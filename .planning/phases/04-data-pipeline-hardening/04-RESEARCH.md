# Phase 4: Data Pipeline Hardening - Research

**Researched:** 2026-03-23
**Goal:** Plan code-first hardening work for the offline Python regeneration path that turns archived local assets into website-facing runtime payloads.

## Current Pipeline Topology

### Supported entrypoints

The repo already has two clear Python entrypoints under `demo-web/scripts/`:

1. `extract_main_corridors_from_clustered_ais.py`
   - Consumes archived clustering artifacts from `代码依据/轨迹聚类/`
   - Produces analysis outputs in `demo-web/analysis/`
   - Produces website runtime corridor payload at `demo-web/public/data/main-corridor-tracks.json`

2. `generate_first_version_data.py`
   - Consumes archived AIS, flow, graph, and model assets from `代码依据/轨迹聚类/` and `代码依据/流量预测/`
   - Consumes website geometry from `demo-web/public/data/shared-geometry.json`
   - Produces website runtime outputs in `demo-web/public/data/`

`stgcn_runtime.py` is a helper module used by the runtime-data generator, not a contributor-facing command surface.

### Asset flow

#### Corridor extraction chain

- Primary archived inputs:
  - `代码依据/轨迹聚类/compressed_segments(60,90,0.03).pkl`
  - `代码依据/轨迹聚类/output_figs/聚类前轨迹 .png`
- Current outputs:
  - `demo-web/analysis/senior_main_corridors_cleaned_points.csv`
  - `demo-web/analysis/senior_main_corridors_track_stats.csv`
  - `demo-web/analysis/senior_main_corridors_summary.json`
  - `demo-web/analysis/senior_main_corridors_comparison.png`
  - `demo-web/public/data/main-corridor-tracks.json`

#### Demo runtime generation chain

- Primary archived inputs:
  - `代码依据/轨迹聚类/cleaned_ais.CSV`
  - `代码依据/流量预测/grid_mmsi_count（流量数据）.csv`
  - `代码依据/流量预测/相关性矩阵0.csv`
  - `代码依据/流量预测/save/model_0.pt`
- Website-owned input:
  - `demo-web/public/data/shared-geometry.json`
- Current outputs:
  - `demo-web/public/data/demo-live-ais-*.csv`
  - `demo-web/public/data/ais-playback.json`
  - `demo-web/public/data/flow-forecast.json`
  - `demo-web/public/data/model-config.json`

## Current Code Risks

### 1. Hidden path resolution

- `generate_first_version_data.py` uses broad repo search helpers (`resolve_path`, `resolve_flow_data_path`) that silently choose the first match.
- `extract_main_corridors_from_clustered_ais.py` has a better CLI, but its defaults still come from `find_first_path()` and implicit repo-wide discovery.
- If multiple similar files appear later, contributors will not know which asset was actually consumed unless they inspect the code.

### 2. Scattered configuration and magic values

- Generation defaults such as demo window, thresholds, output names, and model settings are embedded as script-level constants.
- Extraction defaults such as clustering thresholds, quality-filter ratios, and default outputs are spread across argparse defaults and top-level constants.
- There is no single versioned surface that answers, "what are the official pipeline defaults for this demo?"

### 3. Inconsistent failure behavior

- Current failure modes include `FileNotFoundError`, `KeyError`, `ValueError`, and library exceptions, but the user-facing messages are inconsistent.
- Missing assets are usually detected only when the specific step touches them, not up front before output mutation starts.
- The current scripts do not make it obvious which override flag or config field a contributor should use to fix a missing-path problem.

### 4. Partial-write risk

- `generate_first_version_data.py` writes directly into `demo-web/public/data/` during execution.
- `extract_main_corridors_from_clustered_ais.py` writes analysis outputs and runtime corridor output in the same run.
- If a run fails after some writes succeed, the repo can be left in a mixed state that looks "fresh" but is only partially regenerated.

### 5. Documentation gap

