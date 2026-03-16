"""
Export pre-computed main corridors to a JSON file consumable by the RouteEditor website.

Reads:  demo-web/analysis/senior_main_corridors_cleaned_points.csv
Writes: demo-web/public/data/precomputed-corridors.json

Each corridor's representative line is computed by:
  1. Grouping track points by corridor_id then track_id
  2. Resampling every track to SIGNATURE_POINTS evenly-spaced points (arc-length)
  3. Averaging the resampled tracks to get one representative polyline
  4. Exporting the representative points directly as geographic lat/lon

Run from any directory:
    python demo-web/scripts/export_corridors_for_web.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SIGNATURE_POINTS = 9


def resample_latlon(points: np.ndarray, n: int) -> np.ndarray:
    """Resample a lat/lon polyline (shape [k, 2]) to n evenly-spaced points."""
    if len(points) == 0:
        return np.zeros((n, 2))
    if len(points) == 1:
        return np.repeat(points[:1], n, axis=0)

    mean_lat = float(points[:, 0].mean())
    cos_lat = math.cos(math.radians(mean_lat))
    dlat = np.diff(points[:, 0]) * 111_000.0
    dlon = np.diff(points[:, 1]) * 111_000.0 * cos_lat
    seg_lengths = np.sqrt(dlat**2 + dlon**2)
    cumlen = np.concatenate([[0.0], np.cumsum(seg_lengths)])
    total = float(cumlen[-1])

    if total == 0:
        return np.repeat(points[:1], n, axis=0)

    targets = np.linspace(0.0, total, n)
    result = []
    for t in targets:
        i = int(np.searchsorted(cumlen, t, side="right") - 1)
        i = max(0, min(i, len(points) - 2))
        span = float(cumlen[i + 1] - cumlen[i])
        w = 0.0 if span == 0 else (t - float(cumlen[i])) / span
        result.append(points[i] + w * (points[i + 1] - points[i]))

    return np.vstack(result)


def geo_to_point(lat: float, lon: float) -> dict[str, float]:
    """Convert a representative point to a JSON-friendly geographic coordinate."""
    return {"lat": round(lat, 6), "lon": round(lon, 6)}


def build_representative_line(corridor_df: pd.DataFrame) -> list[dict[str, float]]:
    """Return SIGNATURE_POINTS representative points for one corridor."""
    track_resampled: list[np.ndarray] = []

    for _, track_df in corridor_df.groupby("track_id"):
        track_df = track_df.sort_values("point_index")
        pts = track_df[["lat", "lon"]].values
        if len(pts) < 2:
            continue
        track_resampled.append(resample_latlon(pts, SIGNATURE_POINTS))

    if not track_resampled:
        return []

    mean_line = np.mean(np.stack(track_resampled), axis=0)
    return [geo_to_point(float(row[0]), float(row[1])) for row in mean_line]


def main() -> None:
    csv_path = ROOT / "demo-web" / "analysis" / "senior_main_corridors_cleaned_points.csv"
    out_path = ROOT / "demo-web" / "public" / "data" / "precomputed-corridors.json"

    print(f"Reading {csv_path} ...")
    df = pd.read_csv(csv_path)

    corridors: list[dict] = []

    for corridor_id, corridor_df in df.groupby("corridor_id"):
        representative_points = build_representative_line(corridor_df)
        if not representative_points:
            print(f"  Skipping {corridor_id}: no valid tracks")
            continue

        track_count = int(corridor_df["track_id"].nunique())
        direction_label = str(corridor_df["direction_label"].iloc[0])

        corridors.append(
            {
                "corridorId": str(corridor_id),
                "trackCount": track_count,
                "directionLabel": direction_label,
                "representativePoints": representative_points,
            }
        )

    corridors.sort(key=lambda c: -c["trackCount"])

    output = {
        "source": "senior_main_corridors_cleaned_points.csv",
        "signaturePoints": SIGNATURE_POINTS,
        "corridorCount": len(corridors),
        "corridors": corridors,
    }

    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(corridors)} corridors -> {out_path}")
    for c in corridors:
        print(f"  {c['corridorId']:12s}  {c['trackCount']:4d} tracks  ({c['directionLabel']})")


if __name__ == "__main__":
    main()
