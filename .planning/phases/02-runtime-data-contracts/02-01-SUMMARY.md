---
phase: 02-runtime-data-contracts
plan: 01
subsystem: ui
tags: [react, runtime-validation, zod, data-contracts, smoke-tests]
requires:
  - phase: 01-baseline-quality-gate
    provides: repeatable lint-test-build baseline for the offline demo
provides:
  - Shared runtime schemas for shipped JSON payloads
  - Structured runtime loader boundary with contract-aware failure results
  - Smoke coverage aligned with committed dashboard and RouteEditor assets
affects: [dashboard, route-editor, runtime-loading, testing]
tech-stack:
  added: [zod]
  patterns: [shared runtime schema boundary, structured loader result objects, contract-focused smoke coverage]
key-files:
  created: [demo-web/src/runtimeSchemas.ts, demo-web/src/runtimeData.ts]
  modified: [demo-web/package.json, demo-web/package-lock.json, demo-web/src/datasetCatalog.ts, demo-web/tests/smoke.test.mjs]
key-decisions:
  - "Validated website-facing runtime payloads only; raw research clustering artifacts remain outside the UI contract."
  - "Kept runtime validation separate from React presentation logic by returning structured success/failure results."
  - "Stopped malformed dataset catalog payloads from silently falling back to the default catalog."
patterns-established:
  - "All shipped runtime JSON should enter the UI through schema-backed loader helpers."
  - "Smoke tests should reflect the same structural contract surface the runtime loader depends on."
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]
duration: 22min
completed: 2026-03-23
---

# Phase 2 Plan 01 Summary

**Zod-backed runtime schemas and loader helpers now validate every shipped dashboard and RouteEditor JSON payload before typed data reaches React state.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-23T16:40:00+08:00
- **Completed:** 2026-03-23T17:02:00+08:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `zod` and created shared schemas for dataset catalog, shared geometry, AIS playback, flow forecast, and curated corridor payloads.
- Added `runtimeData.ts` so loaders return structured success/failure results with resource kind, path, and contract detail.
- Expanded smoke coverage so committed offline assets are checked against the structural surface the app now depends on.

## Task Commits

No atomic task commits were created during this in-session execution. Changes were verified locally before phase closeout.

## Files Created/Modified

- `demo-web/src/runtimeSchemas.ts` - Schema definitions and parse helpers for shipped runtime payloads
- `demo-web/src/runtimeData.ts` - Shared loader boundary, path resolution helpers, and structured runtime failure formatting
- `demo-web/src/datasetCatalog.ts` - Catalog loading now uses the shared contract boundary without silent fallback
- `demo-web/tests/smoke.test.mjs` - Smoke checks now assert key structural fields for committed runtime assets
- `demo-web/package.json` - Added `zod`
- `demo-web/package-lock.json` - Locked dependency update for `zod`

## Decisions Made

- Used strict contract validation for website payloads and kept research-source compatibility out of Phase 2 scope.
- Preserved dataset selection helpers while moving catalog validation to the shared boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Preserved the old `loadDatasetCatalog()` signature temporarily**
- **Found during:** Task 2 (loader boundary integration)
- **Issue:** `App.tsx` still depended on the old promise-of-catalog signature, which broke `build` midway through Wave 1.
- **Fix:** Added `loadDatasetCatalogResult()` for the new structured boundary and kept `loadDatasetCatalog()` as a throwing compatibility wrapper until Wave 2 migrated the dashboard.
- **Files modified:** `demo-web/src/datasetCatalog.ts`
- **Verification:** `npm run lint`, `npm run test`, `npm run build`
- **Committed in:** Not committed separately

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Kept Wave 1 buildable without weakening the new contract boundary and enabled the planned Wave 2 migration cleanly.

## Issues Encountered

- The dashboard still expected the old catalog loader return type when the shared result object landed. This was resolved with a temporary compatibility wrapper that Wave 2 then replaced at the call site.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard and RouteEditor can now migrate to shared validated loaders without inventing their own fetch or parse logic.
- Smoke coverage now guards the committed offline demo asset surface for future phases.

---
*Phase: 02-runtime-data-contracts*
*Completed: 2026-03-23*