- The repo documents the website runtime baseline, but not a contributor-facing Python pipeline setup.
- There is no checked-in Python dependency manifest for the supported regeneration flow.
- Notebooks under `代码依据/` exist as provenance, but today there is no strong doc boundary telling contributors they are reference material rather than the supported interface.

## Recommended Implementation Seams

### A. Shared pipeline config module

Create one shared Python module for:

- official relative input paths
- official runtime and analysis output targets
- stable defaults for thresholds and demo window values
- path-resolution and validation helpers
- concise resolution logging for any compatibility fallback

The most practical shape here is a checked-in Python module with dataclasses or typed dictionaries, so the scripts can import defaults without adding YAML or TOML dependencies.

### B. Consistent CLI surface on both scripts

`extract_main_corridors_from_clustered_ais.py` already uses `argparse`; keep that and route its defaults through the shared config module.

`generate_first_version_data.py` should gain a matching `argparse` surface so contributors can:

- inspect supported inputs with `--help`
- override paths explicitly
- run validation or dry-run mode before mutating outputs

### C. Validation-first execution

Both scripts should:

1. resolve all required inputs
2. validate shape and presence up front
3. print or log the resolved paths and target outputs
4. only then start generation
5. write final outputs after the run is coherent enough to trust

### D. Staged writes for official outputs

For website-facing assets in `demo-web/public/data/`, prefer temporary files plus a final replace step after successful generation. Analysis outputs can still be regenerated in-place, but the runtime output contract should not be overwritten mid-failure.

### E. Explicit provenance language

Documentation and any verification helper should clearly distinguish:

- archived provenance assets in `代码依据/`
- diagnostic outputs in `demo-web/analysis/`
- official website runtime assets in `demo-web/public/data/`

## Planning Guidance

### Best execution order

Even though the roadmap labels are `04-01`, `04-02`, and `04-03`, the safest execution order is:

1. `04-02` harden the code surface first
2. `04-01` document the hardened commands and environment
3. `04-03` regenerate, compare, and update provenance notes

Reason: if docs are written before the CLI and config surface are stabilized, they will immediately need rework.

### Good phase split

- `04-02` should own shared config, path resolution, dry-run or validation mode, and safe output handling.
- `04-01` should own the contributor guide, Python dependency manifest, and exact supported commands.
- `04-03` should own end-to-end regeneration verification and any committed output/provenance updates that follow from the new workflow.

## Validation Architecture

Phase 4 should verify the hardened pipeline at three levels:

### 1. Interface validation

- `python demo-web/scripts/extract_main_corridors_from_clustered_ais.py --help`
- `python demo-web/scripts/generate_first_version_data.py --help`
- `python -m compileall demo-web/scripts`

This proves both supported entrypoints are importable and contributor-discoverable.

### 2. Preflight validation

After hardening, both scripts should support a non-destructive validation path such as `--dry-run` or `--check` that:

- resolves inputs
- confirms required files exist
- reports target outputs
- exits before writing

This is the safest way to verify configuration and asset availability on a new machine.

### 3. Regeneration verification

The phase should finish with one repeatable command path that:

- regenerates corridor outputs from archived clustering artifacts
- regenerates runtime demo data from archived AIS, graph, and model assets
- checks the resulting payloads against stable demo expectations

The comparison should focus on stable contract signals such as:

- required files exist
- metadata references the expected sources
- corridor counts, route IDs, horizons, and study-area fields remain coherent
- runtime outputs remain clearly separated from analysis artifacts

## Planning Risks To Watch

- Avoid introducing a new dependency-heavy configuration format when a shared Python module is enough.
- Avoid hard-deleting repo-wide fallback search without a migration path unless explicit paths are already easy to provide.
- Keep `public/data/` output filenames stable by default so Phase 4 does not force frontend changes.
- Keep notebooks and research code out of the supported execution story, but preserve their provenance role in docs.

## Recommendation

Plan Phase 4 around one shared Python pipeline boundary, then use that boundary to document and verify the full offline regeneration flow from archived assets to committed website outputs.

---

*Phase: 04-data-pipeline-hardening*
*Research completed: 2026-03-23*
