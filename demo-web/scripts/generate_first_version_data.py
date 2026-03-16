from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch

from stgcn_runtime import STGCN, cheb_poly, scaled_laplacian


ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = ROOT / "demo-web"
PUBLIC_DATA_DIR = WEB_ROOT / "public" / "data"
PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

GEOMETRY_CONFIG_PATH = PUBLIC_DATA_DIR / "shared-geometry.json"
MODEL_CONFIG_PATH = PUBLIC_DATA_DIR / "model-config.json"

BUCKET_MINUTES = 5
FLOW_RESOLUTION_MINUTES = 60
MIN_TRACK_POINTS = 5
MAX_ROUTE_DISTANCE = 0.015
MOTION_DURATION_MS = 10000
ROUTE_PULL_WEIGHT = 0.25
MAX_NEXT_POINT_MINUTES = 12
MAX_TARGET_DISTANCE_PERCENT = 10.0
DEMO_START = pd.Timestamp("2020-01-01 00:00:00")
DEMO_END = pd.Timestamp("2020-01-03 00:00:00")
SCENARIO_ID = "demo-live"

MODEL_NAME = "STGCN"
MODEL_SETTINGS = {
    "n_his": 24,
    "n_pred": 1,
    "n_route": 60,
    "Ks": 3,
    "Kt": 3,
    "blocks": [[1, 32, 64], [64, 32, 128]],
    "drop_prob": 0.02,
    "train_ratio": 0.6,
    "val_ratio": 0.2,
}
FORECAST_HORIZONS: dict[str, int] = {"1h": 1, "2h": 2, "3h": 3}
HOTSPOT_HIGH_THRESHOLD = 0.78
HOTSPOT_MEDIUM_THRESHOLD = 0.55

GEOMETRY_CONFIG = json.loads(GEOMETRY_CONFIG_PATH.read_text(encoding="utf-8"))
STUDY_BOUNDS = GEOMETRY_CONFIG["meta"]["studyArea"]
ROUTE_IDS: list[str] = list(GEOMETRY_CONFIG["meta"]["routeOrder"])
HOTSPOT_IDS: list[str] = list(GEOMETRY_CONFIG["meta"]["hotspotOrder"])
HOTSPOT_ROUTE_MAP: dict[str, str] = dict(GEOMETRY_CONFIG["routeFocusMap"])
HOTSPOT_NODE_MAP: dict[str, str] = {hotspot_id: str(int(hotspot_id[1:])) for hotspot_id in HOTSPOT_IDS}


@dataclass(frozen=True)
class GeoPoint:
    lon: float
    lat: float


ROUTE_BLUEPRINTS: dict[str, list[GeoPoint]] = {
    route["id"]: [GeoPoint(lon=point["lon"], lat=point["lat"]) for point in route["points"]]
    for route in GEOMETRY_CONFIG["routes"]
}
HOTSPOT_ANCHORS: dict[str, GeoPoint] = {
    hotspot["id"]: GeoPoint(lon=hotspot["point"]["lon"], lat=hotspot["point"]["lat"])
    for hotspot in GEOMETRY_CONFIG["hotspots"]
}

HOTSPOT_NOTES = {
    "G03": "北侧并行航路与主航路入口保持并行，需要持续观察合流节奏。",
    "G25": "南北主航路承担主要通行压力，是当前页面的优先关注热点。",
    "G60": "东侧支路保持边缘补流，重点关注是否再次卷入主航路判断。",
    "G15": "西侧连接路承担补充汇入，需要防止横切干扰回到主航路展示层。",
}


def resolve_path(pattern: str) -> Path:
    matches = sorted(ROOT.rglob(pattern))
    if not matches:
        raise FileNotFoundError(f"Could not find file matching pattern: {pattern}")
    return matches[0]


def resolve_flow_data_path() -> Path:
    matches = sorted(path for path in ROOT.rglob("*.csv") if "grid_mmsi_count" in path.name)
    if not matches:
        raise FileNotFoundError("Could not find grid_mmsi_count source CSV")
    return matches[0]


def format_window_stamp(value: pd.Timestamp) -> str:
    return value.strftime("%Y%m%d-%H%M")


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def geo_to_percent(lon: float, lat: float) -> tuple[float, float]:
    x = ((lon - STUDY_BOUNDS["minLon"]) / (STUDY_BOUNDS["maxLon"] - STUDY_BOUNDS["minLon"])) * 100
    y = ((STUDY_BOUNDS["maxLat"] - lat) / (STUDY_BOUNDS["maxLat"] - STUDY_BOUNDS["minLat"])) * 100
    return round(float(x), 2), round(float(y), 2)


def scaled_point(point: GeoPoint) -> tuple[float, float]:
    lon_scale = math.cos(math.radians((STUDY_BOUNDS["minLat"] + STUDY_BOUNDS["maxLat"]) / 2))
    return point.lon * lon_scale, point.lat


def interpolate_geo(a: GeoPoint, b: GeoPoint, weight: float) -> GeoPoint:
    return GeoPoint(lon=a.lon + (b.lon - a.lon) * weight, lat=a.lat + (b.lat - a.lat) * weight)


def clamp_progress(value: float) -> float:
    return max(0.0, min(1.0, value))


def lerp_point(a: tuple[float, float], b: tuple[float, float], weight: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * weight, a[1] + (b[1] - a[1]) * weight)


def lerp_array(a: np.ndarray, b: np.ndarray, weight: float) -> np.ndarray:
    return a + (b - a) * weight


