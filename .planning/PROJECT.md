# Port Traffic AIS Demo Web

## What This Is

This is a brownfield Vite/React site for presenting port-traffic research outputs through archived AIS playback and offline-generated analysis bundles. After `v1.1`, the product now ships as a modular showcase with dedicated overview, forecast, repair, clustering, evaluation, and forward-looking routes instead of one dense demo page.

The product remains a presentation-grade offline website for teaching, defense, and portfolio display. It is still not a realtime AIS platform or a live harbor-operations system.

## Core Value

The website must clearly, credibly, and repeatably present our algorithms and model outputs using archived AIS data plus offline-computed results, while preserving a convincing quasi-realtime demo experience.

## Current State

**Latest shipped milestone:** `v1.1 Offline Showcase Expansion` on 2026-03-30

**What shipped:**

- A reproducible module-bundle export pipeline for forecast, repair, clustering, evaluation, overview, and forward-looking analysis
- A registry-driven shell with lazy-loaded module discovery, shared runtime validation, and one coherent navigation model
- Module-deep UI for multi-model forecasting, curated trajectory repair, corridor-led clustering, unified evaluation, overview framing, and forward-looking before/after strategy evidence
- One site-wide narrative for corridor dominance and deferred `CLUS-03`, instead of disconnected module-local copy

**Truth boundary:**

- Archived playback plus offline-computed evidence only
- No live optimizer
- No fake noise re-clustering while `normalized_distances(60,90,0.03).pkl` remains zero-byte

## Requirements

### Validated

- [x] Historical AIS playback, dashboard/editor runtime validation, and safer frontend seams from `v1.0`
- [x] Module shell that links overview, forecast, repair, clustering, evaluation, and forward-looking through one coherent product surface
- [x] Static artifact pipeline with bundle exporters, lineage manifests, and repeatable verification for shipped module data
- [x] Forecast cockpit with model switching, horizon switching, metric visibility, hotspot context, and total-flow analysis
- [x] Repair cockpit with curated sample selection, method switching, synchronized comparison, and full metric summaries
- [x] Clustering module with layered provenance, corridor-dominance storytelling, and an honest deferred `CLUS-03` boundary
- [x] Unified evaluation, overview business-loop framing, and forward-looking before/after evidence layer

### Active

- [ ] Define the next milestone after `v1.1` closeout
- [ ] Reopen a true `CLUS-03` comparison only if `normalized_distances(60,90,0.03).pkl` becomes a trustworthy non-zero input
- [ ] Decide whether node-level forecast evidence and animation are worth another showcase wave
- [ ] Decide whether future work should remain an offline presentation product or move toward live / service-backed capabilities

### Out of Scope

- Realtime AIS ingestion, live backend APIs, and online inference until a dependable data source and service model exist
- Auth, roles, business workflows, or multi-tenant operations
- Full framework migration away from Vite + React + TypeScript
- Arbitrary user uploads or ad hoc online compute jobs
- Retraining or replacing research models from scratch as part of showcase packaging work

## Context

- The working web app lives under `demo-web/` and remains deployable as a static Vite build.
- Shipped module data now lives under `demo-web/public/data/modules/`.
- The research source tree still provides the offline evidence inputs and regeneration anchors for the website.
- `compressed_segments(60,90,0.03).pkl` remains sufficient for corridor extraction, but not for all clustering provenance layers.
- `normalized_distances(60,90,0.03).pkl` exists in the workspace but is still zero-byte, so real noise re-clustering remains blocked.
- The forward-looking module is now `ready`, but it remains a curated rule-driven evidence layer over shipped forecast / clustering context rather than a standalone optimizer package.
- Milestone archives now live under `.planning/milestones/`, with `v1.1` fully archived there.

## Constraints

- **Tech stack:** Keep Vite + React + TypeScript as the core frontend foundation
- **Deployment model:** Preserve static-site deployment and committed offline artifacts until requirements say otherwise
- **Data source:** Work from archived research inputs and existing cleaned outputs
- **Python pipeline:** Keep Python exporters / notebooks as the offline computation layer where they already hold the research truth
- **Brownfield safety:** Respect the existing dashboard and RouteEditor where they still provide demonstrable value
- **Scalability approach:** Solve growth through module boundaries, catalogs, and lazy loading before introducing backend complexity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat `v1.1` as an offline showcase expansion, not a live-system milestone | The real value is demonstrating research outputs credibly, not pretending live infrastructure exists | Good |
| Use module manifests, bundles, and lazy loading as the frontend scaling model | The site had already outgrown one eager-loaded dashboard surface | Good |
| Complete data packaging and lineage before deep UI work | Stable artifacts reduce rework and guessed contracts | Good |
| Let corridor dominance become a site-wide narrative bridge | It ties clustering, evaluation, overview, and forward-looking into one coherent story | Good |
| Ship an honest `CLUS-03` fallback instead of fake re-clustering visuals | The current `normalized_distances(60,90,0.03).pkl` artifact is still zero-byte | Good |
| Treat forward-looking as a rule-driven evidence layer over shipped outputs | The repo does not yet contain a standalone optimizer package strong enough for direct productization | Good |
| Package optimization evidence from committed exports instead of requiring fragile local pickle replay | This keeps `EVAL-04` truthful and shippable in the current environment | Good |

## Next Milestone Goals

- Define fresh requirements instead of extending the archived `v1.1` backlog
- Choose whether the next step is showcase deepening, blocked-data recovery, or a move toward dynamic capabilities
- If the evidence becomes trustworthy, decide whether restoring real noise re-clustering deserves first priority

<details>
<summary>Archived v1.1 planning stance</summary>

`v1.1` began as a data-first milestone to turn the existing offline dashboard into a structured showcase site with dedicated modules for flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and overview.

</details>

---
*Last updated: 2026-03-30 after v1.1 milestone closeout*
