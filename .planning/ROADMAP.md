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
- [x] **Phase 7: Frontend Contracts and Website Shell** - Build the frontend contracts, shell, navigation, shared loader, and baseline module pages on top of the stabilized artifacts
- [ ] **Phase 8: Flow Prediction Module Completion** - Complete the forecast showcase around model switching, horizon switching, metrics, hotspots, and total flow trends
- [ ] **Phase 9: Trajectory Repair Module Completion** - Complete curated repair comparisons with sample selection, model switching, error charts, and metric summaries
- [ ] **Phase 10: Trajectory Clustering Module Completion** - Complete the clustering showcase with trajectory state switching, cluster statistics, corridor extraction views, and only the clustering layers that the available data can support
- [ ] **Phase 11: Evaluation Center and Overview Reinforcement** - Strengthen the evaluation center and overview after the core algorithm modules are in place
- [ ] **Phase 12: Collaborative Decision and Forward-Looking Analysis** - Add collaborative decision as a forward-looking analysis layer after the core evidence modules are stable

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
**Goal:** Build the frontend contracts, website shell, navigation, shared loading layer, and baseline module pages on top of the completed Phase 6 data bundles
**Depends on:** Phase 6
**Requirements**: [BASE-01, BASE-03, BASE-04]
**Success Criteria** (what must be TRUE):
1. Frontend-facing schemas, module metadata, and route definitions exist for every Phase 6 bundle the website will consume
2. A viewer can move between overview, forecast, repair, clustering, evaluation, and a deferred forward-looking analysis entry through one coherent shell
3. Shared loaders, loading states, error states, and deferred states work consistently across modules without one monolithic initial payload
4. Each major module has a baseline page wired to real Phase 6 data, but deep feature completion remains deferred to later phases
**Plans:** 3 plans

Plans:
- [x] 07-01: Define frontend contracts, module registry metadata, deferred-state semantics, and route descriptors for the stabilized bundle set
- [x] 07-02: Implement shared loaders, validation hooks, lazy-loading behavior, and shared shell state around those contracts
- [x] 07-03: Build the website shell, navigation, and baseline module pages using real Phase 6 bundles plus honest deferred placeholders where data is not ready

### Phase 8: Flow Prediction Module Completion
**Goal:** Complete the archived flow-forecast story as a true module rather than a hardcoded panel set
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

### Phase 9: Trajectory Repair Module Completion
**Goal:** Complete the repair experience by turning notebook repair experiments into a curated, explainable website module
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

### Phase 10: Trajectory Clustering Module Completion
**Goal:** Complete clustering provenance and corridor extraction as an understandable visual pipeline without depending on notebook-only artifacts that are currently missing
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

### Phase 11: Evaluation Center and Overview Reinforcement
**Goal:** Strengthen the evaluation center and overview once the forecast, repair, and clustering modules are in place
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

### Phase 12: Collaborative Decision and Forward-Looking Analysis
**Goal:** Add collaborative decision as a forward-looking analysis layer only after prediction, repair, clustering, evaluation, and overview evidence are stable enough to support defensible linkage
**Depends on:** Phases 8, 10, and 11
**Requirements**: [DECI-01, DECI-02, DECI-03, DECI-04]
**Success Criteria** (what must be TRUE):
1. A viewer can see the focus route and grid for the selected scenario or frame
2. Strategy suggestions are tied to explicit prediction or clustering evidence rather than floating narrative copy
3. A before/after toggle updates benefit cards and state summary consistently
4. The forward-looking analysis stays honest that strategy output is offline or rule-driven, not a live optimizer
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
| 7. Frontend Contracts and Website Shell | 3/3 | Complete | 2026-03-25 |
| 8. Flow Prediction Module Completion | 0/3 | Not started | - |
| 9. Trajectory Repair Module Completion | 0/3 | Not started | - |
| 10. Trajectory Clustering Module Completion | 0/3 | Not started | - |
| 11. Evaluation Center and Overview Reinforcement | 0/3 | Not started | - |
| 12. Collaborative Decision and Forward-Looking Analysis | 0/3 | Not started | - |

---
*Roadmap created: 2026-03-24*
*Last updated: 2026-03-25 after completing Phase 7 frontend contracts and website shell*
*Current milestone: v1.1 Offline Showcase Expansion*
