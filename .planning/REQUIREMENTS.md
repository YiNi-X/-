# Requirements: Port Traffic AIS Demo Web

**Defined:** 2026-03-23
**Core Value:** The demo must clearly, credibly, and stably present our algorithms and model outputs on the website using existing historical and cleaned AIS datasets.

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

### Presentation and Narrative

- [ ] **PRES-01**: Demo viewer can understand which layers come from archived AIS playback, which views come from cleaned corridor extraction, and which panels come from offline model output
- [ ] **PRES-02**: Website presents algorithm and model results using committed historical datasets without implying that the system is operating on live AIS data
- [ ] **PRES-03**: Team can curate and present stable demo scenarios from archived datasets so algorithm and model behavior is repeatable during demos

### Verification

- [ ] **QUAL-01**: Automated tests cover dataset/resource resolution and runtime schema validation paths
- [ ] **QUAL-02**: Automated tests cover at least one critical dashboard path and one critical RouteEditor path

## v2 Requirements

### Scenario Expansion

- **SCEN-01**: Team can add more archived AIS scenarios from local source files without restructuring the app
- **SCEN-02**: Demo can compare multiple model runs, parameters, or derived outputs on the same historical dataset
- **SCEN-03**: Website can export or present richer explanation material for presentations, reports, or defense sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Realtime AIS backend, streaming feed, or live inference | No practical data source and not required for the current mission |
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
| PRES-01 | Phase 5 | Pending |
| PRES-02 | Phase 5 | Pending |
| PRES-03 | Phase 5 | Pending |
| QUAL-01 | Phase 5 | Pending |
| QUAL-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after scope refinement*
