from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from forecast_sequence_models import export_sequence_model_artifacts
from phase6_bundle_common import (
    MODULES_DIR,
    PUBLIC_DATA_DIR,
    ROOT,
    artifact_record,
    build_time_range,
    copy_json,
    ensure_dir,
    find_first,
    find_repair_sample_paths,
    iso_now,
    repo_rel,
    round_float,
    upsert_module_index,
    write_artifact_index,
    write_json,
)

FORECAST_REQUIREMENTS = ["FLOW-01", "FLOW-02", "FLOW-03", "FLOW-04", "BASE-02", "BASE-05"]
REPAIR_REQUIREMENTS = ["REPR-01", "REPR-02", "REPR-03", "REPR-04", "REPR-05", "BASE-02", "BASE-05"]
FORECAST_SCENARIO_ID = "demo-live"
REPAIR_SCENARIO_ID = "repair-curated-v1"
FORECAST_HORIZON_STEPS = {"1h": 12, "2h": 24, "3h": 36}
FORECAST_MODEL_ORDER = ["STGCN", "LSTM", "BiLSTM"]
MODEL_NAME_MAP = {
    "ATT-BILSTM": "att-bilstm",
    "BILSTM": "bilstm",
    "LSTM": "lstm",
    "线性插值": "linear-interpolation",
    "样条插值": "spline-interpolation",
    "真实值": "ground-truth",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Phase 6 primary forecast and repair bundles.")
    parser.add_argument("--module", choices=["forecast", "repair", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true", help="Describe what would be written without modifying files.")
    return parser.parse_args()


def model_id(label: str) -> str:
    return MODEL_NAME_MAP.get(label, label.strip().lower().replace(" ", "-"))


def parse_prediction_values(value: Any) -> np.ndarray:
    if isinstance(value, np.ndarray):
        return value.astype(float)
    if isinstance(value, list):
        return np.asarray(value, dtype=float)
    if isinstance(value, str):
        parsed = ast.literal_eval(value)
        return np.asarray(parsed, dtype=float)
    raise TypeError(f"Unsupported prediction payload type: {type(value)}")


def metric_triplet(actual: np.ndarray, predicted: np.ndarray) -> dict[str, Any]:
    actual = actual.astype(float)
    predicted = predicted.astype(float)
    mae = float(np.mean(np.abs(actual - predicted)))
    rmse = float(np.sqrt(np.mean(np.square(actual - predicted))))
    ss_res = float(np.sum(np.square(actual - predicted)))
    ss_tot = float(np.sum(np.square(actual - np.mean(actual))))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot else 1.0
    return {
        "sampleCount": int(len(actual)),
        "mae": round_float(mae, 6),
        "rmse": round_float(rmse, 6),
        "r2": round_float(r2, 6),
    }


def model_entry_key(prefix: str, model_name: str) -> str:
    return f"{prefix}{model_name.replace('-', '').replace(' ', '')}"


def compute_forecast_metrics(forecast_runtimes: dict[str, dict[str, Any]]) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "module": "forecast",
        "scenarioId": FORECAST_SCENARIO_ID,
        "metricBasis": "timeline-aligned totalFlow derived from committed STGCN, LSTM, and BiLSTM runtime outputs",
        "generatedAt": iso_now(),
        "models": {},
        "deferredModels": [],
    }

    for model_name in FORECAST_MODEL_ORDER:
        runtime = forecast_runtimes.get(model_name)
        if not runtime:
            continue
        timeline = runtime["timeline"]
        current_totals = np.asarray([entry["current"]["totalFlow"] for entry in timeline], dtype=float)
        metrics["models"][model_name] = {"status": "available", "horizons": {}}
        for horizon, step_count in FORECAST_HORIZON_STEPS.items():
            predicted = np.asarray([entry["forecast"][horizon]["totalFlow"] for entry in timeline[:-step_count]], dtype=float)
            actual = current_totals[step_count:]
            metrics["models"][model_name]["horizons"][horizon] = metric_triplet(actual, predicted)

    return metrics


def build_forecast_package(dry_run: bool) -> list[str]:
    return build_forecast_package_801a(dry_run)


def build_forecast_package_legacy(dry_run: bool) -> list[str]:
    forecast_src = PUBLIC_DATA_DIR / "flow-forecast.json"
    model_config_src = PUBLIC_DATA_DIR / "model-config.json"
    forecast_runtime = pd.read_json(forecast_src).to_dict() if False else None
    forecast_data = __import__("json").loads(forecast_src.read_text(encoding="utf-8"))
    model_config = __import__("json").loads(model_config_src.read_text(encoding="utf-8"))

    flow_csv = find_first(["grid_mmsi_count*.csv"])
    adjacency_csv = find_first(["相关性矩阵*.csv"])
    distance_csv = find_first(["距离矩阵*.csv"])
    weight_path = find_first(["model_0.pt"])

    module_dir = MODULES_DIR / "forecast"
    runtime_dest = module_dir / "forecast-runtime.json"
    config_dest = module_dir / "forecast-model-config.json"
    metrics_dest = module_dir / "forecast-metrics.json"
    bundle_dest = module_dir / "forecast-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    metrics = compute_forecast_metrics(forecast_data)
    bundle = {
        "artifactId": "forecast-bundle",
        "module": "forecast",
        "generatedAt": iso_now(),
        "scenarioId": FORECAST_SCENARIO_ID,
        "timeRange": build_time_range(forecast_data["meta"]["windowStart"], forecast_data["meta"]["windowEnd"]),
        "availableModels": ["STGCN"],
        "deferredModels": ["LSTM", "BiLSTM"],
        "horizons": list(forecast_data["meta"]["horizons"]),
        "entryFiles": {
            "runtime": f"data/modules/forecast/{runtime_dest.name}",
            "modelConfig": f"data/modules/forecast/{config_dest.name}",
            "metrics": f"data/modules/forecast/{metrics_dest.name}",
        },
    }
    manifest = {
        "artifactId": "forecast-manifest",
        "module": "forecast",
        "sourceStage": "exported",
        "derivedFrom": [
            "flow-grid-csv",
            "flow-adjacency-csv",
            "flow-distance-csv",
            "stgcn-weight",
            "flow-forecast-runtime",
            "flow-model-config-runtime",
        ],
        "scenarioId": FORECAST_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": FORECAST_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/forecast/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="forecast-runtime",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-forecast-runtime"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-02", "FLOW-04"],
                path=f"data/modules/forecast/{runtime_dest.name}",
                description="Committed STGCN runtime timeline copied into the module package.",
            ),
            artifact_record(
                artifact_id="forecast-model-config",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-model-config-runtime", "flow-adjacency-csv", "flow-distance-csv"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02"],
                path=f"data/modules/forecast/{config_dest.name}",
                description="Graph and scaler metadata copied into the forecast module package.",
            ),
            artifact_record(
                artifact_id="forecast-metrics",
                module="forecast",
                source_stage="exported",
                derived_from=["forecast-runtime"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-03", "EVAL-01", "EVAL-02", "EVAL-05"],
                path=f"data/modules/forecast/{metrics_dest.name}",
                description="Timeline-aligned STGCN total-flow metrics for 1h, 2h, and 3h horizons.",
            ),
            artifact_record(
                artifact_id="forecast-bundle",
                module="forecast",
                source_stage="exported",
                derived_from=["forecast-runtime", "forecast-model-config", "forecast-metrics"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=FORECAST_REQUIREMENTS,
                path=f"data/modules/forecast/{bundle_dest.name}",
                description="Module entry bundle for forecast data discovery.",
            ),
        ],
        "deferred": [
            {
                "artifactId": "forecast-lstm-runtime",
                "reason": "Only notebook definitions exist; there is no committed structured runtime export.",
                "dependsOn": ["FLOW-01", "FLOW-03", "Phase 8"],
            },
            {
                "artifactId": "forecast-bilstm-runtime",
                "reason": "Only notebook definitions exist; there is no committed structured runtime export.",
                "dependsOn": ["FLOW-01", "FLOW-03", "Phase 8"],
            },
        ],
        "sources": {
            "flow-grid-csv": repo_rel(flow_csv),
            "flow-adjacency-csv": repo_rel(adjacency_csv),
            "flow-distance-csv": repo_rel(distance_csv),
            "stgcn-weight": repo_rel(weight_path),
            "flow-forecast-runtime": repo_rel(forecast_src),
            "flow-model-config-runtime": repo_rel(model_config_src),
        },
    }

    if dry_run:
        print("[dry-run] forecast package")
        print(f"  module dir: {module_dir}")
        print(f"  runtime: {runtime_dest.name}")
        print(f"  model config: {config_dest.name}")
        print(f"  metrics: {metrics_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        return [str(runtime_dest), str(config_dest), str(metrics_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    copy_json(forecast_src, runtime_dest)
    copy_json(model_config_src, config_dest)
    write_json(metrics_dest, metrics)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)

    index = upsert_module_index(
        {
            "module": "forecast",
            "status": "ready",
            "manifestPath": bundle["entryFiles"]["runtime"].replace(runtime_dest.name, manifest_dest.name),
            "bundlePath": f"data/modules/forecast/{bundle_dest.name}",
            "scenarioId": FORECAST_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": FORECAST_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(runtime_dest), repo_rel(config_dest), repo_rel(metrics_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def build_forecast_package_801a(dry_run: bool) -> list[str]:
    forecast_src = PUBLIC_DATA_DIR / "flow-forecast.json"
    model_config_src = PUBLIC_DATA_DIR / "model-config.json"
    forecast_data = json.loads(forecast_src.read_text(encoding="utf-8"))
    model_config = json.loads(model_config_src.read_text(encoding="utf-8"))

    flow_csv = find_first(["grid_mmsi_count*.csv"])
    flow_dir = flow_csv.parent
    adjacency_csv = next(path for path in sorted(flow_dir.glob("*.csv")) if "相关性矩阵" in path.name)
    distance_csv = next(path for path in sorted(flow_dir.glob("*.csv")) if "距离矩阵" in path.name)
    weight_path = find_first(["model_0.pt"])

    module_dir = MODULES_DIR / "forecast"
    runtime_dest = module_dir / "forecast-runtime.json"
    config_dest = module_dir / "forecast-model-config.json"
    lstm_runtime_dest = module_dir / "forecast-lstm-runtime.json"
    bilstm_runtime_dest = module_dir / "forecast-bilstm-runtime.json"
    lstm_config_dest = module_dir / "forecast-lstm-model-config.json"
    bilstm_config_dest = module_dir / "forecast-bilstm-model-config.json"
    metrics_dest = module_dir / "forecast-metrics.json"
    bundle_dest = module_dir / "forecast-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    if dry_run:
        print("[dry-run] forecast package")
        print(f"  module dir: {module_dir}")
        print(f"  runtime: {runtime_dest.name}")
        print(f"  model config: {config_dest.name}")
        print(f"  runtime (lstm): {lstm_runtime_dest.name}")
        print(f"  runtime (bilstm): {bilstm_runtime_dest.name}")
        print(f"  model config (lstm): {lstm_config_dest.name}")
        print(f"  model config (bilstm): {bilstm_config_dest.name}")
        print(f"  metrics: {metrics_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        return [
            str(runtime_dest),
            str(config_dest),
            str(lstm_runtime_dest),
            str(bilstm_runtime_dest),
            str(lstm_config_dest),
            str(bilstm_config_dest),
            str(metrics_dest),
            str(bundle_dest),
            str(manifest_dest),
        ]

    ensure_dir(module_dir)
    copy_json(forecast_src, runtime_dest)
    copy_json(model_config_src, config_dest)

    flow_df = pd.read_csv(flow_csv, index_col=0)
    flow_df.index = pd.to_datetime(flow_df.index)
    flow_df = flow_df.sort_index()

    sequence_artifacts = export_sequence_model_artifacts(
        flow_df=flow_df,
        base_runtime=forecast_data,
        base_model_config=model_config,
        module_dir=module_dir,
        flow_source_rel=repo_rel(flow_csv),
        generated_by="demo-web/scripts/export_phase6_primary_bundles.py",
    )

    forecast_runtimes = {"STGCN": forecast_data}
    runtime_paths = {"STGCN": f"data/modules/forecast/{runtime_dest.name}"}
    model_config_paths = {"STGCN": f"data/modules/forecast/{config_dest.name}"}
    extra_sources: dict[str, str] = {}

    for artifact in sequence_artifacts:
        runtime_output_path = module_dir / artifact.runtime_file
        config_output_path = module_dir / artifact.config_file
        write_json(runtime_output_path, artifact.runtime)
        write_json(config_output_path, artifact.model_config)
        forecast_runtimes[artifact.model] = artifact.runtime
        runtime_paths[artifact.model] = f"data/modules/forecast/{artifact.runtime_file}"
        model_config_paths[artifact.model] = f"data/modules/forecast/{artifact.config_file}"
        extra_sources[f"forecast-{artifact.model.lower()}-weight"] = repo_rel(artifact.weight_path)

    metrics = compute_forecast_metrics(forecast_runtimes)
    available_models = [model_name for model_name in FORECAST_MODEL_ORDER if model_name in forecast_runtimes]
    bundle = {
        "artifactId": "forecast-bundle",
        "module": "forecast",
        "generatedAt": iso_now(),
        "scenarioId": FORECAST_SCENARIO_ID,
        "timeRange": build_time_range(forecast_data["meta"]["windowStart"], forecast_data["meta"]["windowEnd"]),
        "availableModels": available_models,
        "deferredModels": [],
        "horizons": list(forecast_data["meta"]["horizons"]),
        "entryFiles": {
            "runtime": f"data/modules/forecast/{runtime_dest.name}",
            "modelConfig": f"data/modules/forecast/{config_dest.name}",
            "metrics": f"data/modules/forecast/{metrics_dest.name}",
            **{model_entry_key("runtime", model_name): path for model_name, path in runtime_paths.items()},
            **{model_entry_key("modelConfig", model_name): path for model_name, path in model_config_paths.items()},
        },
    }
    manifest = {
        "artifactId": "forecast-manifest",
        "module": "forecast",
        "sourceStage": "exported",
        "derivedFrom": [
            "flow-grid-csv",
            "flow-adjacency-csv",
            "flow-distance-csv",
            "stgcn-weight",
            "flow-forecast-runtime",
            "flow-model-config-runtime",
            "forecast-lstm-weight",
            "forecast-bilstm-weight",
        ],
        "scenarioId": FORECAST_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": FORECAST_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/forecast/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="forecast-runtime",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-forecast-runtime"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-02", "FLOW-04"],
                path=f"data/modules/forecast/{runtime_dest.name}",
                description="Committed STGCN runtime timeline copied into the module package.",
            ),
            artifact_record(
                artifact_id="forecast-lstm-runtime",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-grid-csv", "forecast-lstm-weight"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02", "FLOW-04"],
                path=f"data/modules/forecast/{lstm_runtime_dest.name}",
                description="Structured LSTM runtime timeline exported on the same replay window as the STGCN bundle.",
            ),
            artifact_record(
                artifact_id="forecast-bilstm-runtime",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-grid-csv", "forecast-bilstm-weight"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02", "FLOW-04"],
                path=f"data/modules/forecast/{bilstm_runtime_dest.name}",
                description="Structured BiLSTM runtime timeline exported on the same replay window as the STGCN bundle.",
            ),
            artifact_record(
                artifact_id="forecast-model-config",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-model-config-runtime", "flow-adjacency-csv", "flow-distance-csv"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02"],
                path=f"data/modules/forecast/{config_dest.name}",
                description="Graph and scaler metadata copied into the forecast module package.",
            ),
            artifact_record(
                artifact_id="forecast-lstm-model-config",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-model-config-runtime", "forecast-lstm-weight"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02"],
                path=f"data/modules/forecast/{lstm_config_dest.name}",
                description="LSTM architecture, scaler, and hotspot metadata aligned to the forecast module runtime.",
            ),
            artifact_record(
                artifact_id="forecast-bilstm-model-config",
                module="forecast",
                source_stage="exported",
                derived_from=["flow-model-config-runtime", "forecast-bilstm-weight"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-01", "FLOW-02"],
                path=f"data/modules/forecast/{bilstm_config_dest.name}",
                description="BiLSTM architecture, scaler, and hotspot metadata aligned to the forecast module runtime.",
            ),
            artifact_record(
                artifact_id="forecast-metrics",
                module="forecast",
                source_stage="exported",
                derived_from=["forecast-runtime", "forecast-lstm-runtime", "forecast-bilstm-runtime"],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["FLOW-03", "EVAL-01", "EVAL-02", "EVAL-05"],
                path=f"data/modules/forecast/{metrics_dest.name}",
                description="Timeline-aligned STGCN, LSTM, and BiLSTM total-flow metrics for 1h, 2h, and 3h horizons.",
            ),
            artifact_record(
                artifact_id="forecast-bundle",
                module="forecast",
                source_stage="exported",
                derived_from=[
                    "forecast-runtime",
                    "forecast-model-config",
                    "forecast-lstm-runtime",
                    "forecast-bilstm-runtime",
                    "forecast-lstm-model-config",
                    "forecast-bilstm-model-config",
                    "forecast-metrics",
                ],
                scenario_id=FORECAST_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=FORECAST_REQUIREMENTS,
                path=f"data/modules/forecast/{bundle_dest.name}",
                description="Module entry bundle for forecast data discovery.",
            ),
        ],
        "deferred": [],
        "sources": {
            "flow-grid-csv": repo_rel(flow_csv),
            "flow-adjacency-csv": repo_rel(adjacency_csv),
            "flow-distance-csv": repo_rel(distance_csv),
            "stgcn-weight": repo_rel(weight_path),
            "flow-forecast-runtime": repo_rel(forecast_src),
            "flow-model-config-runtime": repo_rel(model_config_src),
            **extra_sources,
        },
    }

    write_json(metrics_dest, metrics)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)

    index = upsert_module_index(
        {
            "module": "forecast",
            "status": "ready",
            "manifestPath": f"data/modules/forecast/{manifest_dest.name}",
            "bundlePath": f"data/modules/forecast/{bundle_dest.name}",
            "scenarioId": FORECAST_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": FORECAST_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [
        repo_rel(runtime_dest),
        repo_rel(config_dest),
        repo_rel(lstm_runtime_dest),
        repo_rel(bilstm_runtime_dest),
        repo_rel(lstm_config_dest),
        repo_rel(bilstm_config_dest),
        repo_rel(metrics_dest),
        repo_rel(bundle_dest),
        repo_rel(manifest_dest),
    ]


def load_repair_frame(path: Path) -> pd.DataFrame:
    return pd.read_pickle(path)


def points_from_frame(df: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "index": int(index),
            "lon": round_float(row["lon"], 6),
            "lat": round_float(row["lat"], 6),
        }
        for index, row in df.reset_index(drop=True).iterrows()
    ]


