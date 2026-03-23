# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- UI entry points such as `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx` are PascalCase and export their component directly; data and helper modules like `demo-web/src/datasetCatalog.ts`, `demo-web/src/mainCorridorSelection.ts`, and `demo-web/src/sharedContracts.ts` use camelCase names that describe the capabilities they expose.

**Functions:**
- Helper/math utilities and event handlers consistently adopt camelCase, including `geoToPercent`, `buildTimelineMoments`, `handleStagePointerMove`, and `updateSelectedPoint` inside `demo-web/src/App.tsx`/`demo-web/src/RouteEditor.tsx`.
- Selector/loader functions follow verb patterns such as `loadDatasetCatalog`, `selectDatasetEntry`, and `buildObservedTracks` in `demo-web/src/datasetCatalog.ts` and `demo-web/src/mainCorridorSelection.ts`.

**Variables:**
- Hook state and derived values use camelCase setter pairs (`[sceneIndex, setSceneIndex]` in `demo-web/src/App.tsx`, `[mapTransform, setMapTransform]` in `demo-web/src/RouteEditor.tsx`).
- Shared constants adopt screaming snake case for configuration blobs (e.g., `STUDY_BOUNDS`, `DEFAULT_ROUTE_COUNTS`, `CLEANED_TRACKS_PATH`, `BACKGROUND_PRESETS`) defined in `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx`.

**Types:**
- All custom type aliases/interfaces are PascalCase with descriptive suffixes such as `DatasetCatalogEntry`, `PlaybackFrame`, `MainCorridorSelectionResult`, and `FlowForecastData` declared in `demo-web/src/datasetCatalog.ts`, `demo-web/src/sharedContracts.ts`, and `demo-web/src/mainCorridorSelection.ts`.

## Code Style

**Formatting:**
- `demo-web/eslint.config.js` extends `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`, so ESLint applies the formatting defaults (single quotes, spacing, trailing comma rules) without a separate Prettier configuration.
- `demo-web/tsconfig.app.json` and `demo-web/tsconfig.node.json` enable `strict`, `noUnusedLocals`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`, and other compiler checks that enforce consistent typing and prevent implicit globals.

**Linting:**
- `demo-web/package.json` exposes `npm run lint` (`eslint .`), making ESLint the gatekeeper for style rules before running builds or dev servers.

## Import Organization

**Order:**
1. `import type` statements and React/core dependencies appear first, as shown by the dual `import type { CSSProperties }` and `import { useEffect, useMemo, useState }` blocks in `demo-web/src/App.tsx`.
2. Shared utilities and data helpers (`demo-web/src/scenarioPacks.ts`, `demo-web/src/datasetCatalog.ts`, `demo-web/src/sharedContracts.ts`) follow.
3. Entry-specific CSS imports come last (`demo-web/src/App.css`, `demo-web/src/RouteEditor.css`).

**Path Aliases:**
- None; every import is relative to the file that consumes it (e.g., `demo-web/src/App.tsx` imports `./datasetCatalog` and `./sharedContracts`).

## Error Handling

**Patterns:**
- Fetch helpers such as `loadPublicJson` (`demo-web/src/sharedContracts.ts`) and `loadDatasetCatalog` (`demo-web/src/datasetCatalog.ts`) always verify `response.ok`, throw `Error` objects on failure, and gate parsing behind input validators like `isRecord` and `sanitizeDatasetId`.
- React effects in `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx` use `let cancelled = false` guards to ignore late results and set user-facing error strings (`setDatasetLoadError`, `setTracksDataError`) in catch blocks.
- Data validation routines (`hasRequiredAssets`, `normalizeCatalog`) ensure callers receive a sane fallback rather than letting malformed JSON bubble up.

## Logging

**Framework:** Not configured; no runtime logging library exists and `rg "console\." demo-web/src` only matches CSS classes, so there are no `console.log` statements in `demo-web/src`.

**Patterns:** UI state (e.g., `datasetLoadError` in `demo-web/src/App.tsx`) exposes statuses instead of writing to the console; diagnostics are surfaced through React state and visible messages.

## Comments

**When to Comment:** Comments are limited to configuration groupings such as `/* Bundler mode */` and `/* Linting */` in `demo-web/tsconfig.app.json` and `demo-web/tsconfig.node.json`; in-source comments are rare, so prefer expressive names like those in `demo-web/src/mainCorridorSelection.ts` to explain intent.

**JSDoc/TSDoc:** Not used anywhere in `demo-web/src`; the code relies on TypeScript signatures and clear naming instead of doc blocks.

## Function Design

**Size:** Helper calculations (`geoToPercent`, `createSmoothGeoPath`, `buildObservedTracks`) live near the top of `demo-web/src/App.tsx`/`demo-web/src/RouteEditor.tsx` so they stay focused, while the large components orchestrate these helpers instead of embedding sprawling inline logic.

**Parameters:** Functions accept typed arguments with defaults (e.g., `geoToPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS)` in `demo-web/src/App.tsx` and `buildObservedTracks(frames: PlaybackFrame[])` in `demo-web/src/mainCorridorSelection.ts`).

**Return Values:** Utilities return specific TypeScript shapes (`normalizeCatalog` returns `DatasetCatalog`, `resolveCorridorSolution` returns `ResolvedCorridorSolution`), and event handlers return `void` while updating React state with setters.

## Module Design

**Exports:** Utility modules (`demo-web/src/datasetCatalog.ts`, `demo-web/src/mainCorridorSelection.ts`, `demo-web/src/sharedContracts.ts`) expose named functions/types, whereas UI modules default-export (`demo-web/src/App.tsx`) or directly export the component (`demo-web/src/RouteEditor.tsx`).

**Barrel Files:** None; each consumer (`demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`) imports helper modules directly by their file path rather than through an index barrel.

---

*Convention analysis: 2026-03-23*
