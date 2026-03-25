from __future__ import annotations

import hashlib
import json
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = ROOT / "demo-web"
PUBLIC_ROOT = WEB_ROOT / "public"
PUBLIC_DATA_DIR = PUBLIC_ROOT / "data"
MODULES_DIR = PUBLIC_DATA_DIR / "modules"
REVIEW_DIR = WEB_ROOT / "analysis" / "review"
PHASE_DIR = ROOT / ".planning" / "phases" / "06-data-completion-and-lineage"

MODULES_DIR.mkdir(parents=True, exist_ok=True)
REVIEW_DIR.mkdir(parents=True, exist_ok=True)


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def repo_rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def public_rel(path: Path) -> str:
    return path.resolve().relative_to(PUBLIC_ROOT.resolve()).as_posix()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def round_float(value: Any, digits: int = 6) -> float:
    return round(float(value), digits)


def sanitize_for_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): sanitize_for_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_for_json(item) for item in value]
    if hasattr(value, "tolist"):
        return sanitize_for_json(value.tolist())
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"Non-finite float cannot be serialized: {value}")
        return value
    return value


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(
        json.dumps(sanitize_for_json(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def copy_json(src: Path, dest: Path) -> None:
    write_json(dest, read_json(src))


def copy_text(src: Path, dest: Path) -> None:
    ensure_dir(dest.parent)
    shutil.copyfile(src, dest)


def find_first(patterns: list[str]) -> Path:
    for pattern in patterns:
        matches = sorted(ROOT.rglob(pattern))
        if matches:
            return matches[0]
    raise FileNotFoundError(f"Unable to find any path matching: {patterns}")


def artifact_record(
    *,
    artifact_id: str,
    module: str,
    source_stage: str,
    derived_from: list[str],
    scenario_id: str,
    time_range: dict[str, Any],
    authoritative_for: list[str],
    path: str,
    status: str = "ready",
    description: str = "",
) -> dict[str, Any]:
    return {
        "artifactId": artifact_id,
        "module": module,
        "sourceStage": source_stage,
        "derivedFrom": derived_from,
        "scenarioId": scenario_id,
        "timeRange": time_range,
        "authoritativeFor": authoritative_for,
        "path": path,
        "status": status,
        "description": description,
    }


def default_index() -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "generatedAt": iso_now(),
        "generatedBy": "demo-web/scripts/phase6_bundle_common.py",
        "modules": [],
    }


def artifact_index_path() -> Path:
    return MODULES_DIR / "artifact-index.json"


def load_artifact_index() -> dict[str, Any]:
    path = artifact_index_path()
    if not path.exists():
        return default_index()
    return read_json(path)


def upsert_module_index(entry: dict[str, Any]) -> dict[str, Any]:
    index = load_artifact_index()
    modules = [item for item in index.get("modules", []) if item.get("module") != entry.get("module")]
    modules.append(entry)
    modules.sort(key=lambda item: item["module"])
    index["generatedAt"] = iso_now()
    index["modules"] = modules
    return index


def write_artifact_index(index: dict[str, Any]) -> None:
    write_json(artifact_index_path(), index)


def find_repair_sample_paths() -> list[tuple[str, Path]]:
    samples: list[tuple[str, Path]] = []
    for csv_path in sorted(ROOT.rglob("trajectory_1.csv")):
        parent_name = csv_path.parent.name
        if "随机噪声轨迹" not in parent_name:
            continue
        sample_id = f"repair-target-{len(samples) + 1}-sample-1"
        samples.append((sample_id, csv_path))
    if not samples:
        raise FileNotFoundError("Could not find repair trajectory_1.csv samples")
    return samples


def build_time_range(start: Any, end: Any) -> dict[str, Any]:
    return {"start": start, "end": end}