def points_from_array(values: np.ndarray) -> list[dict[str, Any]]:
    return [
        {
            "index": int(index),
            "lon": round_float(point[0], 6),
            "lat": round_float(point[1], 6),
        }
        for index, point in enumerate(values)
    ]


def build_repair_package(dry_run: bool) -> list[str]:
    module_dir = MODULES_DIR / "repair"
    samples_dest = module_dir / "repair-samples.json"
    trajectories_dest = module_dir / "repair-trajectories.json"
    errors_dest = module_dir / "repair-errors.json"
    metrics_dest = module_dir / "repair-metrics.json"
    bundle_dest = module_dir / "repair-bundle.json"
    manifest_dest = module_dir / "manifest.json"

    sample_catalog: list[dict[str, Any]] = []
    trajectory_payload = {"module": "repair", "scenarioId": REPAIR_SCENARIO_ID, "samples": []}
    error_payload = {"module": "repair", "scenarioId": REPAIR_SCENARIO_ID, "samples": []}
    metrics_payload = {"module": "repair", "scenarioId": REPAIR_SCENARIO_ID, "samples": []}
    derived_from: list[str] = []
    source_map: dict[str, str] = {}

    for index, (sample_id, csv_path) in enumerate(find_repair_sample_paths(), start=1):
        prediction_path = ROOT / "代码依据" / "轨迹修复" / f"轨迹{index}预测值.pkl"
        metrics_path = ROOT / "代码依据" / "轨迹修复" / f"metrics_results{index}_1.pkl"
        noisy_df = pd.read_csv(csv_path)
        prediction_df = load_repair_frame(prediction_path)
        metrics_df = load_repair_frame(metrics_path)

        target_id = f"target-{index}"
        derived_from.extend([f"repair-target-{index}-sample-1", f"repair-predictions-{index}", f"repair-metrics-{index}"])
        source_map[f"repair-target-{index}-sample-1"] = repo_rel(csv_path)
        source_map[f"repair-predictions-{index}"] = repo_rel(prediction_path)
        source_map[f"repair-metrics-{index}"] = repo_rel(metrics_path)

        missing_points = points_from_frame(noisy_df)
        predicted_rows = {row["Model"]: parse_prediction_values(row["Predicted Values"]) for _, row in prediction_df.iterrows()}
        ground_truth = points_from_array(predicted_rows["真实值"])
        repairs: dict[str, Any] = {}
        for label, values in predicted_rows.items():
            if label == "真实值":
                continue
            repairs[model_id(label)] = {
                "modelId": model_id(label),
                "modelLabel": label,
                "points": points_from_array(values),
            }

        sample_catalog.append(
            {
                "sampleId": sample_id,
                "label": f"Target {index} Sample 1",
                "targetId": target_id,
                "missingPointCount": len(missing_points),
                "groundTruthPointCount": len(ground_truth),
                "availableModels": [key for key in repairs.keys()],
                "sourceFiles": {
                    "missingTrajectory": repo_rel(csv_path),
                    "predictions": repo_rel(prediction_path),
                    "metrics": repo_rel(metrics_path),
                },
            }
        )
        trajectory_payload["samples"].append(
            {
                "sampleId": sample_id,
                "targetId": target_id,
                "missing": missing_points,
                "groundTruth": ground_truth,
                "repairs": repairs,
            }
        )

        error_models: dict[str, Any] = {}
        metric_rows: list[dict[str, Any]] = []
        for _, row in metrics_df.iterrows():
            label = row["Model"]
            current_model_id = model_id(label)
            error_models[current_model_id] = {
                "modelId": current_model_id,
                "modelLabel": label,
                "lonDifference": [round_float(value, 6) for value in np.asarray(row["X Difference"], dtype=float)],
                "latDifference": [round_float(value, 6) for value in np.asarray(row["Y Difference"], dtype=float)],
                "euclideanDistance": [round_float(value, 6) for value in np.asarray(row["Euclidean Distances"], dtype=float)],
                "lonDifferenceMean": round_float(row["X Difference Mean"], 6),
                "latDifferenceMean": round_float(row["Y Difference Mean"], 6),
                "euclideanDistanceMean": round_float(row["Euclidean Distances Mean"], 6),
            }
            metric_rows.append(
                {
                    "modelId": current_model_id,
                    "modelLabel": label,
                    "mse": round_float(row["MSE"], 6),
                    "rmse": round_float(row["RMSE"], 6),
                    "mae": round_float(row["MAE"], 6),
                    "dtwSimilarity": round_float(row["DTW Similarity"], 6),
                    "ade": round_float(row["ADE"], 6),
                    "r2": round_float(row["R²"], 6),
                    "hausdorffDistance": round_float(row["Hausdorff Distance"], 6),
                    "lonDifferenceMean": round_float(row["X Difference Mean"], 6),
                    "latDifferenceMean": round_float(row["Y Difference Mean"], 6),
                    "euclideanDistanceMean": round_float(row["Euclidean Distances Mean"], 6),
                }
            )

        error_payload["samples"].append({"sampleId": sample_id, "targetId": target_id, "models": error_models})
        metrics_payload["samples"].append({"sampleId": sample_id, "targetId": target_id, "metrics": metric_rows})

    bundle = {
        "artifactId": "repair-bundle",
        "module": "repair",
        "generatedAt": iso_now(),
        "scenarioId": REPAIR_SCENARIO_ID,
        "timeRange": build_time_range("sample-scoped", "sample-scoped"),
        "sampleCount": len(sample_catalog),
        "entryFiles": {
            "samples": f"data/modules/repair/{samples_dest.name}",
            "trajectories": f"data/modules/repair/{trajectories_dest.name}",
            "errors": f"data/modules/repair/{errors_dest.name}",
            "metrics": f"data/modules/repair/{metrics_dest.name}",
        },
        "availableModels": sorted({model for sample in sample_catalog for model in sample["availableModels"]}),
        "deferred": ["repair-optuna-study-export"],
    }
    manifest = {
        "artifactId": "repair-manifest",
        "module": "repair",
        "sourceStage": "exported",
        "derivedFrom": derived_from,
        "scenarioId": REPAIR_SCENARIO_ID,
        "timeRange": bundle["timeRange"],
        "authoritativeFor": REPAIR_REQUIREMENTS,
        "generatedAt": iso_now(),
        "bundlePath": f"data/modules/repair/{bundle_dest.name}",
        "artifacts": [
            artifact_record(
                artifact_id="repair-samples",
                module="repair",
                source_stage="exported",
                derived_from=[item for item in derived_from if item.startswith("repair-target")],
                scenario_id=REPAIR_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["REPR-01"],
                path=f"data/modules/repair/{samples_dest.name}",
                description="Curated repair sample catalog for website selection.",
            ),
            artifact_record(
                artifact_id="repair-trajectories",
                module="repair",
                source_stage="exported",
                derived_from=[item for item in derived_from if item.startswith("repair-target") or item.startswith("repair-predictions")],
                scenario_id=REPAIR_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["REPR-02", "REPR-03"],
                path=f"data/modules/repair/{trajectories_dest.name}",
                description="Missing, repaired, and ground-truth trajectories for curated repair samples.",
            ),
            artifact_record(
                artifact_id="repair-errors",
                module="repair",
                source_stage="exported",
                derived_from=[item for item in derived_from if item.startswith("repair-metrics")],
                scenario_id=REPAIR_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["REPR-04", "REPR-05"],
                path=f"data/modules/repair/{errors_dest.name}",
                description="Longitude, latitude, and euclidean error arrays for each repair sample and model.",
            ),
            artifact_record(
                artifact_id="repair-metrics-export",
                module="repair",
                source_stage="exported",
                derived_from=[item for item in derived_from if item.startswith("repair-metrics")],
                scenario_id=REPAIR_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=["REPR-05", "EVAL-01", "EVAL-03", "EVAL-05"],
                path=f"data/modules/repair/{metrics_dest.name}",
                description="Scalar repair metrics for evaluation and module UI.",
            ),
            artifact_record(
                artifact_id="repair-bundle",
                module="repair",
                source_stage="exported",
                derived_from=["repair-samples", "repair-trajectories", "repair-errors", "repair-metrics-export"],
                scenario_id=REPAIR_SCENARIO_ID,
                time_range=bundle["timeRange"],
                authoritative_for=REPAIR_REQUIREMENTS,
                path=f"data/modules/repair/{bundle_dest.name}",
                description="Module entry bundle for repair data discovery.",
            ),
        ],
        "deferred": [
            {
                "artifactId": "repair-optuna-study-export",
                "reason": "study1_1.pkl requires optuna in the local environment, so only HTML outputs are currently reviewable.",
                "dependsOn": ["EVAL-04", "Phase 11"],
            }
        ],
        "sources": source_map,
    }

    if dry_run:
        print("[dry-run] repair package")
        print(f"  module dir: {module_dir}")
        print(f"  samples: {samples_dest.name}")
        print(f"  trajectories: {trajectories_dest.name}")
        print(f"  errors: {errors_dest.name}")
        print(f"  metrics: {metrics_dest.name}")
        print(f"  bundle: {bundle_dest.name}")
        print(f"  manifest: {manifest_dest.name}")
        print(f"  curated samples: {len(sample_catalog)}")
        return [str(samples_dest), str(trajectories_dest), str(errors_dest), str(metrics_dest), str(bundle_dest), str(manifest_dest)]

    ensure_dir(module_dir)
    write_json(samples_dest, {"module": "repair", "scenarioId": REPAIR_SCENARIO_ID, "samples": sample_catalog})
    write_json(trajectories_dest, trajectory_payload)
    write_json(errors_dest, error_payload)
    write_json(metrics_dest, metrics_payload)
    write_json(bundle_dest, bundle)
    write_json(manifest_dest, manifest)

    index = upsert_module_index(
        {
            "module": "repair",
            "status": "ready",
            "manifestPath": f"data/modules/repair/{manifest_dest.name}",
            "bundlePath": f"data/modules/repair/{bundle_dest.name}",
            "scenarioId": REPAIR_SCENARIO_ID,
            "timeRange": bundle["timeRange"],
            "authoritativeFor": REPAIR_REQUIREMENTS,
        }
    )
    write_artifact_index(index)
    return [repo_rel(samples_dest), repo_rel(trajectories_dest), repo_rel(errors_dest), repo_rel(metrics_dest), repo_rel(bundle_dest), repo_rel(manifest_dest)]


def main() -> None:
    args = parse_args()
    written: list[str] = []
    if args.module in {"forecast", "all"}:
        written.extend(build_forecast_package(args.dry_run))
    if args.module in {"repair", "all"}:
        written.extend(build_repair_package(args.dry_run))
    if not args.dry_run:
        print("Wrote primary Phase 6 artifacts:")
        for item in written:
            print(f"- {item}")


if __name__ == "__main__":
    main()
