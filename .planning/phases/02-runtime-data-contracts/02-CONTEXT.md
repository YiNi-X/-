# Phase 2: Runtime Data Contracts - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning and execution

<domain>
## Phase Boundary

Phase 2 adds schema validation and fail-safe runtime handling around the shipped JSON datasets used by the dashboard and RouteEditor. This phase protects the website-facing payload boundary for archived AIS playback, offline forecast output, and curated main corridor data. It does not expose or validate raw notebook-style research artifacts directly in the UI.

</domain>

<decisions>
## Implementation Decisions

### Runtime failure behavior
- Invalid runtime data should fail directly rather than partially limping through the UI.
- Missing or malformed required data should surface a direct `data unavailable` style message.
- Error handling should feel like a normal software product surface that happens to support demos, not an explicit `demo mode`.

### Corridor and clustering strategy
- The upstream trajectory-clustering workflow in `代码依据/轨迹聚类` is methodology provenance, not the primary website contract.
- `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` is the adapter that converts clustering artifacts into curated website-facing main corridor payloads.
- The main UI and RouteEditor should treat curated main corridors as the primary entity, not raw trajectory clusters.
- Runtime contracts in this phase should therefore validate `main-corridor-tracks.json` as a product payload, not attempt to mirror the full research notebook data shape.

### Claude's Discretion
- Exact schema tooling choice and how it integrates into the current React code.
- Exact copy for `data unavailable` fallback states.
- Whether optional display or narrative fields should be defaulted at load time versus filled by generation scripts.

</decisions>

<specifics>
## Specific Ideas

- The contract boundary should cover at least dataset catalog, AIS playback, flow forecast, shared geometry, and main corridor track payloads.
- Structural fields required for rendering or interaction should be treated as mandatory.
- Research metadata may be preserved in analysis files without becoming a runtime requirement for the UI.

</specifics>

<deferred>
## Deferred Ideas

- Final policy for which non-structural narrative or display fields may be optional can be settled during detailed Phase 2 planning.
- Surfacing raw clustering outputs in a dedicated explanation or methodology view belongs to later presentation work, not this safety phase.

</deferred>

---

*Phase: 02-runtime-data-contracts*
*Context gathered: 2026-03-23*
