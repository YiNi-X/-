# Phase 6: Data Completion and Lineage - Research

**Researched:** 2026-03-25
**Domain:** Offline artifact auditing, lineage control, bundle export, and runtime data validation for the archived AIS showcase
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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
- Each module should ship as one module package directory rather than one giant standalone JSON file.
- Each module package directory should contain one manifest plus the supporting runtime files for that module.
- Module packages should include only website runtime data. Manual review images and other human-audit artifacts stay outside the runtime package in dedicated review outputs.
- File naming should use stable directory locations and stable file names rather than encoding versions into every file name. Scenario and version information should live inside metadata fields.
- Externally, each module is treated as one package. Internally, packages may split by `samples`, `models`, `horizons`, or similar nodes where needed.
- The following are explicitly allowed to remain deferred after Phase 6 if they are not stable to regenerate and validate locally:
- Noise re-clustering artifacts
- Complete collaborative-decision data packages
- Any research-grade artifact that depends on special environments and cannot be reproducibly rebuilt in the short term
- Deferred capabilities should still be visible as future-facing module surface area later, but clearly labeled as "该能力将在后续版本补全".
- If a module has enough foundational data for the main story, it should proceed to the next phase even when advanced layers remain deferred.
- Deferred items must be documented with name, missing reason, and later dependency chain.
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

### Deferred Ideas (OUT OF SCOPE)
- Noise re-clustering visuals and supporting artifacts if they cannot be regenerated reliably
- Full collaborative-decision evidence packages and strategy data until later phases
- Any research-only outputs that require special environments and do not block the main website showcase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BASE-02 | Website loads module data from committed static artifacts derived from archived local research outputs instead of requiring a live backend or online inference | Use committed module package directories under `demo-web/public/data/modules/`, generated offline from `代码依据` and existing cleaned outputs. |
| BASE-05 | Team can regenerate website-facing showcase artifacts from `代码依据` and existing cleaned outputs through one documented offline pipeline | Keep generation in Python scripts under `demo-web/scripts/`, reuse current data exporters, and add one documented manifest-driven export surface instead of notebook-only steps. |
| BASE-06 | Team can run one repeatable verification flow that checks buildability and critical module data contracts before demoing the site | Reuse the existing Zod runtime validation pattern in `demo-web/src/runtimeData.ts` and `demo-web/src/runtimeSchemas.ts`, then add Phase 6-specific bundle verification plus manual review images. |
</phase_requirements>

## Summary

Phase 6 should extend the repo's existing "offline, committed, validated runtime data" pattern instead of inventing a new platform. The current website already proves three important seams: Python export scripts exist under `demo-web/scripts/`, committed runtime JSON exists under `demo-web/public/data/`, and the frontend already validates runtime contracts with Zod through `demo-web/src/runtimeData.ts` and `demo-web/src/runtimeSchemas.ts`. The right planning posture is therefore audit first, then export missing module bundles, then verify those bundles with both schema checks and human review artifacts.

The strongest existing sources are uneven by module. Flow prediction has structured CSV inputs, graph matrices, Python support code, and model weights. Trajectory repair has abundant sample CSVs plus PKL and HTML outputs, but they are not packaged for website consumption. Trajectory clustering has the best provenance for raw, segmented, and compressed layers, plus a current exported corridor file used by the site, but its research-only `normalized_distances(60,90,0.03).pkl` is zero bytes and the notebook-era clustering labels are not preserved as a reliable website input. That means Phase 6 should treat clustering corridor extraction as recoverable, while noise re-clustering remains explicitly deferrable.

**Primary recommendation:** Plan Phase 6 as a three-step chain: 1) audit and document authoritative sources and gaps, 2) export the minimum website-facing module bundles plus lineage manifests from those authoritative inputs, 3) add a repeatable verification flow with schema checks, rerun-time notes, deferred-item tracking, and manual review images.

## Standard Stack

