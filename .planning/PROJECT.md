# Port Traffic AIS Demo Web

## What This Is

This is a brownfield Vite/React demo project for presenting port-traffic research outputs. It currently ships a historical AIS playback dashboard, an offline STGCN forecast experience, and a RouteEditor for inspecting cleaned main corridor tracks.

The current product is a presentation-grade demo for showcasing algorithms and model results with historical AIS data plus cleaned offline datasets. It is not intended to become a realtime AIS platform or a full harbor operations system.

## Core Value

The demo must clearly, credibly, and stably present our algorithms and model outputs on the website using existing historical and cleaned AIS datasets.

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
- [ ] Document and harden the offline Python data pipeline around the archived source data we already have
- [ ] Improve the website's explanation and presentation of algorithm and model outputs so the demo story is accurate even without realtime data

### Out of Scope

- Realtime AIS ingestion, live backend APIs, and online inference - we do not have a reliable data source and they are not required for this project's mission
- Business backend concerns such as auth, roles, billing, or multi-tenant operations - the current product is still a demo/research surface
- A full visual redesign of the working dashboard/editor experience - this milestone prioritizes reliability and maintainability over rebranding
- Replacing the STGCN research model or retraining from scratch - we need reproducibility and handoff first, not a new modeling program

## Context

- The working web app lives under `demo-web/` and is already deployable as a static Vite build with two entry points.
- Runtime data is served from `demo-web/public/data/*.json`, including AIS playback, flow forecast, shared geometry, dataset catalog, and main corridor tracks.
- The canonical raw and intermediate inputs available to us live under `C:\Users\X\Desktop\服务外包网站设计\代码依据`, plus additional cleaned subsets prepared earlier.
- The dashboard and RouteEditor are functional today, but `App.tsx` and `RouteEditor.tsx` are large monoliths with high regression risk.
- `npm run build` passes, while `npm run lint` currently fails due to React hook/compiler issues in the brownfield codebase.
- No automated tests exist yet, and the Python pipeline depends on unpinned libraries plus fragile raw-data assumptions.
- We do not currently have a practical realtime AIS source, so the correct product framing is an operable offline showcase built from archived data, cleaned tracks, and offline model outputs.

## Constraints

- **Tech stack**: Keep the current Vite + React + TypeScript frontend architecture for this milestone - changing the platform would delay stabilization work
- **Data architecture**: Preserve static JSON delivery for the shipped demo during this milestone - it matches the current deployment model and avoids premature backend work
- **Data availability**: Work from archived files in `代码依据` and previously cleaned outputs - there is no dependable realtime AIS feed available to build against
- **Python dependencies**: Existing data-generation scripts stay in Python for now - rewriting them would expand scope before reproducibility is fixed
- **Brownfield safety**: Changes must respect existing behavior in the dashboard and RouteEditor - this project already contains demonstrable user-facing capability
- **Verification**: New work needs stronger repeatable verification than the current manual-only flow - otherwise refactors will remain risky

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat the current product as a completed v1 offline demo, not a missing greenfield app | The repo already ships usable dashboard and RouteEditor capabilities | Good |
| Use archived data plus cleaned subsets in `代码依据` as the canonical demo input source | These are the reliable inputs we actually have today | Good |
| Optimize the next milestone for an operable offline showcase of algorithm and model presentation, not realtime evolution | The mission is to demonstrate research outputs on the website, not to ingest live traffic | Good |
| Keep static dataset delivery in `public/data` for the current milestone | It preserves deployment simplicity while we harden contracts and tooling | Pending |
| Avoid roadmap pressure toward realtime AIS/backend work | Lack of live data source makes that direction misleading for current planning | Good |

---
*Last updated: 2026-03-23 after scope refinement*
