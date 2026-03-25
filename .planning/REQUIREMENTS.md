# Requirements: Port Traffic AIS Demo Web

**Defined:** 2026-03-24
**Core Value:** The website must clearly, credibly, and repeatably present our algorithms and model outputs using archived AIS data plus offline-computed results, while preserving a convincing quasi-realtime demo experience.

## v1 Requirements

### Showcase Foundation

- [ ] **BASE-01**: Demo viewer can navigate between overview, flow prediction, trajectory repair, trajectory clustering, collaborative decision, and evaluation from one coherent website shell
- [x] **BASE-02**: Website loads module data from committed static artifacts derived from archived local research outputs instead of requiring a live backend or online inference
- [ ] **BASE-03**: Demo viewer can switch scenarios or time slices without broken module state or missing data contracts
- [ ] **BASE-04**: Website lazy-loads module or scenario artifacts so new datasets do not force one monolithic initial payload
- [x] **BASE-05**: Team can regenerate website-facing showcase artifacts from `代码依据` and existing cleaned outputs through one documented offline pipeline
- [x] **BASE-06**: Team can run one repeatable verification flow that checks buildability and critical module data contracts before demoing the site

### Flow Prediction

- [ ] **FLOW-01**: Demo viewer can switch among STGCN, LSTM, and BiLSTM prediction results for the same archived scenario
- [ ] **FLOW-02**: Demo viewer can switch forecast horizon between 1h, 2h, and 3h
- [ ] **FLOW-03**: Demo viewer can inspect key prediction metrics for the selected model and horizon, including MAE, RMSE, and R-squared
- [ ] **FLOW-04**: Demo viewer can inspect hotspot grid ranking and total flow trends during historical playback

### Trajectory Repair

- [ ] **REPR-01**: Demo viewer can choose from curated sample trajectories that contain missing or damaged segments
- [ ] **REPR-02**: Demo viewer can compare original ground truth, missing trajectory, and repaired trajectory on the same visual surface
- [ ] **REPR-03**: Demo viewer can switch among ATT-BILSTM, BiLSTM, LSTM, and at least one classical baseline for the selected repair sample
- [ ] **REPR-04**: Demo viewer can inspect longitude and latitude error charts for the selected repair result
- [ ] **REPR-05**: Demo viewer can inspect a repair metric summary that includes MAE, RMSE, DTW, R-squared, and Hausdorff distance

### Trajectory Clustering

- [ ] **CLUS-01**: Demo viewer can switch between original trajectories, segmented trajectories, compressed trajectories, clustering results, and extracted main corridors
- [ ] **CLUS-02**: Demo viewer can inspect cluster count statistics and noise proportion for the selected clustering run
- [ ] **CLUS-03**: Demo viewer can compare first-pass clustering with noise re-clustering results
- [ ] **CLUS-04**: Demo viewer can inspect main corridor extraction results and link them back to dashboard or map entities used elsewhere in the site

### Collaborative Decision

- [ ] **DECI-01**: Demo viewer can see the current focus route and focus grid for a selected frame or scenario
- [ ] **DECI-02**: Demo viewer can inspect strategy suggestions associated with the selected frame or scenario
- [ ] **DECI-03**: Demo viewer can toggle between before-strategy and after-strategy states and compare benefit changes
- [ ] **DECI-04**: Demo viewer can read explanation copy showing which forecast or clustering evidence drove the suggested strategy

### Evaluation Center

- [ ] **EVAL-01**: Demo viewer can inspect unified metric cards or tables across prediction and repair tasks using the metrics appropriate to each task
- [ ] **EVAL-02**: Demo viewer can rank flow prediction models by selected horizon and metric
- [ ] **EVAL-03**: Demo viewer can rank trajectory repair models by selected sample and metric
- [ ] **EVAL-04**: Demo viewer can inspect parameter optimization history and parameter importance for supported offline models
- [ ] **EVAL-05**: Team can trace displayed evaluation numbers back to committed offline result artifacts

### Project Overview

- [ ] **OVER-01**: Overview page explains the end-to-end business loop from archived AIS playback through clustering or repair, prediction, and collaborative decision
- [ ] **OVER-02**: Overview page surfaces data scale, scenario entry points, and direct links into each algorithm module instead of low-value system logs
- [ ] **OVER-03**: Overview page clearly frames the product as archived playback plus offline inference rather than live AIS

## v2 Requirements

### Live and Dynamic Capabilities

- **LIVE-01**: Website can ingest or query realtime AIS data from a dependable external source
- **LIVE-02**: Website can execute prediction or repair inference online for newly arriving data
- **LIVE-03**: Website can manage scenarios, runs, and result history through a backend service instead of committed static artifacts
- **LIVE-04**: User can upload custom trajectory files and receive on-demand analysis

## Out of Scope

| Feature | Reason |
|---------|--------|
| Realtime AIS backend and streaming inference | No dependable live source and not necessary for this milestone |
| Full framework rewrite to Next.js, micro-frontends, or a backend-heavy architecture | Architectural cleanup is needed, but the current stack is sufficient for an offline showcase |
| Arbitrary user uploads and long-running compute jobs | The milestone should use curated offline artifacts, not become a generic analysis platform |
| Retraining research models from scratch | The immediate need is packaging and presenting existing outputs credibly |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 7 | Pending |
| BASE-02 | Phase 6 | Complete |
| BASE-03 | Phase 7 | Pending |
| BASE-04 | Phase 7 | Pending |
| BASE-05 | Phase 6 | Complete |
| BASE-06 | Phase 6 | Complete |
| FLOW-01 | Phase 8 | Pending |
| FLOW-02 | Phase 8 | Pending |
| FLOW-03 | Phase 8 | Pending |
| FLOW-04 | Phase 8 | Pending |
| REPR-01 | Phase 9 | Pending |
| REPR-02 | Phase 9 | Pending |
| REPR-03 | Phase 9 | Pending |
| REPR-04 | Phase 9 | Pending |
| REPR-05 | Phase 9 | Pending |
| CLUS-01 | Phase 10 | Pending |
| CLUS-02 | Phase 10 | Pending |
| CLUS-03 | Phase 10 | Pending |
| CLUS-04 | Phase 10 | Pending |
| DECI-01 | Phase 12 | Pending |
| DECI-02 | Phase 12 | Pending |
| DECI-03 | Phase 12 | Pending |
| DECI-04 | Phase 12 | Pending |
| EVAL-01 | Phase 11 | Pending |
| EVAL-02 | Phase 11 | Pending |
| EVAL-03 | Phase 11 | Pending |
| EVAL-04 | Phase 11 | Pending |
| EVAL-05 | Phase 11 | Pending |
| OVER-01 | Phase 11 | Pending |
| OVER-02 | Phase 11 | Pending |
| OVER-03 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-25 after completing Phase 6 data completion and lineage*

