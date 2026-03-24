# Project Research Summary

**Project:** Port Traffic AIS Demo Web
**Domain:** Offline AIS algorithm showcase website
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

This project is best treated as an archived-data showcase website, not a live harbor platform. The existing Vite/React/TypeScript stack is already good enough for the next milestone, but the site needs a stronger module shell and a cleaner artifact packaging strategy so additional algorithm views do not keep accumulating inside one monitoring-style page.

The recommended approach is to keep all heavy computation offline, translate `代码依据` outputs into stable website-facing manifests and result bundles, and then build dedicated modules for flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and overview. The main risks are data-contract drift from notebook artifacts, oversized runtime payloads, and overpromising "realtime" behavior when the site is really driven by archived replay plus offline inference.

## Key Findings

### Recommended Stack

The current frontend stack should stay in place. The right move is not a framework rewrite but a structural upgrade: module-oriented navigation, shared scenario context, Zod-validated artifact manifests, and lazy loading by module and scenario. Python remains the correct offline packaging layer because the research assets already live there.

**Core technologies:**
- Vite + React + TypeScript: static module shell and typed UI composition
- Zod-backed contracts: validate website-facing artifact bundles before rendering
- Python packaging scripts: translate `代码依据` experiments into stable frontend artifacts

### Expected Features

The must-have features are the six module surfaces already defined in milestone scope: flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and overview. The strongest differentiator is the complete loop from archived playback to algorithm analysis to decision support, rather than any one module in isolation.

**Must have (table stakes):**
- Module-first navigation with shared scenario context
- Honest archived replay plus offline inference framing
- Model/sample switching with synchronized visuals and metrics

**Should have (competitive):**
- Before/after collaborative decision story
- Clustering pipeline explanation from raw traces to main corridors
- Unified evaluation center with optimization artifacts

**Defer (v2+):**
- Live AIS ingestion
- User uploads and online inference
- Backend scenario management

### Architecture Approach

The site should use a small shell around route- or module-level boundaries, with one artifact catalog that points each module to its precomputed files. Module-owned loaders should fetch only what the active view needs. This solves the scale problem more directly than replacing the framework.

**Major components:**
1. Website shell and shared scenario context - navigation plus state shared across modules
2. Artifact catalog and loaders - module/scenario manifest resolution with validation
3. Module surfaces - flow, repair, clustering, decision, evaluation, and overview
4. Offline packaging layer - Python exporters that convert `代码依据` outputs into website-ready bundles

### Code-Basis Sufficiency Audit

**Flow prediction:** Strong support already exists. `代码依据/流量预测` contains STGCN implementation, matrices, weights, and comparison notebooks. The gap is productization: current website data only ships STGCN as structured runtime JSON, so LSTM and BiLSTM still need website-facing export bundles.

**Trajectory repair:** Partially sufficient. `代码依据/轨迹修复` contains rich experiments, metrics, optimization history, and HTML result exports that are enough to support the module conceptually. The missing piece is structured packaging for samples, repaired coordinates, per-axis error arrays, and unified metric summaries.

**Trajectory clustering:** Partially sufficient. `代码依据/轨迹聚类` contains segmentation, compression, distance fusion, cuDBSCAN clustering, noise re-clustering, and corridor export logic. The missing piece is a stable frontend-facing contract for each stage plus curated parameter metadata and website-ready result bundles.

**Collaborative decision:** Weak standalone support. Current `flow-forecast.json` already carries narrative, recommendation, benefit, and applied-state fields that are presentation-friendly, but `代码依据` does not currently provide a separate decision algorithm package strong enough to present as an independent model. This module should therefore be built as a rule-driven evidence layer over prediction and clustering outputs.

**Evaluation center:** Mostly sufficient for prediction and repair, partial for clustering. The metric ingredients exist across `代码依据/流量预测`, `代码依据/轨迹修复`, and parameter-optimization outputs, but they are not yet unified into one comparison-ready artifact format. Clustering also needs a small agreed metric set beyond raw cluster labels.

**Additional material to prepare if gaps remain:**
- Website-facing JSON manifests for repair and clustering bundles
- Multi-model forecast exports for LSTM and BiLSTM to match the desired module
- Curated decision rules or scenario annotations that explicitly map evidence to strategy
- A unified metrics aggregator that writes prediction, repair, and optimization outputs to one consistent structure

