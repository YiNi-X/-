# Requirements: Port Traffic AIS Demo Web

**Defined:** 2026-03-23
**Core Value:** The demo must remain a credible, stable, and explainable representation of historical AIS activity plus offline forecast insights so we can iterate on it with confidence.

## v1 Requirements

### Reliability and Tooling

- [ ] **RELY-01**: Developer can install project dependencies and build both the dashboard and RouteEditor from documented commands on a fresh machine
- [ ] **RELY-02**: Developer can run lint locally without known React hook/compiler violations blocking the current codebase
- [ ] **RELY-03**: Developer can run one documented quality command set (`build`, `lint`, and `test`) before merging or demoing changes

### Runtime Data Contracts

- [ ] **DATA-01**: Dashboard rejects malformed dataset catalog entries with a clear error instead of silently selecting bad paths
- [ ] **DATA-02**: Dashboard validates AIS playback payload structure before rendering map or timeline state
- [ ] **DATA-03**: Dashboard validates flow forecast payload structure before rendering forecast panels
- [ ] **DATA-04**: RouteEditor validates main corridor track payload structure before rendering or exporting corridors
- [ ] **DATA-05**: Demo viewer sees actionable fallback messaging when required runtime JSON is missing or invalid instead of a broken screen

### Maintainability

- [ ] **MAINT-01**: Developer can change dashboard data loading and derived state without editing one large `App.tsx` file
- [ ] **MAINT-02**: Developer can change RouteEditor interaction logic without editing one large `RouteEditor.tsx` block
- [ ] **MAINT-03**: Shared dataset and resource loading logic is reused through focused modules or hooks with clear boundaries between UI orchestration and domain logic

### Data Pipeline

- [ ] **PIPE-01**: Developer can recreate committed demo payloads using documented Python setup and commands
- [ ] **PIPE-02**: Data-generation scripts fail fast with clear messages when required raw AIS files, clustering artifacts, or model files are missing
- [ ] **PIPE-03**: Corridor extraction and demo-data generation thresholds or paths are centralized in versioned config or constants instead of hidden magic values

### Verification

- [ ] **QUAL-01**: Automated tests cover dataset/resource resolution and runtime schema validation paths
- [ ] **QUAL-02**: Automated tests cover at least one critical dashboard path and one critical RouteEditor path

### Future Handoff

- [ ] **FUTR-01**: Team has a concrete written v2 upgrade path for stable AIS ingestion and backend-served forecasting without expanding the current milestone into realtime delivery

## v2 Requirements

### Realtime System

- **REAL-01**: Operator can ingest refreshed AIS data without rebuilding the frontend bundle
- **REAL-02**: Backend can map incoming AIS events into model-ready grid windows compatible with trained STGCN assets
- **REAL-03**: Frontend can request current flow and forecast summaries from API endpoints instead of static JSON files
- **REAL-04**: System can run scheduled or streaming inference and publish refreshed forecast outputs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Realtime AIS backend in the current milestone | Deferred to the later system evolution once the shipped demo is stable |
| Auth, RBAC, or business operations workflows | Not required for the current demo/research product |
| Full UI redesign | Reliability and maintainability come first for this milestone |
| Retraining or replacing the STGCN model | Current need is reproducibility and handoff, not model R&D expansion |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RELY-01 | Phase 1 | Pending |
| RELY-02 | Phase 1 | Pending |
| RELY-03 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| MAINT-01 | Phase 3 | Pending |
| MAINT-02 | Phase 3 | Pending |
| MAINT-03 | Phase 3 | Pending |
| PIPE-01 | Phase 4 | Pending |
| PIPE-02 | Phase 4 | Pending |
| PIPE-03 | Phase 4 | Pending |
| QUAL-01 | Phase 5 | Pending |
| QUAL-02 | Phase 5 | Pending |
| FUTR-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after initial definition*
