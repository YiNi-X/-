from __future__ import annotations

import argparse
import json
import math
import pickle
from datetime import datetime, timezone
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
EVALUATION_REQUIREMENTS = ["EVAL-01", "EVAL-02", "EVAL-03", "EVAL-04", "EVAL-05", "BASE-02", "BASE-05"]
OVERVIEW_REQUIREMENTS = ["OVER-01", "OVER-02", "OVER-03", "BASE-02", "BASE-05"]
FORWARD_LOOKING_REQUIREMENTS = ["DECI-01", "DECI-02", "DECI-03", "DECI-04"]
CLUSTERING_SCENARIO_ID = "clustered-ais-v1"
EVALUATION_SCENARIO_ID = "phase6-evaluation-v1"
OVERVIEW_SCENARIO_ID = "phase6-overview-v1"
FORWARD_LOOKING_SCENARIO_ID = "phase12-forward-looking-v1"
CLUSTERING_NOISE_ARTIFACT_NAME = "normalized_distances(60,90,0.03).pkl"
CLUSTERING_NOISE_ARTIFACT_ID = "clustering-noise-reclustered"
CLUSTERING_NOISE_LABELS = {
    "dbscan_noise": "DBSCAN noise",
    "non_top_corridor": "Non-top corridor",
    "too_few_points": "Too few points",
    "too_short": "Too short",
}
CLUSTERING_NOISE_NARRATIVES = {
    "dbscan_noise": "These segments currently remain in the unrecovered noise pool and are the most truthful stand-in for deferred CLUS-03.",
    "non_top_corridor": "These segments formed minor directional families but were not promoted into the shipped top-K corridor runtime.",
    "too_few_points": "These segments failed the minimum support threshold before any trustworthy re-clustering story could begin.",
    "too_short": "These segments were removed because displacement stayed below the current corridor extraction threshold.",
}
REPAIR_OPTIMIZATION_DIR = ROOT / "代码依据" / "轨迹修复"
OPTIMIZATION_NOTEBOOK_PATH = REPAIR_OPTIMIZATION_DIR / "代码" / "参数优化.ipynb"
OPTIMIZATION_STUDY_PATH = REPAIR_OPTIMIZATION_DIR / "study1_1.pkl"
OPTIMIZATION_HISTORY_PATH = REPAIR_OPTIMIZATION_DIR / "optimization_history.html"
PARAM_IMPORTANCE_PATH = REPAIR_OPTIMIZATION_DIR / "param_importance.html"
PARALLEL_COORD_PATH = REPAIR_OPTIMIZATION_DIR / "parallel_coord.html"
PARAM_DIST_PATH = REPAIR_OPTIMIZATION_DIR / "param_dist.html"
OPTIMIZATION_PARAM_LABELS = {
    "batch_size": "Batch size",
    "hidden_dim": "Hidden dim",
    "lr": "Learning rate",
    "num_epochs": "Epochs",
    "num_layers": "Layers",
}
OVERVIEW_LABELS = {
    "overview": "Overview",
    "home": "Home",
    "forecast": "Flow Prediction",
    "repair": "Trajectory Repair",
    "clustering": "Trajectory Clustering",
    "evaluation": "Evaluation Center",
    "forward-looking": "Forward-Looking Analysis",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Phase 6 clustering, evaluation, and overview bundles.")
    parser.add_argument("--module", choices=["clustering", "evaluation", "forward-looking", "overview", "all"], default="all")
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


def find_optional(patterns: list[str]) -> Path | None:
    for pattern in patterns:
        matches = sorted(ROOT.rglob(pattern))
        if matches:
            return matches[0]
    return None


def parse_plotly_figure(path: Path) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    plot_start = raw.rfind("Plotly.newPlot(")
    if plot_start < 0:
        raise ValueError(f"Could not find Plotly.newPlot call in {repo_rel(path)}")

    decoder = json.JSONDecoder()
    segment = raw[plot_start + len("Plotly.newPlot(") :].lstrip()
    div_id, offset = decoder.raw_decode(segment)
    segment = segment[offset:].lstrip()
    if not segment.startswith(","):
        raise ValueError(f"Expected Plotly.newPlot data payload in {repo_rel(path)}")

    segment = segment[1:].lstrip()
    data, offset = decoder.raw_decode(segment)
    segment = segment[offset:].lstrip()
    if not segment.startswith(","):
        raise ValueError(f"Expected Plotly.newPlot layout payload in {repo_rel(path)}")

    segment = segment[1:].lstrip()
    layout, _ = decoder.raw_decode(segment)
    return str(div_id), data, layout


def require_trace(data: list[dict[str, Any]], trace_name: str) -> dict[str, Any]:
    for trace in data:
        if trace.get("name") == trace_name:
            return trace
    raise ValueError(f"Missing {trace_name!r} trace in Plotly figure")


def format_optimization_param_label(param_id: str) -> str:
    return OPTIMIZATION_PARAM_LABELS.get(param_id, param_id.replace("_", " ").title())


def format_optimization_param_value(param_id: str, value: float) -> str:
    if param_id == "lr":
        return f"{value:.5f}"
    rounded = round(value)
    if math.isclose(value, rounded):
        return str(int(rounded))
    return f"{value:.3f}"


def convert_param_value(param_id: str, value: float) -> float:
    if param_id == "lr":
        return float(10 ** value)
    return float(value)


def format_scientific(value: float) -> str:
    return f"{float(value):.3e}"


def require_present(value: Any, label: str) -> Any:
    if value is None:
        raise ValueError(f"Missing required overview source: {label}")
    return value


def parse_numeric_text(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace("%", "").strip())
    except ValueError:
        return None


def find_benefit_metric(benefits: list[dict[str, Any]], label: str) -> dict[str, Any] | None:
    for benefit in benefits:
        if benefit.get("label") == label:
            return benefit
    return None


def format_share_percent(value: float) -> str:
    return f"{value * 100:.0f}%"


def build_evaluation_optimization_summary() -> dict[str, Any]:
    required_paths = [
        OPTIMIZATION_NOTEBOOK_PATH,
        OPTIMIZATION_STUDY_PATH,
        OPTIMIZATION_HISTORY_PATH,
        PARAM_IMPORTANCE_PATH,
        PARALLEL_COORD_PATH,
        PARAM_DIST_PATH,
    ]
    missing = [repo_rel(path) for path in required_paths if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing optimization evidence files: {', '.join(missing)}")

    _, history_data, history_layout = parse_plotly_figure(OPTIMIZATION_HISTORY_PATH)
    _, importance_data, _ = parse_plotly_figure(PARAM_IMPORTANCE_PATH)
    _, parallel_coord_data, _ = parse_plotly_figure(PARALLEL_COORD_PATH)

    objective_trace = require_trace(history_data, "Objective Value")
    best_trace = require_trace(history_data, "Best Value")
    infeasible_trace = require_trace(history_data, "Infeasible Trial")

    completed_points = [
        {"trial": int(trial), "value": float(value)}
        for trial, value in zip(objective_trace.get("x", []), objective_trace.get("y", []), strict=False)
    ]
    best_curve_points = [
        {"trial": int(trial), "value": float(value)}
        for trial, value in zip(best_trace.get("x", []), best_trace.get("y", []), strict=False)
    ]
    infeasible_trials = int(len(infeasible_trace.get("x", [])))
    total_trial_slots = int(len(best_curve_points))
    completed_trial_count = int(len(completed_points))
    non_completed_trial_slots = max(total_trial_slots - completed_trial_count - infeasible_trials, 0)

    if not completed_points or not best_curve_points:
        raise ValueError("Optimization history export does not contain usable trial points")

    best_completed = min(completed_points, key=lambda item: item["value"])
    first_completed = completed_points[0]

    checkpoints: list[dict[str, Any]] = []
    previous_best: float | None = None
    for point in best_curve_points:
        if previous_best is None or point["value"] < previous_best:
            checkpoints.append({"trial": point["trial"], "value": point["value"]})
            previous_best = point["value"]

    importance_trace = importance_data[0]
    ranked_importance = sorted(
        [
            {"id": str(param_id), "importance": float(score)}
            for param_id, score in zip(importance_trace.get("y", []), importance_trace.get("x", []), strict=False)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    importance_parameters = [
        {
            "id": item["id"],
            "label": format_optimization_param_label(item["id"]),
            "importance": item["importance"],
            "rank": rank + 1,
        }
        for rank, item in enumerate(ranked_importance)
    ]

    parallel_dimensions = parallel_coord_data[0].get("dimensions", [])
    if len(parallel_dimensions) < 2:
        raise ValueError("Parallel coordinate export does not contain optimization dimensions")

    objective_values = [float(value) for value in parallel_dimensions[0].get("values", [])]
    best_dimension_index = min(range(len(objective_values)), key=lambda index: objective_values[index])
    best_parameters: list[dict[str, Any]] = []

    for dimension in parallel_dimensions[1:]:
        param_id = str(dimension.get("label"))
        raw_values = [float(value) for value in dimension.get("values", [])]
        if not raw_values:
            continue
        converted_values = [convert_param_value(param_id, value) for value in raw_values]
        best_value = converted_values[best_dimension_index]
        observed_min = min(converted_values)
        observed_max = max(converted_values)
        best_parameters.append(
            {
                "id": param_id,
                "label": format_optimization_param_label(param_id),
                "value": best_value,
                "displayValue": format_optimization_param_value(param_id, best_value),
                "observedMin": observed_min,
                "observedMax": observed_max,
                "observedMinDisplay": format_optimization_param_value(param_id, observed_min),
                "observedMaxDisplay": format_optimization_param_value(param_id, observed_max),
                "scale": "log10" if param_id == "lr" else "linear",
            }
        )

    top_two_share = sum(item["importance"] for item in importance_parameters[:2])
    summary = (
        "Optimization history is packaged from committed Plotly exports instead of a live notebook rerun. "
        f"The shipped offline study records {total_trial_slots} trial slots, {completed_trial_count} completed objective points, "
        f"and a best visible objective of {best_completed['value']:.3e} at trial {best_completed['trial']}. "
        f"{non_completed_trial_slots} non-complete trial slots stay explicit rather than being backfilled with synthetic values."
    )

    return {
        "artifactId": "evaluation-optimization",
        "module": "evaluation",
        "scenarioId": EVALUATION_SCENARIO_ID,
        "generatedAt": iso_now(),
        "studyId": "study1_1",
        "studyLabel": "Trajectory repair offline study",
        "summary": summary,
        "objective": {
            "metricLabel": str(objective_trace.get("name", "Objective Value")),
            "direction": "lower",
            "totalTrialSlots": total_trial_slots,
            "completedTrials": completed_trial_count,
            "nonCompletedTrialSlots": non_completed_trial_slots,
            "infeasibleTrials": infeasible_trials,
            "firstCompletedTrial": first_completed["trial"],
            "firstCompletedValue": first_completed["value"],
            "bestTrial": best_completed["trial"],
            "bestValue": best_completed["value"],
            "improvementRatio": float(1 - (best_completed["value"] / first_completed["value"])),
            "improvementCount": max(len(checkpoints) - 1, 0),
            "completedPoints": completed_points,
            "bestCurvePoints": best_curve_points,
            "checkpoints": checkpoints,
        },
        "importance": {
            "parameters": importance_parameters,
            "topTwoShare": float(top_two_share),
        },
        "bestParameters": best_parameters,
        "supportingViews": [
            {
                "id": "history-html",
                "label": "Optimization history HTML",
                "path": repo_rel(OPTIMIZATION_HISTORY_PATH),
                "detail": "Raw Plotly export for the completed objective points and best-value line.",
            },
            {
                "id": "importance-html",
                "label": "Parameter importance HTML",
                "path": repo_rel(PARAM_IMPORTANCE_PATH),
                "detail": "Raw Plotly export for the ranked hyperparameter importance view.",
            },
            {
                "id": "parallel-coordinates",
                "label": "Parallel coordinates HTML",
                "path": repo_rel(PARALLEL_COORD_PATH),
                "detail": "Completed-trial parameter coupling across objective value and the tuned knobs.",
            },
            {
                "id": "parameter-slice",
                "label": "Parameter slice HTML",
                "path": repo_rel(PARAM_DIST_PATH),
                "detail": "Feasible-trial slices for each tuned parameter against objective value.",
            },
        ],
        "traceability": {
            "optimizationNotebook": repo_rel(OPTIMIZATION_NOTEBOOK_PATH),
            "optimizationStudy": repo_rel(OPTIMIZATION_STUDY_PATH),
            "optimizationHistoryHtml": repo_rel(OPTIMIZATION_HISTORY_PATH),
            "paramImportanceHtml": repo_rel(PARAM_IMPORTANCE_PATH),
            "parallelCoordHtml": repo_rel(PARALLEL_COORD_PATH),
            "paramDistHtml": repo_rel(PARAM_DIST_PATH),
        },
    }


def describe_clustering_noise_artifact(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {
            "artifactId": CLUSTERING_NOISE_ARTIFACT_ID,
            "fileName": CLUSTERING_NOISE_ARTIFACT_NAME,
            "fileBytes": 0,
            "filePath": "",
            "status": "missing",
            "present": False,
            "lastModified": None,
            "reason": f"{CLUSTERING_NOISE_ARTIFACT_NAME} could not be found in the workspace, so the notebook-grade noise re-clustering path has no authoritative distance matrix to load.",
        }

    stat = path.stat()
    file_bytes = int(stat.st_size)
    repo_path = repo_rel(path)
    last_modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc).replace(microsecond=0).isoformat()
    if file_bytes == 0:
        status = "zero-byte"
        reason = f"{CLUSTERING_NOISE_ARTIFACT_NAME} exists at {repo_path} but is 0 bytes, so the notebook-grade noise re-clustering path has no authoritative distance matrix to load."
    else:
        status = "present"
        reason = f"{CLUSTERING_NOISE_ARTIFACT_NAME} is present at {repo_path} and non-empty. Re-run the notebook-grade noise re-clustering export before enabling CLUS-03 visuals."

    return {
        "artifactId": CLUSTERING_NOISE_ARTIFACT_ID,
        "fileName": path.name,
        "fileBytes": file_bytes,
        "filePath": repo_path,
        "status": status,
        "present": True,
        "lastModified": last_modified,
        "reason": reason,
    }


def build_clustering_noise_fallback(summary: dict[str, Any], noise_artifact: dict[str, Any]) -> dict[str, Any]:
    status = noise_artifact["status"]
    if status == "zero-byte":
        summary_text = (
            "Honest fallback for deferred CLUS-03. The notebook-grade noise re-clustering result cannot be shipped because "
            f"{noise_artifact['fileName']} exists in the workspace but is still 0 bytes, so this panel only exposes verified pre-reclustering statistics."
        )
    elif status == "missing":
        summary_text = (
            "Honest fallback for deferred CLUS-03. The notebook-grade noise re-clustering result cannot be shipped because "
            f"{noise_artifact['fileName']} is still missing from the workspace, so this panel only exposes verified pre-reclustering statistics."
        )
    else:
        summary_text = (
            "Deferred CLUS-03 remains in honest fallback mode. The distance artifact is no longer empty, but the notebook-grade "
            "re-clustering export has not been regenerated into a website-facing bundle yet, so only pre-reclustering statistics are shown."
        )

    drop_reasons = []
    for reason_id, count in summary.get("dropReasons", {}).items():
        drop_reasons.append(
            {
                "id": reason_id,
                "label": CLUSTERING_NOISE_LABELS.get(reason_id, reason_id.replace("_", " ").title()),
                "count": int(count),
                "narrative": CLUSTERING_NOISE_NARRATIVES.get(
                    reason_id,
                    "These segments remain outside the shipped corridor runtime and are retained here as fallback evidence only.",
                ),
            }
        )

    return {
        "artifactId": "clustering-noise-fallback",
        "module": "clustering",
        "scenarioId": CLUSTERING_SCENARIO_ID,
        "generatedAt": iso_now(),
        "summary": summary_text,
        "sourceSummary": repo_rel(REVIEW_DIR / "corridor-review-summary.json"),
        "sourceArtifacts": [
            "compressed_segments(60,90,0.03).pkl",
            "segments(60-90).pkl",
            "shaixuanhou_.csv",
        ],
        "deferredArtifact": {
            "artifactId": noise_artifact["artifactId"],
            "fileName": noise_artifact["fileName"],
            "fileBytes": noise_artifact["fileBytes"],
            "filePath": noise_artifact["filePath"],
            "status": noise_artifact["status"],
            "present": noise_artifact["present"],
            "lastModified": noise_artifact["lastModified"],
        },
        "counts": {
            "rawSegments": int(summary["rawSegments"]),
            "candidateSegments": int(summary["candidateSegments"]),
            "keptSegments": int(summary["keptSegments"]),
            "removedSegments": int(summary["removedSegments"]),
            "rawPoints": int(summary["rawPoints"]),
            "keptPoints": int(summary["keptPoints"]),
        },
        "dropReasons": drop_reasons,
    }


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
    noise_distance_path = find_optional([CLUSTERING_NOISE_ARTIFACT_NAME])
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
    noise_artifact = describe_clustering_noise_artifact(noise_distance_path)
    noise_fallback = build_clustering_noise_fallback(review_summary, noise_artifact)

    shaixuan_df = pd.read_csv(shaixuan_path, usecols=["mmsi"])
    review_corridor_count = review_tracks.get("corridorCount", review_summary.get("keptSegments", 0))
    review_track_count = review_tracks.get("trackCount", review_summary.get("keptSegments", 0))
    time_range = raw_meta["timeRange"]

    module_dir = MODULES_DIR / "clustering"
    summary_dest = module_dir / "clustering-summary.json"
    previews_dest = module_dir / "clustering-stage-previews.json"
    corridor_runtime_dest = module_dir / "clustering-corridor-runtime.json"
    corridor_review_dest = module_dir / "clustering-corridor-review.json"
    noise_fallback_dest = module_dir / "clustering-noise-fallback.json"
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
                "artifactId": CLUSTERING_NOISE_ARTIFACT_ID,
                "reason": noise_artifact["reason"],
                "dependsOn": ["CLUS-03", "Phase 10"],
                "status": noise_artifact["status"],
                "fileBytes": noise_artifact["fileBytes"],
                "filePath": noise_artifact["filePath"],
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
            "noiseFallback": f"data/modules/clustering/{noise_fallback_dest.name}",
        },
        "deferred": [CLUSTERING_NOISE_ARTIFACT_ID],
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
            artifact_record(
                artifact_id="clustering-noise-fallback",
                module="clustering",
                source_stage="exported",
                derived_from=["clustering-compressed-pkl", "clustering-corridor-review"],
                scenario_id=CLUSTERING_SCENARIO_ID,
                time_range=time_range,
                authoritative_for=["CLUS-02", "BASE-02", "BASE-05"],
                path=f"data/modules/clustering/{noise_fallback_dest.name}",
                status="deferred",
                description="Pre-reclustering noise-pool evidence plus zero-byte artifact state for the honest deferred CLUS-03 boundary.",
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
            **({"clustering-noise-distance-pkl": repo_rel(noise_distance_path)} if noise_distance_path else {}),
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
        print(f"  noise fallback: {noise_fallback_dest.name}")
        print(f"  review images: {', '.join(review_images)}")
        return [
            str(summary_dest),
            str(previews_dest),
            str(corridor_runtime_dest),
            str(corridor_review_dest),
            str(noise_fallback_dest),
            str(bundle_dest),
            str(manifest_dest),
        ]

    ensure_dir(module_dir)
    copy_json(corridor_runtime_src, corridor_runtime_dest)
    if review_tracks:
        write_json(corridor_review_dest, review_tracks)
    write_json(summary_dest, summary)
    write_json(previews_dest, previews)
    write_json(noise_fallback_dest, noise_fallback)
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
    return [
        repo_rel(summary_dest),
        repo_rel(previews_dest),
        repo_rel(corridor_runtime_dest),
        repo_rel(corridor_review_dest),
        repo_rel(noise_fallback_dest),
        repo_rel(bundle_dest),
        repo_rel(manifest_dest),
    ]

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


def build_forecast_rankings(forecast_metrics: dict[str, Any]) -> dict[str, Any]:
    horizons = sorted(
        {
            horizon
            for payload in forecast_metrics["models"].values()
            if payload.get("status") == "available"
            for horizon in payload.get("horizons", {}).keys()
        }
    )
    rankings: dict[str, Any] = {}
    for horizon in horizons:
        model_rows = [
            {"model": model_name, **payload["horizons"][horizon]}
            for model_name, payload in forecast_metrics["models"].items()
            if payload.get("status") == "available" and horizon in payload.get("horizons", {})
        ]
        rankings[horizon] = {
            "rmse": [
                {"model": row["model"], "value": row["rmse"], "rank": rank + 1}
                for rank, row in enumerate(sorted(model_rows, key=lambda item: (item["rmse"], item["mae"], item["model"])))
            ],
            "mae": [
                {"model": row["model"], "value": row["mae"], "rank": rank + 1}
                for rank, row in enumerate(sorted(model_rows, key=lambda item: (item["mae"], item["rmse"], item["model"])))
            ],
            "r2": [
                {"model": row["model"], "value": row["r2"], "rank": rank + 1}
                for rank, row in enumerate(sorted(model_rows, key=lambda item: (-item["r2"], item["rmse"], item["model"])))
            ],
        }
    return rankings


def build_evaluation_package(dry_run: bool) -> list[str]:
    artifact_index = read_json(MODULES_DIR / "artifact-index.json")
    forecast_metrics = read_json(MODULES_DIR / "forecast" / "forecast-metrics.json")
    repair_metrics = read_json(MODULES_DIR / "repair" / "repair-metrics.json")
    repair_aggregate = aggregate_repair_metrics(repair_metrics)
    optimization_summary = build_evaluation_optimization_summary()

    module_dir = MODULES_DIR / "evaluation"
    metrics_dest = module_dir / "evaluation-metrics.json"
    optimization_dest = module_dir / "evaluation-optimization.json"
    bundle_dest = module_dir / "evaluation-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    forecast_rankings = build_forecast_rankings(forecast_metrics)

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
        "entryFiles": {
            "metrics": f"data/modules/evaluation/{metrics_dest.name}",
            "optimization": f"data/modules/evaluation/{optimization_dest.name}",
        },
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
                artifact_id="evaluation-optimization",
                module="evaluation",
                source_stage="exported",
                derived_from=[
                    OPTIMIZATION_HISTORY_PATH.name,
                    PARAM_IMPORTANCE_PATH.name,
                    PARALLEL_COORD_PATH.name,
                    PARAM_DIST_PATH.name,
                    OPTIMIZATION_STUDY_PATH.name,
                ],
                scenario_id=EVALUATION_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["EVAL-04"],
                path=f"data/modules/evaluation/{optimization_dest.name}",
                description="Structured optimization-history and parameter-importance evidence derived from committed offline Plotly exports.",
            ),
            artifact_record(
                artifact_id="evaluation-bundle",
                module="evaluation",
                source_stage="exported",
                derived_from=["evaluation-metrics", "evaluation-optimization"],
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
            "optimization-notebook": repo_rel(OPTIMIZATION_NOTEBOOK_PATH),
            "optimization-study": repo_rel(OPTIMIZATION_STUDY_PATH),
            "optimization-history-html": repo_rel(OPTIMIZATION_HISTORY_PATH),
            "param-importance-html": repo_rel(PARAM_IMPORTANCE_PATH),
            "parallel-coord-html": repo_rel(PARALLEL_COORD_PATH),
            "param-dist-html": repo_rel(PARAM_DIST_PATH),
        },
    }

    if dry_run:
        print("[dry-run] evaluation package")
        print(f"  module dir: {module_dir}")
        print(f"  metrics: {metrics_dest.name}")
        print(f"  optimization: {optimization_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        print(f"  upstream modules: {[item['module'] for item in artifact_index['modules']]}")
        return [str(metrics_dest), str(optimization_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    write_json(metrics_dest, metrics)
    write_json(optimization_dest, optimization_summary)
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
    return [repo_rel(metrics_dest), repo_rel(optimization_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def build_forward_looking_package(dry_run: bool) -> list[str]:
    artifact_index = read_json(MODULES_DIR / "artifact-index.json")
    forecast_bundle = read_json(MODULES_DIR / "forecast" / "forecast-bundle.json")
    evaluation_metrics = read_json(MODULES_DIR / "evaluation" / "evaluation-metrics.json")
    clustering_runtime = read_json(MODULES_DIR / "clustering" / "clustering-corridor-runtime.json")
    noise_fallback = read_json(MODULES_DIR / "clustering" / "clustering-noise-fallback.json")

    module_index_map = {item["module"]: item for item in artifact_index["modules"]}
    forecast_entry = require_present(module_index_map.get("forecast"), "forecast module index entry")
    evaluation_entry = require_present(module_index_map.get("evaluation"), "evaluation module index entry")
    clustering_entry = require_present(module_index_map.get("clustering"), "clustering module index entry")
    overview_entry = module_index_map.get("overview")
    overview_summary_path = MODULES_DIR / "overview" / "overview-summary.json"

    forecast_rankings = evaluation_metrics.get("forecast", {}).get("rankings", {}).get("1h", {}).get("rmse", [])
    selected_model_entry = require_present((forecast_rankings or [None])[0], "forward-looking selected forecast ranking leader")
    selected_model = str(selected_model_entry["model"])
    runtime_entry_key = {
        "STGCN": "runtimeSTGCN",
        "LSTM": "runtimeLSTM",
        "BiLSTM": "runtimeBiLSTM",
    }.get(selected_model, "runtime")
    runtime_rel_path = require_present(
        forecast_bundle.get("entryFiles", {}).get(runtime_entry_key) or forecast_bundle.get("entryFiles", {}).get("runtime"),
        "forward-looking selected runtime path",
    )
    selected_runtime_path = WEB_ROOT / "public" / runtime_rel_path
    forecast_runtime = read_json(selected_runtime_path)

    sorted_corridors = sorted(
        clustering_runtime.get("corridors", []),
        key=lambda item: (-item.get("trackCount", 0), item.get("corridorId", "")),
    )
    corridor_leader = require_present((sorted_corridors or [None])[0], "forward-looking lead corridor")
    total_runtime_tracks = int(clustering_runtime.get("trackCount", 0))
    leading_share = corridor_leader["trackCount"] / total_runtime_tracks if total_runtime_tracks else 0
    top_three_share = (
        sum(item.get("trackCount", 0) for item in sorted_corridors[:3]) / total_runtime_tracks if total_runtime_tracks else 0
    )

    second_model_entry = forecast_rankings[1] if len(forecast_rankings) > 1 else None
    next_model_name = str(second_model_entry["model"]) if second_model_entry else "n/a"
    next_model_gap = round_float(float(second_model_entry["value"]) - float(selected_model_entry["value"]), 6) if second_model_entry else 0.0
    noise_artifact = noise_fallback["deferredArtifact"]

    selected_by_route: dict[str, dict[str, Any]] = {}
    for index, frame in enumerate(forecast_runtime.get("timeline", [])):
        focus_grid = str(frame["derived"]["focusGrid"])
        focus_route = str(frame["derived"]["focusRoute"])
        benefits = frame.get("narrative", {}).get("benefits", [])
        pressure_metric = find_benefit_metric(benefits, "Focus-grid pressure")
        hotspots_metric = find_benefit_metric(benefits, "Elevated hotspots")
        focus_pressure_before = parse_numeric_text((pressure_metric or {}).get("before"))
        focus_pressure_after = parse_numeric_text((pressure_metric or {}).get("after"))
        if focus_pressure_before is None or focus_pressure_after is None:
            continue

        alerts_before = frame["derived"].get("alerts", [])
        alerts_after = frame.get("narrative", {}).get("appliedState", {}).get("alerts", [])
        alert_count_before = int(parse_numeric_text((hotspots_metric or {}).get("before")) or len(alerts_before))
        alert_count_after = int(
            parse_numeric_text((hotspots_metric or {}).get("after"))
            or len([alert for alert in alerts_after if alert.get("level") != "watch"])
        )
        focus_grid_current = round_float(frame.get("current", {}).get("keyGrids", {}).get(focus_grid, 0))
        focus_grid_future = round_float(frame.get("forecast", {}).get("1h", {}).get("keyGrids", {}).get(focus_grid, 0))
        focus_pressure_drop = round_float(focus_pressure_before - focus_pressure_after, 3)

        candidate = {
            "focusRoute": focus_route,
            "focusGrid": focus_grid,
            "sceneId": str(frame["sceneId"]),
            "frameIndex": index,
            "time": str(frame["time"]),
            "currentTotalFlow": round_float(frame.get("current", {}).get("totalFlow", 0)),
            "forecastTotalFlow": round_float(frame.get("forecast", {}).get("1h", {}).get("totalFlow", 0)),
            "focusGridCurrent": focus_grid_current,
            "focusGridFuture": focus_grid_future,
            "focusPressureBefore": round_float(focus_pressure_before, 3),
            "focusPressureAfter": round_float(focus_pressure_after, 3),
            "focusPressureDrop": focus_pressure_drop,
            "alertCountBefore": alert_count_before,
            "alertCountAfter": alert_count_after,
            "strategyHeadline": str(frame.get("narrative", {}).get("strategy", {}).get("headline", "")).strip(),
            "strategySummary": str(frame.get("narrative", {}).get("strategy", {}).get("summary", "")).strip(),
            "recommendations": frame.get("narrative", {}).get("recommendations", []),
            "benefits": benefits,
            "alertsBefore": alerts_before,
            "alertsAfter": alerts_after,
            "_sort": (focus_pressure_drop, focus_grid_future, -index),
        }
        existing = selected_by_route.get(focus_route)
        if existing is None or candidate["_sort"] > existing["_sort"]:
            selected_by_route[focus_route] = candidate

    if not selected_by_route:
        raise ValueError("Forward-looking export could not derive any curated scenarios from the selected forecast runtime.")

    scenarios: list[dict[str, Any]] = []
    for rank, scenario in enumerate(
        sorted(selected_by_route.values(), key=lambda item: (-item["focusPressureDrop"], item["focusRoute"], item["time"])),
        start=1,
    ):
        scenario_id = f"forward-looking-{scenario['focusRoute'].lower()}-{scenario['focusGrid'].lower()}"
        scenarios.append(
            {
                "id": scenario_id,
                "title": f"{scenario['focusRoute']} / {scenario['focusGrid']} pressure window",
                "emphasis": f"Curated scenario #{rank}: {scenario['focusGrid']} shows a {scenario['focusPressureDrop']:.1f} drop in the applied-state preview.",
                "sceneId": scenario["sceneId"],
                "frameIndex": scenario["frameIndex"],
                "time": scenario["time"],
                "focusGrid": scenario["focusGrid"],
                "focusRoute": scenario["focusRoute"],
                "selectedModel": selected_model,
                "selectedHorizon": "1h",
                "currentTotalFlow": scenario["currentTotalFlow"],
                "forecastTotalFlow": scenario["forecastTotalFlow"],
                "focusGridCurrent": scenario["focusGridCurrent"],
                "focusGridFuture": scenario["focusGridFuture"],
                "focusPressureBefore": scenario["focusPressureBefore"],
                "focusPressureAfter": scenario["focusPressureAfter"],
                "focusPressureDrop": scenario["focusPressureDrop"],
                "alertCountBefore": scenario["alertCountBefore"],
                "alertCountAfter": scenario["alertCountAfter"],
                "strategyHeadline": scenario["strategyHeadline"],
                "strategySummary": scenario["strategySummary"],
                "recommendations": scenario["recommendations"],
                "benefits": scenario["benefits"],
                "alertsBefore": scenario["alertsBefore"],
                "alertsAfter": scenario["alertsAfter"],
                "evaluationContext": {
                    "rank": int(selected_model_entry["rank"]),
                    "metric": "1h RMSE",
                    "value": round_float(selected_model_entry["value"]),
                    "nextModel": next_model_name,
                    "nextModelGap": next_model_gap,
                    "summary": (
                        f"{selected_model} is the shipped 1h RMSE leader at {float(selected_model_entry['value']):.3f}. "
                        + (
                            f"The next model is {next_model_name}, trailing by {next_model_gap:.3f} RMSE."
                            if second_model_entry
                            else "No second shipped model is available for comparison."
                        )
                    ),
                },
                "corridorContext": {
                    "headline": f"{corridor_leader['corridorId']} remains the site-wide movement spine",
                    "detail": (
                        f"{corridor_leader['corridorId']} leads {format_share_percent(leading_share)} of runtime corridor tracks in the "
                        f"{corridor_leader['directionLabel']} direction. The decision layer uses that as context only and does not claim "
                        "a one-to-one corridor-to-route mapping."
                    ),
                },
                "evidenceLineage": [
                    {
                        "artifactId": "forecast-selected-runtime",
                        "label": f"{selected_model} runtime frame",
                        "detail": f"Scene {scenario['sceneId']} at {scenario['time']} anchors the selected focus route/grid pair.",
                    },
                    {
                        "artifactId": "evaluation-metrics",
                        "label": "1h ranking authority",
                        "detail": (
                            f"{selected_model} ranks #{int(selected_model_entry['rank'])} in the shipped 1h RMSE table, ahead of {next_model_name}."
                            if second_model_entry
                            else f"{selected_model} is the only shipped 1h ranking authority available here."
                        ),
                    },
                    {
                        "artifactId": "clustering-corridor-runtime",
                        "label": "Corridor dominance context",
                        "detail": (
                            f"{corridor_leader['corridorId']} leads {corridor_leader['trackCount']} of {total_runtime_tracks} runtime tracks "
                            f"({format_share_percent(leading_share)})."
                        ),
                    },
                    {
                        "artifactId": "clustering-noise-fallback",
                        "label": "Deferred CLUS-03 boundary",
                        "detail": (
                            f"{noise_artifact['fileName']} remains {noise_artifact['status']} at {noise_artifact['filePath']}, "
                            "so no fake noise re-clustering evidence is injected into this decision layer."
                        ),
                    },
                ],
                "honestBoundary": (
                    "This applied-state preview is a curated, rule-driven offline comparison built from committed forecast outputs. "
                    f"It is not a live optimizer, and it does not reopen CLUS-03 while {noise_artifact['fileName']} remains {noise_artifact['status']}."
                ),
            }
        )

    module_dir = MODULES_DIR / "forward-looking"
    summary_dest = module_dir / "forward-looking-summary.json"
    scenarios_dest = module_dir / "forward-looking-scenarios.json"
    bundle_dest = module_dir / "forward-looking-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    summary = {
        "artifactId": "forward-looking-summary",
        "module": "forward-looking",
        "scenarioId": FORWARD_LOOKING_SCENARIO_ID,
        "generatedAt": iso_now(),
        "status": "ready",
        "framing": "Rule-driven collaborative decision built from archived forecast, evaluation, and clustering evidence; not a live optimizer or live AIS control loop.",
        "summary": (
            f"{len(scenarios)} curated scenarios expose selected focus routes and grids from the best shipped {selected_model} 1h run. "
            "The module now ships an interactive focus surface and explicit before/after switching, while CLUS-03 remains an honest deferred boundary until noise re-clustering can be restored."
        ),
        "selectedModel": selected_model,
        "selectedHorizon": "1h",
        "scenarioCount": len(scenarios),
        "uniqueFocusRoutes": [scenario["focusRoute"] for scenario in scenarios],
        "uniqueFocusGrids": [scenario["focusGrid"] for scenario in scenarios],
        "evidenceAuthority": {
            "selectedModel": selected_model,
            "selectedHorizon": "1h",
            "rankingMetric": "RMSE",
            "rankingValue": round_float(selected_model_entry["value"]),
            "rankingLabel": "Evaluation center 1h ranking leader",
            "rationale": (
                f"{selected_model} is selected because it currently ranks #1 in the shipped 1h RMSE table, so the decision layer inherits "
                "its scenario authority from the evaluation center instead of from hand-written narrative preference."
            ),
            "comparedModels": [
                {
                    "model": str(item["model"]),
                    "rank": int(item["rank"]),
                    "value": round_float(item["value"]),
                }
                for item in forecast_rankings
            ],
        },
        "corridorContext": {
            "narrative": (
                f"{corridor_leader['corridorId']} leads the runtime corridor stack at {format_share_percent(leading_share)}, and the top three corridors "
                f"cover {format_share_percent(top_three_share)} of shipped runtime tracks. That dominance now informs the whole site story, "
                "but forward-looking analysis still treats it as context rather than as an exact route assignment."
            ),
            "leadingCorridorId": str(corridor_leader["corridorId"]),
            "leadingDirection": str(corridor_leader["directionLabel"]),
            "leadingShare": round_float(leading_share, 6),
            "topThreeShare": round_float(top_three_share, 6),
            "totalRuntimeTracks": total_runtime_tracks,
            "routeMappingClaim": "context-only",
        },
        "noiseContext": {
            "artifactId": str(noise_artifact["artifactId"]),
            "fileName": str(noise_artifact["fileName"]),
            "fileBytes": int(noise_artifact["fileBytes"]),
            "filePath": str(noise_artifact["filePath"]),
            "status": str(noise_artifact["status"]),
            "reason": str(noise_fallback["summary"]),
        },
        "deferred": [],
        "crossLinks": [
            {
                "routeId": "forecast",
                "label": OVERVIEW_LABELS["forecast"],
                "summary": "Open the forecast module to inspect the full selected-model timeline around each curated decision frame.",
            },
            {
                "routeId": "evaluation",
                "label": OVERVIEW_LABELS["evaluation"],
                "summary": "Verify why the chosen model owns the 1h authority before interpreting any rule-driven recommendation.",
            },
            {
                "routeId": "clustering",
                "label": OVERVIEW_LABELS["clustering"],
                "summary": "Review corridor dominance and the deferred CLUS-03 boundary that still shapes the movement narrative.",
            },
            {
                "routeId": "overview",
                "label": OVERVIEW_LABELS["overview"],
                "summary": "See how collaborative decision now enters the archived-playback business loop as a shipped evidence layer.",
            },
        ],
        "sourceArtifacts": [
            "forecast-bundle",
            "forecast-selected-runtime",
            "evaluation-metrics",
            "clustering-corridor-runtime",
            "clustering-noise-fallback",
            "overview-summary",
        ],
    }
    scenario_catalog = {
        "artifactId": "forward-looking-scenarios",
        "module": "forward-looking",
        "scenarioId": FORWARD_LOOKING_SCENARIO_ID,
        "generatedAt": iso_now(),
        "scenarios": scenarios,
    }
    bundle = {
        "artifactId": "forward-looking-bundle",
        "module": "forward-looking",
        "generatedAt": iso_now(),
        "scenarioId": FORWARD_LOOKING_SCENARIO_ID,
        "timeRange": forecast_entry["timeRange"],
        "entryFiles": {
            "summary": f"data/modules/forward-looking/{summary_dest.name}",
            "scenarios": f"data/modules/forward-looking/{scenarios_dest.name}",
        },
        "deferred": [],
    }
    manifest_derived_from = [
        "forecast-manifest",
        "evaluation-manifest",
        "clustering-manifest",
        "artifact-index",
    ]
    if overview_entry and overview_summary_path.exists():
        manifest_derived_from.append("overview-manifest")

    manifest_sources = {
        "artifact-index": repo_rel(MODULES_DIR / "artifact-index.json"),
        "forecast-bundle": repo_rel(MODULES_DIR / "forecast" / "forecast-bundle.json"),
        "forecast-selected-runtime": repo_rel(selected_runtime_path),
        "forecast-manifest": repo_rel(MODULES_DIR / "forecast" / "manifest.json"),
        "evaluation-metrics": repo_rel(MODULES_DIR / "evaluation" / "evaluation-metrics.json"),
        "evaluation-manifest": repo_rel(MODULES_DIR / "evaluation" / "manifest.json"),
        "clustering-corridor-runtime": repo_rel(MODULES_DIR / "clustering" / "clustering-corridor-runtime.json"),
        "clustering-noise-fallback": repo_rel(MODULES_DIR / "clustering" / "clustering-noise-fallback.json"),
        "clustering-manifest": repo_rel(MODULES_DIR / "clustering" / "manifest.json"),
    }
    if overview_entry and overview_summary_path.exists():
        manifest_sources["overview-summary"] = repo_rel(overview_summary_path)
        manifest_sources["overview-manifest"] = repo_rel(MODULES_DIR / "overview" / "manifest.json")

    manifest = {
        "artifactId": "forward-looking-manifest",
        "module": "forward-looking",
        "sourceStage": "exported",
        "derivedFrom": manifest_derived_from,
        "scenarioId": FORWARD_LOOKING_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": FORWARD_LOOKING_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/forward-looking/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="forward-looking-summary",
                module="forward-looking",
                source_stage="exported",
                derived_from=[
                    "forecast-selected-runtime",
                    "evaluation-metrics",
                    "clustering-corridor-runtime",
                    "clustering-noise-fallback",
                ],
                scenario_id=FORWARD_LOOKING_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["DECI-01", "DECI-02", "DECI-04"],
                path=f"data/modules/forward-looking/{summary_dest.name}",
                description="Rule-driven decision summary anchored to the selected forecast ranking authority and corridor context.",
            ),
            artifact_record(
                artifact_id="forward-looking-scenarios",
                module="forward-looking",
                source_stage="exported",
                derived_from=["forward-looking-summary", "forecast-selected-runtime"],
                scenario_id=FORWARD_LOOKING_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["DECI-01", "DECI-02", "DECI-04"],
                path=f"data/modules/forward-looking/{scenarios_dest.name}",
                description="Curated scenario records for the current rule-driven focus route and grid evidence pack.",
            ),
            artifact_record(
                artifact_id="forward-looking-bundle",
                module="forward-looking",
                source_stage="exported",
                derived_from=["forward-looking-summary", "forward-looking-scenarios"],
                scenario_id=FORWARD_LOOKING_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=FORWARD_LOOKING_REQUIREMENTS,
                path=f"data/modules/forward-looking/{bundle_dest.name}",
                description="Module entry bundle for forward-looking decision data discovery.",
            ),
        ],
        "sources": manifest_sources,
        "deferred": [],
    }

    if dry_run:
        print("[dry-run] forward-looking package")
        print(f"  module dir: {module_dir}")
        print(f"  summary: {summary_dest.name}")
        print(f"  scenarios: {scenarios_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        return [str(summary_dest), str(scenarios_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    write_json(summary_dest, summary)
    write_json(scenarios_dest, scenario_catalog)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)
    index = upsert_module_index(
        {
            "module": "forward-looking",
            "status": "ready",
            "manifestPath": f"data/modules/forward-looking/{manifest_dest.name}",
            "bundlePath": f"data/modules/forward-looking/{bundle_dest.name}",
            "scenarioId": FORWARD_LOOKING_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": FORWARD_LOOKING_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(summary_dest), repo_rel(scenarios_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def build_overview_package(dry_run: bool) -> list[str]:
    artifact_index = read_json(MODULES_DIR / "artifact-index.json")
    forecast_bundle = read_json(MODULES_DIR / "forecast" / "forecast-bundle.json")
    forecast_runtime = read_json(MODULES_DIR / "forecast" / "forecast-runtime.json")
    repair_bundle = read_json(MODULES_DIR / "repair" / "repair-bundle.json")
    repair_samples = read_json(MODULES_DIR / "repair" / "repair-samples.json")
    clustering_summary = read_json(MODULES_DIR / "clustering" / "clustering-summary.json")
    clustering_runtime = read_json(MODULES_DIR / "clustering" / "clustering-corridor-runtime.json")
    evaluation_metrics = read_json(MODULES_DIR / "evaluation" / "evaluation-metrics.json")
    evaluation_optimization = read_json(MODULES_DIR / "evaluation" / "evaluation-optimization.json")

    module_dir = MODULES_DIR / "overview"
    summary_dest = module_dir / "overview-summary.json"
    bundle_dest = module_dir / "overview-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    module_index_map = {item["module"]: item for item in artifact_index["modules"]}
    forecast_entry = module_index_map["forecast"]
    repair_entry = module_index_map["repair"]
    clustering_entry = module_index_map["clustering"]
    evaluation_entry = module_index_map["evaluation"]
    forward_entry = module_index_map.get("forward-looking")
    forward_summary_path = MODULES_DIR / "forward-looking" / "forward-looking-summary.json"
    forward_summary = read_json(forward_summary_path) if forward_entry and forward_summary_path.exists() else None

    forecast_leader = require_present(
        (evaluation_metrics.get("forecast", {}).get("rankings", {}).get("1h", {}).get("rmse", []) or [None])[0],
        "evaluation forecast 1h RMSE leader",
    )
    repair_leader = require_present(
        (
            sorted(
                evaluation_metrics.get("repair", {}).get("aggregateByModel", []),
                key=lambda item: (item.get("rankByRmse", 9999), item.get("modelLabel", "")),
            )
            or [None]
        )[0],
        "evaluation repair aggregate RMSE leader",
    )
    top_optimization_parameter = require_present(
        (evaluation_optimization.get("importance", {}).get("parameters", []) or [None])[0],
        "evaluation optimization top importance parameter",
    )
    corridor_leader = require_present(
        (
            sorted(
                clustering_runtime.get("corridors", []),
                key=lambda item: (-item.get("trackCount", 0), item.get("corridorId", "")),
            )
            or [None]
        )[0],
        "clustering runtime leader corridor",
    )
    first_repair_sample = require_present((repair_samples.get("samples", []) or [None])[0], "repair sample catalog")
    forecast_window = forecast_entry["timeRange"]
    forward_source_artifacts = (
        ["forward-looking-summary", "forward-looking-scenarios", "evaluation-metrics", "clustering-corridor-runtime"]
        if forward_summary
        else ["overview-summary", "forward-looking placeholder"]
    )

    module_entry_points = [
        {
            "routeId": "forecast",
            "label": OVERVIEW_LABELS["forecast"],
            "status": "ready",
            "scenarioId": forecast_entry["scenarioId"],
            "summary": f"{forecast_leader['model']} leads the shipped 1h RMSE ranking across {len(forecast_bundle['availableModels'])} forecast models and {len(forecast_bundle['horizons'])} horizons.",
            "primaryMetric": {"label": "Horizons", "value": str(len(forecast_bundle["horizons"]))},
            "secondaryMetric": {"label": "1h leader", "value": str(forecast_leader["model"])},
            "evidence": ["forecast-bundle", "forecast-metrics", "evaluation-metrics"],
            "requirementCodes": list(forecast_entry["authoritativeFor"]),
        },
        {
            "routeId": "repair",
            "label": OVERVIEW_LABELS["repair"],
            "status": "ready",
            "scenarioId": repair_entry["scenarioId"],
            "summary": f"{repair_bundle['sampleCount']} curated repair samples are shipped, with {repair_leader['modelLabel']} currently leading the aggregate RMSE comparison.",
            "primaryMetric": {"label": "Curated samples", "value": str(repair_bundle["sampleCount"])},
            "secondaryMetric": {"label": "RMSE leader", "value": str(repair_leader["modelLabel"])},
            "evidence": ["repair-bundle", "repair-samples", "evaluation-metrics"],
            "requirementCodes": list(repair_entry["authoritativeFor"]),
        },
        {
            "routeId": "clustering",
            "label": OVERVIEW_LABELS["clustering"],
            "status": "ready",
            "scenarioId": clustering_entry["scenarioId"],
            "summary": f"{clustering_summary['stageCounts']['corridorRuntimeCorridors']} runtime corridors and {clustering_summary['stageCounts']['corridorRuntimeTracks']} corridor tracks keep clustering connected to one dominant movement spine led by {corridor_leader['corridorId']}.",
            "primaryMetric": {"label": "Runtime corridors", "value": str(clustering_summary["stageCounts"]["corridorRuntimeCorridors"])},
            "secondaryMetric": {"label": "Lead corridor", "value": str(corridor_leader["corridorId"])},
            "evidence": ["clustering-summary", "clustering-corridor-runtime", "clustering-noise-fallback"],
            "requirementCodes": list(clustering_entry["authoritativeFor"]),
        },
        {
            "routeId": "evaluation",
            "label": OVERVIEW_LABELS["evaluation"],
            "status": "ready",
            "scenarioId": evaluation_entry["scenarioId"],
            "summary": f"The evaluation center now combines forecast or repair rankings with {evaluation_optimization['objective']['completedTrials']} completed optimization checkpoints from the shipped offline tuning study.",
            "primaryMetric": {"label": "Traceable codes", "value": str(len(evaluation_entry["authoritativeFor"]))},
            "secondaryMetric": {"label": "Top parameter", "value": str(top_optimization_parameter["label"])},
            "evidence": ["evaluation-metrics", "evaluation-optimization", "evaluation-manifest"],
            "requirementCodes": list(evaluation_entry["authoritativeFor"]),
        },
        {
            "routeId": "forward-looking",
            "label": OVERVIEW_LABELS["forward-looking"],
            "status": str(forward_entry["status"]) if forward_entry else "deferred",
            "scenarioId": forward_entry["scenarioId"] if forward_entry else "phase-12-deferred",
            "summary": (
                f"{forward_summary['scenarioCount']} curated {forward_summary['selectedModel']} {forward_summary['selectedHorizon']} scenarios now connect focus-route decisions to evaluation authority and corridor dominance."
                if forward_summary
                else "Collaborative decision stays visible as the next evidence layer, but the site does not pretend a live optimizer or shipped rule engine already exists."
            ),
            "primaryMetric": (
                {"label": "Curated scenarios", "value": str(forward_summary["scenarioCount"])}
                if forward_summary
                else {"label": "Current status", "value": "Later phase"}
            ),
            "secondaryMetric": (
                {"label": "Authority", "value": f"{forward_summary['selectedModel']} {forward_summary['selectedHorizon']}"}
                if forward_summary
                else {"label": "Planned phase", "value": "12"}
            ),
            "evidence": forward_source_artifacts,
            "requirementCodes": list(forward_entry["authoritativeFor"]) if forward_entry else ["DECI-01", "DECI-02", "DECI-03", "DECI-04"],
        },
    ]

    scenario_entry_points = [
        {
            "id": "archived-playback-window",
            "routeId": "home",
            "label": "Archived playback window",
            "signal": f"{forecast_window['start']} -> {forecast_window['end']}",
            "summary": "Start from the command-center replay rather than generic logs so every module shares the same archived scene clock.",
            "detail": f"{len(forecast_runtime['timeline'])} timeline frames and {len(forecast_bundle['horizons'])} forecast horizons are already packaged for the same historical harbor window.",
        },
        {
            "id": "forecast-entry",
            "routeId": "forecast",
            "label": "Forecast entry",
            "signal": f"{forecast_leader['model']} | 1h leader",
            "summary": "Jump directly into the strongest shipped 1h ranking before comparing hotspot or route-level behavior.",
            "detail": f"Available models: {', '.join(forecast_bundle['availableModels'])}. Supported horizons: {', '.join(forecast_bundle['horizons'])}.",
        },
        {
            "id": "repair-entry",
            "routeId": "repair",
            "label": "Repair entry",
            "signal": str(first_repair_sample["sampleId"]),
            "summary": "Begin from the first curated damaged trajectory sample instead of a notebook-only experiment snapshot.",
            "detail": f"{repair_bundle['sampleCount']} curated samples ship with {repair_leader['modelLabel']} currently leading aggregate RMSE.",
        },
        {
            "id": "corridor-entry",
            "routeId": "clustering",
            "label": "Corridor entry",
            "signal": f"{corridor_leader['corridorId']} runtime leader",
            "summary": "Follow the dominant corridor family that now anchors the site-wide movement story.",
            "detail": f"{clustering_summary['stageCounts']['corridorRuntimeTracks']} runtime tracks are grouped into {clustering_summary['stageCounts']['corridorRuntimeCorridors']} shipped corridors.",
        },
        {
            "id": "evaluation-entry",
            "routeId": "evaluation",
            "label": "Evaluation entry",
            "signal": f"Trial {evaluation_optimization['objective']['bestTrial']} best",
            "summary": "The evaluation center now holds both cross-task rankings and the shipped offline tuning story.",
            "detail": f"{evaluation_optimization['objective']['completedTrials']} completed checkpoints, best objective {format_scientific(evaluation_optimization['objective']['bestValue'])}, top importance {top_optimization_parameter['label']}.",
        },
    ]
    if forward_summary:
        scenario_entry_points.append(
            {
                "id": "forward-looking-entry",
                "routeId": "forward-looking",
                "label": "Decision entry",
                "signal": f"{forward_summary['scenarioCount']} scenarios | {forward_summary['selectedModel']}",
                "summary": "Open the curated decision layer to inspect focus-route scenarios tied back to forecast rankings and corridor dominance.",
                "detail": (
                    f"Current scenario pack covers {', '.join(forward_summary['uniqueFocusRoutes'])}. "
                    f"Corridor context stays honest and CLUS-03 remains deferred because {forward_summary['noiseContext']['fileName']} is still {forward_summary['noiseContext']['status']}."
                ),
            }
        )

    overview_summary_derived_from = [
        "forecast-bundle",
        "forecast-runtime",
        "repair-bundle",
        "repair-samples",
        "clustering-summary",
        "clustering-corridor-runtime",
        "evaluation-metrics",
        "evaluation-optimization",
        "artifact-index",
    ]
    manifest_derived_from = ["forecast-manifest", "repair-manifest", "clustering-manifest", "evaluation-manifest", "artifact-index"]
    manifest_sources = {
        "artifact-index": repo_rel(MODULES_DIR / "artifact-index.json"),
        "forecast-bundle": repo_rel(MODULES_DIR / "forecast" / "forecast-bundle.json"),
        "forecast-runtime": repo_rel(MODULES_DIR / "forecast" / "forecast-runtime.json"),
        "repair-bundle": repo_rel(MODULES_DIR / "repair" / "repair-bundle.json"),
        "repair-samples": repo_rel(MODULES_DIR / "repair" / "repair-samples.json"),
        "clustering-summary": repo_rel(MODULES_DIR / "clustering" / "clustering-summary.json"),
        "clustering-corridor-runtime": repo_rel(MODULES_DIR / "clustering" / "clustering-corridor-runtime.json"),
        "clustering-manifest": repo_rel(MODULES_DIR / "clustering" / "manifest.json"),
        "evaluation-metrics": repo_rel(MODULES_DIR / "evaluation" / "evaluation-metrics.json"),
        "evaluation-optimization": repo_rel(MODULES_DIR / "evaluation" / "evaluation-optimization.json"),
        "evaluation-manifest": repo_rel(MODULES_DIR / "evaluation" / "manifest.json"),
    }
    if forward_summary:
        overview_summary_derived_from.extend(["forward-looking-summary", "forward-looking-scenarios"])
        manifest_derived_from.append("forward-looking-manifest")
        manifest_sources["forward-looking-summary"] = repo_rel(forward_summary_path)
        manifest_sources["forward-looking-manifest"] = repo_rel(MODULES_DIR / "forward-looking" / "manifest.json")

    overview = {
        "artifactId": "overview-summary",
        "module": "overview",
        "scenarioId": OVERVIEW_SCENARIO_ID,
        "generatedAt": iso_now(),
        "framing": "Archived AIS playback plus offline-computed inference from committed research exports; not a live AIS backend or online optimizer.",
        "framingPillars": [
            {
                "id": "archived-scene-clock",
                "kicker": "Playback",
                "title": "Archived AIS playback is the scene clock",
                "detail": "Every module reuses the same committed historical harbor window instead of claiming a live stream.",
            },
            {
                "id": "offline-inference",
                "kicker": "Inference",
                "title": "Forecast, repair, clustering, and tuning all come from offline exports",
                "detail": "The website packages committed JSON and Plotly outputs from local research artifacts rather than rerunning notebooks in the browser.",
            },
            {
                "id": "truth-boundary",
                "kicker": "Boundary",
                "title": "This showcase is not a live AIS backend or online optimizer",
                "detail": "The interface can feel realtime, but its truth boundary remains archived playback plus offline-computed evidence with explicit deferred states.",
            },
        ],
        "businessLoop": [
            {
                "step": "Archived AIS Playback",
                "description": "Use committed historical AIS playback as the common scene clock for every later evidence surface.",
                "sourceArtifacts": ["forecast-runtime", "clustering-raw-cleaned-ais"],
                "routeId": "home",
                "status": "ready",
            },
            {
                "step": "Trajectory Clustering and Corridor Extraction",
                "description": "Explain movement structure from raw to segmented, compressed, and corridor layers before other modules interpret traffic patterns.",
                "sourceArtifacts": ["clustering-summary", "clustering-stage-previews", "clustering-corridor-runtime"],
                "routeId": "clustering",
                "status": "ready",
            },
            {
                "step": "Flow Prediction",
                "description": "Project near-future traffic change across the archived playback timeline using the committed multi-model forecast bundles.",
                "sourceArtifacts": ["forecast-bundle", "forecast-metrics"],
                "routeId": "forecast",
                "status": "ready",
            },
            {
                "step": "Trajectory Repair",
                "description": "Show how damaged sample tracks are reconstructed and compared against curated reference trajectories.",
                "sourceArtifacts": ["repair-bundle", "repair-samples", "repair-metrics-export"],
                "routeId": "repair",
                "status": "ready",
            },
            {
                "step": "Evaluation Center",
                "description": "Bring forecast, repair, clustering context, and offline tuning evidence into one traceable cross-task evidence center.",
                "sourceArtifacts": ["evaluation-metrics", "evaluation-optimization"],
                "routeId": "evaluation",
                "status": "ready",
            },
            {
                "step": "Collaborative Decision",
                "description": (
                    "Package rule-driven collaborative-decision scenarios on top of forecast, evaluation, and clustering evidence, with the interactive focus surface and before/after switching now shipped on top of the committed offline evidence."
                    if forward_summary
                    else "Reserve the forward-looking decision layer for a later phase instead of implying a shipped live optimizer before the rule-driven evidence surface exists."
                ),
                "sourceArtifacts": forward_source_artifacts,
                "routeId": "forward-looking",
                "status": str(forward_entry["status"]) if forward_entry else "deferred",
            },
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
        "moduleEntryPoints": module_entry_points,
        "scenarioEntryPoints": scenario_entry_points,
        "deferredModules": (
            [
                {
                    "module": item["label"],
                    "status": "phase-12-next",
                    "reason": item["summary"],
                }
                for item in forward_summary.get("deferred", [])
            ]
            if forward_summary
            else [
                {
                    "module": "collaborative-decision",
                    "status": "later-phase",
                    "reason": "Phase 11 closes by making the overview and evaluation evidence coherent first; the rule-driven decision layer remains a later Phase 12 track.",
                }
            ]
        ),
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
        "derivedFrom": manifest_derived_from,
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
                derived_from=overview_summary_derived_from,
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
        "sources": manifest_sources,
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
    if args.module in {"forward-looking", "all"}:
        written.extend(build_forward_looking_package(args.dry_run))
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
