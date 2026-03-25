# Phase 6 Lineage Matrix

_Last updated: 2026-03-25_

This matrix freezes the authoritative lineage for every Phase 6 module package before exporter work begins. Each exported artifact must carry these fields in its manifest:

- `artifactId`
- `module`
- `sourceStage`
- `derivedFrom`
- `scenarioId`
- `timeRange`
- `authoritativeFor`

## Lineage Rules

1. Forecast truth is anchored to the flow research files plus the currently shipped STGCN runtime output. Notebook-only LSTM/BiLSTM results are not allowed to masquerade as shipped website data.
2. Repair truth stays explicit per curated sample. The website package must preserve which target folder, noisy trajectory CSV, prediction PKL, and metrics PKL created each export.
3. Clustering truth stays layered. `main-corridor-tracks.json` is only the `corridor/exported` layer, not the whole clustering truth.
4. Evaluation and overview are derived only from exported Phase 6 module bundles and the artifact index. They must not read scattered research files directly.
5. Corridor-sensitive outputs are review-first. Phase 6 may generate comparison exports, but it must not overwrite the live runtime corridor dataset during this phase.

## Exported Artifact Matrix

| artifactId | module | sourceStage | derivedFrom | scenarioId | timeRange | authoritativeFor | Notes |
|---|---|---|---|---|---|---|---|
| `forecast-manifest` | forecast | exported | `flow-grid-csv`, `flow-adjacency-csv`, `flow-distance-csv`, `stgcn-weight`, `flow-forecast-runtime`, `flow-model-config-runtime` | `demo-live` | `2020-01-01T00:00:00` -> `2020-01-03T00:00:00` | `FLOW-01`, `FLOW-02`, `FLOW-03`, `FLOW-04`, `BASE-02`, `BASE-05` | Primary authority for the forecast package |
| `forecast-runtime` | forecast | exported | `flow-forecast-runtime` | `demo-live` | `2020-01-01T00:00:00` -> `2020-01-03T00:00:00` | `FLOW-02`, `FLOW-04` | Copy of the currently shipped runtime forecast timeline |
| `forecast-model-config` | forecast | exported | `flow-model-config-runtime`, `flow-adjacency-csv`, `flow-distance-csv` | `demo-live` | `2020-01-01T00:00:00` -> `2020-01-03T00:00:00` | `FLOW-01`, `FLOW-02` | Keeps graph/scaler/config context inside the module directory |
| `forecast-metrics` | forecast | exported | `forecast-runtime` | `demo-live` | `2020-01-01T00:00:00` -> `2020-01-03T00:00:00` | `FLOW-03`, `EVAL-01`, `EVAL-02`, `EVAL-05` | Derived from timeline-aligned STGCN output only |
| `repair-manifest` | repair | exported | `repair-target-1-sample-1`, `repair-target-2-sample-1`, `repair-target-3-sample-1`, `repair-predictions-1`, `repair-predictions-2`, `repair-predictions-3`, `repair-metrics-1`, `repair-metrics-2`, `repair-metrics-3` | `repair-curated-v1` | `sample-scoped` | `REPR-01`, `REPR-02`, `REPR-03`, `REPR-04`, `REPR-05`, `BASE-02`, `BASE-05` | Primary authority for the repair package |
| `repair-samples` | repair | exported | `repair-target-1-sample-1`, `repair-target-2-sample-1`, `repair-target-3-sample-1` | `repair-curated-v1` | `sample-scoped` | `REPR-01` | Catalog used for sample switching |
| `repair-trajectories` | repair | exported | `repair-samples`, `repair-predictions-1`, `repair-predictions-2`, `repair-predictions-3` | `repair-curated-v1` | `sample-scoped` | `REPR-02`, `REPR-03` | Missing, repaired, and ground-truth trajectories |
| `repair-errors` | repair | exported | `repair-metrics-1`, `repair-metrics-2`, `repair-metrics-3` | `repair-curated-v1` | `sample-scoped` | `REPR-04`, `REPR-05` | Longitude/latitude/euclidean error arrays |
| `repair-metrics-export` | repair | exported | `repair-metrics-1`, `repair-metrics-2`, `repair-metrics-3` | `repair-curated-v1` | `sample-scoped` | `REPR-05`, `EVAL-01`, `EVAL-03`, `EVAL-05` | Scalar metric summaries per sample and model |
| `clustering-manifest` | clustering | exported | `clustering-raw-cleaned-ais`, `clustering-segmented-pkl`, `clustering-compressed-pkl`, `clustering-corridor-runtime`, `clustering-corridor-review` | `clustered-ais-v1` | `2020-01-01` -> `2020-01-03` | `CLUS-01`, `CLUS-02`, `CLUS-04`, `BASE-02`, `BASE-05` | Primary authority for the clustering package |
| `clustering-summary` | clustering | exported | `clustering-raw-cleaned-ais`, `clustering-shaixuanhou-csv`, `clustering-segmented-pkl`, `clustering-compressed-pkl`, `clustering-corridor-runtime` | `clustered-ais-v1` | `2020-01-01` -> `2020-01-03` | `CLUS-01`, `CLUS-02` | Stage counts and lineage references |
| `clustering-stage-previews` | clustering | exported | `clustering-raw-cleaned-ais`, `clustering-segmented-pkl`, `clustering-compressed-pkl`, `clustering-corridor-runtime` | `clustered-ais-v1` | `2020-01-01` -> `2020-01-03` | `CLUS-01`, `CLUS-04` | Curated preview data for later UI work |
| `clustering-corridor-review` | clustering | exported | `clustering-compressed-pkl` | `clustered-ais-v1` | `2020-01-01` -> `2020-01-03` | `CLUS-04`, `BASE-05` | Review-first regenerated corridor result; never the live runtime truth |
| `evaluation-manifest` | evaluation | exported | `forecast-manifest`, `repair-manifest`, `artifact-index` | `phase6-evaluation-v1` | `module-derived` | `EVAL-01`, `EVAL-02`, `EVAL-03`, `EVAL-05`, `BASE-02`, `BASE-05` | Evaluation may only read module bundles |
| `evaluation-metrics` | evaluation | exported | `forecast-metrics`, `repair-metrics-export` | `phase6-evaluation-v1` | `module-derived` | `EVAL-01`, `EVAL-02`, `EVAL-03`, `EVAL-05` | Unified metric surface |
| `overview-manifest` | overview | exported | `forecast-manifest`, `repair-manifest`, `clustering-manifest`, `artifact-index` | `phase6-overview-v1` | `module-derived` | `OVER-01`, `OVER-02`, `OVER-03`, `BASE-02`, `BASE-05` | Overview may only summarize exported module bundles |
| `overview-summary` | overview | exported | `forecast-bundle`, `repair-bundle`, `clustering-summary`, `evaluation-metrics`, `artifact-index` | `phase6-overview-v1` | `module-derived` | `OVER-01`, `OVER-02`, `OVER-03` | Business loop and module entry summary |

