# Roadmap: Port Traffic AIS Demo Web

## Overview

This roadmap treats the current repository as a working offline demo that now needs engineering hardening. The sequence starts by restoring a trustworthy local quality baseline, then adds runtime data safety, reduces frontend monolith risk, hardens the Python data pipeline, and finally adds regression coverage plus a documented bridge to the future realtime architecture.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions if later needed

- [ ] **Phase 1: Baseline Quality Gate** - Make the existing demo reproducible and establish a trustworthy verification baseline
- [ ] **Phase 2: Runtime Data Contracts** - Protect dashboard and RouteEditor against malformed or missing runtime datasets
- [ ] **Phase 3: UI Maintainability Refactor** - Break monolithic frontend surfaces into safer seams without changing product behavior
- [ ] **Phase 4: Data Pipeline Hardening** - Make offline data generation reproducible, configurable, and fail-fast
- [ ] **Phase 5: Regression Coverage and V2 Handoff** - Add automated guards and capture the future realtime upgrade path

## Phase Details

### Phase 1: Baseline Quality Gate
**Goal:** Restore confidence in local setup and quality commands so future GSD phases start from a repeatable baseline
**Depends on:** Nothing (first phase)
**Requirements**: [RELY-01, RELY-02, RELY-03]
**Success Criteria** (what must be TRUE):
1. A contributor can follow repo docs to install dependencies and build both entry points on a fresh machine
2. Lint runs without the currently known React hook/compiler blockers
3. The repo exposes one documented quality checklist covering build, lint, and test before future changes land
**Plans:** 3 plans

Plans:
- [ ] 01-01: Audit and fix local frontend quality commands plus setup documentation gaps
- [ ] 01-02: Resolve the current lint blockers and stabilize the baseline verification flow
- [ ] 01-03: Document and script the pre-demo or pre-merge quality gate

### Phase 2: Runtime Data Contracts
**Goal:** Add schema validation and fallback handling around shipped runtime data so bad payloads fail safely
**Depends on:** Phase 1
**Requirements**: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05]
**Success Criteria** (what must be TRUE):
1. Invalid catalog, AIS, forecast, or corridor payloads are rejected before corrupt state reaches the UI
2. Dashboard and RouteEditor show actionable fallback messaging instead of crashing when required data is missing or malformed
3. Runtime data loading has one clear contract boundary that future datasets must satisfy
**Plans:** 3 plans

Plans:
- [ ] 02-01: Define runtime schemas for dataset catalog, AIS playback, flow forecast, and corridor track payloads
- [ ] 02-02: Integrate validation and fallback handling into dashboard loading flows
- [ ] 02-03: Integrate validation and fallback handling into RouteEditor loading and export flows

### Phase 3: UI Maintainability Refactor
**Goal:** Reduce the regression risk of future changes by extracting focused modules, hooks, and components from the largest frontend files
**Depends on:** Phase 2
**Requirements**: [MAINT-01, MAINT-02, MAINT-03]
**Success Criteria** (what must be TRUE):
1. Dashboard data loading and derived state can be changed without navigating one monolithic component
2. RouteEditor interaction logic is separated enough that pan, zoom, and export behavior can be modified in isolation
3. Shared resource-loading logic is reusable and clearly separated from presentation concerns
**Plans:** 3 plans

Plans:
- [ ] 03-01: Extract dashboard data-loading and derived-state logic from `App.tsx`
- [ ] 03-02: Extract RouteEditor interaction and export logic from `RouteEditor.tsx`
- [ ] 03-03: Consolidate shared contracts and utilities to preserve behavior while reducing coupling

### Phase 4: Data Pipeline Hardening
**Goal:** Make the offline Python workflow reproducible and safer to operate when datasets or model assets change
**Depends on:** Phase 3
**Requirements**: [PIPE-01, PIPE-02, PIPE-03]
**Success Criteria** (what must be TRUE):
1. A contributor can recreate demo payloads using documented Python setup and commands
2. Missing raw data or model artifacts fail with clear guidance instead of silent or confusing script behavior
3. Thresholds and path assumptions used by generation scripts are centralized and reviewable
**Plans:** 3 plans

Plans:
- [ ] 04-01: Document Python environment, inputs, and regeneration commands
- [ ] 04-02: Add fail-fast checks and centralized config to the generation and extraction scripts
- [ ] 04-03: Verify regenerated outputs and update pipeline handoff notes

### Phase 5: Regression Coverage and V2 Handoff
**Goal:** Add lightweight automated regression protection and leave a clear engineering handoff for future realtime work
**Depends on:** Phase 4
**Requirements**: [QUAL-01, QUAL-02, FUTR-01]
**Success Criteria** (what must be TRUE):
1. Automated tests cover validation logic and at least one critical path in both the dashboard and RouteEditor
2. Future refactors have an executable quality gate instead of manual-only verification
3. The repo includes a concrete written plan for evolving from static demo datasets to backend-served AIS forecasting
**Plans:** 2 plans

Plans:
- [ ] 05-01: Add automated regression coverage for validation and critical UI or domain paths
- [ ] 05-02: Write the v2 realtime architecture handoff and finalize readiness notes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Quality Gate | 0/3 | Not started | - |
| 2. Runtime Data Contracts | 0/3 | Not started | - |
| 3. UI Maintainability Refactor | 0/3 | Not started | - |
| 4. Data Pipeline Hardening | 0/3 | Not started | - |
| 5. Regression Coverage and V2 Handoff | 0/2 | Not started | - |
