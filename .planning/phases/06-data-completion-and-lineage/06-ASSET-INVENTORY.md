# Phase 6 Asset Inventory

_Last updated: 2026-03-25_

This inventory answers one question before any bundle export happens: what already exists, what the website already ships, what is still missing, and whether the missing piece is locally regenerable or blocked by a special environment.

## Global Summary

| Module | Authoritative research assets | Current website-facing assets | Missing website-facing outputs | Regeneration status |
|---|---|---|---|---|
| Forecast | `代码依据/流量预测/grid_mmsi_count（流量数据）.csv`, `代码依据/流量预测/相关性矩阵0.csv`, `代码依据/流量预测/距离矩阵0.csv`, `代码依据/流量预测/save/model_0.pt`, `代码依据/流量预测/stgcn.py`, `代码依据/流量预测/LSTM.ipynb`, `代码依据/流量预测/BILSTM.ipynb` | `demo-web/public/data/flow-forecast.json`, `demo-web/public/data/model-config.json` | Module package, artifact manifest, exported metrics surface, explicit model availability metadata | Regenerable for STGCN; LSTM/BiLSTM authoritative website exports remain missing and must stay deferred |
| Repair | `代码依据/轨迹修复/目标1随机噪声轨迹(50)`, `代码依据/轨迹修复/目标2随机噪声轨迹(50)`, `代码依据/轨迹修复/目标3随机噪声轨迹(50)`, `代码依据/轨迹修复/轨迹1预测值.pkl`, `代码依据/轨迹修复/轨迹2预测值.pkl`, `代码依据/轨迹修复/轨迹3预测值.pkl`, `代码依据/轨迹修复/metrics_results1_1.pkl`, `代码依据/轨迹修复/metrics_results2_1.pkl`, `代码依据/轨迹修复/metrics_results3_1.pkl` | None | Module package, curated sample catalog, structured trajectories, error arrays, metric summaries | Locally regenerable from existing CSV/PKL outputs |
| Clustering | `代码依据/轨迹聚类/cleaned_ais.CSV`, `代码依据/轨迹聚类/shaixuanhou_.csv`, `代码依据/轨迹聚类/segments(60-90).pkl`, `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl`, `代码依据/轨迹聚类/轨迹聚类.ipynb` | `demo-web/public/data/main-corridor-tracks.json`, `demo-web/analysis/senior_main_corridors_cleaned_points.csv`, `demo-web/analysis/senior_main_corridors_track_stats.csv` | Module package with layered lineage, stage summaries, preview data, review-first corridor comparison output | Regenerable for layered summaries and corridor review package; noise re-clustering is still blocked |
| Evaluation | Forecast and repair exported bundles once Phase 6 exporters exist | None | Unified metric package and traceability surface | Regenerable after forecast and repair bundles exist |
| Overview | Exported module bundles and artifact index once Phase 6 exporters exist | None | Overview package summarizing scale, modules, and business loop framing | Regenerable after forecast, repair, and clustering bundles exist |

## Regeneration Classification

| Status | Meaning | Modules |
|---|---|---|
| `ready-now` | Existing files plus current local Python environment are enough to export the website-facing package | Forecast STGCN, repair, clustering layered summaries, evaluation, overview |
| `deferred` | Inputs exist partially, but the missing output cannot be regenerated honestly in the current environment or without a stable extra toolchain | Forecast LSTM/BiLSTM website exports, clustering noise re-clustering, full collaborative decision evidence |
| `review-first` | The output can be regenerated, but it must not overwrite the live runtime artifact during Phase 6 | Clustering corridor-derived exports |

## Module Appendix: Forecast

### What exists now

- `代码依据/流量预测/grid_mmsi_count（流量数据）.csv` contains `13152` time rows and `60` grid columns.
- `代码依据/流量预测/相关性矩阵0.csv` and `代码依据/流量预测/距离矩阵0.csv` provide graph inputs for the flow model family.
- `代码依据/流量预测/save/model_0.pt` plus `代码依据/流量预测/stgcn.py` support the current shipped STGCN runtime lineage.
- `代码依据/流量预测/LSTM.ipynb` and `代码依据/流量预测/BILSTM.ipynb` prove the alternative model family exists at research level, but no committed website-facing result bundle exists yet.
- `demo-web/public/data/flow-forecast.json` ships `577` aligned playback/forecast timeline frames with `1h`, `2h`, and `3h` horizons.
- `demo-web/public/data/model-config.json` ships the current STGCN runtime configuration and graph/scaler metadata.

### What is missing

- A committed module directory under `demo-web/public/data/modules/forecast/`.
- A manifest that records model availability, deferred models, lineage, and scenario coverage.
- A metric file derived from the shipped forecast timeline so later modules stop depending on hardcoded `scenarioPacks.ts` benchmark numbers.