## Layered Clustering Provenance

| Layer | Authoritative input | sourceStage | authoritativeFor |
|---|---|---|---|
| raw | `代码依据/轨迹聚类/cleaned_ais.CSV` | `raw` | Raw trajectory display and stage counts |
| filtered research context | `代码依据/轨迹聚类/shaixuanhou_.csv` | `cleaned` | Supporting research context only; never substitute for raw website layer |
| segmented | `代码依据/轨迹聚类/segments(60-90).pkl` | `segmented` | Segmented trajectory display |
| compressed | `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl` | `compressed` | Compressed trajectory display and corridor regeneration input |
| corridor/exported | `demo-web/public/data/main-corridor-tracks.json` | `exported` | Live RouteEditor/runtime corridor layer |
| corridor/review | `demo-web/analysis/review/corridor-review-tracks.json` | `exported-review` | Review-first regenerated comparison layer |

## Review-First Replacements

| Artifact | Why review-first | Promotion rule |
|---|---|---|
| `clustering-corridor-review` | The current extraction script writes directly to the live corridor runtime file | Compare regenerated counts and shapes against the shipped runtime output first; Phase 6 does not promote automatically |
| Any future forecast multi-model runtime replacement | LSTM/BiLSTM exports are not authoritative yet | Only promote once structured committed results exist |

## Deferred Artifacts

| Name | Missing reason | Later dependency |
|---|---|---|
| `forecast-lstm-runtime` | No committed structured result export exists; only notebooks are present | Phase 8 multi-model switching |
| `forecast-bilstm-runtime` | No committed structured result export exists; only notebooks are present | Phase 8 multi-model switching |
| `clustering-noise-reclustered` | `normalized_distances(60,90,0.03).pkl` is unreadable and notebook path depends on extra environment stability | Phase 10 advanced clustering comparison |
| `decision-evidence-bundle` | Research base does not yet support an honest collaborative-decision package | Phase 12 |
| `repair-optuna-study-export` | `study1_1.pkl` requires `optuna` and is not readable in the current local environment | Phase 11 optimization views |

## Source Alias Reference

| Alias | Path |
|---|---|
| `flow-grid-csv` | `代码依据/流量预测/grid_mmsi_count（流量数据）.csv` |
| `flow-adjacency-csv` | `代码依据/流量预测/相关性矩阵0.csv` |
| `flow-distance-csv` | `代码依据/流量预测/距离矩阵0.csv` |
| `stgcn-weight` | `代码依据/流量预测/save/model_0.pt` |
| `flow-forecast-runtime` | `demo-web/public/data/flow-forecast.json` |
| `flow-model-config-runtime` | `demo-web/public/data/model-config.json` |
| `repair-target-1-sample-1` | `代码依据/轨迹修复/目标1随机噪声轨迹(50)/trajectory_1.csv` |
| `repair-target-2-sample-1` | `代码依据/轨迹修复/目标2随机噪声轨迹(50)/trajectory_1.csv` |
| `repair-target-3-sample-1` | `代码依据/轨迹修复/目标3随机噪声轨迹(50)/trajectory_1.csv` |
| `repair-predictions-1` | `代码依据/轨迹修复/轨迹1预测值.pkl` |
| `repair-predictions-2` | `代码依据/轨迹修复/轨迹2预测值.pkl` |
| `repair-predictions-3` | `代码依据/轨迹修复/轨迹3预测值.pkl` |
| `repair-metrics-1` | `代码依据/轨迹修复/metrics_results1_1.pkl` |
| `repair-metrics-2` | `代码依据/轨迹修复/metrics_results2_1.pkl` |
| `repair-metrics-3` | `代码依据/轨迹修复/metrics_results3_1.pkl` |
| `clustering-raw-cleaned-ais` | `代码依据/轨迹聚类/cleaned_ais.CSV` |
| `clustering-shaixuanhou-csv` | `代码依据/轨迹聚类/shaixuanhou_.csv` |
| `clustering-segmented-pkl` | `代码依据/轨迹聚类/segments(60-90).pkl` |
| `clustering-compressed-pkl` | `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl` |
| `clustering-corridor-runtime` | `demo-web/public/data/main-corridor-tracks.json` |
| `artifact-index` | `demo-web/public/data/modules/artifact-index.json` |
