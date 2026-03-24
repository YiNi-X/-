# Roadmap: Port Traffic AIS Demo Web

## Overview

This roadmap starts milestone `v1.1 Offline Showcase Expansion` after the project's stabilization foundation. The earlier work proved that the repo can ship an offline dashboard, RouteEditor, runtime validation, and safer frontend seams. The next milestone uses that foundation to build a structured showcase website for flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and overview.

The remaining unresolved concerns from the prior hardening roadmap are not discarded; they are absorbed into Phase 6 as explicit foundation work for module packaging, lazy loading, and verification. The site still remains a static, archived-data product, but it will be organized and data-shaped as if it were a serious product surface instead of a single dense demo page.

## Milestone History

- **v1.0 Foundation and Stabilization** - Established build, validation, and maintainability foundations for the existing offline demo
- **v1.1 Offline Showcase Expansion** - Converts the demo into a modular archived-data showcase with richer algorithm presentation and clearer product architecture

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8): Planned milestone work
- Decimal phases (6.1, 6.2): Urgent insertions if later needed

- [ ] **Phase 6: Showcase Shell and Data Packaging** - Establish the shared module shell, lazy-loading data architecture, and reproducible website-facing artifact packaging
- [ ] **Phase 7: Flow Prediction Module** - Build the forecast showcase around model switching, horizon switching, metrics, hotspots, and total flow trends
- [ ] **Phase 8: Trajectory Repair Module** - Build curated repair comparisons with sample selection, model switching, error charts, and metric summaries
- [ ] **Phase 9: Trajectory Clustering Module** - Build the clustering showcase with trajectory state switching, noise re-clustering, cluster statistics, and corridor extraction views
- [ ] **Phase 10: Collaborative Decision Module** - Build the evidence-driven strategy view that links archived playback, prediction, and clustering into before/after decision narratives
- [ ] **Phase 11: Evaluation Center and Overview Integration** - Unify metrics, rankings, optimization artifacts, and project framing into one coherent presentation finish

## Phase Details

### Phase 6: Showcase Shell and Data Packaging
**Goal:** Create the module-oriented website shell and the static artifact structure required to scale the showcase without a backend
**Depends on:** Prior stabilization foundation (completed v1.0 work)
**Requirements**: [BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, BASE-06]
**Success Criteria** (what must be TRUE):
1. A viewer can move between the major modules through one coherent site shell without relying on ad hoc page fragments
2. Website-facing data for the showcase is packaged behind stable module or scenario manifests instead of raw notebook structures or one giant runtime payload
3. A contributor can regenerate the committed showcase artifacts from `代码依据` and existing cleaned outputs using documented offline commands
4. The shell and artifact loaders are verified by one repeatable pre-demo check
**Plans:** 3 plans

Plans:
- [ ] 06-01: Define the website information architecture, module routing or shell composition, and shared scenario context
- [ ] 06-02: Design and implement the module artifact catalog plus lazy-loading contracts for archived results
- [ ] 06-03: Extend the offline packaging pipeline and verification flow so all showcase modules have reproducible website-facing artifacts

### Phase 7: Flow Prediction Module
**Goal:** Present the archived flow-forecast story as a true module rather than a hardcoded panel set
**Depends on:** Phase 6
**Requirements**: [FLOW-01, FLOW-02, FLOW-03, FLOW-04]
**Success Criteria** (what must be TRUE):
1. A viewer can switch among STGCN, LSTM, and BiLSTM results on the same archived scenario
2. A viewer can compare 1h, 2h, and 3h horizons without leaving the module
3. Metrics, hotspot grids, and total flow trends update consistently with the selected model, horizon, and playback frame
4. The module uses precomputed result bundles rather than hardcoded benchmark placeholders
**Plans:** 3 plans

Plans:
- [ ] 07-01: Export website-facing prediction bundles for multi-model and multi-horizon comparison
- [ ] 07-02: Implement the flow prediction module UI with model or horizon switching and metric display
- [ ] 07-03: Integrate hotspot, total-flow, and playback-linked trend visualizations into the new module shell

### Phase 8: Trajectory Repair Module
**Goal:** Turn notebook repair experiments into a curated, explainable website module
**Depends on:** Phase 6
**Requirements**: [REPR-01, REPR-02, REPR-03, REPR-04, REPR-05]
**Success Criteria** (what must be TRUE):
1. A viewer can select curated repair samples and compare missing, repaired, and reference trajectories
2. A viewer can switch between neural and baseline repair methods on the same sample
3. Longitude and latitude error plots plus composite metrics stay synchronized with the selected sample and model
4. The repair module reads structured precomputed artifacts rather than notebook HTML alone
**Plans:** 3 plans

Plans:
- [ ] 08-01: Curate sample trajectories and export structured repair-result bundles from existing experiments
- [ ] 08-02: Build the repair comparison module with sample and model switching
- [ ] 08-03: Integrate error charts and metric summaries for each repair sample and method

### Phase 9: Trajectory Clustering Module
**Goal:** Present clustering provenance and corridor extraction as an understandable visual pipeline
**Depends on:** Phase 6
**Requirements**: [CLUS-01, CLUS-02, CLUS-03, CLUS-04]
**Success Criteria** (what must be TRUE):
1. A viewer can switch among raw, segmented, compressed, clustered, and extracted corridor views
2. Cluster-count and noise statistics are visible and tied to the selected clustering result
3. The module shows both first-pass clustering and noise re-clustering outcomes where available
4. Extracted main corridors can be linked back to the rest of the website as product-facing route entities
**Plans:** 3 plans

Plans:
- [ ] 09-01: Export website-facing clustering bundles and corridor-mapping metadata from notebook provenance
- [ ] 09-02: Build the clustering module with layer switching and cluster statistics
- [ ] 09-03: Add noise re-clustering comparison and corridor-extraction views

### Phase 10: Collaborative Decision Module
**Goal:** Build the decision-support layer that explains what action is suggested and why
**Depends on:** Phases 7 and 9
**Requirements**: [DECI-01, DECI-02, DECI-03, DECI-04]
**Success Criteria** (what must be TRUE):
1. A viewer can see the focus route and grid for the selected scenario or frame
2. Strategy suggestions are tied to explicit prediction or clustering evidence rather than floating narrative copy
3. A before/after toggle updates benefit cards and state summary consistently
4. The module stays honest that strategy output is offline or rule-driven, not a live optimizer
**Plans:** 3 plans

Plans:
- [ ] 10-01: Define the decision data contract and curated rule-driven scenario evidence structure
- [ ] 10-02: Build the focus route or grid and recommendation UI in the new module shell
- [ ] 10-03: Implement before/after benefit switching and explanation linkage

### Phase 11: Evaluation Center and Overview Integration
**Goal:** Unify the model-evaluation story and replace low-value homepage panels with a clear project overview
**Depends on:** Phases 7, 8, 9, and 10
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

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Showcase Shell and Data Packaging | 0/3 | Not started | - |
| 7. Flow Prediction Module | 0/3 | Not started | - |
| 8. Trajectory Repair Module | 0/3 | Not started | - |
| 9. Trajectory Clustering Module | 0/3 | Not started | - |
| 10. Collaborative Decision Module | 0/3 | Not started | - |
| 11. Evaluation Center and Overview Integration | 0/3 | Not started | - |

---
*Roadmap created: 2026-03-24*
*Current milestone: v1.1 Offline Showcase Expansion*
