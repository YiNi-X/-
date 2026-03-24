# Port Traffic AIS Demo Web

## What This Is

This is a brownfield Vite/React demo project for presenting port-traffic research outputs with archived AIS data. The next milestone turns the current offline dashboard into a structured showcase website with dedicated modules for flow prediction, trajectory repair, trajectory clustering, collaborative decision, evaluation, and project overview, all driven by precomputed historical results rather than live feeds.

The product remains a presentation-grade offline demonstration for teaching, defense, and website display. It is not intended to become a realtime AIS platform or a full harbor operations system in this milestone.

## Core Value

The website must clearly, credibly, and repeatably present our algorithms and model outputs using archived AIS data plus offline-computed results, while preserving a convincing quasi-realtime demo experience.

## Current Milestone: v1.1 Offline Showcase Expansion

**Goal:** Reorganize the demo into a modular showcase site that presents the full algorithm story from archived playback through model analysis and decision support.

**Target features:**
- Flow prediction module with model switching, horizon switching, key metrics, hotspot grids, and total flow trends
- Trajectory repair module with curated sample selection, missing-vs-repaired comparison, error charts, and metric summaries
- Trajectory clustering module with raw/segmented/compressed/clustered/corridor views plus noise re-clustering
- Collaborative decision module, unified evaluation center, and a project overview page that explains the end-to-end business loop

## Requirements

### Validated

- [x] Historical AIS playback renders from static JSON with synchronized map, timeline, hotspot, and narrative panels - existing
- [x] Offline forecast datasets drive dashboard scenes, recommendations, and benchmark summaries - existing
- [x] RouteEditor loads cleaned main corridor tracks and supports pan, zoom, inspection, and export interactions - existing
- [x] Static multi-entry deployment exists for both the dashboard and the RouteEditor - existing
- [x] Runtime data-contract validation exists at the boundary for shipped dashboard/editor JSON payloads - existing
- [x] The frontend now has safer seams than the original monolithic `App.tsx` and `RouteEditor.tsx` versions - existing

### Active

- [ ] Build a module-oriented showcase shell that links overview, flow prediction, trajectory repair, trajectory clustering, collaborative decision, and evaluation
- [ ] Package website-facing static artifacts for each module directly from the archived `代码依据` materials and existing cleaned outputs
- [ ] Replace hardcoded placeholder comparisons with structured offline result bundles for prediction, repair, clustering, and evaluation
- [ ] Keep the site honest about archived playback plus offline inference while still delivering a convincing quasi-realtime demo
- [ ] Scale the static website architecture by splitting data and loading paths by module, scenario, and artifact type instead of growing one monolithic runtime payload

### Out of Scope

- Realtime AIS ingestion, live backend APIs, and online inference - we do not have a reliable data source and they are not required for this milestone
- Auth, roles, business workflows, or multi-tenant operations - the current product is still a demo/research showcase
- Full framework migration away from Vite + React + TypeScript - architecture needs to improve, but a platform rewrite would slow the milestone down
- User-uploaded arbitrary datasets and ad hoc online computation - the milestone should present curated offline results, not become a generic analysis platform
- Replacing or retraining the research models from scratch - the immediate need is packaging, explanation, and stable presentation of the results we already have

## Context

- The working web app lives under `demo-web/` and is already deployable as a static Vite build with dashboard and RouteEditor entry points.
- Runtime data is served from `demo-web/public/data/*.json`, including AIS playback, flow forecast, shared geometry, dataset catalog, model config, and main corridor tracks.
- The canonical research and provenance inputs available to us live under `C:\Users\X\Desktop\服务外包网站设计\代码依据`.
- `代码依据/流量预测` already contains STGCN code, benchmark notebooks, matrices, and saved model weights that are strong enough to support a forecast showcase, but only STGCN has been productized into current website-facing JSON so far.
- `代码依据/轨迹修复` contains multiple repair-model experiments, metric computation, optimization history, parameter importance, and exported HTML result artifacts, but it does not yet provide website-ready structured JSON bundles.
- `代码依据/轨迹聚类` contains segmentation, compression, distance fusion, clustering, noise re-clustering, and corridor export logic, but it remains notebook-centric research provenance rather than a stable website-facing data contract.
- The current collaborative-decision experience in `flow-forecast.json` is already presentation-friendly, but it is largely tied to forecast narrative output and not backed by a separate decision algorithm package under `代码依据`.
- Current runtime payload sizes already approach a few megabytes per major artifact, so future expansion must avoid pushing all modules through a single eager-loading page.

## Constraints

- **Tech stack**: Keep the current Vite + React + TypeScript frontend foundation - we need structure upgrades, not a risky platform migration
- **Deployment model**: Preserve static-site deployment and static artifact delivery during this milestone - this matches the data we actually have and keeps demos portable
- **Data source**: Work from archived files in `代码依据` and existing cleaned outputs - there is no dependable realtime AIS feed available
- **Python pipeline**: Continue using Python scripts or notebooks as the offline computation layer - rewriting all data tooling would expand scope before the site story is stable
- **Brownfield safety**: Respect the existing dashboard and RouteEditor behavior where they already provide demonstrable value
- **Scalability approach**: Solve growth first through module boundaries, data catalogs, and lazy loading - not through premature backend introduction

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat v1.1 as an offline showcase expansion, not a live-system milestone | The real value is demonstrating research outputs with confidence, not pretending we have live infrastructure | Good |
| Keep Vite + React + TypeScript as the core platform | The stack is already working; the problem is organization and data packaging, not framework capability | Good |
| Move from one dense dashboard narrative toward module-oriented navigation | The number of algorithm views has outgrown a single monitoring-style surface | Good |
| Use archived AIS playback and precomputed results to create quasi-realtime interaction | This matches what the team can actually reproduce and defend | Good |
| Require website-facing result bundles for repair and clustering before large UI buildout | Notebook outputs alone are not stable frontend contracts | Good |
| Build collaborative decision as a rule-driven evidence layer over prediction and clustering outputs | `代码依据` does not currently contain a separate decision optimizer package strong enough to stand alone | Good |
| Roll the unfinished hardening concerns from the prior roadmap into the new milestone foundation phase | Dataset packaging, verification, and lazy loading are now direct enablers for the showcase modules | Good |

---
*Last updated: 2026-03-24 after starting milestone v1.1 Offline Showcase Expansion*
