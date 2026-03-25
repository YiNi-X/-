---
phase: 02-runtime-data-contracts
plan: 03
subsystem: ui
tags: [react, route-editor, runtime-validation, unavailable-state]
requires:
  - phase: 02-runtime-data-contracts
    provides: shared schema-backed runtime loader boundary
provides:
  - RouteEditor loading through validated corridor payloads only
  - Direct editor unavailable surface for invalid corridor data
  - Stale editor selection/export state clearing on contract failure
affects: [route-editor, exports, corridor-editing]
tech-stack:
  added: []
  patterns: [validated editor bootstrap, direct unavailable state, state clearing on invalid corridor payloads]
key-files:
  created: []
  modified: [demo-web/src/RouteEditor.tsx, demo-web/src/route-editor.css]
key-decisions:
  - "Accepted only curated `main-corridor-tracks.json` payloads at the editor boundary."
  - "Disabled the editor workspace entirely when corridor data is unavailable instead of leaving partial editing controls on screen."
  - "Cleared track, selection, and copy status state together on loader failure."
patterns-established:
  - "RouteEditor should never synthesize fallback geometry when the curated corridor payload is broken."
  - "Export surfaces must derive only from validated editor state."
requirements-completed: [DATA-04, DATA-05]
duration: 8min
completed: 2026-03-23
---

# Phase 2 Plan 03 Summary

**RouteEditor now boots only from validated curated corridor data and presents a direct unavailable workspace instead of a half-editable screen when the payload is broken.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T17:18:00+08:00
- **Completed:** 2026-03-23T17:26:00+08:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced unchecked `main-corridor-tracks.json` loading with the shared validated corridor loader.
- Cleared loaded tracks, selection handles, and copy status when runtime corridor validation fails.
- Added a direct product-style unavailable/loading workspace so the editor no longer looks partially usable when required data is broken.

## Task Commits

No atomic task commits were created during this in-session execution. Changes were verified locally before phase closeout.

## Files Created/Modified

- `demo-web/src/RouteEditor.tsx` - RouteEditor now validates corridor payloads before populating editable state and blocks the workspace on failure
- `demo-web/src/route-editor.css` - Added status workspace styling for loading and unavailable RouteEditor states

## Decisions Made

- Kept the editor contract centered on curated corridor payloads only and did not add fallback conversions from research artifacts.
- Treated editor export capability as invalid whenever the corridor payload itself is invalid.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RouteEditor no longer mixes broken data with editable controls, which lowers the risk of future refactors around interaction logic and export behavior.
- Both frontend entry points now share the same runtime contract posture going into Phase 3.

---
*Phase: 02-runtime-data-contracts*
*Completed: 2026-03-23*

