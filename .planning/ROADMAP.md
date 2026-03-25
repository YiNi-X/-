# Roadmap: Port Traffic AIS Demo Web

## Overview

This roadmap starts milestone `v1.1 Offline Showcase Expansion` after the project's stabilization foundation. The earlier work proved that the repo can ship an offline dashboard, RouteEditor, runtime validation, and safer frontend seams. The next milestone still targets flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and overview, but the execution order is now explicitly data-first: complete and validate the missing offline artifacts, define frontend contracts around those artifacts, and only then build the module UI on top of stable data.

The remaining unresolved concerns from the prior hardening roadmap are not discarded; they are absorbed into the new Phase 6 and Phase 7 foundation work for data completion, lineage control, lazy loading, and verification. The site still remains a static, archived-data product, but it will be organized and data-shaped as if it were a serious product surface instead of a single dense demo page.

## Milestone History

- **v1.0 Foundation and Stabilization** - Established build, validation, and maintainability foundations for the existing offline demo
- **v1.1 Offline Showcase Expansion** - Converts the demo into a modular archived-data showcase with richer algorithm presentation and clearer product architecture

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8): Planned milestone work
- Decimal phases (6.1, 6.2): Urgent insertions if later needed

- [x] **Phase 6: Data Completion and Lineage** - Complete the missing offline artifacts, confirm authoritative sources, and make website-facing bundles reproducible
- [ ] **Phase 7: Frontend Contracts and Website Shell** - Define the data contracts, module catalogs, shared state, and navigation shell around the stabilized artifacts
- [ ] **Phase 8: Flow Prediction Module** - Build the forecast showcase around model switching, horizon switching, metrics, hotspots, and total flow trends
- [ ] **Phase 9: Trajectory Repair Module** - Build curated repair comparisons with sample selection, model switching, error charts, and metric summaries
- [ ] **Phase 10: Trajectory Clustering Module** - Build the clustering showcase with trajectory state switching, cluster statistics, corridor extraction views, and only the clustering layers that the available data can support
- [ ] **Phase 11: Evaluation Center and Overview Integration** - Unify metrics, rankings, optimization artifacts, and project framing into one coherent presentation finish
- [ ] **Phase 12: Collaborative Decision Module** - Build the evidence-driven strategy view after the prediction, repair, clustering, and evaluation data are stable enough to support it

## Phase Details

### Phase 6: Data Completion and Lineage
**Goal:** Complete the missing offline data products first, verify what can be regenerated locally, and define one authoritative lineage for each website module
**Depends on:** Prior stabilization foundation (completed v1.0 work)
**Requirements**: [BASE-02, BASE-05, BASE-06]
**Success Criteria** (what must be TRUE):
1. The team has a checked list of what data already exists, what is missing, and what can be regenerated locally versus what requires special environments
2. Website-facing bundles for forecast, repair, clustering, evaluation, and overview can be regenerated from documented authoritative inputs instead of ad hoc notebook state
3. The project documents which artifact is authoritative for each module so derived JSON does not silently mix incompatible source ranges or processing levels
4. One repeatable verification flow confirms that regenerated artifacts are present, structurally valid, and aligned with the expected demo scenario
**Plans:** 3 plans

Plans:
- [x] 06-01: Audit current research assets, website runtime files, and missing outputs for forecast, repair, clustering, evaluation, and overview
- [x] 06-02: Regenerate or normalize the minimum required website-facing data bundles and lineage manifests from authoritative inputs
- [x] 06-03: Document regeneration time, environment needs, and validation checks so the data layer is stable before UI work begins

### Phase 7: Frontend Contracts and Website Shell
**Goal:** Define stable frontend contracts on top of the finished data artifacts, then build the shared shell that every module will reuse
**Depends on:** Phase 6
**Requirements**: [BASE-01, BASE-03, BASE-04]
**Success Criteria** (what must be TRUE):
1. Frontend-facing schemas and manifests exist for every dataset that the modules will consume
2. A viewer can move between the major modules through one coherent site shell without relying on ad hoc page fragments
3. Scenario selection and artifact loading behave consistently across modules without forcing one monolithic initial payload
4. Data loaders, validation, and error handling are shared enough that later module work no longer depends on hardcoded runtime assumptions
**Plans:** 3 plans

Plans:
- [ ] 07-01: Define module JSON contracts, catalogs, and lineage metadata for the stabilized artifact set
- [ ] 07-02: Implement shared loaders, validation hooks, and scenario state around those contracts
- [ ] 07-03: Build the website shell and navigation using preview-ready data rather than placeholder-only content

### Phase 8: Flow Prediction Module
**Goal:** Present the archived flow-forecast story as a true module rather than a hardcoded panel set
**Depends on:** Phase 7
**Requirements**: [FLOW-01, FLOW-02, FLOW-03, FLOW-04]
**Success Criteria** (what must be TRUE):
1. A viewer can switch among STGCN, LSTM, and BiLSTM results on the same archived scenario
2. A viewer can compare 1h, 2h, and 3h horizons without leaving the module
3. Metrics, hotspot grids, and total flow trends update consistently with the selected model, horizon, and playback frame
4. The module uses precomputed result bundles rather than hardcoded benchmark placeholders
**Plans:** 3 plans