def distance_percent(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.dist(a, b)


def normalize_vector(dx: float, dy: float) -> tuple[float, float]:
    length = math.hypot(dx, dy)
    if length == 0:
        return 0.0, 0.0
    return dx / length, dy / length


def project_to_route(route_id: str, lon: float, lat: float) -> tuple[float, float, GeoPoint]:
    lon_scale = math.cos(math.radians((STUDY_BOUNDS["minLat"] + STUDY_BOUNDS["maxLat"]) / 2))
    px, py = lon * lon_scale, lat
    points = ROUTE_BLUEPRINTS[route_id]
    coords = [scaled_point(point) for point in points]
    cumulative = 0.0
    total_length = sum(math.dist(coords[index], coords[index + 1]) for index in range(len(coords) - 1)) or 1.0
    best_distance = float("inf")
    best_progress = 0.0
    best_geo = points[0]

    for index in range(len(coords) - 1):
        ax, ay = coords[index]
        bx, by = coords[index + 1]
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        denominator = abx * abx + aby * aby
        weight = 0.0 if denominator == 0 else max(0.0, min(1.0, (apx * abx + apy * aby) / denominator))
        proj_x = ax + abx * weight
        proj_y = ay + aby * weight
        distance = math.dist((px, py), (proj_x, proj_y))
        if distance < best_distance:
            best_distance = distance
            best_progress = (cumulative + math.dist((ax, ay), (proj_x, proj_y))) / total_length
            best_geo = interpolate_geo(points[index], points[index + 1], weight)
        cumulative += math.dist((ax, ay), (bx, by))

    return best_distance, round(best_progress, 4), best_geo


def route_point_at_progress(route_id: str, progress: float) -> GeoPoint:
    points = ROUTE_BLUEPRINTS[route_id]
    coords = [scaled_point(point) for point in points]
    segment_lengths = [math.dist(coords[index], coords[index + 1]) for index in range(len(coords) - 1)]
    total_length = sum(segment_lengths) or 1.0
    target_distance = clamp_progress(progress) * total_length
    travelled = 0.0

    for index, segment_length in enumerate(segment_lengths):
        if travelled + segment_length >= target_distance:
            weight = 0.0 if segment_length == 0 else (target_distance - travelled) / segment_length
            return interpolate_geo(points[index], points[index + 1], weight)
        travelled += segment_length

    return points[-1]


def route_percent_point(route_id: str, progress: float) -> tuple[float, float]:
    point = route_point_at_progress(route_id, progress)
    return geo_to_percent(point.lon, point.lat)


def route_tangent_percent(route_id: str, progress: float) -> tuple[float, float]:
    start_progress = clamp_progress(progress)
    end_progress = clamp_progress(progress + 0.03)
    if abs(end_progress - start_progress) < 0.005:
        start_progress = clamp_progress(progress - 0.03)
        end_progress = clamp_progress(progress)
    start_x, start_y = route_percent_point(route_id, start_progress)
    end_x, end_y = route_percent_point(route_id, end_progress)
    return normalize_vector(end_x - start_x, end_y - start_y)


def rounded_motion_point(x: float, y: float) -> dict[str, float]:
    return {"x": round(float(x), 2), "y": round(float(y), 2)}


def build_motion_payload(
    route_id: str,
    current_percent: tuple[float, float],
    current_time: pd.Timestamp,
    current_progress: float,
    sog: float,
    prev_point: pd.Series | None,
    next_point: pd.Series | None,
) -> dict[str, Any]:
    target_progress = current_progress
    target_time = current_time + pd.Timedelta(minutes=BUCKET_MINUTES)
    target_geo = route_point_at_progress(route_id, clamp_progress(current_progress + max(0.035, min((sog or 6.0) / 120.0, 0.09))))

    if next_point is not None:
        next_percent = geo_to_percent(float(next_point["lon"]), float(next_point["lat"]))
        _, candidate_progress, _ = project_to_route(route_id, float(next_point["lon"]), float(next_point["lat"]))
        minutes_delta = (pd.Timestamp(next_point["time"]) - current_time).total_seconds() / 60
        if minutes_delta <= MAX_NEXT_POINT_MINUTES and distance_percent(current_percent, next_percent) <= MAX_TARGET_DISTANCE_PERCENT:
            target_progress = candidate_progress
            target_time = pd.Timestamp(next_point["time"])
            target_geo = GeoPoint(lon=float(next_point["lon"]), lat=float(next_point["lat"]))

    p0 = current_percent
    p3 = geo_to_percent(target_geo.lon, target_geo.lat)

    if prev_point is not None:
        prev_percent = geo_to_percent(float(prev_point["lon"]), float(prev_point["lat"]))
        start_dir = normalize_vector(p0[0] - prev_percent[0], p0[1] - prev_percent[1])
    else:
        start_dir = route_tangent_percent(route_id, current_progress)

    if next_point is not None and target_time == pd.Timestamp(next_point["time"]):
        end_dir = normalize_vector(p3[0] - p0[0], p3[1] - p0[1])
    else:
        end_dir = route_tangent_percent(route_id, target_progress)

    distance = max(distance_percent(p0, p3), 0.8)
    handle = min(max(distance * 0.28, 1.1), 7.5)
    raw_p1 = (p0[0] + start_dir[0] * handle, p0[1] + start_dir[1] * handle)
    raw_p2 = (p3[0] - end_dir[0] * handle, p3[1] - end_dir[1] * handle)
    route_mid_1 = route_percent_point(route_id, current_progress + (target_progress - current_progress) * 0.35)
    route_mid_2 = route_percent_point(route_id, current_progress + (target_progress - current_progress) * 0.7)
    p1 = lerp_point(raw_p1, route_mid_1, ROUTE_PULL_WEIGHT)
    p2 = lerp_point(raw_p2, route_mid_2, ROUTE_PULL_WEIGHT)

    return {
        "routeProgress": round(float(current_progress), 4),
        "nextRouteProgress": round(float(target_progress), 4),
        "from": {"x": round(float(p0[0]), 2), "y": round(float(p0[1]), 2), "time": current_time.isoformat()},
        "to": {"x": round(float(p3[0]), 2), "y": round(float(p3[1]), 2), "time": target_time.isoformat()},
        "targetHint": {"x": round(float(p3[0]), 2), "y": round(float(p3[1]), 2), "routeId": route_id},
        "motion": {
            "durationMs": MOTION_DURATION_MS,
            "p0": rounded_motion_point(*p0),
            "p1": rounded_motion_point(*p1),
            "p2": rounded_motion_point(*p2),
            "p3": rounded_motion_point(*p3),
        },
    }


def is_focus_area(lon: float, lat: float) -> bool:
    lon_scale = math.cos(math.radians((STUDY_BOUNDS["minLat"] + STUDY_BOUNDS["maxLat"]) / 2))
    px, py = lon * lon_scale, lat
    for anchor in HOTSPOT_ANCHORS.values():
        ax, ay = anchor.lon * lon_scale, anchor.lat
        if math.dist((px, py), (ax, ay)) <= 0.03:
            return True
    return False


def round_float(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def format_metric(value: float, digits: int = 1) -> str:
    return f"{value:.{digits}f}"


def level_from_intensity(intensity: float) -> str:
    if intensity >= HOTSPOT_HIGH_THRESHOLD:
        return "high"
    if intensity >= HOTSPOT_MEDIUM_THRESHOLD:
        return "medium"
    return "watch"


def level_from_values(current_value: float, future_value: float, hotspot_scale_max: float) -> str:
    intensity = 0.0 if hotspot_scale_max <= 0 else max(current_value, future_value) / hotspot_scale_max
    return level_from_intensity(float(intensity))


def load_demo_source() -> tuple[pd.DataFrame, str]:
    source_path = resolve_path("cleaned_ais.CSV")
    df = pd.read_csv(source_path)
    df["time"] = pd.to_datetime(df["time"])
    df = df.dropna(subset=["lon", "lat"])
    df = df[(df["lon"] >= STUDY_BOUNDS["minLon"]) & (df["lon"] <= STUDY_BOUNDS["maxLon"])]
    df = df[(df["lat"] >= STUDY_BOUNDS["minLat"]) & (df["lat"] <= STUDY_BOUNDS["maxLat"])]
    df = df[(df["time"] >= DEMO_START) & (df["time"] <= DEMO_END)]
    if df.empty:
        raise ValueError(f"AIS source does not cover requested demo window {DEMO_START.isoformat()} -> {DEMO_END.isoformat()}")
    df = df.sort_values(["mmsi", "time"]).reset_index(drop=True)
    df["bucketTime"] = df["time"].dt.floor(f"{BUCKET_MINUTES}min")
    source_name = f"demo-live-ais-{format_window_stamp(DEMO_START)}-{format_window_stamp(DEMO_END)}.csv"
    df.to_csv(PUBLIC_DATA_DIR / source_name, index=False, encoding="utf-8")
    return df, source_name


def scene_id(index: int) -> str:
    return f"dl{index}"


def select_demo_routes(df: pd.DataFrame) -> dict[str, str]:
    route_map: dict[str, str] = {}

    for mmsi, vessel_track in df.groupby("mmsi", sort=False):
        if len(vessel_track) < MIN_TRACK_POINTS:
            continue
        medians = {}
        for route_id in ROUTE_IDS:
            distances = [project_to_route(route_id, float(row.lon), float(row.lat))[0] for row in vessel_track.itertuples()]
            medians[route_id] = float(pd.Series(distances).median())
        route_id, distance = min(medians.items(), key=lambda item: item[1])
        if distance <= MAX_ROUTE_DISTANCE:
            route_map[str(int(float(mmsi)))] = route_id

    return route_map


def build_playback_frames(df: pd.DataFrame, selected_routes: dict[str, str], source_name: str) -> dict[str, Any]:
    grouped_trails = {str(int(float(mmsi))): part.reset_index(drop=True) for mmsi, part in df.groupby("mmsi", sort=False)}
    frame_times = pd.date_range(DEMO_START, DEMO_END, freq=f"{BUCKET_MINUTES}min")
    frames: list[dict[str, Any]] = []

    for index, bucket_time in enumerate(frame_times):
        bucket_rows = df[df["bucketTime"] == bucket_time]
        latest_rows = bucket_rows.sort_values("time").groupby("mmsi", as_index=False).tail(1).copy()
        latest_rows["mmsiKey"] = latest_rows["mmsi"].map(lambda value: str(int(float(value))))
        latest_rows = latest_rows[latest_rows["mmsiKey"].isin(selected_routes)]
        if latest_rows.empty:
            frames.append(
                {
                    "id": f"{SCENARIO_ID}_{bucket_time.strftime('%Y-%m-%dT%H:%M')}",
                    "sceneId": scene_id(index),
                    "bucketTime": bucket_time.isoformat(),
                    "displayLabel": bucket_time.strftime("%H:%M"),
                    "activeVesselCount": 0,
                    "vessels": [],
                }
            )
            continue

        vessels: list[dict[str, Any]] = []
        latest_rows = latest_rows.sort_values(["mmsiKey", "time"])

        for _, row in latest_rows.iterrows():
            mmsi_key = row["mmsiKey"]
            route_id = selected_routes[mmsi_key]
            vessel_history = grouped_trails[mmsi_key]
            history = vessel_history[vessel_history["time"] <= row["time"]].tail(4)

            route_distance, route_progress, _ = project_to_route(route_id, float(row["lon"]), float(row["lat"]))
            heading = float(row["head"]) if pd.notna(row["head"]) else float(row["cog"])
            trail = [
                {
                    "lon": round_float(float(item["lon"]), 6),
                    "lat": round_float(float(item["lat"]), 6),
                }
                for _, item in history.iterrows()
            ]

            vessels.append(
                {
                    "mmsi": mmsi_key,
                    "type": str(int(float(row["type"]))) if pd.notna(row["type"]) else "unknown",
                    "time": pd.Timestamp(row["time"]).isoformat(),
                    "lon": round_float(float(row["lon"]), 6),
                    "lat": round_float(float(row["lat"]), 6),
                    "sog": round_float(float(row["sog"])) if pd.notna(row["sog"]) else 0.0,
                    "cog": round_float(float(row["cog"])) if pd.notna(row["cog"]) else 0.0,
                    "head": round_float(float(row["head"])) if pd.notna(row["head"]) else None,
                    "heading": round_float(heading),
                    "routeId": route_id,
                    "routeDistance": round_float(route_distance, 5),
                    "isFocusArea": bool(is_focus_area(float(row["lon"]), float(row["lat"]))),
                    "trail": trail,
                }
            )

        vessels.sort(key=lambda item: (item["routeId"], item.get("routeProgress", 0), item["mmsi"]))
        frames.append(
            {
                "id": f"{SCENARIO_ID}_{bucket_time.strftime('%Y-%m-%dT%H:%M')}",
                "sceneId": scene_id(index),
                "bucketTime": bucket_time.isoformat(),
                "displayLabel": bucket_time.strftime("%H:%M"),
                "activeVesselCount": len(vessels),
                "vessels": vessels,
            }
        )

    return {
        "meta": {
            "source": source_name,
            "windowStart": DEMO_START.isoformat(),
            "windowEnd": DEMO_END.isoformat(),
            "coordinateMode": "geo",
            "bucketMinutes": BUCKET_MINUTES,
            "samplingMode": "track-median-distance-filter",
            "studyArea": STUDY_BOUNDS,
            "routeIds": ROUTE_IDS,
        },
        "frames": frames,
    }


def fit_standard_scaler(values: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = values.mean(axis=0)
    variance = values.var(axis=0)
    scale = np.sqrt(variance)
    scale[scale == 0] = 1.0
    return mean, scale, variance


def transform_with_scaler(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    return (values - mean) / scale


def inverse_transform(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    return values * scale + mean


def load_flow_model_inputs() -> tuple[pd.DataFrame, np.ndarray, Path, Path, Path]:
    flow_data_path = resolve_flow_data_path()
    adjacency_path = resolve_path("相关性矩阵0.csv")
    weight_path = resolve_path("model_0.pt")

    flow_df = pd.read_csv(flow_data_path, index_col=0)
    flow_df.index = pd.to_datetime(flow_df.index)
    flow_df = flow_df.sort_index()

    adjacency_df = pd.read_csv(adjacency_path, index_col=0)
    node_order = [str(column) for column in flow_df.columns]
    adjacency_df.columns = adjacency_df.columns.map(str)
    adjacency_df.index = adjacency_df.index.map(str)
    adjacency = adjacency_df.loc[node_order, node_order].to_numpy(dtype=np.float32)
    return flow_df, adjacency, flow_data_path, adjacency_path, weight_path


def build_model_manifest(
    flow_df: pd.DataFrame,
    adjacency: np.ndarray,
    flow_data_path: Path,
    adjacency_path: Path,
    weight_path: Path,
    scaler_mean: np.ndarray,
    scaler_scale: np.ndarray,
    scaler_variance: np.ndarray,
) -> dict[str, Any]:
    total_length = len(flow_df)
    train_length = int(total_length * MODEL_SETTINGS["train_ratio"])
    val_length = int(total_length * MODEL_SETTINGS["val_ratio"])
    test_length = total_length - train_length - val_length
    return {
        "meta": {
            "version": 1,
            "modelName": MODEL_NAME,
            "generatedBy": "demo-web/scripts/generate_first_version_data.py",
            "flowSeriesSource": str(flow_data_path.relative_to(ROOT)).replace("\\", "/"),
            "graphSource": str(adjacency_path.relative_to(ROOT)).replace("\\", "/"),
            "weightSource": str(weight_path.relative_to(ROOT)).replace("\\", "/"),
            "weightSha256": hash_file(weight_path),
            "flowResolutionMinutes": FLOW_RESOLUTION_MINUTES,
            "playbackResolutionMinutes": BUCKET_MINUTES,
            "windowStart": DEMO_START.isoformat(),
            "windowEnd": DEMO_END.isoformat(),
            "warmStartMode": "left-pad-earliest-hour-to-24-history",
        },
        "architecture": {
            "n_his": MODEL_SETTINGS["n_his"],
            "n_pred": MODEL_SETTINGS["n_pred"],
            "n_route": MODEL_SETTINGS["n_route"],
            "Ks": MODEL_SETTINGS["Ks"],
            "Kt": MODEL_SETTINGS["Kt"],
            "blocks": MODEL_SETTINGS["blocks"],
            "dropProb": MODEL_SETTINGS["drop_prob"],
        },
        "split": {
            "trainRatio": MODEL_SETTINGS["train_ratio"],
            "valRatio": MODEL_SETTINGS["val_ratio"],
            "testRatio": round(test_length / total_length, 6),
            "trainLength": train_length,
            "valLength": val_length,
            "testLength": test_length,
        },
        "nodeOrder": [str(column) for column in flow_df.columns],
        "graph": {
            "adjacency": np.round(adjacency, 6).tolist(),
        },
        "scaler": {
            "type": "standard",
            "mean": np.round(scaler_mean, 6).tolist(),
            "scale": np.round(scaler_scale, 6).tolist(),
            "variance": np.round(scaler_variance, 6).tolist(),
        },
        "forecastHorizons": FORECAST_HORIZONS,
        "hotspotNodeMap": HOTSPOT_NODE_MAP,
        "routeFocusMap": HOTSPOT_ROUTE_MAP,
    }


def load_stgcn_model(adjacency: np.ndarray, weight_path: Path) -> STGCN:
    laplacian = scaled_laplacian(adjacency)
    chebyshev_tensor = torch.tensor(cheb_poly(laplacian, MODEL_SETTINGS["Ks"]), dtype=torch.float32)
    model = STGCN(
        order=MODEL_SETTINGS["Ks"],
        kernel_size=MODEL_SETTINGS["Kt"],
        blocks=MODEL_SETTINGS["blocks"],
        history_steps=MODEL_SETTINGS["n_his"],
        node_count=MODEL_SETTINGS["n_route"],
        chebyshev_tensor=chebyshev_tensor,
        dropout=MODEL_SETTINGS["drop_prob"],
    )
    state_dict = torch.load(weight_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()
    return model


def recursive_forecast(
    model: STGCN,
    scaled_series: np.ndarray,
    anchor_index: int,
    scaler_mean: np.ndarray,
    scaler_scale: np.ndarray,
) -> dict[str, np.ndarray]:
    start_index = anchor_index - MODEL_SETTINGS["n_his"] + 1
    history_window = scaled_series[max(0, start_index) : anchor_index + 1].copy()
    if history_window.shape[0] < MODEL_SETTINGS["n_his"]:
        pad_rows = np.repeat(scaled_series[[0]], MODEL_SETTINGS["n_his"] - history_window.shape[0], axis=0)
        history_window = np.vstack([pad_rows, history_window])

    predictions: dict[str, np.ndarray] = {}
    horizon_by_step = {step: horizon for horizon, step in FORECAST_HORIZONS.items()}
    for step in range(1, max(FORECAST_HORIZONS.values()) + 1):
        model_input = torch.tensor(history_window[np.newaxis, np.newaxis, :, :], dtype=torch.float32)
        with torch.no_grad():
            predicted_scaled = model(model_input).view(-1).cpu().numpy()
        history_window = np.vstack([history_window[1:], predicted_scaled])
        predicted = np.maximum(inverse_transform(predicted_scaled, scaler_mean, scaler_scale), 0.0)
        if step in horizon_by_step:
            predictions[horizon_by_step[step]] = predicted
    return predictions


def build_hourly_forecast_anchors(
    flow_df: pd.DataFrame,
    model: STGCN,
    scaler_mean: np.ndarray,
    scaler_scale: np.ndarray,
) -> list[dict[str, Any]]:
    scaled_values = transform_with_scaler(flow_df.to_numpy(dtype=np.float32), scaler_mean, scaler_scale)
    anchor_times = pd.date_range(DEMO_START.floor("h"), DEMO_END.floor("h"), freq="1h")

    anchors: list[dict[str, Any]] = []
    for anchor_time in anchor_times:
        if anchor_time not in flow_df.index:
            raise KeyError(f"Missing hourly flow record for {anchor_time.isoformat()}")
        anchor_index = int(flow_df.index.get_loc(anchor_time))
        anchors.append(
            {
                "time": anchor_time,
                "current": flow_df.loc[anchor_time].to_numpy(dtype=np.float32),
                "forecast": recursive_forecast(model, scaled_values, anchor_index, scaler_mean, scaler_scale),
            }
        )
    return anchors


def interpolate_anchor_array(anchors: list[dict[str, Any]], anchor_lookup: dict[pd.Timestamp, int], bucket_time: pd.Timestamp, key: str) -> np.ndarray:
    floor_hour = bucket_time.floor("h")
    ceil_hour = min(floor_hour + pd.Timedelta(hours=1), anchors[-1]["time"])
    start_index = anchor_lookup[floor_hour]
    end_index = anchor_lookup[ceil_hour]
    if start_index == end_index:
        return anchors[start_index][key]
    weight = (bucket_time - floor_hour).total_seconds() / (FLOW_RESOLUTION_MINUTES * 60)
    return lerp_array(anchors[start_index][key], anchors[end_index][key], weight)


def interpolate_forecast_array(
    anchors: list[dict[str, Any]],
    anchor_lookup: dict[pd.Timestamp, int],
    bucket_time: pd.Timestamp,
    horizon: str,
) -> np.ndarray:
    floor_hour = bucket_time.floor("h")
    ceil_hour = min(floor_hour + pd.Timedelta(hours=1), anchors[-1]["time"])
    start_index = anchor_lookup[floor_hour]
    end_index = anchor_lookup[ceil_hour]
    if start_index == end_index:
        return anchors[start_index]["forecast"][horizon]
    weight = (bucket_time - floor_hour).total_seconds() / (FLOW_RESOLUTION_MINUTES * 60)
    return lerp_array(anchors[start_index]["forecast"][horizon], anchors[end_index]["forecast"][horizon], weight)


def build_recommendations(
    focus_grid: str,
    focus_route: str,
    second_grid: str,
    second_route: str,
    focus_current: float,
    focus_future: float,
) -> list[dict[str, str]]:
    trend_text = "抬升" if focus_future >= focus_current else "回落"
    return [
        {
            "target": f"{focus_route} 主航路",
            "action": "保持优先观察并控制汇入节奏",
            "reason": f"{focus_grid} 在 1h 预测中继续{trend_text}，需要把焦点通道从普通回放提升到重点观察。",
            "effect": "页面右侧策略卡与焦点看板会围绕该航路持续更新。",
        },
        {
            "target": f"{second_route} 邻近通道",
            "action": "限制横切干扰并维持并行关系",
            "reason": f"{second_grid} 是第二关注热点，容易与焦点通道形成叠加压力。",
            "effect": "主航路与邻近通道的叙事不再脱节，热点分布更加稳定。",
        },
        {
            "target": "AIS + 热点联动",
            "action": "同步查看地图热点、右侧策略和底部时间轴",
            "reason": "当前页面已经改成按真实时间轴驱动，适合联动核对回放与预测。",
            "effect": "避免再落回静态八场景兜底，整页叙事保持一致。",
        },
    ]


def build_applied_alerts(alerts: list[dict[str, Any]], focus_grid: str, hotspot_scale_max: float) -> list[dict[str, Any]]:
    applied_alerts: list[dict[str, Any]] = []
    for alert in alerts:
        is_focus = alert["grid"] == focus_grid
        current_factor = 0.84 if is_focus else 0.9 if alert["level"] != "watch" else 0.95
        future_factor = 0.68 if is_focus else 0.82 if alert["level"] != "watch" else 0.9
        next_current = round_float(alert["current"] * current_factor)
        next_future = round_float(alert["future"] * future_factor)
        applied_alerts.append(
            {
                **alert,
                "current": next_current,
                "future": next_future,
                "level": level_from_values(next_current, next_future, hotspot_scale_max),
                "note": "协同策略假设已施加到焦点通道，用于演示策略应用后的页面联动结果。",
            }
        )
    return applied_alerts


def build_benefits(
    current_total: float,
    future_total: float,
    focus_future: float,
    applied_focus_future: float,
    alerts: list[dict[str, Any]],
    applied_alerts: list[dict[str, Any]],
) -> list[dict[str, str]]:
    hotspot_count_before = sum(1 for alert in alerts if alert["level"] != "watch")
    hotspot_count_after = sum(1 for alert in applied_alerts if alert["level"] != "watch")
    applied_future_total = current_total + (future_total - current_total) * 0.78
    load_before = 0.0 if future_total <= 0 else (focus_future / future_total) * 100
    load_after = 0.0 if applied_future_total <= 0 else (applied_focus_future / applied_future_total) * 100
    return [
        {
            "label": "焦点网格压力",
            "before": format_metric(focus_future),
            "after": format_metric(applied_focus_future),
        },
        {
            "label": "高压热点数量",
            "before": str(hotspot_count_before),
            "after": str(hotspot_count_after),
        },
        {
            "label": "总流量增量",
            "before": format_metric(future_total - current_total),
            "after": format_metric(applied_future_total - current_total),
        },
        {
            "label": "主航路负载率",
            "before": format_metric(load_before, 0),
            "after": format_metric(load_after, 0),
            "unit": "%",
        },
    ]


def build_narrative(
    bucket_time: pd.Timestamp,
    visible_vessels: int,
    current_total: float,
    future_total: float,
    focus_grid: str,
    focus_route: str,
    second_grid: str,
    second_route: str,
    hotspot_count: int,
    alerts: list[dict[str, Any]],
    applied_alerts: list[dict[str, Any]],
) -> dict[str, Any]:
    focus_alert = next(alert for alert in alerts if alert["grid"] == focus_grid)
    focus_delta = focus_alert["future"] - focus_alert["current"]
    total_delta = future_total - current_total
    time_label = bucket_time.strftime("%Y-%m-%d %H:%M")

    if focus_delta >= 6 and hotspot_count >= 3:
        phase = "多热点抬升"
    elif focus_delta >= 6:
        phase = "焦点抬升"
    elif total_delta <= -12:
        phase = "流量回落"
    elif hotspot_count == 0:
        phase = "低压巡检"
    else:
        phase = "稳定观察"

    if focus_delta >= 6:
        status = f"{focus_grid} 在未来 1 小时继续抬升，建议优先观察 {focus_route}。"
    elif focus_delta <= -6:
        status = f"{focus_grid} 在未来 1 小时回落，可维持 {focus_route} 的稳定放行。"
    else:
        status = f"{focus_grid} 保持 {focus_alert['level']} 级监视，页面继续跟随真实时间轴更新。"

    summary = (
        f"{time_label} 的历史 AIS 回放窗口内可见 {visible_vessels} 艘船舶，"
        f"当前总流量 {format_metric(current_total)}，1 小时后预测 {format_metric(future_total)}。"
        f" 焦点网格为 {focus_grid}，对应航路 {focus_route}。"
    )

    strategy_headline = f"{focus_route} 焦点通道预控" if focus_delta >= 0 else f"{focus_route} 稳态维持"
    strategy_summary = (
        f"将 {focus_grid} 作为当前帧的焦点热点，联合观察 {focus_route} 与 {second_route}，"
        f"把 AIS 回放、热点强度和右侧推荐文案保持在同一条时间线上。"
    )

    applied_focus_alert = next(alert for alert in applied_alerts if alert["grid"] == focus_grid)
    benefits = build_benefits(current_total, future_total, focus_alert["future"], applied_focus_alert["future"], alerts, applied_alerts)

    logs = [
        f"{time_label} 历史 AIS 回放已对齐，当前帧保留 {visible_vessels} 艘可见船舶。",
        f"{time_label} 离线 STGCN 使用 24 小时历史窗口，对 {focus_grid} 给出 1h 预测 {format_metric(focus_alert['future'])}。",
        f"{time_label} 第二热点 {second_grid} 仍由 {second_route} 承担观察压力，需要联动关注。",
        f"{time_label} 页面 narrative 已直接来自离线推理，不再映射静态八场景种子。",
    ]

    return {
        "phase": phase,
        "status": status,
        "summary": summary,
        "logs": logs,
        "strategy": {
            "headline": strategy_headline,
            "summary": strategy_summary,
        },
        "recommendations": build_recommendations(
            focus_grid=focus_grid,
            focus_route=focus_route,
            second_grid=second_grid,
            second_route=second_route,
            focus_current=focus_alert["current"],
            focus_future=focus_alert["future"],
        ),
        "benefits": benefits,
        "appliedState": {
            "status": "协同策略已加载",
            "summary": (
                f"若对 {focus_route} 执行演示版协同策略，{focus_grid} 的 1h 预测压力将从 "
                f"{format_metric(focus_alert['future'])} 降到 {format_metric(applied_focus_alert['future'])}。"
            ),
            "hotspotScale": 0.22 if hotspot_count >= 3 else 0.32,
            "focusGrid": focus_grid,
            "focusRoute": focus_route,
            "alerts": applied_alerts,
        },
    }


def build_flow_forecast(
    ais_playback: dict[str, Any],
    hourly_anchors: list[dict[str, Any]],
    flow_df: pd.DataFrame,
    source_name: str,
    model_manifest: dict[str, Any],
) -> dict[str, Any]:
    anchor_lookup = {anchor["time"]: index for index, anchor in enumerate(hourly_anchors)}
    node_order = [str(column) for column in flow_df.columns]
    node_index_map = {node_id: index for index, node_id in enumerate(node_order)}
    hotspot_scale_max = max(
        max(float(anchor["current"][node_index_map[HOTSPOT_NODE_MAP[hotspot_id]]]) for hotspot_id in HOTSPOT_IDS)
        for anchor in hourly_anchors
    )
    for anchor in hourly_anchors:
        for horizon in FORECAST_HORIZONS:
            hotspot_scale_max = max(
                hotspot_scale_max,
                max(float(anchor["forecast"][horizon][node_index_map[HOTSPOT_NODE_MAP[hotspot_id]]]) for hotspot_id in HOTSPOT_IDS),
            )

    total_flow_series: list[float] = []
    forecast_totals: dict[str, list[float]] = {horizon: [] for horizon in FORECAST_HORIZONS}
    hotspot_series: dict[str, list[float]] = {hotspot_id: [] for hotspot_id in HOTSPOT_IDS}
    timeline: list[dict[str, Any]] = []

    for frame in ais_playback["frames"]:
        bucket_time = pd.Timestamp(frame["bucketTime"])
        current_nodes = interpolate_anchor_array(hourly_anchors, anchor_lookup, bucket_time, "current")
        forecast_nodes = {
            horizon: interpolate_forecast_array(hourly_anchors, anchor_lookup, bucket_time, horizon)
            for horizon in FORECAST_HORIZONS
        }

        current_key_grids = {
            hotspot_id: round_float(current_nodes[node_index_map[HOTSPOT_NODE_MAP[hotspot_id]]])
            for hotspot_id in HOTSPOT_IDS
        }
        forecast_key_grids = {
            horizon: {
                hotspot_id: round_float(values[node_index_map[HOTSPOT_NODE_MAP[hotspot_id]]])
                for hotspot_id in HOTSPOT_IDS
            }
            for horizon, values in forecast_nodes.items()
        }

        hotspot_payload = []
        for hotspot_id in HOTSPOT_IDS:
            intensity = 0.0 if hotspot_scale_max <= 0 else max(current_key_grids[hotspot_id], forecast_key_grids["1h"][hotspot_id]) / hotspot_scale_max
            hotspot_payload.append(
                {
                    "id": hotspot_id,
                    "intensity": round_float(intensity, 4),
                    "level": level_from_intensity(float(intensity)),
                }
            )
        hotspot_payload.sort(key=lambda item: (item["intensity"], item["id"]), reverse=True)

        focus_grid = hotspot_payload[0]["id"]
        focus_route = HOTSPOT_ROUTE_MAP[focus_grid]
        second_grid = hotspot_payload[1]["id"] if len(hotspot_payload) > 1 else focus_grid
        second_route = HOTSPOT_ROUTE_MAP[second_grid]

        alerts = [
            {
                "grid": hotspot_id,
                "level": level_from_values(current_key_grids[hotspot_id], forecast_key_grids["1h"][hotspot_id], hotspot_scale_max),
                "current": current_key_grids[hotspot_id],
                "future": forecast_key_grids["1h"][hotspot_id],
                "note": HOTSPOT_NOTES[hotspot_id],
            }
            for hotspot_id in HOTSPOT_IDS
        ]
        applied_alerts = build_applied_alerts(alerts, focus_grid, hotspot_scale_max)

        current_total = round_float(float(np.sum(current_nodes)))
        forecast_total_by_horizon = {horizon: round_float(float(np.sum(values))) for horizon, values in forecast_nodes.items()}

        narrative = build_narrative(
            bucket_time=bucket_time,
            visible_vessels=frame["activeVesselCount"],
            current_total=current_total,
            future_total=forecast_total_by_horizon["1h"],
            focus_grid=focus_grid,
            focus_route=focus_route,
            second_grid=second_grid,
            second_route=second_route,
            hotspot_count=sum(1 for item in hotspot_payload if item["level"] != "watch"),
            alerts=alerts,
            applied_alerts=applied_alerts,
        )

        total_flow_series.append(current_total)
        for horizon, value in forecast_total_by_horizon.items():
            forecast_totals[horizon].append(value)
        for hotspot_id, value in current_key_grids.items():
            hotspot_series[hotspot_id].append(value)

        timeline.append(
            {
                "sceneId": frame["sceneId"],
                "time": bucket_time.isoformat(),
                "current": {
                    "totalFlow": current_total,
                    "visibleVessels": frame["activeVesselCount"],
                    "keyGrids": current_key_grids,
                },
                "forecast": {
                    horizon: {
                        "totalFlow": forecast_total_by_horizon[horizon],
                        "keyGrids": forecast_key_grids[horizon],
                    }
                    for horizon in FORECAST_HORIZONS
                },
                "derived": {
                    "focusGrid": focus_grid,
                    "focusRoute": focus_route,
                    "hotspotCount": sum(1 for item in hotspot_payload if item["level"] != "watch"),
                    "hotspots": hotspot_payload,
                    "alerts": alerts,
                },
                "narrative": narrative,
            }
        )

    return {
        "meta": {
            "source": source_name,
            "model": MODEL_NAME,
            "modelConfigPath": "data/model-config.json",
            "weightSource": model_manifest["meta"]["weightSource"],
            "weightSha256": model_manifest["meta"]["weightSha256"],
            "historyWindowHours": MODEL_SETTINGS["n_his"],
            "horizons": list(FORECAST_HORIZONS.keys()),
            "hotspotIds": HOTSPOT_IDS,
            "routeFocusMap": HOTSPOT_ROUTE_MAP,
            "forecastMode": "offline-stgcn-recursive",
            "inferenceResolutionMinutes": FLOW_RESOLUTION_MINUTES,
            "playbackResolutionMinutes": BUCKET_MINUTES,
            "interpolationMode": "linear-between-hourly-inference-anchors",
            "windowStart": DEMO_START.isoformat(),
            "windowEnd": DEMO_END.isoformat(),
            "narrativeMode": "model-driven-per-frame",
            "notice": "船舶轨迹来自历史 AIS 回放，预测来自离线 STGCN 小时级推理并线性映射到 5 分钟回放时间轴。当前页面仍是演示版，不是生产业务系统。",
        },
        "series": {
            "totalFlow": total_flow_series,
            "forecastTotals": forecast_totals,
            "hotspots": hotspot_series,
        },
        "timeline": timeline,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    demo_df, source_name = load_demo_source()
    selected_routes = select_demo_routes(demo_df)
    ais_playback = build_playback_frames(demo_df, selected_routes, source_name)

    flow_df, adjacency, flow_data_path, adjacency_path, weight_path = load_flow_model_inputs()
    train_length = int(len(flow_df) * MODEL_SETTINGS["train_ratio"])
    scaler_mean, scaler_scale, scaler_variance = fit_standard_scaler(flow_df.iloc[:train_length].to_numpy(dtype=np.float32))
    model_manifest = build_model_manifest(flow_df, adjacency, flow_data_path, adjacency_path, weight_path, scaler_mean, scaler_scale, scaler_variance)
    model = load_stgcn_model(adjacency, weight_path)
    hourly_anchors = build_hourly_forecast_anchors(flow_df, model, scaler_mean, scaler_scale)
    flow_forecast = build_flow_forecast(ais_playback, hourly_anchors, flow_df, source_name, model_manifest)

    write_json(MODEL_CONFIG_PATH, model_manifest)
    write_json(PUBLIC_DATA_DIR / "ais-playback.json", ais_playback)
    write_json(PUBLIC_DATA_DIR / "flow-forecast.json", flow_forecast)

    print(f"Demo window: {DEMO_START.isoformat()} -> {DEMO_END.isoformat()}")
    print(f"Wrote {(PUBLIC_DATA_DIR / source_name).relative_to(ROOT)}")
    print(f"Wrote {MODEL_CONFIG_PATH.relative_to(ROOT)}")
    print(f"Wrote {(PUBLIC_DATA_DIR / 'ais-playback.json').relative_to(ROOT)}")
    print(f"Wrote {(PUBLIC_DATA_DIR / 'flow-forecast.json').relative_to(ROOT)}")
    print(f"Selected vessel tracks: {len(selected_routes)}")
    print(f"Model weights: {weight_path.relative_to(ROOT)}")
    print(f"Weight sha256: {model_manifest['meta']['weightSha256']}")


if __name__ == "__main__":
    main()
