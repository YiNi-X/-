from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = ROOT / "demo-web"
PUBLIC_ROOT = WEB_ROOT / "public"
MODULES_DIR = PUBLIC_ROOT / "data" / "modules"
REVIEW_DIR = WEB_ROOT / "analysis" / "review"

REQUIRED_MANIFEST_FIELDS = {
    "artifactId",
    "module",
    "sourceStage",
    "derivedFrom",
    "scenarioId",
    "timeRange",
    "authoritativeFor",
}
REQUIRED_ARTIFACT_FIELDS = REQUIRED_MANIFEST_FIELDS | {"path", "status", "description"}
REQUIRED_MODULES = {"forecast", "repair", "clustering", "evaluation", "overview"}
REQUIRED_REVIEW_FILES = {
    REVIEW_DIR / "forecast-total-flow-review.png",
    REVIEW_DIR / "repair-target-1-review.png",
    REVIEW_DIR / "repair-target-1-errors-review.png",
    REVIEW_DIR / "clustering-compressed-review.png",
    REVIEW_DIR / "clustering-corridor-review.png",
}


def read_json(path: Path) -> Any:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def resolve_public(rel_path: str) -> Path:
    if rel_path.startswith("data/"):
        return PUBLIC_ROOT / rel_path
    return PUBLIC_ROOT / rel_path.lstrip("/")


