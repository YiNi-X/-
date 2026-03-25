# Phase 4: Data Pipeline Hardening - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 hardens the offline Python workflow that regenerates website-facing demo payloads from archived local source artifacts. The scope is the engineering path from local research or cleaned inputs through `demo-web/scripts/` to stable outputs in `demo-web/public/data/` and `demo-web/analysis/`.

This phase is about reproducibility, configuration, and fail-fast behavior. It does not add new modeling capability, retrain models, or expand the product surface.

</domain>

<decisions>
## Implementation Decisions

### Supported pipeline entrypoints
- Treat `demo-web/scripts/generate_first_version_data.py` and `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` as the supported product regeneration entrypoints.
- Treat notebooks and ad hoc files under `代码依据/` as provenance inputs or references, not as the documented execution interface contributors are expected to run directly.
- Phase 4 should document both:
  - one full regeneration path for contributors who want to rebuild official outputs end to end
  - stage-specific commands for corridor extraction versus dashboard payload generation

### Input boundary and source resolution
- Required raw and intermediate inputs must be declared explicitly enough that a contributor can tell what the pipeline depends on before running it.
- Missing required assets should block immediately; the hardened pipeline should not quietly continue with partial results.
- Repo-wide `rglob` searching is acceptable only as a transitional compatibility layer if the script reports exactly what it resolved. The supported path should move toward explicit configured or CLI-provided inputs.
- Website runtime payloads must continue to come from archived AIS files, cleaned subsets, clustering outputs, and saved model weights that already exist locally; no live data assumptions are allowed.

### Configuration boundary
- Centralize thresholds, key source paths, demo window settings, cluster parameters, and output targets in one versioned configuration surface instead of scattering them across script-level constants.
- Keep stable defaults for the official demo build, but allow CLI overrides for operational values when regeneration needs a different local path or threshold.
- The official website-facing output names and locations should remain stable by default so the frontend does not need to change.

### Failure and overwrite policy
- Fail fast with actionable error messages whenever required files, model artifacts, or derived inputs are missing or malformed.
- Error messages should identify:
  - what asset is missing or invalid
  - what path or lookup rule was attempted
  - how the contributor can provide or override the expected input
- Do not silently overwrite website runtime payloads during a partially failed run.
- Prefer a flow where scripts validate inputs first, then write outputs only after the generation step is coherent enough to be trusted.

### Output ownership and provenance
- `demo-web/public/data/` remains the official website runtime output target.
- `demo-web/analysis/` remains the analysis and inspection artifact target.
- The pipeline should make it clear which outputs are website-facing runtime artifacts versus research or diagnostic artifacts.
- The corridor extraction adapter remains the bridge between clustering provenance and RouteEditor-ready `main-corridor-tracks.json`; the website should not depend directly on notebook-native structures.

### Claude's Discretion
- Exact config file format and helper-module layout
- Whether transitional path auto-discovery remains as a fallback or is removed immediately
- Whether to introduce a top-level wrapper script or document the stage-specific Python commands directly
- Exact logging format, as long as it stays concise and actionable

</decisions>

<specifics>
## Specific Ideas

- Current code-level issues that Phase 4 should address directly:
  - `demo-web/scripts/generate_first_version_data.py` currently mixes many hardcoded thresholds, repo-wide path discovery, and direct writes into `public/data/`.
  - `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` already has a richer CLI, but still bakes important defaults into script constants and repo search behavior.
  - The STGCN runtime helper is product code, but the notebooks in `代码依据/流量预测/` are provenance rather than the contributor-facing execution path.
  - The corridor workflow currently mixes analysis outputs and RouteEditor runtime output in one run; Phase 4 should make that contract easier to understand.
- The user explicitly wanted this phase framed around code and implementation quality, not abstract data discussion.

</specifics>

<deferred>
## Deferred Ideas

- Retraining or replacing the STGCN model
- Adding live AIS ingestion or backend services
- Expanding the demo to support new scenario-management features beyond regeneration and hardening

</deferred>

---

*Phase: 04-data-pipeline-hardening*
*Context gathered: 2026-03-23*
