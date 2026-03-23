# Port Traffic AIS Demo Web

## What This Is

This is a brownfield Vite/React demo project for presenting port-traffic research outputs. It currently ships a historical AIS playback dashboard, an offline STGCN forecast experience, and a RouteEditor for inspecting cleaned main corridor tracks.

The current product is a presentation-grade demo for showcasing data and modeling results. It is not yet a production realtime AIS platform or a full harbor operations system.

## Core Value

The demo must remain a credible, stable, and explainable representation of historical AIS activity plus offline forecast insights so we can iterate on it with confidence.

## Requirements

### Validated

- [x] Historical AIS playback renders from static JSON with synchronized map, timeline, hotspot, and narrative panels - existing
- [x] Offline forecast datasets drive dashboard scenes, recommendations, and benchmark summaries - existing
- [x] RouteEditor loads cleaned main corridor tracks and supports pan, zoom, inspection, and export interactions - existing
- [x] Static multi-entry deployment exists for both the dashboard and the RouteEditor - existing

### Active

- [ ] Make the current demo buildable, lintable, and reproducible on a fresh machine
- [ ] Add runtime data-contract validation and actionable failure handling for shipped JSON datasets
- [ ] Reduce monolithic frontend components so future feature work is safer
- [ ] Document and harden the offline Python data pipeline while preserving a clear future upgrade path to backend-served AIS forecasting

### Out of Scope

- Realtime AIS ingestion and online inference in this milestone - this is a later system evolution, not part of stabilizing the shipped demo
- Business backend concerns such as auth, roles, billing, or multi-tenant operations - the current product is still a demo/research surface
- A full visual redesign of the working dashboard/editor experience - this milestone prioritizes reliability and maintainability over rebranding
- Replacing the STGCN research model or retraining from scratch - we need reproducibility and handoff first, not a new modeling program

## Context

- The working web app lives under `demo-web/` and is already deployable as a static Vite build with two entry points.
- Runtime data is served from `demo-web/public/data/*.json`, including AIS playback, flow forecast, shared geometry, dataset catalog, and main corridor tracks.
- The dashboard and RouteEditor are functional today, but `App.tsx` and `RouteEditor.tsx` are large monoliths with high regression risk.
- `npm run build` passes, while `npm run lint` currently fails due to React hook/compiler issues in the brownfield codebase.
- No automated tests exist yet, and the Python pipeline depends on unpinned libraries plus fragile raw-data assumptions.
- Existing repository notes already describe a two-step product direction: stabilize the offline first-version demo now, then preserve a clean path toward future quasi-realtime AIS ingestion and backend forecasting.

## Constraints

- **Tech stack**: Keep the current Vite + React + TypeScript frontend architecture for this milestone - changing the platform would delay stabilization work
- **Data architecture**: Preserve static JSON delivery for the shipped demo during this milestone - it matches the current deployment model and avoids premature backend work
- **Python dependencies**: Existing data-generation scripts stay in Python for now - rewriting them would expand scope before reproducibility is fixed
- **Brownfield safety**: Changes must respect existing behavior in the dashboard and RouteEditor - this project already contains demonstrable user-facing capability
- **Verification**: New work needs stronger repeatable verification than the current manual-only flow - otherwise refactors will remain risky

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat the current product as a completed v1 offline demo, not a missing greenfield app | The repo already ships usable dashboard and RouteEditor capabilities | Good |
| Use the next milestone to stabilize and modularize the shipped demo before adding realtime features | Current risk is maintainability and reproducibility, not missing core presentation features | Pending |
| Keep static dataset delivery in `public/data` for the current milestone | It preserves deployment simplicity while we harden contracts and tooling | Pending |
| Keep the future realtime AIS/backend path documented but deferred | The repo notes already describe that evolution, but it should not distort current scope | Good |

---
*Last updated: 2026-03-23 after initialization*