### Core
| Library / Surface | Version / State | Purpose | Why Standard |
|-------------------|-----------------|---------|--------------|
| Python export scripts in `demo-web/scripts/` | Existing repo surface | Offline regeneration of website-facing artifacts | The repo already uses Python as the bridge from archived research assets to committed runtime data. |
| Static JSON artifacts in `demo-web/public/data/` | Existing repo surface | Website runtime data delivery | This matches `BASE-02` and the project's offline-demo deployment model. |
| Zod runtime validation in `demo-web/src/runtimeSchemas.ts` | Existing repo surface | Structural validation of loaded runtime artifacts | The frontend already uses this boundary successfully for shipped dashboard and RouteEditor data. |
| Phase docs in `.planning/phases/06-data-completion-and-lineage/` | Existing repo surface | Audit, lineage, rerun-time, and deferred-item evidence | Phase 6 is as much about trustworthy evidence as it is about data export. |

### Supporting
| Library / Surface | Purpose | When to Use |
|-------------------|---------|-------------|
| `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` | Corridor and clustering-derived export | Use for corridor-facing clustering outputs and comparison analysis. |
| `demo-web/scripts/generate_first_version_data.py` | Existing runtime generation path | Use as a pattern for offline bundle generation and preflight validation. |
| `demo-web/src/runtimeData.ts` | Validated resource loading | Reuse for contract validation design and error-shaping expectations. |
| `demo-web/src/datasetCatalog.ts` | Catalog-driven runtime loading | Use as reference for how future module manifests should point to runtime resources. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Committed static bundle export | Live backend + on-demand inference | Conflicts with milestone scope and weakens reproducibility for demos. |
| Layered clustering lineage | Flatten everything into `main-corridor-tracks.json` | Faster short term, but loses provenance and makes future clustering UI misleading. |
| Module package directories | One giant all-module JSON | Easier initial export, but hurts lazy loading and module isolation for Phase 7. |

## Architecture Patterns

### Recommended Project Structure
```text
.planning/phases/06-data-completion-and-lineage/
  06-ASSET-INVENTORY.md
  06-LINEAGE-MATRIX.md
  06-RERUN-TIMES.md
  06-DEFERRED-ITEMS.md

demo-web/scripts/
  export_phase6_*.py
  verify_phase6_bundles.py

demo-web/public/data/modules/
  forecast/
  repair/
  clustering/
  evaluation/
  overview/
```

### Pattern 1: Audit before export
**What:** First produce a module-by-module inventory of existing sources, missing outputs, regeneration path, and risk.  
**When to use:** Before writing any exporter or manifest logic for Phase 6.  
**Why:** The repo currently mixes research assets, analysis artifacts, and runtime payloads. Planning without a written audit will cause lineage drift.

### Pattern 2: Authoritative-input to exported-bundle pipeline
**What:** Export website bundles from named authoritative inputs rather than from ad hoc analysis leftovers.  
**When to use:** For forecast, repair, clustering, evaluation, and overview package generation.  
**Why:** `BASE-05` requires a documented regeneration path from `代码依据` and cleaned outputs, not from notebook state.

### Pattern 3: Review-first replacement for corridor-sensitive outputs
**What:** Write regenerated corridor-like outputs to review paths first, compare visually, then replace official runtime outputs only after review acceptance.  
**When to use:** Any clustering-derived export that could affect `main-corridor-tracks.json` or future route entities.  
**Why:** The current site already depends on `main-corridor-tracks.json`; accidental overwrite is riskier than staged acceptance.

### Pattern 4: Contract validation at bundle boundaries
**What:** Validate exported JSON structure before declaring the bundle usable.  
**When to use:** Every module package created in Phase 6.  
**Why:** The frontend already has a contract-validation pattern; Phase 6 should extend it so Phase 7 can consume trustworthy inputs.

