from __future__ import annotations

import argparse
import copy
import json
import math
import pickle
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors


ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_DIR = ROOT / "demo-web" / "analysis"
PUBLIC_DATA_DIR = ROOT / "demo-web" / "public" / "data"

DIRECTION_COLORS = [
    "#3a86ff",
    "#00bbf9",
    "#06d6a0",
    "#80ed99",
    "#ffd166",
    "#f4a261",
    "#ef476f",
    "#9b5de5",
]
DIRECTION_LABELS = ["East", "NorthEast", "North", "NorthWest", "West", "SouthWest", "South", "SouthEast"]
DEFAULT_MAX_CORRIDOR_WIDTH_RATIO = 0.85
DEFAULT_MIN_REPRESENTATIVE_LENGTH_RATIO = 0.35
DEFAULT_MAX_CIRCULAR_SPREAD = 0.18


@dataclass
class TrackRecord:
    track_id: int
    points_latlon: np.ndarray
    points_xy: np.ndarray
    times: list[pd.Timestamp]
    cogs: list[float | None]
    point_count: int
    length_m: float
    displacement_m: float
    duration_min: float
    bearing_deg: float
    principal_axis_deg: float
    direction_bin: int
    direction_label: str
    resampled_xy: np.ndarray
    resampled_latlon: np.ndarray
    keep: bool = False
    corridor_cluster_label: int | None = None
    corridor_rank: int | None = None
    corridor_id: str | None = None
    corridor_size: int = 0
    drop_reason: str | None = None


def find_first_path(patterns: list[str]) -> Path:
    for pattern in patterns:
        matches = sorted(ROOT.rglob(pattern))
        if matches:
            return matches[0]
    raise FileNotFoundError(f"Unable to find any file matching: {patterns}")


DEFAULT_SEGMENTS_PKL = find_first_path(["compressed_segments(60,90,0.03).pkl", "compressed_segments*.pkl"])
DEFAULT_REFERENCE_IMAGE = find_first_path(["*聚类前轨迹*.png"])


def to_local_xy(lat: np.ndarray, lon: np.ndarray, mean_lat: float) -> np.ndarray:
    lon_scale = math.cos(math.radians(mean_lat)) * 111000.0
    x = lon * lon_scale
    y = lat * 111000.0
    return np.column_stack([x, y])


def polyline_length(points_xy: np.ndarray) -> float:
    if len(points_xy) < 2:
        return 0.0
    deltas = np.diff(points_xy, axis=0)
    return float(np.linalg.norm(deltas, axis=1).sum())


def resample_polyline(points_xy: np.ndarray, sample_count: int) -> np.ndarray:
    if len(points_xy) == 0:
        return np.empty((0, 2), dtype=float)
    if len(points_xy) == 1:
        return np.repeat(points_xy[:1], sample_count, axis=0)

    segment_lengths = np.linalg.norm(np.diff(points_xy, axis=0), axis=1)
    cumulative = np.concatenate([[0.0], np.cumsum(segment_lengths)])
    total_length = float(cumulative[-1])
    if total_length == 0:
        return np.repeat(points_xy[:1], sample_count, axis=0)

    targets = np.linspace(0.0, total_length, sample_count)
    resampled: list[np.ndarray] = []

    for target in targets:
        index = int(np.searchsorted(cumulative, target, side="right") - 1)
        index = max(0, min(index, len(points_xy) - 2))
        span = cumulative[index + 1] - cumulative[index]
        weight = 0.0 if span == 0 else (target - cumulative[index]) / span
        resampled.append(points_xy[index] + (points_xy[index + 1] - points_xy[index]) * weight)

    return np.vstack(resampled)