### Regeneration call

- `STGCN` package export is locally regenerable from the current runtime data and authoritative research files.
- `LSTM` and `BiLSTM` are **not** locally ready as website artifacts because the repo only contains notebooks, not committed structured result files. They must be marked deferred instead of stubbed.

## Module Appendix: Repair

### What exists now

- Three curated repair target folders each contain `50` noisy trajectory CSV files.
- Representative sample lengths for `trajectory_1.csv` are `829`, `1026`, and `965` points for targets 1, 2, and 3.
- `轨迹1预测值.pkl`, `轨迹2预测值.pkl`, and `轨迹3预测值.pkl` each expose a `Model` plus `Predicted Values` table with six rows, including model predictions and a ground-truth row.
- `metrics_results1_1.pkl`, `metrics_results2_1.pkl`, and `metrics_results3_1.pkl` each expose five scored models with RMSE, MAE, DTW Similarity, ADE, R-squared, Hausdorff Distance, and per-point error arrays.
- HTML outputs already exist for repair trajectories, longitude error, latitude error, and metric reports, so there is enough evidence to create review visuals without reopening notebooks.

### What is missing

- A structured sample catalog for the website.
- Structured trajectory exports separating missing trajectory, ground truth, and repaired outputs.
- Structured error arrays and metric tables detached from notebook HTML.

### Regeneration call

- Repair is locally regenerable with the current environment because the website can consume the existing CSV and PKL outputs directly.
- `study1_1.pkl` is not currently readable because `optuna` is missing, so any structured optimization-history export must stay deferred or HTML-backed for now.

## Module Appendix: Clustering

### What exists now

- `代码依据/轨迹聚类/shaixuanhou_.csv` contains `293771` cleaned-filtered AIS rows across `3554` MMSI values.
- `代码依据/轨迹聚类/cleaned_ais.CSV` contains `208812` AIS rows across `2451` MMSI values and is the raw display layer used by the current dashboard scripts.
- `代码依据/轨迹聚类/segments(60-90).pkl` contains `3827` segmented trajectories with `152673` total points.
- `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl` contains `3827` compressed trajectories with `18980` total points.
- `demo-web/public/data/main-corridor-tracks.json` currently ships `16` corridors and `1321` tracks for the RouteEditor/runtime corridor view.
- `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` can regenerate corridor-level review outputs from `compressed_segments(60,90,0.03).pkl`, but its CLI writes directly to the live runtime file and therefore cannot be used as-is for Phase 6 promotion.

### What is missing

- A committed clustering module package with raw/segmented/compressed/exported layering preserved.
- Review-first corridor comparison outputs that do not overwrite `demo-web/public/data/main-corridor-tracks.json`.
- Structured noise re-clustering output.

### Regeneration call

- Raw, segmented, compressed, and corridor review outputs are locally regenerable.
- `代码依据/轨迹聚类/normalized_distances(60,90,0.03).pkl` is unreadable (`EOFError`), so notebook-grade noise re-clustering remains deferred.
- `main-corridor-tracks.json` is a runtime export, not the top-level clustering truth. The package must preserve layered lineage instead of flattening onto that file.

## Module Appendix: Evaluation

### What exists now

- No website package exists yet.
- The needed metric evidence already lives in the forecast runtime timeline and repair PKL outputs.

### What is missing

- A committed evaluation package derived from exported module bundles, not directly from research files.
- Traceable model ranking tables and module-scoped metric metadata.

### Regeneration call

- Evaluation is locally regenerable after forecast and repair bundles are exported.

## Module Appendix: Overview

### What exists now

- No website package exists yet.
- The planned data scale, module coverage, and business-loop framing can be derived from module manifests and the artifact index once those files exist.

### What is missing

- A committed overview package for Phase 7+ website shell work.

### Regeneration call

- Overview is locally regenerable after the Phase 6 module packages exist.

## Deferred Boundary at Audit Time

| Deferred item | Reason | Downstream dependency |
|---|---|---|
| Forecast LSTM/BiLSTM website exports | Only notebook definitions exist in-repo; no committed structured results yet | Phase 8 model switching and comparison depth |
| Clustering noise re-clustering | `normalized_distances(60,90,0.03).pkl` is unreadable and the notebook-grade path depends on extra environment stability | Phase 10 advanced clustering comparison |
| Full collaborative decision evidence package | Research assets are not yet strong enough to support an honest strategy package | Phase 12 |
| Structured Optuna study export | `study1_1.pkl` requires `optuna`, which is not available in the current local environment | Phase 11 optimization visuals |