### Anti-Patterns to Avoid
- **Notebook-as-product-pipeline:** Do not make notebooks the official generation path.
- **Stage mixing:** Do not let evaluation or overview read directly from raw research files once module bundles exist.
- **Implicit overwrite:** Do not replace official runtime exports before review if the artifact feeds current website behavior.
- **All-or-nothing recovery:** Do not block the whole phase on noise re-clustering or special-environment-only outputs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime artifact validation | Custom ad hoc JSON checks in each consumer | Extend the existing Zod validation pattern in `runtimeSchemas.ts` | The repo already has one contract boundary; duplicating validation logic increases drift. |
| Data lineage tracking | Spreadsheet-only provenance outside the repo | Checked-in markdown inventory plus machine-readable manifests | Phase 6 needs committed traceability, not private notes. |
| New backend for artifact serving | API server or database just for bundle delivery | Static files in `demo-web/public/data/modules/` | Backend work is out of scope and unnecessary for the offline demo. |
| One-file clustering truth | Custom flattening that discards stage provenance | Layered raw/segmented/compressed/corridor mapping | Clustering UI later needs provenance, not just one exported route layer. |

**Key insight:** The repo's best path is to formalize and extend what already exists: offline Python exporters, committed runtime files, and frontend contract validation. The main risk is not missing infrastructure; it is missing lineage discipline.

## Common Pitfalls

### Pitfall 1: Treating shipped runtime outputs as upstream truth
**What goes wrong:** The team edits or copies current runtime JSON without documenting where it came from.  
**Why it happens:** Existing runtime files are convenient and already in `public/data/`.  
**How to avoid:** Force every module export to record `derivedFrom`, `sourceStage`, and `authoritativeFor`, and keep a separate audit doc for upstream truth.  
**Warning signs:** A bundle can be explained only as "copied from the current site" rather than from a research or cleaned input.

### Pitfall 2: Mixing incompatible clustering layers
**What goes wrong:** The clustering UI later shows raw or segmented layers that do not match the corridor export lineage.  
**Why it happens:** `compressed_segments(60,90,0.03).pkl` is strong enough for corridor extraction, which tempts people to skip raw and segmented provenance.  
**How to avoid:** Preserve the layered model: raw, segmented, compressed, corridor/exported.  
**Warning signs:** The same corridor entity cannot be traced back to its source stage or scenario range.

### Pitfall 3: Blocking Phase 6 on research-only missing outputs
**What goes wrong:** The phase stalls trying to fully recover notebook-era clustering artifacts or collaborative-decision packages.  
**Why it happens:** Research completeness gets mistaken for website readiness.  
**How to avoid:** Mark unstable or special-environment outputs as deferred with name, reason, and dependency chain.  
**Warning signs:** Tasks start depending on `normalized_distances(60,90,0.03).pkl`, `cuML`, or undefined decision-optimization code before the main bundles exist.

### Pitfall 4: Skipping review artifacts because the JSON validates
**What goes wrong:** Structurally valid bundles still encode bad geography, poor sample selection, or incorrect corridor mapping.  
**Why it happens:** Schema validation catches shape, not plausibility.  
**How to avoid:** Require manual preview images for forecast, repair, and clustering as locked Phase 6 evidence.  
**Warning signs:** The bundle passes parsing but no one can visually sanity-check it against the expected story.

## Code Examples

Verified patterns from the current repo:

### Runtime contract validation boundary
```typescript
async function loadValidatedRuntimeJson<T>(config: RuntimeLoadConfig<T>): Promise<RuntimeLoadResult<T>> {
  const path = formatRuntimePath(config.resource)
  const requestUrl = resolveRuntimeResource(config.resource, config.baseHref)
  const response = await fetch(requestUrl)
  const payload: unknown = await response.json()
  return {
    ok: true,
    kind: config.kind,
    label: config.label,
    path,
    data: config.parser(payload),
  }
}
```
Source: `demo-web/src/runtimeData.ts`

### Existing schema-driven parser surface
```typescript
export function parseAisPlaybackData(value: unknown) {
  return aisPlaybackDataSchema.parse(value)
}

export function parseFlowForecastData(value: unknown) {
  return flowForecastDataSchema.parse(value)
}
```
Source: `demo-web/src/runtimeSchemas.ts`

