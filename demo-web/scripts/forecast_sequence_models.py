from __future__ import annotations

import copy
import hashlib
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.preprocessing import StandardScaler


FORECAST_HORIZONS: dict[str, int] = {"1h": 1, "2h": 2, "3h": 3}
FLOW_RESOLUTION_MINUTES = 60
PLAYBACK_RESOLUTION_MINUTES = 5
HOTSPOT_HIGH_THRESHOLD = 0.78
HOTSPOT_MEDIUM_THRESHOLD = 0.55
SEED = 2021
MODEL_SETTINGS = {
    "n_his": 24,
    "n_pred": 1,
    "hidden_dim": 64,
    "num_layers": 2,
    "num_epochs": 50,
    "learning_rate": 0.001,
    "batch_size": 50,
}


class LSTMPredictor(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, num_layers: int, output_dim: int):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_dim, output_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim, device=x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim, device=x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = out[:, -1, :]
        return self.fc(out)


class BiLSTMPredictor(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, num_layers: int, output_dim: int):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.bilstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, bidirectional=True)
        self.fc = nn.Linear(hidden_dim * 2, output_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h0 = torch.zeros(self.num_layers * 2, x.size(0), self.hidden_dim, device=x.device)
        c0 = torch.zeros(self.num_layers * 2, x.size(0), self.hidden_dim, device=x.device)
        out, _ = self.bilstm(x, (h0, c0))
        out = out[:, -1, :]
        return self.fc(out)


@dataclass(frozen=True)
class SequenceModelArtifact:
    model: str
    runtime_file: str
    config_file: str
    weight_file: str
    weight_path: Path
    weight_sha256: str
    runtime: dict[str, Any]
    model_config: dict[str, Any]


MODEL_SPECS = {
    "LSTM": {
        "runtime_file": "forecast-lstm-runtime.json",
        "config_file": "forecast-lstm-model-config.json",
        "weight_file": "forecast-lstm-model.pt",
        "model_family": "lstm",
        "forecast_mode": "offline-lstm-recursive",
        "bidirectional": False,
        "builder": LSTMPredictor,
    },
    "BiLSTM": {
        "runtime_file": "forecast-bilstm-runtime.json",
        "config_file": "forecast-bilstm-model-config.json",
        "weight_file": "forecast-bilstm-model.pt",
        "model_family": "bilstm",
        "forecast_mode": "offline-bilstm-recursive",
        "bidirectional": True,
        "builder": BiLSTMPredictor,
    },
}


def round_float(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def format_metric(value: float, digits: int = 1) -> str:
    return f"{value:.{digits}f}"


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def set_reproducible(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def split_lengths(total_length: int) -> tuple[int, int, int]:
    train_length = int(total_length * 0.6)
    val_length = int(total_length * 0.2)
    test_length = total_length - train_length - val_length
    return train_length, val_length, test_length


def data_transform_noday(data: np.ndarray, n_his: int, n_pred: int) -> tuple[np.ndarray, np.ndarray]:
    num_samples = len(data) - n_his - n_pred + 1
    n_route = data.shape[1]
    x = np.zeros((num_samples, n_his, n_route), dtype=np.float32)
    y = np.zeros((num_samples, n_route), dtype=np.float32)
    for index in range(num_samples):
        end_index = index + n_his
        x[index] = data[index:end_index]
        y[index] = data[end_index + n_pred - 1]
    return x, y


def build_data_loaders(
    train_x: np.ndarray,
    train_y: np.ndarray,
    val_x: np.ndarray,
    val_y: np.ndarray,
    batch_size: int,
) -> tuple[torch.utils.data.DataLoader, torch.utils.data.DataLoader]:
    generator = torch.Generator()
    generator.manual_seed(SEED)
    train_dataset = torch.utils.data.TensorDataset(torch.from_numpy(train_x), torch.from_numpy(train_y))
    val_dataset = torch.utils.data.TensorDataset(torch.from_numpy(val_x), torch.from_numpy(val_y))
    loader_kwargs = {"batch_size": batch_size, "pin_memory": torch.cuda.is_available()}
    train_loader = torch.utils.data.DataLoader(train_dataset, shuffle=True, generator=generator, **loader_kwargs)
    val_loader = torch.utils.data.DataLoader(val_dataset, shuffle=False, **loader_kwargs)
    return train_loader, val_loader


def evaluate_model(model: nn.Module, criterion: nn.Module, data_loader: torch.utils.data.DataLoader, device: torch.device) -> float:
    model.eval()
    total_loss = 0.0
    count = 0
    with torch.no_grad():
        for x_batch, y_batch in data_loader:
            x_batch = x_batch.to(device, non_blocking=True)
            y_batch = y_batch.to(device, non_blocking=True)
            outputs = model(x_batch)
            loss = criterion(outputs, y_batch)
            total_loss += loss.item() * y_batch.size(0)
            count += y_batch.size(0)
    return total_loss / max(1, count)


def train_model(
    model: nn.Module,
    train_loader: torch.utils.data.DataLoader,
    val_loader: torch.utils.data.DataLoader,
    device: torch.device,
) -> nn.Module:
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=MODEL_SETTINGS["learning_rate"])
    best_val_loss = float("inf")
    best_state: dict[str, torch.Tensor] | None = None

    for _epoch in range(MODEL_SETTINGS["num_epochs"]):
        model.train()
        for x_batch, y_batch in train_loader:
            x_batch = x_batch.to(device, non_blocking=True)
            y_batch = y_batch.to(device, non_blocking=True)
            optimizer.zero_grad()
            outputs = model(x_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            optimizer.step()

        val_loss = evaluate_model(model, criterion, val_loader, device)
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = copy.deepcopy(model.state_dict())

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()
    return model


def inverse_transform(values: np.ndarray, scaler: StandardScaler) -> np.ndarray:
    return scaler.inverse_transform(values)


def recursive_forecast(
    model: nn.Module,
    scaled_series: np.ndarray,
    anchor_index: int,
    scaler: StandardScaler,
    device: torch.device,
) -> dict[str, np.ndarray]:
    start_index = anchor_index - MODEL_SETTINGS["n_his"] + 1
    history_window = scaled_series[max(0, start_index) : anchor_index + 1].copy()
    if history_window.shape[0] < MODEL_SETTINGS["n_his"]:
        pad_rows = np.repeat(scaled_series[[0]], MODEL_SETTINGS["n_his"] - history_window.shape[0], axis=0)
        history_window = np.vstack([pad_rows, history_window])

    predictions: dict[str, np.ndarray] = {}
    horizon_by_step = {step: horizon for horizon, step in FORECAST_HORIZONS.items()}

    for step in range(1, max(FORECAST_HORIZONS.values()) + 1):
        model_input = torch.tensor(history_window[np.newaxis, :, :], dtype=torch.float32, device=device)
        with torch.no_grad():
            predicted_scaled = model(model_input).view(-1).detach().cpu().numpy()
        history_window = np.vstack([history_window[1:], predicted_scaled])
        predicted = np.maximum(inverse_transform(predicted_scaled.reshape(1, -1), scaler).reshape(-1), 0.0)
        if step in horizon_by_step:
            predictions[horizon_by_step[step]] = predicted

    return predictions


def interpolate_array(a: np.ndarray, b: np.ndarray, weight: float) -> np.ndarray:
    return a + (b - a) * weight


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
    return interpolate_array(anchors[start_index]["forecast"][horizon], anchors[end_index]["forecast"][horizon], weight)


def level_from_intensity(intensity: float) -> str:
    if intensity >= HOTSPOT_HIGH_THRESHOLD:
        return "high"
    if intensity >= HOTSPOT_MEDIUM_THRESHOLD:
        return "medium"
    return "watch"


def level_from_values(current_value: float, future_value: float, hotspot_scale_max: float) -> str:
    intensity = 0.0 if hotspot_scale_max <= 0 else max(current_value, future_value) / hotspot_scale_max
    return level_from_intensity(float(intensity))


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
                "note": "Applied-state values illustrate a coordinated response pass for the current focus route.",
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
            "label": "Focus-grid pressure",
            "before": format_metric(focus_future),
            "after": format_metric(applied_focus_future),
        },
        {
            "label": "Elevated hotspots",
            "before": str(hotspot_count_before),
            "after": str(hotspot_count_after),
        },
        {
            "label": "Total-flow delta",
            "before": format_metric(future_total - current_total),
            "after": format_metric(applied_future_total - current_total),
        },
        {
            "label": "Focus-route load share",
            "before": format_metric(load_before, 0),
            "after": format_metric(load_after, 0),
            "unit": "%",
        },
    ]


def build_narrative(
    *,
    model_name: str,
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
    applied_focus_alert = next(alert for alert in applied_alerts if alert["grid"] == focus_grid)
    focus_delta = focus_alert["future"] - focus_alert["current"]
    total_delta = future_total - current_total
    time_label = bucket_time.strftime("%Y-%m-%d %H:%M")

    if focus_delta >= 8 and hotspot_count >= 3:
        phase = "Escalating hotspot cluster"
    elif focus_delta >= 8:
        phase = "Rising focus channel"
    elif total_delta <= -12:
        phase = "Cooling traffic window"
    elif hotspot_count == 0:
        phase = "Low-pressure monitoring"
    else:
        phase = "Stable monitoring"

    if focus_delta >= 8:
        status = f"{model_name} highlights {focus_grid} / {focus_route} as the leading 1h pressure point."
    elif focus_delta <= -8:
        status = f"{model_name} shows {focus_grid} easing over the next hour while {focus_route} stays in view."
    else:
        status = f"{model_name} keeps {focus_grid} under active watch without a sharp regime change."

    summary = (
        f"{time_label} replay frame: {visible_vessels} vessels visible, current total flow {format_metric(current_total)}, "
        f"and {model_name} projects {format_metric(future_total)} for the 1h horizon. Focus grid {focus_grid} maps to route {focus_route}."
    )

    strategy_summary = (
        f"Prioritize {focus_grid} on {focus_route}, keep {second_grid} / {second_route} in secondary watch, "
        f"and keep the chart, alert table, and evidence drawer aligned to the {model_name} run."
    )

    benefits = build_benefits(current_total, future_total, focus_alert["future"], applied_focus_alert["future"], alerts, applied_alerts)

    return {
        "phase": phase,
        "status": status,
        "summary": summary,
        "logs": [
            f"{time_label}: archived replay remains the common scene clock for all forecast models.",
            f"{time_label}: {model_name} uses a {MODEL_SETTINGS['n_his']}h history window and recursive hourly rollout.",
            f"{time_label}: secondary hotspot {second_grid} on {second_route} remains the next context check.",
        ],
        "strategy": {
            "headline": f"{focus_route} focus-route check",
            "summary": strategy_summary,
        },
        "recommendations": [
            {
                "target": focus_route,
                "action": "Prioritize the focus route in the operator readout.",
                "reason": f"{focus_grid} carries the strongest 1h hotspot signal in the current {model_name} run.",
                "effect": "The focus bridge and alert list remain aligned with the most relevant route.",
            },
            {
                "target": second_route,
                "action": "Keep the secondary route under cross-check.",
                "reason": f"{second_grid} is the next-most active hotspot and can compound congestion if it rises with {focus_grid}.",
                "effect": "Operators retain a fallback narrative instead of overfitting to one hotspot only.",
            },
            {
                "target": "Evidence drawer",
                "action": "Cross-check metrics and architecture notes against the active model.",
                "reason": "The cockpit now exposes model-specific runtime and evidence instead of a deferred placeholder.",
                "effect": "Model switching remains honest across summary, chart, and evidence layers.",
            },
        ],
        "benefits": benefits,
        "appliedState": {
            "status": "Applied-state preview ready",
            "summary": (
                f"If the focus-route response is applied, {focus_grid} drops from {format_metric(focus_alert['future'])} "
                f"to {format_metric(applied_focus_alert['future'])} on the 1h forecast."
            ),
            "hotspotScale": 0.22 if hotspot_count >= 3 else 0.32,
            "focusGrid": focus_grid,
            "focusRoute": focus_route,
            "alerts": applied_alerts,
        },
    }


def build_sequence_model_config(
    *,
    base_model_config: dict[str, Any],
    model_name: str,
    model_family: str,
    bidirectional: bool,
    flow_source_rel: str,
    generated_by: str,
    weight_source_rel: str,
    weight_sha256: str,
    scaler: StandardScaler,
    flow_df: pd.DataFrame,
    base_runtime: dict[str, Any],
) -> dict[str, Any]:
    config = copy.deepcopy(base_model_config)
    train_length, val_length, test_length = split_lengths(len(flow_df))
    config["meta"] = {
        "version": int(config.get("meta", {}).get("version", 1)),
        "modelName": model_name,
        "generatedBy": generated_by,
        "flowSeriesSource": flow_source_rel,
        "graphSource": str(base_model_config.get("meta", {}).get("graphSource", "")),
        "weightSource": weight_source_rel,
        "weightSha256": weight_sha256,
        "flowResolutionMinutes": FLOW_RESOLUTION_MINUTES,
        "playbackResolutionMinutes": PLAYBACK_RESOLUTION_MINUTES,
        "windowStart": str(base_runtime["meta"]["windowStart"]),
        "windowEnd": str(base_runtime["meta"]["windowEnd"]),
        "warmStartMode": str(base_model_config.get("meta", {}).get("warmStartMode", "left-pad-earliest-hour-to-24-history")),
    }
    config["architecture"] = {
        "modelFamily": model_family,
        "n_his": MODEL_SETTINGS["n_his"],
        "n_pred": MODEL_SETTINGS["n_pred"],
        "n_route": len(flow_df.columns),
        "inputDim": len(flow_df.columns),
        "hiddenDim": MODEL_SETTINGS["hidden_dim"],
        "numLayers": MODEL_SETTINGS["num_layers"],
        "bidirectional": bidirectional,
    }
    config["split"] = {
        "trainRatio": round_float(train_length / len(flow_df), 6),
        "valRatio": round_float(val_length / len(flow_df), 6),
        "testRatio": round_float(test_length / len(flow_df), 6),
        "trainLength": train_length,
        "valLength": val_length,
        "testLength": test_length,
    }
    config["scaler"] = {
        "type": "standard",
        "mean": [round_float(value, 6) for value in np.asarray(scaler.mean_, dtype=float)],
        "scale": [round_float(value, 6) for value in np.asarray(scaler.scale_, dtype=float)],
        "variance": [round_float(value, 6) for value in np.asarray(scaler.var_, dtype=float)],
    }
    config["forecastHorizons"] = dict(FORECAST_HORIZONS)
    return config


def build_runtime_from_base(
    *,
    model_name: str,
    forecast_mode: str,
    base_runtime: dict[str, Any],
    base_model_config: dict[str, Any],
    model_config_path: str,
    weight_source_rel: str,
    weight_sha256: str,
    anchors: list[dict[str, Any]],
) -> dict[str, Any]:
    hotspot_ids = list(base_runtime["meta"]["hotspotIds"])
    route_focus_map = dict(base_runtime["meta"]["routeFocusMap"])
    node_order = [str(value) for value in base_model_config["nodeOrder"]]
    hotspot_node_map = {key: str(value) for key, value in base_model_config["hotspotNodeMap"].items()}
    node_index_map = {node_id: index for index, node_id in enumerate(node_order)}
    anchor_lookup = {anchor["time"]: index for index, anchor in enumerate(anchors)}

    hotspot_scale_max = max(
        max(float(frame["current"]["keyGrids"][grid_id]) for grid_id in hotspot_ids)
        for frame in base_runtime["timeline"]
    )
    for anchor in anchors:
        for horizon in FORECAST_HORIZONS:
            hotspot_scale_max = max(
                hotspot_scale_max,
                max(float(anchor["forecast"][horizon][node_index_map[hotspot_node_map[grid_id]]]) for grid_id in hotspot_ids),
            )

    forecast_totals: dict[str, list[float]] = {horizon: [] for horizon in FORECAST_HORIZONS}
    timeline: list[dict[str, Any]] = []

    for base_frame in base_runtime["timeline"]:
        bucket_time = pd.Timestamp(base_frame["time"])
        forecast_nodes = {
            horizon: interpolate_forecast_array(anchors, anchor_lookup, bucket_time, horizon)
            for horizon in FORECAST_HORIZONS
        }
        forecast_key_grids = {
            horizon: {
                grid_id: round_float(values[node_index_map[hotspot_node_map[grid_id]]])
                for grid_id in hotspot_ids
            }
            for horizon, values in forecast_nodes.items()
        }
        hotspot_payload = []
        for grid_id in hotspot_ids:
            current_value = float(base_frame["current"]["keyGrids"][grid_id])
            future_value = float(forecast_key_grids["1h"][grid_id])
            intensity = 0.0 if hotspot_scale_max <= 0 else max(current_value, future_value) / hotspot_scale_max
            hotspot_payload.append(
                {
                    "id": grid_id,
                    "intensity": round_float(intensity, 4),
                    "level": level_from_intensity(float(intensity)),
                }
            )
        hotspot_payload.sort(key=lambda item: (item["intensity"], item["id"]), reverse=True)

        focus_grid = hotspot_payload[0]["id"]
        focus_route = route_focus_map[focus_grid]
        second_grid = hotspot_payload[1]["id"] if len(hotspot_payload) > 1 else focus_grid
        second_route = route_focus_map[second_grid]

        alerts = [
            {
                "grid": grid_id,
                "level": level_from_values(
                    float(base_frame["current"]["keyGrids"][grid_id]),
                    float(forecast_key_grids["1h"][grid_id]),
                    hotspot_scale_max,
                ),
                "current": round_float(base_frame["current"]["keyGrids"][grid_id]),
                "future": round_float(forecast_key_grids["1h"][grid_id]),
                "note": f"{model_name} keeps {grid_id} in the hotspot watchlist for the active frame.",
            }
            for grid_id in hotspot_ids
        ]
        applied_alerts = build_applied_alerts(alerts, focus_grid, hotspot_scale_max)

        forecast_total_by_horizon = {horizon: round_float(float(np.sum(values))) for horizon, values in forecast_nodes.items()}
        narrative = build_narrative(
            model_name=model_name,
            bucket_time=bucket_time,
            visible_vessels=int(base_frame["current"]["visibleVessels"]),
            current_total=float(base_frame["current"]["totalFlow"]),
            future_total=float(forecast_total_by_horizon["1h"]),
            focus_grid=focus_grid,
            focus_route=focus_route,
            second_grid=second_grid,
            second_route=second_route,
            hotspot_count=sum(1 for item in hotspot_payload if item["level"] != "watch"),
            alerts=alerts,
            applied_alerts=applied_alerts,
        )

        for horizon, value in forecast_total_by_horizon.items():
            forecast_totals[horizon].append(value)

        timeline.append(
            {
                "sceneId": base_frame["sceneId"],
                "time": base_frame["time"],
                "current": copy.deepcopy(base_frame["current"]),
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
            "source": base_runtime["meta"]["source"],
            "model": model_name,
            "modelConfigPath": model_config_path,
            "weightSource": weight_source_rel,
            "weightSha256": weight_sha256,
            "historyWindowHours": MODEL_SETTINGS["n_his"],
            "horizons": list(FORECAST_HORIZONS.keys()),
            "hotspotIds": hotspot_ids,
            "routeFocusMap": route_focus_map,
            "forecastMode": forecast_mode,
            "inferenceResolutionMinutes": FLOW_RESOLUTION_MINUTES,
            "playbackResolutionMinutes": PLAYBACK_RESOLUTION_MINUTES,
            "interpolationMode": "linear-between-hourly-inference-anchors",
            "windowStart": base_runtime["meta"]["windowStart"],
            "windowEnd": base_runtime["meta"]["windowEnd"],
            "narrativeMode": "model-driven-per-frame",
            "notice": (
                f"Archived AIS playback remains fixed while {model_name} forecasts are generated with recursive hourly inference "
                "and linearly mapped onto the 5-minute replay timeline."
            ),
        },
        "series": {
            "totalFlow": copy.deepcopy(base_runtime["series"]["totalFlow"]),
            "forecastTotals": forecast_totals,
            "hotspots": copy.deepcopy(base_runtime["series"]["hotspots"]),
        },
        "timeline": timeline,
    }


def build_hourly_anchors(
    *,
    model: nn.Module,
    scaled_values: np.ndarray,
    flow_df: pd.DataFrame,
    base_runtime: dict[str, Any],
    scaler: StandardScaler,
    device: torch.device,
) -> list[dict[str, Any]]:
    anchor_times = pd.date_range(
        pd.Timestamp(base_runtime["meta"]["windowStart"]).floor("h"),
        pd.Timestamp(base_runtime["meta"]["windowEnd"]).floor("h"),
        freq="1h",
    )
    anchors: list[dict[str, Any]] = []
    for anchor_time in anchor_times:
        if anchor_time not in flow_df.index:
            raise KeyError(f"Missing hourly flow record for {anchor_time.isoformat()}")
        anchor_index = int(flow_df.index.get_loc(anchor_time))
        anchors.append(
            {
                "time": anchor_time,
                "forecast": recursive_forecast(model, scaled_values, anchor_index, scaler, device),
            }
        )
    return anchors


def export_sequence_model_artifacts(
    *,
    flow_df: pd.DataFrame,
    base_runtime: dict[str, Any],
    base_model_config: dict[str, Any],
    module_dir: Path,
    flow_source_rel: str,
    generated_by: str,
) -> list[SequenceModelArtifact]:
    set_reproducible()
    device = get_device()

    train_length, val_length, _test_length = split_lengths(len(flow_df))
    train_data = flow_df.iloc[:train_length].to_numpy(dtype=np.float32)
    val_data = flow_df.iloc[train_length : train_length + val_length].to_numpy(dtype=np.float32)
    scaler = StandardScaler()
    train_scaled = scaler.fit_transform(train_data).astype(np.float32)
    val_scaled = scaler.transform(val_data).astype(np.float32)
    scaled_values = scaler.transform(flow_df.to_numpy(dtype=np.float32)).astype(np.float32)

    train_x, train_y = data_transform_noday(train_scaled, MODEL_SETTINGS["n_his"], MODEL_SETTINGS["n_pred"])
    val_x, val_y = data_transform_noday(val_scaled, MODEL_SETTINGS["n_his"], MODEL_SETTINGS["n_pred"])

    weights_dir = module_dir / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    artifacts: list[SequenceModelArtifact] = []

    for model_name, spec in MODEL_SPECS.items():
        train_loader, val_loader = build_data_loaders(train_x, train_y, val_x, val_y, MODEL_SETTINGS["batch_size"])
        model = spec["builder"](
            input_dim=len(flow_df.columns),
            hidden_dim=MODEL_SETTINGS["hidden_dim"],
            num_layers=MODEL_SETTINGS["num_layers"],
            output_dim=len(flow_df.columns),
        ).to(device)
        trained_model = train_model(model, train_loader, val_loader, device)

        weight_path = weights_dir / spec["weight_file"]
        torch.save(trained_model.state_dict(), weight_path)
        weight_sha256 = hash_file(weight_path)
        weight_source_rel = weight_path.relative_to(module_dir.parents[4]).as_posix()

        model_config = build_sequence_model_config(
            base_model_config=base_model_config,
            model_name=model_name,
            model_family=spec["model_family"],
            bidirectional=bool(spec["bidirectional"]),
            flow_source_rel=flow_source_rel,
            generated_by=generated_by,
            weight_source_rel=weight_source_rel,
            weight_sha256=weight_sha256,
            scaler=scaler,
            flow_df=flow_df,
            base_runtime=base_runtime,
        )
        model_config_path = f"data/modules/forecast/{spec['config_file']}"
        anchors = build_hourly_anchors(
            model=trained_model,
            scaled_values=scaled_values,
            flow_df=flow_df,
            base_runtime=base_runtime,
            scaler=scaler,
            device=device,
        )
        runtime = build_runtime_from_base(
            model_name=model_name,
            forecast_mode=spec["forecast_mode"],
            base_runtime=base_runtime,
            base_model_config=base_model_config,
            model_config_path=model_config_path,
            weight_source_rel=weight_source_rel,
            weight_sha256=weight_sha256,
            anchors=anchors,
        )
        artifacts.append(
            SequenceModelArtifact(
                model=model_name,
                runtime_file=spec["runtime_file"],
                config_file=spec["config_file"],
                weight_file=spec["weight_file"],
                weight_path=weight_path,
                weight_sha256=weight_sha256,
                runtime=runtime,
                model_config=model_config,
            )
        )
        if device.type == "cuda":
            torch.cuda.empty_cache()

    return artifacts
