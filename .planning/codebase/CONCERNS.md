# Codebase Concerns

**Analysis Date:** 2026-03-23

## Tech Debt

**`demo-web/src/App.tsx` monolith:**
- Issue: The root React tree mixes geometry helpers, dataset fetches, chart math, control drawers, and timeline rendering within a single 58KB component.
- Files: `demo-web/src/App.tsx`
- Impact: Changing any part (e.g., dataset loading or chart logic) requires scrolling through thousands of lines; regression risk is high and there are no focused tests to guard the different responsibilities.
- Fix approach: Split data loading into hooks/services, move timeline/chart rendering to dedicated child components, and keep the component’s job to layout/orchestration.

**`demo-web/src/RouteEditor.tsx` tightly couples UI, geometry math, and export logic:**
- Issue: The editor component contains pointer handling, shared layer transforms, clipboard exports, geometry conversion, and control panels in one 42KB file.
- Files: `demo-web/src/RouteEditor.tsx`
- Impact: Simple tweaks (e.g., add a new control or change map zoom) require reasoning about dozens of interleaved handlers and state slices, so regression scope expands quickly.
- Fix approach: Extract geometry utilities/pan handlers into reusable hooks, break the panel controls into smaller components, and keep the stage render logic focused on visualization.

**`demo-web/src/mainCorridorSelection.ts` clustering implementation lacks modular boundaries:**
- Issue: The ~32KB clustering/resampling math lives in one file with little documentation or exported helpers beyond the final selection result.
- Files: `demo-web/src/mainCorridorSelection.ts`
- Impact: Anyone trying to adjust corridor discovery (needed for new datasets or route counts) must grok hundreds of lines of ad-hoc statistics before they can safely change anything.
- Fix approach: Split the file into smaller modules (e.g., sampling, clustering, scoring), document parameter contracts, and expose a clean API so that the `RouteEditor` and scripts can reuse only what they need.

## Known Bugs

Not detected.

## Security Considerations

Not detected.

## Performance Bottlenecks

**Startup loads full AIS + forecast JSON:**
- Problem: `Promise.all` in `demo-web/src/App.tsx` fetches `resolveRuntimeResource(selectedDataset.aisPlaybackPath)` and `resolveRuntimeResource(selectedDataset.flowForecastPath ?? 'data/flow-forecast.json')` before any UI interaction.
- Files: `demo-web/src/App.tsx`, `demo-web/public/data/ais-playback.json`, `demo-web/public/data/flow-forecast.json`
- Cause: Both payloads are multi-megabyte (4,363,043 bytes and 3,986,720 bytes) and parsed on the main thread before the dashboard renders.
- Improvement path: Stream or paginate playback/forecast data, fetch only the frames needed for the initial view, or introduce a backend summary endpoint so the first paint is not blocked by full JSON parsing.

**RouteEditor renders the entire corridor export for every interaction:**
- Problem: Every render path in `demo-web/src/RouteEditor.tsx` walks `demo-web/public/data/main-corridor-tracks.json` (1,805,770 bytes) to build SVGs, lists, and export strings.
- Files: `demo-web/src/RouteEditor.tsx`, `demo-web/public/data/main-corridor-tracks.json`
- Cause: There is no virtualization or memoization for the track list/paths, so navigating, nudging points, or changing layers triggers recomputations of hundreds of SVG paths.
- Improvement path: Memoize geometry, virtualize the track list, or render the large track layer with canvas/webgl so pointer updates do not redraw every corridor.

## Fragile Areas

**RouteEditor stage pan/zoom logic:**
- Files: `demo-web/src/RouteEditor.tsx`
- Why fragile: `stagePan` toggles global `pointermove`/`pointerup` listeners that mutate `mapTransform`/`trackTransform` every mouse move while the rest of the component assumes those transforms stay in sync with CSS. Any change to the DOM structure or styling may break handle hit-testing or leave pointer listeners attached.
- Safe modification: Encapsulate pan/zoom handling in a custom hook that keeps DOM interactions local, add defensive guards before mutating transforms, and write targeted regression tests for the hook’s math.
- Test coverage: There are no tests that exercise this pointer logic, so breakages are only caught manually.