def check_finite(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            check_finite(item, f"{path}.{key}", errors)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            check_finite(item, f"{path}[{index}]", errors)
    elif isinstance(value, float) and not math.isfinite(value):
        errors.append(f"Non-finite number at {path}")


def expect(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_manifest(module: str, index_entry: dict[str, Any], errors: list[str]) -> dict[str, Any]:
    manifest_path = resolve_public(index_entry["manifestPath"])
    bundle_path = resolve_public(index_entry["bundlePath"])
    expect(manifest_path.exists(), f"Missing manifest for {module}: {manifest_path}", errors)
    expect(bundle_path.exists(), f"Missing bundle for {module}: {bundle_path}", errors)
    manifest = read_json(manifest_path)
    bundle = read_json(bundle_path)
    check_finite(manifest, f"{module}.manifest", errors)
    check_finite(bundle, f"{module}.bundle", errors)
    missing_manifest_fields = sorted(REQUIRED_MANIFEST_FIELDS - set(manifest.keys()))
    expect(not missing_manifest_fields, f"Manifest {module} missing fields: {missing_manifest_fields}", errors)
    expect(manifest["module"] == module, f"Manifest {module} module mismatch", errors)
    for artifact in manifest.get("artifacts", []):
        missing_artifact_fields = sorted(REQUIRED_ARTIFACT_FIELDS - set(artifact.keys()))
        expect(not missing_artifact_fields, f"Artifact in {module} missing fields: {missing_artifact_fields}", errors)
        artifact_path = resolve_public(artifact["path"])
        expect(artifact_path.exists(), f"Artifact path missing for {module}: {artifact_path}", errors)
    return {"manifest": manifest, "bundle": bundle}


def validate_forecast(errors: list[str]) -> None:
    runtime = read_json(MODULES_DIR / "forecast" / "forecast-runtime.json")
    metrics = read_json(MODULES_DIR / "forecast" / "forecast-metrics.json")
    check_finite(runtime, "forecast.runtime", errors)
    check_finite(metrics, "forecast.metrics", errors)
    expect(len(runtime["timeline"]) == len(runtime["series"]["totalFlow"]), "Forecast timeline length does not match totalFlow series length", errors)
    expect(set(metrics["models"]["STGCN"]["horizons"].keys()) == {"1h", "2h", "3h"}, "Forecast metrics missing expected horizons", errors)
    for horizon, payload in metrics["models"]["STGCN"]["horizons"].items():
        expect(payload["sampleCount"] > 0, f"Forecast metric sampleCount invalid for {horizon}", errors)


def validate_repair(errors: list[str]) -> None:
    samples = read_json(MODULES_DIR / "repair" / "repair-samples.json")["samples"]
    trajectories = {item["sampleId"]: item for item in read_json(MODULES_DIR / "repair" / "repair-trajectories.json")["samples"]}
    error_samples = {item["sampleId"]: item for item in read_json(MODULES_DIR / "repair" / "repair-errors.json")["samples"]}
    metric_samples = {item["sampleId"]: item for item in read_json(MODULES_DIR / "repair" / "repair-metrics.json")["samples"]}
    expect(len(samples) == len(trajectories) == len(error_samples) == len(metric_samples), "Repair package sample counts are inconsistent", errors)
    for sample in samples:
        sample_id = sample["sampleId"]
        expect(sample_id in trajectories, f"Repair trajectory payload missing {sample_id}", errors)
        expect(sample_id in error_samples, f"Repair error payload missing {sample_id}", errors)
        expect(sample_id in metric_samples, f"Repair metric payload missing {sample_id}", errors)
        if sample_id not in trajectories or sample_id not in error_samples or sample_id not in metric_samples:
            continue
        repair_models = set(trajectories[sample_id]["repairs"].keys())
        error_models = set(error_samples[sample_id]["models"].keys())
        metric_models = {row["modelId"] for row in metric_samples[sample_id]["metrics"]}
        expect(set(sample["availableModels"]) == repair_models, f"Repair sample catalog model mismatch for {sample_id}", errors)
        expect(repair_models <= error_models, f"Repair error payload missing model arrays for {sample_id}", errors)
        expect(repair_models <= metric_models, f"Repair metric payload missing model rows for {sample_id}", errors)


def validate_clustering(errors: list[str]) -> None:
    summary = read_json(MODULES_DIR / "clustering" / "clustering-summary.json")
    previews = read_json(MODULES_DIR / "clustering" / "clustering-stage-previews.json")
    corridor_runtime = read_json(MODULES_DIR / "clustering" / "clustering-corridor-runtime.json")
    corridor_review = read_json(MODULES_DIR / "clustering" / "clustering-corridor-review.json")
    expect(summary["stageCounts"]["segmentedTracks"] == summary["stageCounts"]["compressedTracks"], "Clustering segmented/compressed track counts diverge", errors)
    expect(corridor_runtime["corridorCount"] == summary["stageCounts"]["corridorRuntimeCorridors"], "Clustering runtime corridor count mismatch", errors)
    expect(corridor_review["corridorCount"] == summary["stageCounts"]["corridorReviewCorridors"], "Clustering review corridor count mismatch", errors)
    for key in ["raw", "segmented", "compressed", "corridorExported", "corridorReview"]:
        expect(key in previews["previews"], f"Clustering previews missing {key}", errors)


def validate_evaluation(errors: list[str]) -> None:
    metrics = read_json(MODULES_DIR / "evaluation" / "evaluation-metrics.json")
    expect("forecast" in metrics and "repair" in metrics, "Evaluation package missing forecast or repair section", errors)
    expect(len(metrics["repair"]["aggregateByModel"]) > 0, "Evaluation repair aggregate is empty", errors)
    expect(set(metrics["forecast"]["rankings"].keys()) == {"1h", "2h", "3h"}, "Evaluation forecast rankings missing horizons", errors)


def validate_overview(index: dict[str, Any], errors: list[str]) -> None:
    summary = read_json(MODULES_DIR / "overview" / "overview-summary.json")
    indexed_non_overview = {item["module"] for item in index["modules"] if item["module"] != "overview"}
    summary_modules = {item["module"] for item in summary["modules"]}
    expect(summary_modules == indexed_non_overview, "Overview modules do not match non-overview artifact index entries", errors)
    expect(summary["framing"].lower().startswith("archived ais playback"), "Overview framing does not preserve archived/offline positioning", errors)


def main() -> int:
    errors: list[str] = []
    index_path = MODULES_DIR / "artifact-index.json"
    expect(index_path.exists(), f"Missing artifact index: {index_path}", errors)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    index = read_json(index_path)
    check_finite(index, "artifact-index", errors)
    module_names = {item["module"] for item in index.get("modules", [])}
    expect(module_names == REQUIRED_MODULES, f"Artifact index modules mismatch: {sorted(module_names)}", errors)

    for item in index.get("modules", []):
        validate_manifest(item["module"], item, errors)

    validate_forecast(errors)
    validate_repair(errors)
    validate_clustering(errors)
    validate_evaluation(errors)
    validate_overview(index, errors)

    for review_path in REQUIRED_REVIEW_FILES:
        expect(review_path.exists(), f"Missing review artifact: {review_path}", errors)

    if errors:
        print("Phase 6 bundle verification failed.")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Phase 6 bundle verification passed.")
    print(f"Validated modules: {', '.join(sorted(module_names))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