def compute_bearing_deg(points_xy: np.ndarray) -> float:
    if len(points_xy) < 2:
        return 0.0
    dx = points_xy[-1, 0] - points_xy[0, 0]
    dy = points_xy[-1, 1] - points_xy[0, 1]
    return float((math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0)


def compute_principal_axis_deg(points_xy: np.ndarray) -> float:
    if len(points_xy) < 2:
        return 0.0
    centered = points_xy - points_xy.mean(axis=0)
    covariance = np.cov(centered.T)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    axis_vector = eigenvectors[:, int(np.argmax(eigenvalues))]
    return float((math.degrees(math.atan2(axis_vector[1], axis_vector[0])) + 180.0) % 180.0)


def load_segments(path: Path) -> list[list[dict[str, Any]]]:
    with path.open("rb") as handle:
        payload = pickle.load(handle)
    if not isinstance(payload, list):
        raise TypeError(f"Unexpected payload type: {type(payload)}")
    return payload


def build_track_records(
    segments: list[list[dict[str, Any]]],
    direction_bin_count: int,
    min_points: int,
    min_displacement_m: float,
    signature_points: int,
) -> tuple[list[TrackRecord], float]:
    all_lats = [float(point["point"][0]) for segment in segments for point in segment]
    mean_lat = float(np.mean(all_lats))
    bin_size = 360.0 / direction_bin_count

    records: list[TrackRecord] = []

    for track_id, segment in enumerate(segments):
        if not segment:
            continue

        lat = np.array([float(point["point"][0]) for point in segment], dtype=float)
        lon = np.array([float(point["point"][1]) for point in segment], dtype=float)
        times = [pd.Timestamp(point["time"]) for point in segment]
        cogs = [float(point["cog"]) if point.get("cog") is not None else None for point in segment]
        points_xy = to_local_xy(lat, lon, mean_lat)
        point_count = int(len(segment))
        length_m = polyline_length(points_xy)
        displacement_m = float(np.linalg.norm(points_xy[-1] - points_xy[0])) if point_count >= 2 else 0.0
        duration_min = float((times[-1] - times[0]).total_seconds() / 60.0) if len(times) >= 2 else 0.0
        bearing_deg = compute_bearing_deg(points_xy)
        principal_axis_deg = compute_principal_axis_deg(points_xy)
        direction_bin = int(min(direction_bin_count - 1, math.floor(bearing_deg / bin_size)))
        direction_label = DIRECTION_LABELS[direction_bin % len(DIRECTION_LABELS)]
        resampled_xy = resample_polyline(points_xy, signature_points)
        resampled_latlon = np.column_stack(
            [
                np.interp(np.linspace(0, point_count - 1, signature_points), np.arange(point_count), lat),
                np.interp(np.linspace(0, point_count - 1, signature_points), np.arange(point_count), lon),
            ]
        )

        record = TrackRecord(
            track_id=track_id,
            points_latlon=np.column_stack([lat, lon]),
            points_xy=points_xy,
            times=times,
            cogs=cogs,
            point_count=point_count,
            length_m=length_m,
            displacement_m=displacement_m,
            duration_min=duration_min,
            bearing_deg=bearing_deg,
            principal_axis_deg=principal_axis_deg,
            direction_bin=direction_bin,
            direction_label=direction_label,
            resampled_xy=resampled_xy,
            resampled_latlon=resampled_latlon,
        )

        if point_count < min_points:
            record.drop_reason = "too_few_points"
        elif displacement_m < min_displacement_m:
            record.drop_reason = "too_short"

        records.append(record)

    return records, mean_lat


def estimate_eps(features: np.ndarray) -> float:
    if len(features) <= 1:
        return 0.5

    neighbor_count = min(max(6, len(features) // 25), len(features))
    distances = NearestNeighbors(n_neighbors=neighbor_count).fit(features).kneighbors(features)[0][:, -1]
    return float(np.clip(np.percentile(distances, 70), 0.25, 2.5))


def compute_circular_spread(bearings_deg: np.ndarray) -> float:
    if len(bearings_deg) == 0:
        return 1.0
    angles = np.deg2rad(bearings_deg)
    resultant = float(np.hypot(np.cos(angles).mean(), np.sin(angles).mean()))
    return 1.0 - resultant


def build_corridor_quality(
    kept_records: list[TrackRecord],
    min_representative_length_ratio: float,
    max_width_ratio: float,
    max_circular_spread: float,
) -> list[dict[str, Any]]:
    corridor_groups: dict[str, list[TrackRecord]] = defaultdict(list)
    for record in kept_records:
        if record.corridor_id:
            corridor_groups[record.corridor_id].append(record)

    corridor_quality: list[dict[str, Any]] = []

    for corridor_id, group in sorted(corridor_groups.items()):
        resampled_xy = np.stack([record.resampled_xy for record in group])
        representative_line_xy = np.mean(resampled_xy, axis=0)
        representative_length_m = polyline_length(representative_line_xy)
        representative_displacement_m = float(np.linalg.norm(representative_line_xy[-1] - representative_line_xy[0]))
        widths_m = np.linalg.norm(resampled_xy - representative_line_xy, axis=2)
        median_width_m = float(np.median(widths_m))
        p90_width_m = float(np.percentile(widths_m, 90))
        median_track_length_m = float(np.median([record.length_m for record in group]))
        median_track_displacement_m = float(np.median([record.displacement_m for record in group]))
        circular_spread = compute_circular_spread(np.array([record.bearing_deg for record in group], dtype=float))
        representative_length_ratio = representative_length_m / max(median_track_displacement_m, 1.0)
        width_ratio = p90_width_m / max(representative_length_m, 1.0)

        failed_rules: list[str] = []
        if representative_length_ratio < min_representative_length_ratio:
            failed_rules.append("compressed_corridor")
        if width_ratio > max_width_ratio:
            failed_rules.append("wide_corridor")
        if circular_spread > max_circular_spread:
            failed_rules.append("mixed_directions")

        corridor_quality.append(
            {
                "corridorId": corridor_id,
                "trackCount": len(group),
                "representativeLengthM": round(representative_length_m, 2),
                "representativeDisplacementM": round(representative_displacement_m, 2),
                "medianTrackLengthM": round(median_track_length_m, 2),
                "medianTrackDisplacementM": round(median_track_displacement_m, 2),
                "medianWidthM": round(median_width_m, 2),
                "p90WidthM": round(p90_width_m, 2),
                "representativeLengthRatio": round(representative_length_ratio, 4),
                "widthRatio": round(width_ratio, 4),
                "circularSpread": round(circular_spread, 4),
                "passesQuality": not failed_rules,
                "rejectionReason": "|".join(failed_rules) if failed_rules else "",
            }
        )

    return corridor_quality


def apply_corridor_quality_filter(records: list[TrackRecord], corridor_quality: list[dict[str, Any]]) -> list[TrackRecord]:
    rejected_corridors = {
        item["corridorId"]: item["rejectionReason"] or "poor_corridor_quality"
        for item in corridor_quality
        if not item["passesQuality"]
    }

    for record in records:
        if not record.keep or not record.corridor_id:
            continue
        if record.corridor_id not in rejected_corridors:
            continue
        record.keep = False
        record.drop_reason = "poor_corridor_quality"

    return [record for record in records if record.keep]


def summarize_corridor_solution(
    kept_records: list[TrackRecord],
    corridor_quality: list[dict[str, Any]],
) -> tuple[int, int, float, float]:
    valid_quality = [item for item in corridor_quality if item["passesQuality"]]
    if not kept_records or not valid_quality:
        return (0, 0, float("-inf"), float("-inf"))

    weights = np.array([item["trackCount"] for item in valid_quality], dtype=float)
    weight_sum = float(weights.sum()) or 1.0
    weighted_width_ratio = float(np.dot(weights, np.array([item["widthRatio"] for item in valid_quality], dtype=float)) / weight_sum)
    weighted_circular_spread = float(np.dot(weights, np.array([item["circularSpread"] for item in valid_quality], dtype=float)) / weight_sum)
    return (
        len(kept_records),
        len(valid_quality),
        -weighted_width_ratio,
        -weighted_circular_spread,
    )


def assign_main_corridors_directional(
    records: list[TrackRecord],
    direction_bin_count: int,
    top_k_per_direction: int,
    min_cluster_size: int,
) -> tuple[list[TrackRecord], dict[str, Any]]:
    candidate_records = [record for record in records if record.drop_reason is None]
    grouped: dict[int, list[TrackRecord]] = defaultdict(list)
    for record in candidate_records:
        grouped[record.direction_bin].append(record)

    bin_size = 360.0 / direction_bin_count
    direction_summaries: list[dict[str, Any]] = []

    for direction_bin in range(direction_bin_count):
        group = grouped.get(direction_bin, [])
        if not group:
            continue

        center_angle = math.radians(direction_bin * bin_size + bin_size / 2.0)
        normal_vector = np.array([-math.sin(center_angle), math.cos(center_angle)])
        features = np.array([np.quantile(record.resampled_xy @ normal_vector, [0.2, 0.5, 0.8]) for record in group]) / 1000.0
        eps = estimate_eps(features)
        min_samples = max(8, len(group) // 25)
        labels = DBSCAN(eps=eps, min_samples=min_samples).fit_predict(features)

        cluster_sizes = Counter(int(label) for label in labels if int(label) != -1)
        ranked_clusters = sorted(cluster_sizes.items(), key=lambda item: (-item[1], item[0]))
        kept_clusters = [label for label, size in ranked_clusters[:top_k_per_direction] if size >= min_cluster_size]
        corridor_rank_map = {label: index + 1 for index, (label, _) in enumerate(ranked_clusters)}

        for record, label in zip(group, labels):
            label_int = int(label)
            if label_int == -1:
                record.drop_reason = "dbscan_noise"
                continue

            record.corridor_cluster_label = label_int
            record.corridor_size = cluster_sizes[label_int]
            record.corridor_rank = corridor_rank_map[label_int]
            record.corridor_id = f"D{direction_bin:02d}-C{record.corridor_rank:02d}"

            if label_int in kept_clusters:
                record.keep = True
                record.drop_reason = None
            else:
                record.drop_reason = "non_top_corridor"

        direction_summaries.append(
            {
                "directionBin": direction_bin,
                "directionLabel": DIRECTION_LABELS[direction_bin % len(DIRECTION_LABELS)],
                "trackCount": len(group),
                "epsKm": round(eps, 3),
                "minSamples": min_samples,
                "clusters": [{"clusterLabel": label, "trackCount": size} for label, size in ranked_clusters],
                "keptClusters": kept_clusters,
            }
        )

    kept_records = [record for record in records if record.keep]
    return kept_records, {"clusterMode": "directional", "directionSummaries": direction_summaries}


def assign_main_corridors_global(
    records: list[TrackRecord],
    min_cluster_size: int,
    angle_scale: float,
) -> tuple[list[TrackRecord], dict[str, Any]]:
    candidate_records = [record for record in records if record.drop_reason is None]
    if not candidate_records:
        return [], {"clusterMode": "global", "globalClustering": {"eps": 0.0, "minSamples": 0, "clusters": [], "keptClusters": []}}

    centers = np.array([record.points_xy.mean(axis=0) for record in candidate_records], dtype=float)
    mean_center = centers.mean(axis=0)
    features = np.column_stack(
        [
            (centers[:, 0] - mean_center[0]) / 1000.0,
            (centers[:, 1] - mean_center[1]) / 1000.0,
            np.array([record.principal_axis_deg for record in candidate_records], dtype=float) * angle_scale,
        ]
    )

    neighbor_count = min(max(6, len(features) // 30), len(features))
    neighbor_distances = NearestNeighbors(n_neighbors=neighbor_count).fit(features).kneighbors(features)[0][:, -1]
    eps = float(np.clip(np.percentile(neighbor_distances, 55), 0.3, 3.5))
    min_samples = max(8, len(features) // 50)
    labels = DBSCAN(eps=eps, min_samples=min_samples).fit_predict(features)

    cluster_sizes = Counter(int(label) for label in labels if int(label) != -1)
    ranked_clusters = sorted(cluster_sizes.items(), key=lambda item: (-item[1], item[0]))
    kept_clusters = [label for label, size in ranked_clusters if size >= min_cluster_size]
    corridor_rank_map = {label: index + 1 for index, (label, _) in enumerate(ranked_clusters)}

    for record, label in zip(candidate_records, labels):
        label_int = int(label)
        if label_int == -1:
            record.drop_reason = "dbscan_noise"
            continue

        record.corridor_cluster_label = label_int
        record.corridor_size = cluster_sizes[label_int]
        record.corridor_rank = corridor_rank_map[label_int]
        record.corridor_id = f"G{record.corridor_rank:02d}"

        if label_int in kept_clusters:
            record.keep = True
            record.drop_reason = None
        else:
            record.drop_reason = "small_corridor_cluster"

    kept_records = [record for record in records if record.keep]
    return kept_records, {
        "clusterMode": "global",
        "globalClustering": {
            "eps": round(eps, 3),
            "minSamples": min_samples,
            "angleScale": angle_scale,
            "clusters": [{"clusterLabel": label, "trackCount": size} for label, size in ranked_clusters],
            "keptClusters": kept_clusters,
        },
    }


def assign_main_corridors(
    records: list[TrackRecord],
    cluster_mode: str,
    direction_bin_count: int,
    top_k_per_direction: int,
    min_cluster_size: int,
    global_angle_scale: float,
) -> tuple[list[TrackRecord], dict[str, Any]]:
    if cluster_mode == "global":
        return assign_main_corridors_global(records=records, min_cluster_size=min_cluster_size, angle_scale=global_angle_scale)
    return assign_main_corridors_directional(
        records=records,
        direction_bin_count=direction_bin_count,
        top_k_per_direction=top_k_per_direction,
        min_cluster_size=min_cluster_size,
    )


def run_corridor_mode(
    source_records: list[TrackRecord],
    cluster_mode: str,
    direction_bin_count: int,
    top_k_per_direction: int,
    min_cluster_size: int,
    global_angle_scale: float,
    min_representative_length_ratio: float,
    max_width_ratio: float,
    max_circular_spread: float,
) -> tuple[list[TrackRecord], list[TrackRecord], dict[str, Any]]:
    working_records = copy.deepcopy(source_records)
    kept_records, clustering_details = assign_main_corridors(
        records=working_records,
        cluster_mode=cluster_mode,
        direction_bin_count=direction_bin_count,
        top_k_per_direction=top_k_per_direction,
        min_cluster_size=min_cluster_size,
        global_angle_scale=global_angle_scale,
    )

    corridor_quality = build_corridor_quality(
        kept_records=kept_records,
        min_representative_length_ratio=min_representative_length_ratio,
        max_width_ratio=max_width_ratio,
        max_circular_spread=max_circular_spread,
    )
    kept_records = apply_corridor_quality_filter(working_records, corridor_quality)

    clustering_details = {
        **clustering_details,
        "clusterMode": cluster_mode,
        "corridorQuality": corridor_quality,
        "qualityFilter": {
            "minRepresentativeLengthRatio": min_representative_length_ratio,
            "maxCorridorWidthRatio": max_width_ratio,
            "maxWidthRatio": max_width_ratio,
            "maxCircularSpread": max_circular_spread,
            "rejectedCorridors": [item["corridorId"] for item in corridor_quality if not item["passesQuality"]],
        },
    }
    return working_records, kept_records, clustering_details


def resolve_corridor_solution(
    source_records: list[TrackRecord],
    cluster_mode: str,
    direction_bin_count: int,
    top_k_per_direction: int,
    min_cluster_size: int,
    global_angle_scale: float,
    min_representative_length_ratio: float,
    max_width_ratio: float,
    max_circular_spread: float,
) -> tuple[list[TrackRecord], list[TrackRecord], dict[str, Any]]:
    if cluster_mode in {"global", "directional"}:
        records, kept_records, clustering_details = run_corridor_mode(
            source_records=source_records,
            cluster_mode=cluster_mode,
            direction_bin_count=direction_bin_count,
            top_k_per_direction=top_k_per_direction,
            min_cluster_size=min_cluster_size,
            global_angle_scale=global_angle_scale,
            min_representative_length_ratio=min_representative_length_ratio,
            max_width_ratio=max_width_ratio,
            max_circular_spread=max_circular_spread,
        )
        clustering_details["requestedClusterMode"] = cluster_mode
        return records, kept_records, clustering_details

    candidates: list[tuple[tuple[int, int, float, float], list[TrackRecord], list[TrackRecord], dict[str, Any]]] = []
    candidate_summaries: list[dict[str, Any]] = []

    for candidate_mode in ("global", "directional"):
        candidate_records, candidate_kept_records, candidate_details = run_corridor_mode(
            source_records=source_records,
            cluster_mode=candidate_mode,
            direction_bin_count=direction_bin_count,
            top_k_per_direction=top_k_per_direction,
            min_cluster_size=min_cluster_size,
            global_angle_scale=global_angle_scale,
            min_representative_length_ratio=min_representative_length_ratio,
            max_width_ratio=max_width_ratio,
            max_circular_spread=max_circular_spread,
        )
        score = summarize_corridor_solution(candidate_kept_records, candidate_details["corridorQuality"])
        candidate_summaries.append(
            {
                "clusterMode": candidate_mode,
                "keptSegments": len(candidate_kept_records),
                "keptCorridors": sum(1 for item in candidate_details["corridorQuality"] if item["passesQuality"]),
                "qualityScore": list(score),
                "rejectedCorridors": candidate_details["qualityFilter"]["rejectedCorridors"],
            }
        )
        candidates.append((score, candidate_records, candidate_kept_records, candidate_details))

    _, records, kept_records, clustering_details = max(candidates, key=lambda item: item[0])
    clustering_details["requestedClusterMode"] = cluster_mode
    clustering_details["candidateModes"] = candidate_summaries
    return records, kept_records, clustering_details


def export_cleaned_points_csv(records: list[TrackRecord], output_path: Path) -> None:
    rows: list[dict[str, Any]] = []
    for record in records:
        for point_index, (point, timestamp, cog) in enumerate(zip(record.points_latlon, record.times, record.cogs)):
            rows.append(
                {
                    "track_id": record.track_id,
                    "direction_bin": record.direction_bin,
                    "direction_label": record.direction_label,
                    "corridor_id": record.corridor_id,
                    "corridor_rank": record.corridor_rank,
                    "point_index": point_index,
                    "lat": round(float(point[0]), 6),
                    "lon": round(float(point[1]), 6),
                    "time": timestamp.isoformat(),
                    "cog": None if cog is None else round(float(cog), 2),
                }
            )
    pd.DataFrame(rows).to_csv(output_path, index=False, encoding="utf-8")


def export_track_stats_csv(records: list[TrackRecord], output_path: Path) -> None:
    rows = [
        {
            "track_id": record.track_id,
            "direction_bin": record.direction_bin,
            "direction_label": record.direction_label,
            "corridor_id": record.corridor_id,
            "corridor_rank": record.corridor_rank,
            "point_count": record.point_count,
            "length_m": round(record.length_m, 2),
            "displacement_m": round(record.displacement_m, 2),
            "duration_min": round(record.duration_min, 2),
            "bearing_deg": round(record.bearing_deg, 2),
            "keep": record.keep,
            "drop_reason": record.drop_reason or "",
        }
        for record in records
    ]
    pd.DataFrame(rows).to_csv(output_path, index=False, encoding="utf-8")


def build_study_area(records: list[TrackRecord]) -> dict[str, float]:
    if not records:
        return {
            "minLon": 0.0,
            "maxLon": 0.0,
            "minLat": 0.0,
            "maxLat": 0.0,
        }

    all_lat = np.concatenate([record.points_latlon[:, 0] for record in records if len(record.points_latlon)])
    all_lon = np.concatenate([record.points_latlon[:, 1] for record in records if len(record.points_latlon)])
    return {
        "minLon": round(float(all_lon.min()), 6),
        "maxLon": round(float(all_lon.max()), 6),
        "minLat": round(float(all_lat.min()), 6),
        "maxLat": round(float(all_lat.max()), 6),
    }


def export_route_editor_tracks_json(
    records: list[TrackRecord],
    summary: dict[str, Any],
    output_path: Path,
    cleaned_points_path: Path,
    summary_path: Path,
) -> None:
    corridor_groups: dict[str, list[TrackRecord]] = defaultdict(list)
    for record in records:
        if record.corridor_id:
            corridor_groups[record.corridor_id].append(record)

    corridor_entries: list[dict[str, Any]] = []
    for corridor_id, group in sorted(corridor_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        first_record = group[0]
        label_index = min(max(len(first_record.points_latlon) // 2, 0), max(len(first_record.points_latlon) - 1, 0))
        label_point = first_record.points_latlon[label_index]
        corridor_entries.append(
            {
                "corridorId": corridor_id,
                "trackCount": len(group),
                "directionLabel": first_record.direction_label,
                "labelPoint": {
                    "lat": round(float(label_point[0]), 6),
                    "lon": round(float(label_point[1]), 6),
                },
            }
        )

    track_entries: list[dict[str, Any]] = []
    for record in sorted(records, key=lambda item: ((item.corridor_id or ""), item.track_id)):
        label_index = min(max(len(record.points_latlon) // 2, 0), max(len(record.points_latlon) - 1, 0))
        label_point = record.points_latlon[label_index]
        track_entries.append(
            {
                "id": f"{record.corridor_id or 'uncategorized'}-T{record.track_id:05d}",
                "trackId": record.track_id,
                "corridorId": record.corridor_id or "",
                "corridorRank": record.corridor_rank,
                "directionBin": record.direction_bin,
                "directionLabel": record.direction_label,
                "pointCount": record.point_count,
                "labelPoint": {
                    "lat": round(float(label_point[0]), 6),
                    "lon": round(float(label_point[1]), 6),
                },
                "points": [
                    {
                        "lat": round(float(point[0]), 6),
                        "lon": round(float(point[1]), 6),
                        "time": timestamp.isoformat(),
                        "cog": None if cog is None else round(float(cog), 2),
                    }
                    for point, timestamp, cog in zip(record.points_latlon, record.times, record.cogs)
                ],
            }
        )

    payload = {
        "source": cleaned_points_path.name,
        "summarySource": summary_path.name,
        "clusterMode": summary.get("clusterMode", ""),
        "requestedClusterMode": summary.get("requestedClusterMode", summary.get("clusterMode", "")),
        "trackCount": len(track_entries),
        "corridorCount": len(corridor_entries),
        "studyArea": build_study_area(records),
        "corridors": corridor_entries,
        "tracks": track_entries,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def plot_track_set(ax: plt.Axes, records: list[TrackRecord], color: str, alpha: float, linewidth: float) -> None:
    for record in records:
        ax.plot(record.points_latlon[:, 1], record.points_latlon[:, 0], color=color, alpha=alpha, linewidth=linewidth)


def plot_kept_corridors(ax: plt.Axes, records: list[TrackRecord]) -> None:
    corridor_groups: dict[str, list[TrackRecord]] = defaultdict(list)
    for record in records:
        if record.corridor_id:
            corridor_groups[record.corridor_id].append(record)

    ranked_corridors = sorted(corridor_groups)
    cmap = plt.get_cmap("tab20", max(len(ranked_corridors), 1))
    corridor_colors = {corridor_id: cmap(index) for index, corridor_id in enumerate(ranked_corridors)}

    for record in records:
        color = corridor_colors.get(record.corridor_id or "", DIRECTION_COLORS[record.direction_bin % len(DIRECTION_COLORS)])
        ax.plot(record.points_latlon[:, 1], record.points_latlon[:, 0], color=color, alpha=0.16, linewidth=0.9)

    for corridor_id, group in sorted(corridor_groups.items()):
        color = corridor_colors[corridor_id]
        mean_line = np.mean(np.stack([record.resampled_latlon for record in group]), axis=0)
        ax.plot(mean_line[:, 1], mean_line[:, 0], color="#0b132b", alpha=0.7, linewidth=4.6)
        ax.plot(mean_line[:, 1], mean_line[:, 0], color=color, alpha=0.95, linewidth=2.8, label=f"{corridor_id} ({len(group)})")

    ax.legend(loc="lower right", fontsize=7, frameon=False, ncol=2)


def plot_direction_bars(ax: plt.Axes, records: list[TrackRecord]) -> None:
    kept_counts = Counter(record.direction_label for record in records if record.keep)
    dropped_counts = Counter(record.direction_label for record in records if not record.keep)
    labels = [label for label in DIRECTION_LABELS if kept_counts[label] or dropped_counts[label]]
    x = np.arange(len(labels))
    kept = np.array([kept_counts[label] for label in labels], dtype=int)
    dropped = np.array([dropped_counts[label] for label in labels], dtype=int)

    ax.bar(x, kept, color="#118ab2", label="Kept")
    ax.bar(x, dropped, bottom=kept, color="#adb5bd", alpha=0.75, label="Dropped")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_ylabel("Trajectory count")
    ax.set_title("Direction Counts")
    ax.grid(axis="y", alpha=0.15)
    ax.legend(frameon=False)


def add_summary_text(ax: plt.Axes, summary: dict[str, Any]) -> None:
    ax.axis("off")
    cluster_mode = summary.get("clusterMode", "global")
    requested_mode = summary.get("requestedClusterMode", cluster_mode)
    quality_filter = summary.get("qualityFilter", {})
    rejected_quality = [item for item in summary.get("corridorQuality", []) if not item.get("passesQuality")]
    candidate_modes = summary.get("candidateModes", [])
    lines = [
        "Main Corridor Summary",
        f"Requested mode: {requested_mode}",
        f"Resolved mode: {cluster_mode}",
        f"Raw segments: {summary['rawSegments']}",
        f"Candidate segments: {summary['candidateSegments']}",
        f"Kept main-corridor segments: {summary['keptSegments']}",
        f"Removed segments: {summary['removedSegments']}",
        f"Raw points: {summary['rawPoints']}",
        f"Kept points: {summary['keptPoints']}",
        "",
        "Keep rule:",
        f"1. point_count >= {summary['params']['minPoints']}",
        f"2. displacement >= {summary['params']['minDisplacementMeters']} m",
        "",
    ]

    if cluster_mode == "global":
        global_info = summary.get("globalClustering", {})
        lines.extend(
            [
            f"3. global DBSCAN on corridor center + principal axis",
            f"4. keep dense clusters with size >= {summary['params']['minClusterSize']}",
            f"5. angle scale = {global_info.get('angleScale', summary['params'].get('globalAngleScale', 0.08))}",
            f"   eps = {global_info.get('eps', 0.0)} / min_samples = {global_info.get('minSamples', 0)}",
            ]
        )
    else:
        lines.extend(
            [
            f"3. group by {summary['params']['directionBinCount']} direction bins",
            f"4. keep top {summary['params']['topKPerDirection']} corridors per direction",
            f"5. corridor size >= {summary['params']['minClusterSize']}",
            ]
        )

    if quality_filter:
        max_width_ratio = quality_filter.get(
            "maxCorridorWidthRatio",
            quality_filter.get("maxWidthRatio", DEFAULT_MAX_CORRIDOR_WIDTH_RATIO),
        )
        lines.extend(
            [
                f"6. representative length ratio >= {quality_filter.get('minRepresentativeLengthRatio', DEFAULT_MIN_REPRESENTATIVE_LENGTH_RATIO)}",
                f"7. width ratio <= {max_width_ratio}",
                f"8. circular spread <= {quality_filter.get('maxCircularSpread', DEFAULT_MAX_CIRCULAR_SPREAD)}",
            ]
        )

    lines.extend(["", "Removed reasons:"])

    for reason, count in summary["dropReasons"].items():
        lines.append(f"  {reason}: {count}")

    if candidate_modes and requested_mode == "auto":
        lines.extend(["", "Auto mode candidates:"])
        for item in candidate_modes:
            lines.append(
                "  "
                f"{item['clusterMode']}: {item['keptSegments']} seg, "
                f"{item['keptCorridors']} corridors, "
                f"reject={len(item['rejectedCorridors'])}"
            )

    if rejected_quality:
        lines.extend(["", "Rejected corridors:"])
        for item in rejected_quality[:8]:
            lines.append(f"  {item['corridorId']}: {item['rejectionReason']}")

    lines.extend(["", "Top kept corridors:"])
    for item in summary["topCorridors"][:10]:
        lines.append(f"  {item['corridorId']}: {item['trackCount']} tracks")

    ax.text(0.01, 0.99, "\n".join(lines), va="top", ha="left", fontsize=9, family="monospace")


def create_comparison_figure(
    reference_image_path: Path,
    records: list[TrackRecord],
    kept_records: list[TrackRecord],
    output_path: Path,
    summary: dict[str, Any],
) -> None:
    removed_records = [record for record in records if not record.keep]
    raw_candidate_records = [record for record in records if record.drop_reason != "too_few_points"]

    fig, axes = plt.subplots(2, 3, figsize=(20, 12), constrained_layout=True)
    fig.suptitle(
        f"Senior Plot vs Main Corridor Extraction ({summary.get('clusterMode', 'global').title()} clustering)",
        fontsize=16,
        fontweight="bold",
    )

    axes[0, 0].imshow(Image.open(reference_image_path))
    axes[0, 0].set_title("A. Senior Reference Plot")
    axes[0, 0].axis("off")

    plot_track_set(axes[0, 1], raw_candidate_records, color="#1d3557", alpha=0.12, linewidth=0.55)
    axes[0, 1].set_title("B. Replotted Source Trajectories")

    plot_kept_corridors(axes[0, 2], kept_records)
    axes[0, 2].set_title("C. Extracted Main Corridors")

    plot_track_set(axes[1, 0], removed_records, color="#8d99ae", alpha=0.12, linewidth=0.5)
    axes[1, 0].set_title("D. Removed Sparse / Messy Tracks")

    plot_direction_bars(axes[1, 1], records)
    add_summary_text(axes[1, 2], summary)

    for ax in [axes[0, 1], axes[0, 2], axes[1, 0]]:
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
        ax.grid(alpha=0.14, linewidth=0.4)

    fig.savefig(output_path, dpi=220)
    plt.close(fig)


def build_summary(records: list[TrackRecord], kept_records: list[TrackRecord], params: dict[str, Any], clustering_details: dict[str, Any]) -> dict[str, Any]:
    drop_reasons = Counter(record.drop_reason or "kept" for record in records if not record.keep)
    candidate_segments = int(
        sum(
            record.point_count >= params["minPoints"] and record.displacement_m >= params["minDisplacementMeters"]
            for record in records
        )
    )
    corridor_rows = pd.DataFrame(
        [
            {
                "corridorId": record.corridor_id,
                "directionLabel": record.direction_label,
                "trackId": record.track_id,
            }
            for record in kept_records
            if record.corridor_id
        ]
    )
    top_corridors: list[dict[str, Any]] = []
    if not corridor_rows.empty:
        corridor_counts = (
            corridor_rows.groupby("corridorId", as_index=False)["trackId"]
            .count()
            .rename(columns={"trackId": "trackCount"})
            .sort_values(["trackCount", "corridorId"], ascending=[False, True])
        )
        for _, row in corridor_counts.iterrows():
            corridor_id = row["corridorId"]
            direction_counts = corridor_rows[corridor_rows["corridorId"] == corridor_id]["directionLabel"].value_counts()
            top_corridors.append(
                {
                    "corridorId": corridor_id,
                    "trackCount": int(row["trackCount"]),
                    "dominantDirections": direction_counts.head(3).to_dict(),
                }
            )

    return {
        "params": params,
        "rawSegments": len(records),
        "candidateSegments": candidate_segments,
        "keptSegments": len(kept_records),
        "removedSegments": int(sum(not record.keep for record in records)),
        "rawPoints": int(sum(record.point_count for record in records)),
        "keptPoints": int(sum(record.point_count for record in kept_records)),
        "dropReasons": dict(sorted(drop_reasons.items())),
        "topCorridors": top_corridors,
        **clustering_details,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract major shipping corridors from the senior clustered AIS dataset and compare with the senior plot.")
    parser.add_argument("--segments-pkl", type=Path, default=DEFAULT_SEGMENTS_PKL, help="Path to the compressed trajectory segments pickle.")
    parser.add_argument("--reference-image", type=Path, default=DEFAULT_REFERENCE_IMAGE, help="Path to the senior reference trajectory image.")
    parser.add_argument("--output-dir", type=Path, default=ANALYSIS_DIR, help="Directory for generated figures and cleaned data.")
    parser.add_argument(
        "--cluster-mode",
        choices=["auto", "global", "directional"],
        default="auto",
        help="Corridor extraction mode. Auto compares global and directional clustering, then keeps the healthier corridor set.",
    )
    parser.add_argument("--direction-bin-count", type=int, default=8, help="Number of direction bins for stats and directional mode.")
    parser.add_argument("--top-k-per-direction", type=int, default=2, help="How many strongest corridors to keep in each direction bin when cluster mode is directional.")
    parser.add_argument("--min-cluster-size", type=int, default=12, help="Minimum track count for a corridor cluster to be kept.")
    parser.add_argument("--min-points", type=int, default=4, help="Minimum point count per trajectory segment.")
    parser.add_argument("--min-displacement-m", type=float, default=4000.0, help="Minimum start-to-end displacement in meters.")
    parser.add_argument("--signature-points", type=int, default=9, help="Number of resampled points per trajectory signature.")
    parser.add_argument("--global-angle-scale", type=float, default=0.08, help="Angle-to-distance scale used by global corridor clustering.")
    parser.add_argument(
        "--min-representative-length-ratio",
        type=float,
        default=DEFAULT_MIN_REPRESENTATIVE_LENGTH_RATIO,
        help="Reject corridors whose representative line is too short compared with member-track displacement.",
    )
    parser.add_argument(
        "--max-corridor-width-ratio",
        type=float,
        default=DEFAULT_MAX_CORRIDOR_WIDTH_RATIO,
        help="Reject corridors whose cross-track width is too large relative to their representative length.",
    )
    parser.add_argument(
        "--max-circular-spread",
        type=float,
        default=DEFAULT_MAX_CIRCULAR_SPREAD,
        help="Reject corridors that mix too many incompatible travel directions.",
    )
    parser.add_argument("--show", action="store_true", help="Open the generated comparison figure with the system image viewer.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    segments = load_segments(args.segments_pkl)
    source_records, mean_lat = build_track_records(
        segments=segments,
        direction_bin_count=args.direction_bin_count,
        min_points=args.min_points,
        min_displacement_m=args.min_displacement_m,
        signature_points=args.signature_points,
    )
    records, kept_records, clustering_details = resolve_corridor_solution(
        source_records=source_records,
        cluster_mode=args.cluster_mode,
        direction_bin_count=args.direction_bin_count,
        top_k_per_direction=args.top_k_per_direction,
        min_cluster_size=args.min_cluster_size,
        global_angle_scale=args.global_angle_scale,
        min_representative_length_ratio=args.min_representative_length_ratio,
        max_width_ratio=args.max_corridor_width_ratio,
        max_circular_spread=args.max_circular_spread,
    )

    summary = build_summary(
        records=records,
        kept_records=kept_records,
        params={
            "segmentsPkl": str(args.segments_pkl),
            "referenceImage": str(args.reference_image),
            "clusterMode": args.cluster_mode,
            "requestedClusterMode": args.cluster_mode,
            "directionBinCount": args.direction_bin_count,
            "topKPerDirection": args.top_k_per_direction,
            "minClusterSize": args.min_cluster_size,
            "minPoints": args.min_points,
            "minDisplacementMeters": args.min_displacement_m,
            "signaturePoints": args.signature_points,
            "globalAngleScale": args.global_angle_scale,
            "minRepresentativeLengthRatio": args.min_representative_length_ratio,
            "maxCorridorWidthRatio": args.max_corridor_width_ratio,
            "maxCircularSpread": args.max_circular_spread,
            "meanLatitude": round(mean_lat, 6),
        },
        clustering_details=clustering_details,
    )

    cleaned_points_path = args.output_dir / "senior_main_corridors_cleaned_points.csv"
    track_stats_path = args.output_dir / "senior_main_corridors_track_stats.csv"
    summary_path = args.output_dir / "senior_main_corridors_summary.json"
    figure_path = args.output_dir / "senior_main_corridors_comparison.png"
    route_editor_tracks_path = PUBLIC_DATA_DIR / "main-corridor-tracks.json"

    export_cleaned_points_csv(kept_records, cleaned_points_path)
    export_track_stats_csv(records, track_stats_path)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    create_comparison_figure(args.reference_image, records, kept_records, figure_path, summary)
    export_route_editor_tracks_json(kept_records, summary, route_editor_tracks_path, cleaned_points_path, summary_path)

    print(f"Saved figure: {figure_path}")
    print(f"Saved summary: {summary_path}")
    print(f"Saved cleaned points: {cleaned_points_path}")
    print(f"Saved track stats: {track_stats_path}")
    print(f"Saved RouteEditor tracks: {route_editor_tracks_path}")
    print(f"Requested mode: {summary.get('requestedClusterMode', summary['clusterMode'])}")
    print(f"Resolved mode: {summary['clusterMode']}")
    print(f"Raw segments: {summary['rawSegments']}")
    print(f"Kept main corridors: {summary['keptSegments']}")
    print(f"Removed segments: {summary['removedSegments']}")
    print(f"Raw points: {summary['rawPoints']}")
    print(f"Kept points: {summary['keptPoints']}")
    print(f"Rejected corridors: {', '.join(summary.get('qualityFilter', {}).get('rejectedCorridors', [])) or 'none'}")

    if args.show:
        Image.open(figure_path).show()
        print("Opened comparison figure with Image.show().")


if __name__ == "__main__":
    main()
