# Phase 6: Data Completion and Lineage - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 completes the website-facing offline data layer before new module UI work continues. The goal is to identify authoritative inputs, fill or normalize the missing website bundles that can be reproduced locally, document lineage for every shipped artifact, and verify that those artifacts are structurally valid and visually plausible for the archived demo.

This phase does not promise full recovery of every research-stage output. If an artifact is not stable to regenerate in the current environment and is not a hard prerequisite for the next website modules, it can be explicitly deferred.

</domain>

<decisions>
## Implementation Decisions

### Authoritative data sources
- Every website-facing artifact must include lineage metadata. The manifest must at least record: `artifactId`, `module`, `sourceStage`, `derivedFrom`, `scenarioId`, `timeRange`, and `authoritativeFor`.
- Clustering must keep a layered source model instead of collapsing onto one file:
- `raw`: `cleaned_ais.CSV`
- `segmented`: `segments(60-90).pkl`
- `compressed`: `compressed_segments(60,90,0.03).pkl`
- `corridor/exported`: `main-corridor-tracks.json`
- `compressed_segments(60,90,0.03).pkl` is the authoritative middle layer for corridor extraction and compressed-trajectory display, but not the only truth for the clustering module.
- Do not overwrite the current `main-corridor-tracks.json` until review outputs are accepted. Review-first outputs should go to a separate review path.
- Flow prediction keeps research inputs (`grid_mmsi_count*.csv`, matrix files, model scripts, weights) as the upstream source of truth, while the website only consumes a new exported forecast bundle.
- Trajectory repair keeps the current research-side CSV, PKL, notebook, and HTML artifacts as upstream evidence, while the website only consumes a new structured repair bundle.
- Evaluation center must aggregate only from the exported module bundles, not directly from scattered research metrics files.
- Project overview must aggregate only from module bundles and bundle-level summaries, not directly from raw research files.

### Bundle shape and packaging
- Each module should ship as one module package directory rather than one giant standalone JSON file.
- Each module package directory should contain one manifest plus the supporting runtime files for that module.
- Module packages should include only website runtime data. Manual review images and other human-audit artifacts stay outside the runtime package in dedicated review outputs.
- File naming should use stable directory locations and stable file names rather than encoding versions into every file name. Scenario and version information should live inside metadata fields.
- Externally, each module is treated as one package. Internally, packages may split by `samples`, `models`, `horizons`, or similar nodes where needed.

### Deferred capability policy
- The following are explicitly allowed to remain deferred after Phase 6 if they are not stable to regenerate and validate locally:
- Noise re-clustering artifacts
- Complete collaborative-decision data packages
- Any research-grade artifact that depends on special environments and cannot be reproducibly rebuilt in the short term
- Deferred capabilities should still be visible as future-facing module surface area later, but clearly labeled as "该能力将在后续版本补全".
- If a module has enough foundational data for the main story, it should proceed to the next phase even when advanced layers remain deferred.
- Deferred items must be documented with name, missing reason, and later dependency chain.

### Verification and handoff evidence
- Phase 6 must produce one global inventory table plus module-specific appendix tables.
- Phase 6 must produce lineage manifests for the shipped website-facing artifacts.
- Phase 6 must produce manual review images at minimum for:
- flow prediction: 1 image
- trajectory repair: 1-2 images
- trajectory clustering: 2 images covering compressed and corridor views
- Evaluation center and overview do not require manual review images in this phase.
- Every shipped bundle should pass automated structural validation, even if the first version is only a basic schema check.
- Phase 6 evidence should record rerun time for regenerated artifacts.

### Claude's Discretion
- Exact file and folder names inside each module package, as long as they follow the locked packaging rules above
- Exact schema breakdown beyond the required lineage fields
- The implementation details of structural validation and review-image generation
- How to format the global inventory table and module appendix tables

</decisions>

<specifics>
## Specific Ideas

- The clustering module should tell a layered provenance story instead of pretending that one exported file is the whole pipeline.
- `compressed_segments(60,90,0.03).pkl` is a strong core input for corridor extraction and compressed-trajectory presentation, but the module should still preserve raw and segmented provenance.
- Data completion comes before frontend contract design, and frontend contract design comes before module UI work.

</specifics>

<deferred>
## Deferred Ideas

- Noise re-clustering visuals and supporting artifacts if they cannot be regenerated reliably
- Full collaborative-decision evidence packages and strategy data until later phases
- Any research-only outputs that require special environments and do not block the main website showcase

</deferred>

---

*Phase: 06-data-completion-and-lineage*
*Context gathered: 2026-03-25*
