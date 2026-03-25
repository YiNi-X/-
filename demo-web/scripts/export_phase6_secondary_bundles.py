from __future__ import annotations

import argparse
import math
import pickle
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import extract_main_corridors_from_clustered_ais as corridor_tools
from phase6_bundle_common import (
    MODULES_DIR,
    PUBLIC_DATA_DIR,
    REVIEW_DIR,
    ROOT,
    WEB_ROOT,
    artifact_record,
    build_time_range,
    copy_json,
    ensure_dir,
    find_first,
    iso_now,
    read_json,
    repo_rel,
    round_float,
    upsert_module_index,
    write_artifact_index,
    write_json,
)

CLUSTERING_REQUIREMENTS = ["CLUS-01", "CLUS-02", "CLUS-04", "BASE-02", "BASE-05"]
EVALUATION_REQUIREMENTS = ["EVAL-01", "EVAL-02", "EVAL-03", "EVAL-05", "BASE-02", "BASE-05"]
OVERVIEW_REQUIREMENTS = ["OVER-01", "OVER-02", "OVER-03", "BASE-02", "BASE-05"]
CLUSTERING_SCENARIO_ID = "clustered-ais-v1"
EVALUATION_SCENARIO_ID = "phase6-evaluation-v1"
OVERVIEW_SCENARIO_ID = "phase6-overview-v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Phase 6 clustering, evaluation, and overview bundles.")
    parser.add_argument("--module", choices=["clustering", "evaluation", "overview", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true", help="Describe what would be written without modifying files.")
    return parser.parse_args()


def clean_nonfinite(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: clean_nonfinite(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean_nonfinite(item) for item in value]
    if isinstance(value, float):
        return None if not math.isfinite(value) else value
    return value


def parse_segment_point(value: Any) -> tuple[float, float]:
    if isinstance(value, (list, tuple, np.ndarray)):
        arr = np.asarray(value, dtype=float).reshape(-1)
        return float(arr[0]), float(arr[1])
    text = str(value).replace("[", " ").replace("]", " ").split()
    if len(text) != 2:
        raise ValueError(f"Unexpected segment point format: {value}")
    return float(text[0]), float(text[1])


def downsample_indices(length: int, max_points: int) -> list[int]:
    if length <= max_points:
        return list(range(length))
    return np.linspace(0, length - 1, max_points, dtype=int).tolist()


def preview_track(points: list[dict[str, Any]], track_id: str, stage: str) -> dict[str, Any]:
    return {
        "trackId": track_id,
        "stage": stage,
        "pointCount": len(points),
        "points": points,
    }


def build_raw_preview(cleaned_path: Path, max_tracks: int = 24, max_points: int = 80) -> tuple[dict[str, Any], dict[str, Any]]:
    df = pd.read_csv(cleaned_path, usecols=["mmsi", "time", "lon", "lat", "cog", "sog"])
    df["time"] = pd.to_datetime(df["time"])
    df = df.sort_values(["mmsi", "time"])
    tracks: list[dict[str, Any]] = []

    for mmsi, group in df.groupby("mmsi", sort=False):
        if len(group) < 20:
            continue
        sampled = group.iloc[downsample_indices(len(group), max_points)]
        points = [
            {
                "lon": round_float(row.lon, 6),
                "lat": round_float(row.lat, 6),
                "time": pd.Timestamp(row.time).isoformat(),
                "cog": None if pd.isna(row.cog) else round_float(row.cog, 2),
                "sog": None if pd.isna(row.sog) else round_float(row.sog, 2),
            }
            for row in sampled.itertuples()
        ]
        tracks.append(preview_track(points, str(int(float(mmsi))), "raw"))
        if len(tracks) >= max_tracks:
            break

    meta = {
        "rowCount": int(len(df)),
        "mmsiCount": int(df["mmsi"].nunique()),
        "timeRange": build_time_range(df["time"].min().isoformat(), df["time"].max().isoformat()),
    }
    return {
        "samplingMode": "first-24-valid-tracks-downsampled",
        "trackCount": len(tracks),
        "tracks": tracks,
    }, meta


def load_segments(path: Path) -> list[list[dict[str, Any]]]:
    with path.open("rb") as handle:
        return pickle.load(handle)


def build_segment_preview(
    segments: list[list[dict[str, Any]]],
    *,
    stage: str,
    max_tracks: int = 80,
    max_points: int = 24,
) -> dict[str, Any]:
    if not segments:
        return {"samplingMode": "empty", "trackCount": 0, "tracks": []}
    stride = max(1, len(segments) // max_tracks)
    chosen = segments[::stride][:max_tracks]
    tracks: list[dict[str, Any]] = []
    for index, segment in enumerate(chosen):
        selected = [segment[i] for i in downsample_indices(len(segment), max_points)]
        points = []
        for point_index, item in enumerate(selected):
            lat, lon = parse_segment_point(item["point"])
            points.append(
                {
                    "index": point_index,
                    "lon": round_float(lon, 6),
                    "lat": round_float(lat, 6),
                    "time": pd.Timestamp(item["time"]).isoformat(),
                    "cog": None if item.get("cog") is None else round_float(item["cog"], 2),
                }
            )
        tracks.append(preview_track(points, f"{stage}-{index:04d}", stage))
    return {
        "samplingMode": f"every-{stride}-tracks-downsampled",
        "trackCount": len(tracks),
        "tracks": tracks,
    }


def build_corridor_preview(corridor_data: dict[str, Any], max_corridors: int = 6, max_tracks_per_corridor: int = 3, max_points: int = 30) -> dict[str, Any]:
    selected_corridors = corridor_data["corridors"][:max_corridors]
    corridor_ids = {item["corridorId"] for item in selected_corridors}
    preview_tracks: list[dict[str, Any]] = []
    for corridor_id in corridor_ids:
        corridor_tracks = [item for item in corridor_data["tracks"] if item["corridorId"] == corridor_id][:max_tracks_per_corridor]
        for track in corridor_tracks:
            selected = [track["points"][i] for i in downsample_indices(len(track["points"]), max_points)]
            preview_tracks.append(
                {
                    "trackId": track["id"],
                    "corridorId": corridor_id,
                    "directionLabel": track.get("directionLabel", ""),
                    "pointCount": len(track["points"]),
                    "points": selected,
                }
            )
    return {
        "samplingMode": "top-corridors-top-tracks-downsampled",
        "corridorCount": len(selected_corridors),
        "trackCount": len(preview_tracks),
        "corridors": selected_corridors,
        "tracks": preview_tracks,
    }


def generate_forecast_review_image() -> str:
    runtime = read_json(MODULES_DIR / "forecast" / "forecast-runtime.json")
    timeline = runtime["timeline"]
    x = np.arange(len(timeline))
    current = np.asarray([item["current"]["totalFlow"] for item in timeline], dtype=float)
    forecast_1h = np.asarray([item["forecast"]["1h"]["totalFlow"] for item in timeline], dtype=float)
    forecast_2h = np.asarray([item["forecast"]["2h"]["totalFlow"] for item in timeline], dtype=float)
    forecast_3h = np.asarray([item["forecast"]["3h"]["totalFlow"] for item in timeline], dtype=float)

    output_path = REVIEW_DIR / "forecast-total-flow-review.png"
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(x, current, label="Current total flow", color="#0b132b", linewidth=1.6)
    ax.plot(x, forecast_1h, label="Forecast 1h", color="#0077b6", linewidth=1.0)
    ax.plot(x, forecast_2h, label="Forecast 2h", color="#43aa8b", linewidth=1.0)
    ax.plot(x, forecast_3h, label="Forecast 3h", color="#f4a261", linewidth=1.0)
    ax.set_title("Phase 6 Forecast Review: Current vs Horizon Totals")
    ax.set_xlabel("Timeline frame")
    ax.set_ylabel("Total flow")
    ax.grid(alpha=0.15)
    ax.legend(frameon=False, ncol=4)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    return repo_rel(output_path)


def generate_repair_review_images() -> list[str]:
    trajectories = read_json(MODULES_DIR / "repair" / "repair-trajectories.json")
    errors = read_json(MODULES_DIR / "repair" / "repair-errors.json")
    sample = trajectories["samples"][0]
    error_sample = errors["samples"][0]

    output_paths: list[str] = []

    overlay_path = REVIEW_DIR / "repair-target-1-review.png"
    fig, ax = plt.subplots(figsize=(8, 8))
    missing = np.asarray([[point["lon"], point["lat"]] for point in sample["missing"]], dtype=float)
    ground_truth = np.asarray([[point["lon"], point["lat"]] for point in sample["groundTruth"]], dtype=float)
    neural = np.asarray([[point["lon"], point["lat"]] for point in sample["repairs"]["att-bilstm"]["points"]], dtype=float)
    baseline = np.asarray([[point["lon"], point["lat"]] for point in sample["repairs"]["linear-interpolation"]["points"]], dtype=float)
    ax.plot(ground_truth[:, 0], ground_truth[:, 1], color="#0b132b", linewidth=2.2, label="Ground truth")
    ax.plot(missing[:, 0], missing[:, 1], color="#adb5bd", linewidth=1.0, alpha=0.9, label="Missing / noisy")
    ax.plot(neural[:, 0], neural[:, 1], color="#1d3557", linewidth=1.4, label="ATT-BILSTM")
    ax.plot(baseline[:, 0], baseline[:, 1], color="#ef476f", linewidth=1.1, label="Linear interpolation")
    ax.set_title("Phase 6 Repair Review: Target 1 Sample 1")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.grid(alpha=0.15)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(overlay_path, dpi=180)
    plt.close(fig)
    output_paths.append(repo_rel(overlay_path))

    error_path = REVIEW_DIR / "repair-target-1-errors-review.png"
    fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
    models = ["att-bilstm", "lstm", "linear-interpolation"]
    colors = {"att-bilstm": "#1d3557", "lstm": "#43aa8b", "linear-interpolation": "#ef476f"}
    labels = {"att-bilstm": "ATT-BILSTM", "lstm": "LSTM", "linear-interpolation": "Linear interpolation"}
    for model in models:
        series = error_sample["models"][model]
        x = np.arange(len(series["lonDifference"]))
        axes[0].plot(x, series["lonDifference"], label=labels[model], color=colors[model], linewidth=1.0)
        axes[1].plot(x, series["latDifference"], label=labels[model], color=colors[model], linewidth=1.0)
    axes[0].set_title("Longitude Difference")
    axes[1].set_title("Latitude Difference")
    axes[1].set_xlabel("Point index")
    for ax in axes:
        ax.grid(alpha=0.15)
        ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(error_path, dpi=180)
    plt.close(fig)
    output_paths.append(repo_rel(error_path))

    return output_paths

def build_corridor_review_from_compressed(compressed_path: Path, dry_run: bool) -> tuple[dict[str, Any], dict[str, Any], list[corridor_tools.TrackRecord], list[corridor_tools.TrackRecord]]:
    segments = corridor_tools.load_segments(compressed_path)
    source_records, mean_lat = corridor_tools.build_track_records(
        segments=segments,
        direction_bin_count=8,
        min_points=4,
        min_displacement_m=4000.0,
        signature_points=9,
    )
    records, kept_records, clustering_details = corridor_tools.resolve_corridor_solution(
        source_records=source_records,
        cluster_mode="auto",
        direction_bin_count=8,
        top_k_per_direction=2,
        min_cluster_size=12,
        global_angle_scale=0.08,
        min_representative_length_ratio=corridor_tools.DEFAULT_MIN_REPRESENTATIVE_LENGTH_RATIO,
        max_width_ratio=corridor_tools.DEFAULT_MAX_CORRIDOR_WIDTH_RATIO,
        max_circular_spread=corridor_tools.DEFAULT_MAX_CIRCULAR_SPREAD,
    )
    summary = corridor_tools.build_summary(
        records=records,
        kept_records=kept_records,
        params={
            "segmentsPkl": str(compressed_path),
            "referenceImage": str(corridor_tools.DEFAULT_REFERENCE_IMAGE),
            "clusterMode": "auto",
            "requestedClusterMode": "auto",
            "directionBinCount": 8,
            "topKPerDirection": 2,
            "minClusterSize": 12,
            "minPoints": 4,
            "minDisplacementMeters": 4000.0,
            "signaturePoints": 9,
            "globalAngleScale": 0.08,
            "minRepresentativeLengthRatio": corridor_tools.DEFAULT_MIN_REPRESENTATIVE_LENGTH_RATIO,
            "maxCorridorWidthRatio": corridor_tools.DEFAULT_MAX_CORRIDOR_WIDTH_RATIO,
            "maxCircularSpread": corridor_tools.DEFAULT_MAX_CIRCULAR_SPREAD,
            "meanLatitude": round_float(mean_lat, 6),
        },
        clustering_details=clustering_details,
    )
    summary = clean_nonfinite(summary)

    review_tracks_path = REVIEW_DIR / "corridor-review-tracks.json"
    review_points_path = REVIEW_DIR / "corridor-review-cleaned-points.csv"
    review_summary_path = REVIEW_DIR / "corridor-review-summary.json"
    if not dry_run:
        corridor_tools.export_cleaned_points_csv(kept_records, review_points_path)
        write_json(review_summary_path, summary)
        corridor_tools.export_route_editor_tracks_json(kept_records, summary, review_tracks_path, review_points_path, review_summary_path)
    review_tracks = read_json(review_tracks_path) if review_tracks_path.exists() and not dry_run else {}
    return summary, review_tracks, records, kept_records


def generate_clustering_review_images(records: list[corridor_tools.TrackRecord], kept_records: list[corridor_tools.TrackRecord], summary: dict[str, Any], dry_run: bool) -> list[str]:
    output_paths: list[str] = []
    compressed_path = REVIEW_DIR / "clustering-compressed-review.png"
    corridor_path = REVIEW_DIR / "clustering-corridor-review.png"
    if dry_run:
        return [repo_rel(compressed_path), repo_rel(corridor_path)]

    fig, ax = plt.subplots(figsize=(10, 8))
    corridor_tools.plot_track_set(ax, records, color="#3a86ff", alpha=0.12, linewidth=0.55)
    ax.set_title("Phase 6 Clustering Review: Compressed Segments")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.grid(alpha=0.15)
    fig.tight_layout()
    fig.savefig(compressed_path, dpi=180)
    plt.close(fig)
    output_paths.append(repo_rel(compressed_path))

    corridor_tools.create_comparison_figure(corridor_tools.DEFAULT_REFERENCE_IMAGE, records, kept_records, corridor_path, summary)
    output_paths.append(repo_rel(corridor_path))
    return output_paths


def build_clustering_package(dry_run: bool) -> list[str]:
    cleaned_path = find_first(["cleaned_ais.CSV"])
    shaixuan_path = find_first(["shaixuanhou_.csv"])
    segmented_path = find_first(["segments(60-90).pkl"])
    compressed_path = find_first(["compressed_segments(60,90,0.03).pkl"])
    corridor_runtime_src = PUBLIC_DATA_DIR / "main-corridor-tracks.json"

    raw_preview, raw_meta = build_raw_preview(cleaned_path)
    segmented = load_segments(segmented_path)
    compressed = load_segments(compressed_path)
    segmented_preview = build_segment_preview(segmented, stage="segmented")
    compressed_preview = build_segment_preview(compressed, stage="compressed")
    runtime_corridor_data = read_json(corridor_runtime_src)
    corridor_preview = build_corridor_preview(runtime_corridor_data)
    review_summary, review_tracks, records, kept_records = build_corridor_review_from_compressed(compressed_path, dry_run)
    review_images = generate_clustering_review_images(records, kept_records, review_summary, dry_run)

    shaixuan_df = pd.read_csv(shaixuan_path, usecols=["mmsi"])
    review_corridor_count = review_tracks.get("corridorCount", review_summary.get("keptSegments", 0))
    review_track_count = review_tracks.get("trackCount", review_summary.get("keptSegments", 0))
    time_range = raw_meta["timeRange"]

    module_dir = MODULES_DIR / "clustering"
    summary_dest = module_dir / "clustering-summary.json"
    previews_dest = module_dir / "clustering-stage-previews.json"
    corridor_runtime_dest = module_dir / "clustering-corridor-runtime.json"
    corridor_review_dest = module_dir / "clustering-corridor-review.json"
    bundle_dest = module_dir / "clustering-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    summary = {
        "artifactId": "clustering-summary",
        "module": "clustering",
        "scenarioId": CLUSTERING_SCENARIO_ID,
        "generatedAt": iso_now(),
        "timeRange": time_range,
        "stageCounts": {
            "rawAisRows": raw_meta["rowCount"],
            "rawMmsiCount": raw_meta["mmsiCount"],
            "filteredResearchRows": int(len(shaixuan_df)),
            "filteredResearchMmsiCount": int(shaixuan_df["mmsi"].nunique()),
            "segmentedTracks": int(len(segmented)),
            "segmentedPoints": int(sum(len(segment) for segment in segmented)),
            "compressedTracks": int(len(compressed)),
            "compressedPoints": int(sum(len(segment) for segment in compressed)),
            "corridorRuntimeCorridors": int(runtime_corridor_data["corridorCount"]),
            "corridorRuntimeTracks": int(runtime_corridor_data["trackCount"]),
            "corridorReviewCorridors": int(review_corridor_count),
            "corridorReviewTracks": int(review_track_count),
        },
        "layerOrder": ["raw", "segmented", "compressed", "corridor/exported", "corridor/review"],
        "reviewStatus": {
            "corridorPromotion": "not-promoted",
            "runtimeCorridorPath": "data/main-corridor-tracks.json",
            "reviewCorridorPath": "analysis/review/corridor-review-tracks.json",
        },
        "reviewFiles": review_images,
        "deferred": [
            {
                "artifactId": "clustering-noise-reclustered",
                "reason": "normalized_distances(60,90,0.03).pkl is unreadable and the notebook-grade noise re-clustering path is not stable in the current environment.",
                "dependsOn": ["CLUS-03", "Phase 10"],
            }
        ],
    }
    previews = {
        "artifactId": "clustering-stage-previews",
        "module": "clustering",
        "scenarioId": CLUSTERING_SCENARIO_ID,
        "generatedAt": iso_now(),
        "previews": {
            "raw": raw_preview,
            "segmented": segmented_preview,
            "compressed": compressed_preview,
            "corridorExported": corridor_preview,
            "corridorReview": build_corridor_preview(review_tracks or runtime_corridor_data) if review_tracks else corridor_preview,
        },
    }
    bundle = {
        "artifactId": "clustering-bundle",
        "module": "clustering",
        "generatedAt": iso_now(),
        "scenarioId": CLUSTERING_SCENARIO_ID,
        "timeRange": time_range,
        "entryFiles": {
            "summary": f"data/modules/clustering/{summary_dest.name}",
            "stagePreviews": f"data/modules/clustering/{previews_dest.name}",
            "corridorRuntime": f"data/modules/clustering/{corridor_runtime_dest.name}",
            "corridorReview": f"data/modules/clustering/{corridor_review_dest.name}",
        },
        "deferred": ["clustering-noise-reclustered"],
    }
    manifest = {
        "artifactId": "clustering-manifest",
        "module": "clustering",
        "sourceStage": "exported",
        "derivedFrom": [
            "clustering-raw-cleaned-ais",
            "clustering-shaixuanhou-csv",
            "clustering-segmented-pkl",
            "clustering-compressed-pkl",
            "clustering-corridor-runtime",
            "clustering-corridor-review",
        ],
        "scenarioId": CLUSTERING_SCENARIO_ID,
        "timeRange": time_range,
        "authoritativeFor": CLUSTERING_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/clustering/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="clustering-summary",
                module="clustering",
                source_stage="exported",
                derived_from=["clustering-raw-cleaned-ais", "clustering-shaixuanhou-csv", "clustering-segmented-pkl", "clustering-compressed-pkl", "clustering-corridor-runtime"],
                scenario_id=CLUSTERING_SCENARIO_ID,
                time_range=time_range,
                authoritative_for=["CLUS-01", "CLUS-02"],
                path=f"data/modules/clustering/{summary_dest.name}",
                description="Stage counts, review status, and deferred clustering boundaries.",
            ),
            artifact_record(
                artifact_id="clustering-stage-previews",
                module="clustering",
                source_stage="exported",
                derived_from=["clustering-raw-cleaned-ais", "clustering-segmented-pkl", "clustering-compressed-pkl", "clustering-corridor-runtime"],
                scenario_id=CLUSTERING_SCENARIO_ID,
                time_range=time_range,
                authoritative_for=["CLUS-01", "CLUS-04"],
                path=f"data/modules/clustering/{previews_dest.name}",
                description="Curated preview data for raw, segmented, compressed, and corridor layers.",
            ),
            artifact_record(
                artifact_id="clustering-corridor-review",
                module="clustering",
                source_stage="exported-review",
                derived_from=["clustering-compressed-pkl"],
                scenario_id=CLUSTERING_SCENARIO_ID,
                time_range=time_range,
                authoritative_for=["CLUS-04", "BASE-05"],
                path=f"data/modules/clustering/{corridor_review_dest.name}",
                status="review-first",
                description="Regenerated corridor output kept separate from the live runtime dataset.",
            ),
            artifact_record(
                artifact_id="clustering-bundle",
                module="clustering",
                source_stage="exported",
                derived_from=["clustering-summary", "clustering-stage-previews", "clustering-corridor-runtime", "clustering-corridor-review"],
                scenario_id=CLUSTERING_SCENARIO_ID,
                time_range=time_range,
                authoritative_for=CLUSTERING_REQUIREMENTS,
                path=f"data/modules/clustering/{bundle_dest.name}",
                description="Module entry bundle for clustering data discovery.",
            ),
        ],
        "reviewFiles": review_images,
        "sources": {
            "clustering-raw-cleaned-ais": repo_rel(cleaned_path),
            "clustering-shaixuanhou-csv": repo_rel(shaixuan_path),
            "clustering-segmented-pkl": repo_rel(segmented_path),
            "clustering-compressed-pkl": repo_rel(compressed_path),
            "clustering-corridor-runtime": repo_rel(corridor_runtime_src),
            "clustering-corridor-review": repo_rel(REVIEW_DIR / "corridor-review-tracks.json"),
        },
        "deferred": summary["deferred"],
    }

    if dry_run:
        print("[dry-run] clustering package")
        print(f"  module dir: {module_dir}")
        print(f"  summary: {summary_dest.name}")
        print(f"  stage previews: {previews_dest.name}")
        print(f"  runtime corridor copy: {corridor_runtime_dest.name}")
        print(f"  review corridor copy: {corridor_review_dest.name}")
        print(f"  review images: {', '.join(review_images)}")
        return [str(summary_dest), str(previews_dest), str(corridor_runtime_dest), str(corridor_review_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    copy_json(corridor_runtime_src, corridor_runtime_dest)
    if review_tracks:
        write_json(corridor_review_dest, review_tracks)
    write_json(summary_dest, summary)
    write_json(previews_dest, previews)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)

    index = upsert_module_index(
        {
            "module": "clustering",
            "status": "ready",
            "manifestPath": f"data/modules/clustering/{manifest_dest.name}",
            "bundlePath": f"data/modules/clustering/{bundle_dest.name}",
            "scenarioId": CLUSTERING_SCENARIO_ID,
            "timeRange": time_range,
            "authoritativeFor": CLUSTERING_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(summary_dest), repo_rel(previews_dest), repo_rel(corridor_runtime_dest), repo_rel(corridor_review_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]

def aggregate_repair_metrics(repair_metrics: dict[str, Any]) -> list[dict[str, Any]]:
    accumulators: dict[str, dict[str, Any]] = {}
    for sample in repair_metrics["samples"]:
        for row in sample["metrics"]:
            item = accumulators.setdefault(
                row["modelId"],
                {
                    "modelId": row["modelId"],
                    "modelLabel": row["modelLabel"],
                    "sampleCount": 0,
                    "rmse": [],
                    "mae": [],
                    "dtwSimilarity": [],
                    "ade": [],
                    "r2": [],
                    "hausdorffDistance": [],
                },
            )
            item["sampleCount"] += 1
            for key in ["rmse", "mae", "dtwSimilarity", "ade", "r2", "hausdorffDistance"]:
                item[key].append(float(row[key]))

    aggregated: list[dict[str, Any]] = []
    for item in accumulators.values():
        aggregated.append(
            {
                "modelId": item["modelId"],
                "modelLabel": item["modelLabel"],
                "sampleCount": item["sampleCount"],
                "rmse": round_float(np.mean(item["rmse"]), 6),
                "mae": round_float(np.mean(item["mae"]), 6),
                "dtwSimilarity": round_float(np.mean(item["dtwSimilarity"]), 6),
                "ade": round_float(np.mean(item["ade"]), 6),
                "r2": round_float(np.mean(item["r2"]), 6),
                "hausdorffDistance": round_float(np.mean(item["hausdorffDistance"]), 6),
            }
        )
    aggregated.sort(key=lambda item: (item["rmse"], item["mae"], item["modelLabel"]))
    for index, item in enumerate(aggregated, start=1):
        item["rankByRmse"] = index
    return aggregated


def build_evaluation_package(dry_run: bool) -> list[str]:
    artifact_index = read_json(MODULES_DIR / "artifact-index.json")
    forecast_metrics = read_json(MODULES_DIR / "forecast" / "forecast-metrics.json")
    repair_metrics = read_json(MODULES_DIR / "repair" / "repair-metrics.json")
    repair_aggregate = aggregate_repair_metrics(repair_metrics)

    module_dir = MODULES_DIR / "evaluation"
    metrics_dest = module_dir / "evaluation-metrics.json"
    bundle_dest = module_dir / "evaluation-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    forecast_rankings = {
        horizon: {
            "rmse": [{"model": "STGCN", "value": payload["rmse"], "rank": 1}],
            "mae": [{"model": "STGCN", "value": payload["mae"], "rank": 1}],
            "r2": [{"model": "STGCN", "value": payload["r2"], "rank": 1}],
        }
        for horizon, payload in forecast_metrics["models"]["STGCN"]["horizons"].items()
    }

    metrics = {
        "artifactId": "evaluation-metrics",
        "module": "evaluation",
        "scenarioId": EVALUATION_SCENARIO_ID,
        "generatedAt": iso_now(),
        "forecast": {
            "metricScope": forecast_metrics["metricBasis"],
            "supportedMetrics": ["mae", "rmse", "r2"],
            "models": forecast_metrics["models"],
            "deferredModels": forecast_metrics["deferredModels"],
            "rankings": forecast_rankings,
        },
        "repair": {
            "supportedMetrics": ["rmse", "mae", "dtwSimilarity", "ade", "r2", "hausdorffDistance"],
            "sampleMetrics": repair_metrics["samples"],
            "aggregateByModel": repair_aggregate,
            "rankings": {
                "rmse": [{"model": item["modelLabel"], "value": item["rmse"], "rank": item["rankByRmse"]} for item in repair_aggregate],
                "mae": [{"model": item["modelLabel"], "value": item["mae"], "rank": rank + 1} for rank, item in enumerate(sorted(repair_aggregate, key=lambda row: (row["mae"], row["modelLabel"])))],
                "r2": [{"model": item["modelLabel"], "value": item["r2"], "rank": rank + 1} for rank, item in enumerate(sorted(repair_aggregate, key=lambda row: (-row["r2"], row["modelLabel"])))],
            },
        },
        "traceability": {
            "artifactIndex": "data/modules/artifact-index.json",
            "forecastMetrics": "data/modules/forecast/forecast-metrics.json",
            "repairMetrics": "data/modules/repair/repair-metrics.json",
        },
    }
    bundle = {
        "artifactId": "evaluation-bundle",
        "module": "evaluation",
        "generatedAt": iso_now(),
        "scenarioId": EVALUATION_SCENARIO_ID,
        "timeRange": build_time_range("module-derived", "module-derived"),
        "entryFiles": {"metrics": f"data/modules/evaluation/{metrics_dest.name}"},
    }
    manifest = {
        "artifactId": "evaluation-manifest",
        "module": "evaluation",
        "sourceStage": "exported",
        "derivedFrom": ["forecast-manifest", "repair-manifest", "artifact-index"],
        "scenarioId": EVALUATION_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": EVALUATION_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/evaluation/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="evaluation-metrics",
                module="evaluation",
                source_stage="exported",
                derived_from=["forecast-metrics", "repair-metrics-export"],
                scenario_id=EVALUATION_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["EVAL-01", "EVAL-02", "EVAL-03", "EVAL-05"],
                path=f"data/modules/evaluation/{metrics_dest.name}",
                description="Unified evaluation metrics derived from the forecast and repair bundles.",
            ),
            artifact_record(
                artifact_id="evaluation-bundle",
                module="evaluation",
                source_stage="exported",
                derived_from=["evaluation-metrics"],
                scenario_id=EVALUATION_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=EVALUATION_REQUIREMENTS,
                path=f"data/modules/evaluation/{bundle_dest.name}",
                description="Module entry bundle for evaluation data discovery.",
            ),
        ],
        "sources": {
            "artifact-index": repo_rel(MODULES_DIR / "artifact-index.json"),
            "forecast-manifest": repo_rel(MODULES_DIR / "forecast" / "manifest.json"),
            "repair-manifest": repo_rel(MODULES_DIR / "repair" / "manifest.json"),
        },
    }

    if dry_run:
        print("[dry-run] evaluation package")
        print(f"  module dir: {module_dir}")
        print(f"  metrics: {metrics_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        print(f"  upstream modules: {[item['module'] for item in artifact_index['modules']]}")
        return [str(metrics_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    write_json(metrics_dest, metrics)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)
    index = upsert_module_index(
        {
            "module": "evaluation",
            "status": "ready",
            "manifestPath": f"data/modules/evaluation/{manifest_dest.name}",
            "bundlePath": f"data/modules/evaluation/{bundle_dest.name}",
            "scenarioId": EVALUATION_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": EVALUATION_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(metrics_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def build_overview_package(dry_run: bool) -> list[str]:
    artifact_index = read_json(MODULES_DIR / "artifact-index.json")
    forecast_bundle = read_json(MODULES_DIR / "forecast" / "forecast-bundle.json")
    forecast_runtime = read_json(MODULES_DIR / "forecast" / "forecast-runtime.json")
    repair_bundle = read_json(MODULES_DIR / "repair" / "repair-bundle.json")
    repair_samples = read_json(MODULES_DIR / "repair" / "repair-samples.json")
    clustering_summary = read_json(MODULES_DIR / "clustering" / "clustering-summary.json")
    evaluation_metrics = read_json(MODULES_DIR / "evaluation" / "evaluation-metrics.json")

    module_dir = MODULES_DIR / "overview"
    summary_dest = module_dir / "overview-summary.json"
    bundle_dest = module_dir / "overview-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    overview = {
        "artifactId": "overview-summary",
        "module": "overview",
        "scenarioId": OVERVIEW_SCENARIO_ID,
        "generatedAt": iso_now(),
        "framing": "Archived AIS playback plus offline-computed inference; not a live AIS backend.",
        "businessLoop": [
            {"step": "Archived AIS Playback", "description": "Use committed historical AIS playback as the common scene clock.", "sourceArtifacts": ["forecast-runtime", "clustering-raw-cleaned-ais"]},
            {"step": "Trajectory Clustering and Corridor Extraction", "description": "Explain movement structure from raw to segmented, compressed, and corridor layers.", "sourceArtifacts": ["clustering-summary", "clustering-stage-previews"]},
            {"step": "Flow Prediction", "description": "Project near-future traffic change across the archived playback timeline.", "sourceArtifacts": ["forecast-bundle", "forecast-metrics"]},
            {"step": "Trajectory Repair", "description": "Show how damaged sample tracks are reconstructed and evaluated.", "sourceArtifacts": ["repair-bundle", "repair-metrics-export"]},
            {"step": "Evaluation and Decision Readiness", "description": "Use metrics and review-first evidence to prepare later decision support work.", "sourceArtifacts": ["evaluation-metrics"]},
        ],
        "modules": [item for item in artifact_index["modules"] if item["module"] != "overview"],
        "dataScale": {
            "forecast": {
                "timelineFrames": len(forecast_runtime["timeline"]),
                "availableModels": forecast_bundle["availableModels"],
                "deferredModels": forecast_bundle["deferredModels"],
                "horizons": forecast_bundle["horizons"],
            },
            "repair": {
                "sampleCount": repair_bundle["sampleCount"],
                "availableModels": repair_bundle["availableModels"],
                "curatedSamples": [sample["sampleId"] for sample in repair_samples["samples"]],
            },
            "clustering": clustering_summary["stageCounts"],
        },
        "evaluationReady": {
            "forecastMetrics": list(evaluation_metrics["forecast"]["supportedMetrics"]),
            "repairMetrics": list(evaluation_metrics["repair"]["supportedMetrics"]),
        },
        "deferredModules": [
            {
                "module": "collaborative-decision",
                "status": "later-phase",
                "reason": "Phase 6 stabilizes evidence packages first; strategy evidence remains intentionally deferred.",
            }
        ],
    }
    bundle = {
        "artifactId": "overview-bundle",
        "module": "overview",
        "generatedAt": iso_now(),
        "scenarioId": OVERVIEW_SCENARIO_ID,
        "timeRange": build_time_range("module-derived", "module-derived"),
        "entryFiles": {"summary": f"data/modules/overview/{summary_dest.name}"},
    }
    manifest = {
        "artifactId": "overview-manifest",
        "module": "overview",
        "sourceStage": "exported",
        "derivedFrom": ["forecast-manifest", "repair-manifest", "clustering-manifest", "evaluation-manifest", "artifact-index"],
        "scenarioId": OVERVIEW_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": OVERVIEW_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/overview/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="overview-summary",
                module="overview",
                source_stage="exported",
                derived_from=["forecast-bundle", "repair-bundle", "clustering-summary", "evaluation-metrics", "artifact-index"],
                scenario_id=OVERVIEW_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["OVER-01", "OVER-02", "OVER-03"],
                path=f"data/modules/overview/{summary_dest.name}",
                description="Business-loop framing and module scale summary derived from Phase 6 bundles.",
            ),
            artifact_record(
                artifact_id="overview-bundle",
                module="overview",
                source_stage="exported",
                derived_from=["overview-summary"],
                scenario_id=OVERVIEW_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=OVERVIEW_REQUIREMENTS,
                path=f"data/modules/overview/{bundle_dest.name}",
                description="Module entry bundle for overview data discovery.",
            ),
        ],
        "sources": {
            "artifact-index": repo_rel(MODULES_DIR / "artifact-index.json"),
            "forecast-bundle": repo_rel(MODULES_DIR / "forecast" / "forecast-bundle.json"),
            "repair-bundle": repo_rel(MODULES_DIR / "repair" / "repair-bundle.json"),
            "clustering-manifest": repo_rel(MODULES_DIR / "clustering" / "manifest.json"),
            "evaluation-manifest": repo_rel(MODULES_DIR / "evaluation" / "manifest.json"),
        },
    }

    if dry_run:
        print("[dry-run] overview package")
        print(f"  module dir: {module_dir}")
        print(f"  summary: {summary_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        return [str(summary_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    write_json(summary_dest, overview)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)
    index = upsert_module_index(
        {
            "module": "overview",
            "status": "ready",
            "manifestPath": f"data/modules/overview/{manifest_dest.name}",
            "bundlePath": f"data/modules/overview/{bundle_dest.name}",
            "scenarioId": OVERVIEW_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": OVERVIEW_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(summary_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def main() -> None:
    args = parse_args()
    written: list[str] = []
    if args.module in {"clustering", "all"}:
        written.extend(build_clustering_package(args.dry_run))
    if args.module in {"evaluation", "all"}:
        written.extend(build_evaluation_package(args.dry_run))
    if args.module in {"overview", "all"}:
        written.extend(build_overview_package(args.dry_run))
    if not args.dry_run:
        forecast_review = generate_forecast_review_image()
        repair_reviews = generate_repair_review_images()
        print("Wrote secondary Phase 6 artifacts:")
        for item in written:
            print(f"- {item}")
        print("Review artifacts:")
        print(f"- {forecast_review}")
        for item in repair_reviews:
            print(f"- {item}")


if __name__ == "__main__":
    main()
