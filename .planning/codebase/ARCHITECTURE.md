# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Dual-entry Vite/React experience where `demo-web/src/main.tsx` renders the operations dashboard and `demo-web/src/route-editor.tsx` renders the editing workspace defined by `demo-web/vite.config.ts` and exposed through `demo-web/index.html` plus `demo-web/route-editor.html`.

**Key Characteristics:**
- Client-only rendering: all UI state lives in `demo-web/src/App.tsx` for the dashboard and `demo-web/src/RouteEditor.tsx` for corridor editing, with styling coming from `demo-web/src/App.css`, `demo-web/src/route-editor.css`, and `demo-web/src/index.css`.
- Data-first workflow: `demo-web/src/datasetCatalog.ts` sanitizes catalog JSON from `demo-web/public/data/dataset-catalog.json`, `demo-web/public/data/ais-playback.json`, `demo-web/public/data/flow-forecast.json`, and `demo-web/public/data/shared-geometry.json`, feeding strongly typed payloads defined in `demo-web/src/sharedContracts.ts`.
- Secondary tools: `demo-web/scripts` runs Python workflows to refresh `demo-web/public/data/main-corridor-tracks.json`, `demo-web/analysis/*`, and supporting outputs consumed by `demo-web/src/RouteEditor.tsx` and the broader planning pipeline.

## Layers

**Client UI Layer:**
- Purpose: render the Pavilion-style map/timeline dashboard plus the corridor editor, orchestrating tabs, sliders, and export controls.
- Location: `demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`, `demo-web/src/App.css`, `demo-web/src/route-editor.css`, `demo-web/src/index.css`.
- Contains: root React components (map layers, strategy panels, editor stage) and DOM-focused helpers (pointer events, sliders, buttons).
- Depends on: the dataset helpers and type contracts in `demo-web/src/datasetCatalog.ts`, `demo-web/src/sharedContracts.ts`, and the scenario metadata in `demo-web/src/scenarioPacks.ts`.
- Used by: `demo-web/src/main.tsx` renders `<App />`, and `demo-web/src/route-editor.tsx` renders `<RouteEditor />`.

**Domain Utilities Layer:**
- Purpose: define shared domain models, sanitize dataset metadata, supply static scenario definitions, and provide corridor analysis helpers.
- Location: `demo-web/src/sharedContracts.ts`, `demo-web/src/datasetCatalog.ts`, `demo-web/src/scenarioPacks.ts`, `demo-web/src/mainCorridorSelection.ts`.
- Contains: `FlowForecastData`, `ForecastTimelineEntry`, `DatasetCatalog`, and `MainCorridorSelectionResult` types; functions like `loadDatasetCatalog`, `selectDatasetEntry`, `resolveRuntimeResource`, and the unused but available `selectMainCorridorTracks`.
- Depends on: built-in browser APIs (`fetch`, `localStorage`, `history`) and numeric helpers; the corridor selection logic is pure compute with no DOM ties.
- Used by: `demo-web/src/App.tsx` (data fetching, state derivation) and `demo-web/src/RouteEditor.tsx` (resource resolution, JSON loading).

**Static Data & Tooling Layer:**
- Purpose: make runtime JSON blobs available to the SPA and capture the offline pipelines that refresh them.
- Location: `demo-web/public/data`, `demo-web/scripts`, `demo-web/analysis`.
- Contains: `ais-playback.json`, `flow-forecast.json`, `dataset-catalog.json`, `shared-geometry.json`, `model-config.json`, `main-corridor-tracks.json`; Python scripts `scripts/generate_first_version_data.py`, `scripts/extract_main_corridors_from_clustered_ais.py`, `scripts/stgcn_runtime.py`; and analysis artifacts like `analysis/senior_main_corridors_summary.json`.
- Depends on: Python runtime for the scripts and Vite’s dev/build server to serve the files.
- Used by: `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx` load these assets directly; `demo-web/scripts` and `demo-web/analysis` are referenced when researchers refresh or inspect corridor outputs.

## Data Flow

**Operational Forecast Flow:**
1. `demo-web/src/main.tsx` bootstraps the SPA and renders `<App />` inside `#root` from `demo-web/index.html`.
2. `App` calls `loadDatasetCatalog` in `demo-web/src/datasetCatalog.ts`, which fetches `demo-web/public/data/dataset-catalog.json`, sanitizes IDs, persists the choice via query/localStorage, and falls back to `DEFAULT_DATASET_CATALOG`.
3. When the selected dataset changes, `App` loads `demo-web/public/data/ais-playback.json` and `demo-web/public/data/flow-forecast.json` through `loadPublicJson` (`demo-web/src/sharedContracts.ts`) and also fetches `demo-web/public/data/shared-geometry.json` for route/hotspot overlays.
4. The component’s helpers (`geoToPercent`, `buildTimelineMoments`, `playbackTracks`) in `demo-web/src/App.tsx` convert raw frames into map layers, timeline nodes, and derived summaries using metadata from `demo-web/src/scenarioPacks.ts`.
5. The map, timeline slider, strategy feed, and benchmark panels re-render using the state tracked in `demo-web/src/App.tsx`, delivering a synchronized operational story.

