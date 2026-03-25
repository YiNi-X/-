---
phase: 02-runtime-data-contracts
plan: 02
subsystem: ui
tags: [react, dashboard, runtime-validation, unavailable-state]
requires:
  - phase: 02-runtime-data-contracts
    provides: shared schema-backed runtime loader boundary
provides:
  - Dashboard data loading through validated runtime loaders
  - Direct dashboard unavailable surface for broken required data
  - Stale dashboard state clearing on runtime contract failures
affects: [dashboard, app-shell, runtime-error-handling]
tech-stack:
  added: []
  patterns: [validated loader integration in effects, product-style unavailable state, loading-before-render guard]
key-files:
  created: []
  modified: [demo-web/src/App.tsx, demo-web/src/App.css]
key-decisions:
  - "Blocked dashboard rendering until catalog, geometry, playback, and forecast payloads validate."
  - "Used a product-style unavailable workspace instead of a warning banner buried inside a partially live UI."
  - "Cleared playback and forecast state before replacing datasets so invalid payloads cannot leave stale scenes behind."
patterns-established:
  - "Dashboard entry points should treat runtime data as untrusted until validated."
  - "Unavailable states should be explicit and should not pretend the app is live."
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-05]
duration: 16min
completed: 2026-03-23
---

# Phase 2 Plan 02 Summary

**The main dashboard now opens only from validated offline assets and switches to a direct unavailable workspace whenever required runtime data is missing or malformed.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-23T17:02:00+08:00
- **Completed:** 2026-03-23T17:18:00+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced unchecked dashboard fetches with the shared validated runtime loaders for dataset catalog, shared geometry, AIS playback, and flow forecast.
- Cleared stale playback and forecast state on dataset reloads and validation failures before any derived scene state can render.
- Added a direct product-style unavailable/loading workspace instead of relying on the old control-drawer warning line.

## Task Commits

No atomic task commits were created during this in-session execution. Changes were verified locally before phase closeout.

## Files Created/Modified

- `demo-web/src/App.tsx` - Dashboard data loading now runs through validated loader results and blocks on missing/invalid required data
- `demo-web/src/App.css` - Added status workspace styling for loading and unavailable dashboard states

## Decisions Made

- Treated dataset catalog failure as a hard dashboard blocker instead of silently using fallback shipped data.
- Kept the existing dashboard experience intact for valid offline data while adding a clean guardrail for invalid data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Adjusted dataset reload clearing to satisfy the React hook lint rule**
- **Found during:** Task 1 (validated loader integration)
- **Issue:** Clearing stale state synchronously at effect top-level triggered `react-hooks/set-state-in-effect`.
- **Fix:** Moved the reset-and-load flow into the async loader callback so the dashboard still clears stale data without violating the hook rule.
- **Files modified:** `demo-web/src/App.tsx`
- **Verification:** `npm run lint`, `npm run build`
- **Committed in:** Not committed separately

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Preserved the planned stale-state protection while keeping lint clean. No scope creep.

## Issues Encountered

- The new loader boundary initially conflicted with the React effect lint rule when stale state was cleared synchronously. This was resolved by moving the clearing logic into the async load path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard runtime data is now honest and fail-safe, which clears the way for later maintainability refactors without reopening the data-safety problem.
- Product-style status surfaces now define the tone to match when future phases add more explicit readiness states.

---
*Phase: 02-runtime-data-contracts*
*Completed: 2026-03-23*