### Critical Pitfalls

1. **Frontend coupled to notebook artifacts** - avoid by building packaging scripts and manifests first
2. **Demo appears live without a defensible source** - avoid with explicit archived replay plus offline inference framing
3. **Monolithic payload growth** - avoid by splitting data by module and scenario
4. **Decision module lacks evidence linkage** - avoid by making recommendations rule-driven and traceable
5. **Premature framework rewrite** - avoid by improving module/data boundaries before changing platforms

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 6: Showcase Shell and Data Packaging
**Rationale:** Every later module depends on a clean shell, artifact catalog, and offline packaging boundary.
**Delivers:** Module navigation, lazy-loading data contracts, documented packaging flow, verification entrypoint
**Addresses:** BASE requirements
**Avoids:** Raw notebook coupling and monolithic payload growth

### Phase 7: Flow Prediction Module
**Rationale:** This is already the closest module to productionized data and can validate the new shell fastest.
**Delivers:** Multi-model, multi-horizon forecast comparison with hotspot and trend visuals
**Uses:** Existing forecast pipeline plus new export packaging
**Implements:** First full showcase module

### Phase 8: Trajectory Repair Module
**Rationale:** Repair has strong research material but needs curated packaging and visual comparison work.
**Delivers:** Sample selection, method switching, error plots, metric summaries
**Uses:** Existing repair experiments and optimization outputs

### Phase 9: Trajectory Clustering Module
**Rationale:** Clustering has the deepest provenance story and should be packaged after the shell and first two modules are proven.
**Delivers:** Stage-switching clustering views, statistics, noise re-clustering, corridor extraction story

### Phase 10: Collaborative Decision Module
**Rationale:** Decision support depends on evidence from prediction and clustering.
**Delivers:** Focus route/grid, strategy suggestions, before/after benefits, explanation copy

### Phase 11: Evaluation Center and Overview Integration
**Rationale:** Final integration should unify metrics and explain the overall product loop after module details exist.
**Delivers:** Evaluation center, optimization artifacts, project overview, consistent final framing

### Phase Ordering Rationale

- Phase 6 comes first because data packaging and lazy loading are shared infrastructure for every module
- Flow comes before repair and clustering because its runtime path is already closest to website-ready
- Decision comes after flow and clustering because it should cite evidence rather than invent it
- Evaluation and overview finish last because they aggregate outputs from every prior module

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6:** exact artifact manifest format and packaging boundaries
- **Phase 9:** clustering metric and parameter presentation format
- **Phase 10:** decision-rule design and evidence traceability details

Phases with standard patterns (skip research-phase):
- **Phase 7:** well-bounded UI/data comparison pattern
- **Phase 8:** curated sample plus metric-comparison pattern
- **Phase 11:** standard integration and overview synthesis pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Current stack and deployment model are already proven locally |
| Features | HIGH | The user-defined milestone goals are concrete and map cleanly to modules |
| Architecture | HIGH | Module shell plus static manifests is a direct fit for the current site and data constraints |
| Pitfalls | HIGH | Risks are visible directly from current payloads, code structure, and provenance gaps |

**Overall confidence:** HIGH

### Gaps to Address

- Multi-model forecast exports beyond STGCN still need to be generated for website use
- Repair and clustering outputs need packaging scripts that emit stable frontend contracts
- Collaborative decision needs curated rules or annotations because it is not strongly represented as its own code-basis package
- Clustering should define a small, presentation-friendly metric set for the evaluation center

## Sources

### Primary (HIGH confidence)
- `.planning/codebase/STACK.md` - current stack and deployment model
- `.planning/codebase/ARCHITECTURE.md` - current architecture and boundaries
- `demo-web/package.json` - installed tooling and verification commands
- `demo-web/public/data/*` - current runtime artifact structure and size
- `代码依据/流量预测`, `代码依据/轨迹修复`, `代码依据/轨迹聚类` - direct research provenance and capability audit

### Secondary (MEDIUM confidence)
- Existing front-end implementation in `demo-web/src/` - confirms what is already productized versus still placeholder or hardcoded

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