### Current catalog-driven runtime selection pattern
```typescript
export function selectDatasetEntry(
  catalog: DatasetCatalog,
  requestedId: string | null | undefined,
  requiredAssets: DatasetAssetRequirement[] = ['ais', 'forecast'],
) {
  const eligibleDatasets = catalog.datasets.filter((entry) => hasRequiredAssets(entry, requiredAssets))
  if (!eligibleDatasets.length) return DEFAULT_DATASET_ENTRY
  return (
    eligibleDatasets.find((entry) => entry.id === safeRequestedId) ??
    eligibleDatasets.find((entry) => entry.id === catalog.defaultDatasetId) ??
    eligibleDatasets[0]
  )
}
```
Source: `demo-web/src/datasetCatalog.ts`

## State of the Art

| Old Approach | Current Repo-Fit Approach | Why It Changed | Impact |
|--------------|---------------------------|----------------|--------|
| One dense demo page with hardcoded or mixed data assumptions | Module-oriented static bundle export with validation boundaries | The project is moving from a single dashboard demo to a multi-module showcase | Phase 6 must establish bundle contracts before Phase 7 can build the shell cleanly |
| Notebook outputs as informal reference | Scripted export path from `代码依据` to committed runtime artifacts | The demo needs reproducibility and team handoff | Planning should favor scripts, manifests, and inventory docs over HTML-only research artifacts |
| Corridor output treated as one-off special file | Corridor output treated as one layer in a clustering lineage model | The site now needs clustering provenance, not just route rendering | `main-corridor-tracks.json` must remain connected to raw/segmented/compressed sources |

## Open Questions

1. **How much of the forecast multi-model export can be derived from current assets without rerunning notebooks?**
   - What we know: STGCN inputs, weights, and runtime forecast outputs exist; multiple notebook files for LSTM/BiLSTM also exist.
   - What's unclear: Whether the needed comparison outputs are already serialized in a reusable form or need fresh offline export.
   - Recommendation: Audit notebooks and weight expectations in 06-01, then choose between parser-style extraction and controlled rerun for missing model outputs.

2. **Can repair PKL and HTML artifacts be normalized without extra Python environment work?**
   - What we know: sample CSVs, prediction PKLs, metric PKLs, and HTML visualizations are present for three repair targets.
   - What's unclear: Whether all bundle-ready fields can be read with the current local Python environment or need optional dependencies.
   - Recommendation: Treat repair normalization as Phase 6 mainline work, but record any environment gaps if HTML/PKL extraction needs optional libraries.

3. **Will clustering need full notebook-era labels to ship Phase 10 later?**
   - What we know: raw, segmented, compressed, and corridor-exported layers exist; `normalized_distances(60,90,0.03).pkl` is currently zero bytes.
   - What's unclear: Whether later UI truly needs notebook-era cluster labels immediately, or can ship with the currently recoverable layers first.
   - Recommendation: Plan for a shippable foundational clustering bundle now and keep noise re-clustering explicitly deferred unless local recovery proves stable.

## Sources

### Primary (HIGH confidence)
- Local repo: `代码依据/流量预测/` - source CSVs, graph matrices, model helpers, weight file, and notebooks for forecast provenance
- Local repo: `代码依据/轨迹修复/` - sample CSVs, PKLs, HTML outputs, and notebooks for repair provenance
- Local repo: `代码依据/轨迹聚类/` - raw/segmented/compressed clustering artifacts and current missing-distance file state
- Local repo: `demo-web/public/data/` - current website runtime artifacts
- Local repo: `demo-web/scripts/` - current export and generation entrypoints
- Local repo: `demo-web/src/runtimeData.ts`, `demo-web/src/runtimeSchemas.ts`, `demo-web/src/datasetCatalog.ts` - existing validation and loading patterns

### Secondary (MEDIUM confidence)
- Prior Phase 4 planning documents in `.planning/phases/04-data-pipeline-hardening/` - useful precedent for script-first data hardening, but Phase 6 broadens scope beyond the original runtime pipeline

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - based on current repo code and shipped runtime boundaries
- Architecture: HIGH - derived from locked user decisions plus current repo seams
- Pitfalls: HIGH - backed by current artifact gaps and the existing runtime/export split

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 unless major data-pipeline files or roadmap scope change first