**Python data pipeline heuristics hardcode config and raw paths:**
- Files: `demo-web/scripts/generate_first_version_data.py`, `demo-web/scripts/extract_main_corridors_from_clustered_ais.py`
- Why fragile: Both scripts embed thresholds and lookup logic plus absolute data references (the scripts hunt for `compressed_segments(60,90,0.03).pkl` under the repo root), so changing anything else in the analysis folder can silently break `public/data` generation.
- Safe modification: Move thresholds/config to versioned JSON, document required raw inputs, and fail fast when dependencies or input files are missing so regenerating the payload is repeatable.
- Test coverage: These scripts are never invoked from CI and have no unit tests, leaving the data pipeline unchecked.

## Scaling Limits

**Large static data inside `demo-web/public/data`:**
- Current capacity: 4,363,043 bytes for `ais-playback.json`, 3,986,720 bytes for `flow-forecast.json`, 1,805,770 bytes for `main-corridor-tracks.json`, plus CSV exports `demo-live-ais-20200101-0000-20200103-0000.csv` (20,624,027 bytes) and `demo-live-ais-20200102-1400-20200103-0000.csv` (4,227,400 bytes).
- Limit: Every new dataset inflates the static build because Vite copies everything under `public` into `dist`, so more trials will make the repo/bundle heavier.
- Scaling path: Host the raw datasets on external storage/CDN, fetch slices on demand, or compress the JSON/CSV before including them in the repo.

**Research artifacts checked into `demo-web/analysis`:**
- Current capacity: `senior_main_corridors_cleaned_points.csv` (683,994 bytes), `senior_main_corridors_track_stats.csv` (262,778 bytes), and supporting JSON summaries that are not consumed by the production build.
- Limit: These files travel with every git clone even though they are only used for research, so git history and future clones will keep growing without bounds.
- Scaling path: Move the `analysis` folder into a dedicated data repository or track it with `git-lfs`, leaving only the distilled `public/data` payloads within the web project.

## Dependencies at Risk

**`demo-web/scripts/generate_first_version_data.py` requires unpinned native libraries:**
- Risk: The script imports `torch`, `numpy`, `pandas`, and `scipy` but there is no `requirements.txt` or `pyproject.toml`; running `npm run generate:data` fails unless a contributor guesses compatible versions.
- Impact: Fresh data cannot be regenerated when upstream AIS/forecast sources change, so `public/data` becomes stale and the interface silently shows old information.
- Migration plan: Publish a `requirements.txt` (or `pyproject`) with pinned versions and document how to install them (including `pip install torch` with the right CUDA/no-CUDA wheel).

**`demo-web/scripts/extract_main_corridors_from_clustered_ais.py` relies on sklearn/matplotlib builds:**
- Risk: The script pulls `sklearn`, `matplotlib`, `PIL`, `numpy`, and `pandas` without indicating which Python version or binary wheel to target, so environments (especially Windows) often miss a dependency and the script aborts.
- Impact: RouteEditor cannot regenerate `public/data/main-corridor-tracks.json`, leaving the editor tied to the committed export.
- Migration plan: Share a `requirements.txt`, document the minimum Python version, and consider porting simplified clustering logic to JavaScript so the web team can reproduce the output.

## Missing Critical Features

**Dataset payloads lack runtime schema validation:**
- Problem: `demo-web/src/App.tsx` consumes `aisPlayback.meta`, `flowForecast?.meta`, and other nested keys without any runtime guard (the parser just trusts the JSON).
- Files: `demo-web/src/App.tsx`, `demo-web/public/data/ais-playback.json`, `demo-web/public/data/flow-forecast.json`
- Impact: If a new dataset drops a field or introduces structural change, the dashboard crashes before reporting a useful error.
- Fix approach: Add schema/shape validation (e.g., Zod or JSON Schema) before setting state so corrupted or evolving payloads fail fast with actionable errors or fallback defaults.

## Test Coverage Gaps

**Zero automated tests or `npm test` script:**
- What's not tested: The React UI (`demo-web/src/App.tsx`), the RouteEditor (`demo-web/src/RouteEditor.tsx`), and the clustering helpers (`demo-web/src/mainCorridorSelection.ts`) all lack unit/integration coverage.
- Files: `demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`, `demo-web/src/mainCorridorSelection.ts`, `package.json`
- Risk: Any refactor can easily introduce regressions because there are no automated guards and there is no `npm` script that exercises the core logic.
- Priority: High
- Suggested action: Add a lightweight test runner (Vitest/Jest) with stories for the data selection logic, geometry math, and key React components and tie it to CI so regressions are caught early.
