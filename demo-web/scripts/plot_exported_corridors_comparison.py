from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from PIL import Image

from export_corridors_for_web import ROOT, build_representative_line


ANALYSIS_DIR = ROOT / "demo-web" / "analysis"
REFERENCE_IMAGE = ROOT / "代码依据" / "轨迹聚类" / "output_figs" / "聚类前轨迹 .png"
CLEANED_POINTS_CSV = ANALYSIS_DIR / "senior_main_corridors_cleaned_points.csv"
OUTPUT_IMAGE = ANALYSIS_DIR / "exported_corridors_vs_senior_reference.png"


def load_exported_corridors() -> list[dict]:
    df = pd.read_csv(CLEANED_POINTS_CSV)
    corridors: list[dict] = []
    for corridor_id, corridor_df in df.groupby("corridor_id"):
        representative_points = build_representative_line(corridor_df)
        if not representative_points:
            continue
        corridors.append(
            {
                "corridorId": str(corridor_id),
                "trackCount": int(corridor_df["track_id"].nunique()),
                "directionLabel": str(corridor_df["direction_label"].iloc[0]),
                "representativePoints": representative_points,
            }
        )
    corridors.sort(key=lambda item: (-item["trackCount"], item["corridorId"]))
    return corridors


def plot_representative_corridors(ax: plt.Axes, corridors: list[dict], title: str) -> None:
    cmap = plt.get_cmap("tab20", max(len(corridors), 1))

    for index, corridor in enumerate(corridors):
        color = cmap(index)
        lons = [point["lon"] for point in corridor["representativePoints"]]
        lats = [point["lat"] for point in corridor["representativePoints"]]
        ax.plot(lons, lats, color=color, linewidth=2.8, alpha=0.92)
        ax.scatter(lons, lats, color=color, s=16, alpha=0.9)
        label_index = max(0, min(len(lons) - 1, len(lons) // 2))
        ax.text(
            lons[label_index],
            lats[label_index],
            corridor["corridorId"],
            fontsize=8,
            color=color,
            ha="left",
            va="bottom",
            bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.55, "pad": 1.5},
        )

    ax.set_title(title)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.grid(alpha=0.18, linewidth=0.5)


def plot_overlay(ax: plt.Axes, df: pd.DataFrame, corridors: list[dict]) -> None:
    grouped = df.groupby(["corridor_id", "track_id"])
    for (_, _), track_df in grouped:
        track_df = track_df.sort_values("point_index")
        ax.plot(track_df["lon"], track_df["lat"], color="#aab6c2", alpha=0.13, linewidth=0.7)

    plot_representative_corridors(ax, corridors, "Current exported representative corridors")
    ax.set_title("Exported representative lines over senior cleaned tracks")


def save_plot(output_path: Path) -> Path:
    df = pd.read_csv(CLEANED_POINTS_CSV)
    corridors = load_exported_corridors()

    fig, axes = plt.subplots(1, 3, figsize=(20, 7), constrained_layout=True)
    fig.suptitle("export_corridors_for_web.py vs senior reference", fontsize=16, fontweight="bold")

    axes[0].imshow(Image.open(REFERENCE_IMAGE))
    axes[0].set_title("Senior reference figure")
    axes[0].axis("off")

    plot_representative_corridors(axes[1], corridors, "Replotted from export_corridors_for_web.py")
    plot_overlay(axes[2], df, corridors)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=220)
    plt.close(fig)
    return output_path


def main() -> None:
    output_path = save_plot(OUTPUT_IMAGE)
    summary = {
        "referenceImage": str(REFERENCE_IMAGE),
        "sourceCsv": str(CLEANED_POINTS_CSV),
        "outputImage": str(output_path),
    }
    summary_path = output_path.with_suffix(".json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Saved comparison image: {output_path}")
    print(f"Saved comparison summary: {summary_path}")

    Image.open(output_path).show()
    print("Opened comparison image with Image.show().")


if __name__ == "__main__":
    main()