**Route Editor Flow:**
1. Visiting `demo-web/route-editor.html` triggers the redirect script to `demo-web/dist/route-editor.html` (if present) while still loading the module at `demo-web/src/route-editor.tsx` registered as a second input in `demo-web/vite.config.ts`.
2. `RouteEditor` resolves `demo-web/public/data/main-corridor-tracks.json` using `resolveRuntimeResource` in `demo-web/src/datasetCatalog.ts` and fetches it through `loadPublicJson` from `demo-web/src/sharedContracts.ts`.
3. Tracks are cloned, grouped, and memorized inside `demo-web/src/RouteEditor.tsx`; inspector panels expose JSON exports, cursor coordinates, and corridor summaries, while the SVG layers are built from `selectedTrackGeometry` and `trackLayers`.
4. Pointer and wheel events mutate `LayerTransform` (`mapTransform`, `trackTransform`) via `updateLayerTransform` so the map/track layers respond to zoom, pan, and button-driven nudges.

## State Management

- The dashboard’s `App` component wires dozens of `useState` hooks for scene index, autoplay, dataset selection, playback data, forecast data, geometry, controls, and error messages. Each async `useEffect` (`loadDatasetCatalog`, `loadPublicJson`, geometry loader) tracks a `cancelled` flag to avoid race conditions (`demo-web/src/App.tsx`).
- Derived outputs such as `availableDatasets`, `visiblePlaybackVessels`, `playbackTracks`, `hotspots`, and `timelineMoments` are memoized with `useMemo` so the UI only rerenders when the underlying dataset or geometry changes (`demo-web/src/App.tsx`).
- `RouteEditor` keeps its own `useState` for cursor position, `LayerTransform`, selected handles, uploaded images, and map presets in `demo-web/src/RouteEditor.tsx`; `useEffect` hooks wire the pointer listeners that update `mapTransform`/`trackTransform` while cleaning up blob URLs when uploads change.

## Key Abstractions

**Dataset Catalog & Resource Resolver (`demo-web/src/datasetCatalog.ts`):**
- Purpose: keep dataset metadata consistent and safe—sanitizing IDs, normalizing paths, persisting choices, and resolving runtime URLs.
- Examples: `DEFAULT_DATASET_ENTRY`, `loadDatasetCatalog`, `selectDatasetEntry`, `persistDatasetSelection`, `resolveRuntimeResource`.
- Pattern: central helper module so both the dashboard and editor point to the same sanitized JSON assets without duplicating the path logic.

**Forecast Narrative Model (`demo-web/src/sharedContracts.ts` + `demo-web/src/App.tsx`):**
- Purpose: expose typed structures such as `FlowForecastData`, `ForecastTimelineEntry`, `ForecastNarrative`, and `Recommendation` so UI panels can safely access summaries, benefits, and alerts.
- Examples: `scene.recommendations`, `scene.benefits`, `forecastEntry?.derived`.
- Pattern: `App` maps the raw JSON into this contract before rendering strategy, feed, and benchmark cards, keeping the data shape predictable.

**Route Editor Transform State (`demo-web/src/RouteEditor.tsx`):**
- Purpose: manage `LayerTransform`, `StagePanState`, `selectedHandle`, and cursor state to drive the editor canvas interactions.
- Examples: `updateLayerTransform`, `handleStagePointerDown`, `selectedTrackGeometry`, `trackLayers`.
- Pattern: encapsulate stage interactions inside `RouteEditor` so SVG overlays and inspector controls remain in sync with pointer events.

## Entry Points

**`main`**
- Location: `demo-web/src/main.tsx`
- Triggers: `demo-web/index.html` loads `/src/main.tsx` as the default Vite input.
- Responsibilities: render `<App />` within `<StrictMode>` and boot the dashboard.

**`routeEditor`**
- Location: `demo-web/src/route-editor.tsx`
- Triggers: `demo-web/route-editor.html` (plus the redirect to `demo-web/dist/route-editor.html`) and the secondary input declared in `demo-web/vite.config.ts`.
- Responsibilities: render `<RouteEditor />`, including any boot-time notice while the SPA pulls `main-corridor-tracks.json`.

## Error Handling

**Strategy:** Every async fetch feeds a dedicated error state, so the UI surfaces failures instead of throwing (see the `datasetLoadError`, `geometryLoadError`, and `tracksDataError` states in `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx`).
**Patterns:**
- Wrap `loadPublicJson`/`loadDatasetCatalog` calls inside `.catch` blocks that populate the error state via `setDatasetLoadError` or `setDatasetLoadError` (`demo-web/src/App.tsx`), then display human-friendly copy in the render output.
- Guard each `useEffect` with a `cancelled` flag to prevent stale promises from overriding newer data (`demo-web/src/App.tsx`).
- Fall back to clean state and show `tracksDataError` paragraphs when the Route Editor cannot fetch `demo-web/public/data/main-corridor-tracks.json` (`demo-web/src/RouteEditor.tsx`).

## Cross-Cutting Concerns

**Logging:** No structured logging layer—debugging happens through React DevTools and the browser console since `demo-web/src/App.tsx` contains no `console` calls.
**Validation:** `demo-web/src/datasetCatalog.ts` sanitizes dataset IDs with `sanitizeDatasetId`, filters entries missing required paths, and always returns `DEFAULT_DATASET_CATALOG` before the UI fetches anything.
**Authentication:** None; both entry points assume open access to the bundled JSON assets without cookies, headers, or tokens.

---
*Architecture analysis: 2026-03-23*
