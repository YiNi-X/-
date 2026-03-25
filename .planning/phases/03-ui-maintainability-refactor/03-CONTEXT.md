# Phase 3: UI Maintainability Refactor - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning and execution

<domain>
## Phase Boundary

Phase 3 reduces the change risk inside the two largest frontend entry surfaces: `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx`.
The goal is to move runtime loading, derived state, editing behavior, and stage interaction into focused modules or hooks without changing the shipped offline demo behavior.
This phase does not redesign the UI, replace the runtime contract boundary from Phase 2, or introduce new product scope.

</domain>

<decisions>
## Implementation Decisions

### Dashboard seam strategy
- Keep `App.tsx` as the composition shell for the dashboard surface.
- Extract runtime loading and dataset-selection behavior into a dedicated dashboard hook.
- Extract heavy scene derivation, playback shaping, and presentation-ready computed state into a second focused dashboard module so future work can change dashboard behavior without reopening one monolith.

### RouteEditor seam strategy
- Keep `RouteEditor.tsx` as the composition shell for the editor surface.
- Extract corridor loading, selection, export, and point-editing behavior into a workspace hook.
- Extract pan/zoom, cursor, canvas/map asset controls, and layer transform behavior into a separate stage hook so interaction changes stay isolated from sidebar markup.

### Shared maintainability boundary
- Preserve the Phase 2 runtime loader and schema boundary as the only place that validates shipped JSON payloads.
- Prefer focused feature modules over one giant shared abstraction; the main maintainability gain here is clear boundaries between runtime orchestration, interaction logic, and JSX presentation.
- Keep behavior stable: existing fallback screens, controls, and exports should continue to work after the refactor.

### Claude's Discretion
- Exact folder structure under `demo-web/src/` for the extracted modules.
- Whether loading or unavailable fallback views should also move into small presentational components.
- Which utility functions should remain feature-local versus become shared helpers.

</decisions>

<specifics>
## Specific Ideas

- Dashboard candidates for extraction already visible in the current code:
  - dataset catalog plus geometry/forecast/playback loading effects
  - playback scene and hotspot derivation
  - chart and geometry helpers
  - runtime unavailable status shell
- RouteEditor candidates for extraction already visible in the current code:
  - corridor loading and selected-object derivation
  - export payload generation and reset behavior
  - stage pointer pan/zoom logic
  - canvas and satellite image layer state
- The refactor should leave both entry files easier to scan even if some JSX remains in place for this milestone.

</specifics>

<deferred>
## Deferred Ideas

- Automated component tests for the refactor belong to Phase 5.
- Any major visual redesign or information architecture rewrite remains out of scope for this maintainability phase.
- Reworking Python data-generation scripts remains Phase 4 work.

</deferred>

---

*Phase: 03-ui-maintainability-refactor*
*Context gathered: 2026-03-23*