Plans:
- [ ] 08-01: Export website-facing prediction bundles for multi-model and multi-horizon comparison
- [ ] 08-02: Implement the flow prediction module UI with model or horizon switching and metric display
- [ ] 08-03: Integrate hotspot, total-flow, and playback-linked trend visualizations into the new module shell

### Phase 9: Trajectory Repair Module
**Goal:** Turn notebook repair experiments into a curated, explainable website module
**Depends on:** Phase 7
**Requirements**: [REPR-01, REPR-02, REPR-03, REPR-04, REPR-05]
**Success Criteria** (what must be TRUE):
1. A viewer can select curated repair samples and compare missing, repaired, and reference trajectories
2. A viewer can switch between neural and baseline repair methods on the same sample
3. Longitude and latitude error plots plus composite metrics stay synchronized with the selected sample and model
4. The repair module reads structured precomputed artifacts rather than notebook HTML alone
**Plans:** 3 plans

Plans:
- [ ] 09-01: Curate sample trajectories and export structured repair-result bundles from existing experiments
- [ ] 09-02: Build the repair comparison module with sample and model switching
- [ ] 09-03: Integrate error charts and metric summaries for each repair sample and method

### Phase 10: Trajectory Clustering Module
**Goal:** Present clustering provenance and corridor extraction as an understandable visual pipeline without depending on notebook-only artifacts that are currently missing
**Depends on:** Phase 7
**Requirements**: [CLUS-01, CLUS-02, CLUS-03, CLUS-04]
**Success Criteria** (what must be TRUE):
1. A viewer can switch among raw, segmented, compressed, clustered, and extracted corridor views where the supporting data products exist
2. Cluster-count and corridor statistics are visible and tied to the selected clustering result
3. The module can be shipped even if noise re-clustering remains a deferred enhancement rather than a hard requirement
4. Extracted main corridors can be linked back to the rest of the website as product-facing route entities without conflicting with the current RouteEditor dataset
**Plans:** 3 plans

Plans:
- [ ] 10-01: Export website-facing clustering bundles and corridor-mapping metadata from the authoritative clustering inputs
- [ ] 10-02: Build the clustering module with layer switching and cluster statistics
- [ ] 10-03: Add corridor-extraction views first, then only add noise re-clustering visuals if the missing artifacts are successfully regenerated

### Phase 11: Evaluation Center and Overview Integration
**Goal:** Unify the model-evaluation story and replace low-value homepage panels with a clear project overview
**Depends on:** Phases 8, 9, and 10
**Requirements**: [EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, OVER-01, OVER-02, OVER-03]
**Success Criteria** (what must be TRUE):
1. A viewer can compare prediction and repair methods through one evaluation center with traceable metrics
2. Optimization history and parameter importance are visible for supported models
3. The overview page explains the full algorithm loop and replaces low-value logs with scenario or module entry points
4. The final website framing consistently communicates archived playback plus offline inference instead of live AIS
**Plans:** 3 plans

Plans:
- [ ] 11-01: Build the unified evaluation center with rankings, metric tables, and traceability links
- [ ] 11-02: Integrate optimization history and parameter-importance views from existing offline experiments
- [ ] 11-03: Replace homepage log-centric panels with an overview page that explains the business loop and module entry points

### Phase 12: Collaborative Decision Module
**Goal:** Build the decision-support layer only after the prediction, repair, clustering, evaluation, and overview data are stable enough to support defensible evidence linkage
**Depends on:** Phases 8, 10, and 11
**Requirements**: [DECI-01, DECI-02, DECI-03, DECI-04]
**Success Criteria** (what must be TRUE):
1. A viewer can see the focus route and grid for the selected scenario or frame
2. Strategy suggestions are tied to explicit prediction or clustering evidence rather than floating narrative copy
3. A before/after toggle updates benefit cards and state summary consistently
4. The module stays honest that strategy output is offline or rule-driven, not a live optimizer
**Plans:** 3 plans

Plans:
- [ ] 12-01: Define the decision data contract and curated rule-driven scenario evidence structure
- [ ] 12-02: Build the focus route or grid and recommendation UI in the new module shell
- [ ] 12-03: Implement before/after benefit switching and explanation linkage

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Data Completion and Lineage | 3/3 | Complete | 2026-03-25 |
| 7. Frontend Contracts and Website Shell | 0/3 | Not started | - |
| 8. Flow Prediction Module | 0/3 | Not started | - |
| 9. Trajectory Repair Module | 0/3 | Not started | - |
| 10. Trajectory Clustering Module | 0/3 | Not started | - |
| 11. Evaluation Center and Overview Integration | 0/3 | Not started | - |
| 12. Collaborative Decision Module | 0/3 | Not started | - |

---
*Roadmap created: 2026-03-24*
*Last updated: 2026-03-25 after completing Phase 6 data completion and lineage*
*Current milestone: v1.1 Offline Showcase Expansion*
