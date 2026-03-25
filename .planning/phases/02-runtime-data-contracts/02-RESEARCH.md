# Phase 2: Runtime Data Contracts - Research

**Researched:** 2026-03-23
**Domain:** Browser-side runtime schema validation and fail-safe data loading for a Vite + React + TypeScript offline demo
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions
- Invalid runtime data should fail directly rather than partially limping through the UI.
- Missing or malformed required data should surface a direct `data unavailable` style message.
- Error handling should feel like a normal software product surface that happens to support demos, not an explicit `demo mode`.
- The upstream trajectory-clustering workflow in `代码依据/轨迹聚类` is methodology provenance, not the primary website contract.
- `demo-web/scripts/extract_main_corridors_from_clustered_ais.py` is the adapter that converts clustering artifacts into curated website-facing main corridor payloads.
- The main UI and RouteEditor should treat curated main corridors as the primary entity, not raw trajectory clusters.
- Runtime contracts in this phase should therefore validate `main-corridor-tracks.json` as a product payload, not attempt to mirror the full research notebook data shape.

### Claude's Discretion
- Exact schema tooling choice and how it integrates into the current React code.
- Exact copy for `data unavailable` fallback states.
- Whether optional display or narrative fields should be defaulted at load time versus filled by generation scripts.

### Deferred Ideas
- Final policy for which non-structural narrative or display fields may be optional can be settled during detailed implementation if structural rendering fields stay strict.
- Surfacing raw clustering outputs in a dedicated explanation or methodology view belongs to later presentation work, not this safety phase.
</user_constraints>

<research_summary>
## Summary

The current app already has a clean runtime boundary, but it is not enforcing contracts there. `demo-web/src/datasetCatalog.ts` partially sanitizes catalog entries, then silently falls back to a default catalog on any fetch or shape failure. `demo-web/src/sharedContracts.ts` defines rich TypeScript types for AIS playback, forecast, geometry, and corridor payloads, but `loadPublicJson()` returns `response.json()` without runtime validation. `demo-web/src/App.tsx` and `demo-web/src/RouteEditor.tsx` then derive large amounts of UI state from those unchecked payloads.

That means Phase 2 should stay focused and local: validate JSON exactly once at the resource boundary, convert failures into structured runtime errors, and let each surface render a product-like `data unavailable` state instead of continuing with corrupt state. This does not need a maintainability refactor yet. The best plan is to add a narrow shared validation layer, then wire the dashboard and RouteEditor to consume it.

**Primary recommendation:** Use a single browser-safe runtime schema module with Zod `safeParse()` at the fetch boundary, keep structural fields strict, and default only genuinely non-structural display text where the UI already has an intentional fallback.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript strict mode | local (`strict: true`) | Compile-time contracts | Already enabled in `demo-web/tsconfig.app.json`, so runtime schemas can stay precise without weakening types |
| Zod | 4.x | Runtime parsing and validation | Widely used TypeScript-first schema library; `safeParse()` cleanly supports fail-fast loading without throwing raw parser details into components |
| Existing Fetch + React state flow | local | Runtime loading orchestration | Already present in `App.tsx` and `RouteEditor.tsx`; Phase 2 should harden this boundary, not replace it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `node:test` smoke runner | local | Keep a lightweight automated guard on committed runtime assets | Use for shipped-data contract coverage without introducing a second test framework in this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Custom type guards | Lower dependency count, but significantly more repetitive and easier to drift away from the real payload contract |
| Existing smoke runner | Vitest | Better TS-native unit ergonomics, but adds test-infra scope that fits Phase 5 more naturally than this safety phase |

**Installation:**
```bash
npm install zod
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
demo-web/src/
├── runtimeSchemas.ts      # Zod schemas + narrow parse helpers for shipped JSON payloads
├── runtimeData.ts         # Fetch + validate + structured runtime error helpers
├── datasetCatalog.ts      # Catalog selection helpers, updated to stop silent bad-data fallback
├── App.tsx                # Dashboard integration and fallback UX
└── RouteEditor.tsx        # RouteEditor integration and fallback UX
```

### Pattern 1: Validate once at the JSON boundary
**What:** Fetch raw JSON, validate with a schema immediately, and only let typed data cross into the component tree.
**When to use:** Every shipped JSON payload used by the dashboard or RouteEditor.
**Example:**
```ts
const result = AisPlaybackSchema.safeParse(raw)
if (!result.success) {
  return {
    ok: false,
    error: buildRuntimeDataError('ais-playback', resource, result.error.issues),
  }
}

return { ok: true, data: result.data }
```

### Pattern 2: Keep policy split between shared loaders and surfaces
**What:** Shared loaders should answer `valid or invalid` with a structured error. Components decide how to reset state and how to present `data unavailable`.
**When to use:** Catalog, geometry, AIS playback, forecast, and corridor track loads.
**Example:**
```ts
const playbackResult = await loadValidatedJson(resource, AisPlaybackSchema, 'ais-playback')
if (!playbackResult.ok) {
  setAisPlayback(null)
  setFlowForecast(null)
  setDatasetLoadError(playbackResult.error.message)
  return
}
```

### Pattern 3: Treat structural fields as required, narrative fields as controlled fallback
**What:** Fields required for rendering, selection, geometry, and timeline progression must be strict. Narrative copy can use deliberate UI fallback only when the UI already owns that copy.
**When to use:** Forecast narrative text and optional display strings.
**Example:**
```ts
const StrategySchema = z.object({
  headline: z.string().trim().min(1).catch('Data unavailable'),
  summary: z.string().trim().min(1).catch('This panel is unavailable because the forecast payload failed validation.'),
})
```

### Anti-Patterns to Avoid
- **Distributed ad hoc checks inside components:** `if (!payload?.meta?.foo)` repeated inside `App.tsx` and `RouteEditor.tsx` will drift and still allow partial corrupt state through.
- **Silent fallback to a valid-looking default dataset on invalid input:** this directly conflicts with the locked decision to fail visibly.
- **Trying to validate raw clustering notebooks in the UI:** the website contract is the curated corridor payload, not the research artifact shape.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime JSON contract checking | Handwritten nested `typeof` trees per payload | Zod object/array schemas | Easier to audit, compose, and keep aligned with the actual runtime boundary |
| Error message formatting | Raw `JSON.stringify(error)` or thrown parser stacks | A small `RuntimeDataError` formatter | Keeps the UI product-like and consistent across dashboard/editor surfaces |
| Catalog invalidation policy | Implicit fallback in component state | One shared catalog validation path | Prevents the app from pretending data is available when the catalog is malformed |

**Key insight:** the complex part here is not parsing JSON, it is preventing partial invalid state from leaking into the UI. Centralizing that decision is more valuable than micro-optimizing the validator implementation.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: TypeScript types mistaken for runtime validation
**What goes wrong:** `AisPlaybackData` and `FlowForecastData` look strict in `sharedContracts.ts`, but `loadPublicJson()` still accepts any JSON at runtime.
**Why it happens:** compile-time types are erased in the browser.
**How to avoid:** only return typed data from a schema-backed parse function.
**Warning signs:** generic `loadPublicJson<T>()` being called directly from UI effects.

### Pitfall 2: Silent fallback hides real data failures
**What goes wrong:** malformed catalog or missing assets quietly collapse into `DEFAULT_DATASET_CATALOG`, making the page look alive while data is actually broken.
**Why it happens:** broad `catch { return DEFAULT_DATASET_CATALOG }` behavior in the loader.
**How to avoid:** distinguish `network unavailable` and `contract invalid`, then surface both through an explicit unavailable state.
**Warning signs:** fallback data appears after deleting or corrupting `dataset-catalog.json`.

### Pitfall 3: Over-validating descriptive copy blocks otherwise usable payloads
**What goes wrong:** optional narrative fields become hard blockers even when structural fields are valid.
**Why it happens:** schemas make every string mandatory by default.
**How to avoid:** keep geometry, IDs, arrays, timestamps, and counts strict; use `.catch()` or controlled defaults only where the UI already has a sensible non-misleading fallback.
**Warning signs:** forecast charts could render, but one missing narrative string blanks the whole page.

### Pitfall 4: Reaching for a larger refactor too early
**What goes wrong:** Phase 2 becomes a maintainability rewrite of `App.tsx` and `RouteEditor.tsx`.
**Why it happens:** the validation boundary touches loading code, which tempts a broader extraction.
**How to avoid:** add a narrow shared loader/validator layer now, save component decomposition for Phase 3.
**Warning signs:** new plan tasks start moving unrelated derived-state logic or large UI sections.
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources and current project boundaries:

### Safe parsing without throwing on invalid data
```ts
const result = Player.safeParse({ username: 42, xp: '100' })

if (!result.success) {
  result.error.issues
} else {
  result.data
}
```
Source: https://zod.dev/basics

### Strict object schema at the resource boundary
```ts
const DatasetCatalogSchema = z.object({
  defaultDatasetId: z.string().trim().min(1),
  datasets: z.array(
    z.object({
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
      description: z.string().default(''),
      aisPlaybackPath: z.string().trim().min(1),
      flowForecastPath: z.string().trim().min(1).optional(),
    }),
  ).min(1),
})
```
Source basis: https://zod.dev/ and local `demo-web/src/datasetCatalog.ts`

### Shared loader that preserves UI policy outside the validator
```ts
export async function loadValidatedJson<T>(
  resource: string,
  schema: z.ZodType<T>,
  kind: RuntimeResourceKind,
): Promise<RuntimeLoadResult<T>> {
  const response = await fetch(resource)
  if (!response.ok) {
    return { ok: false, error: buildHttpRuntimeError(kind, resource, response.status) }
  }

  const raw = await response.json()
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: buildSchemaRuntimeError(kind, resource, parsed.error.issues) }
  }

  return { ok: true, data: parsed.data }
}
```
Source basis: https://zod.dev/basics and local `demo-web/src/sharedContracts.ts`
</code_examples>

<sota_updates>
## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript-only payload typing | Runtime schema validation plus typed parse result | Ongoing TS ecosystem norm; reinforced by Zod 4 docs | Prevents false confidence from erased compile-time types |
| Component-specific defensive checks | Shared resource-boundary parsing | Mature React app maintenance pattern | Easier to keep multiple surfaces consistent |
| Silent fallback defaults for invalid data | Explicit unavailable state with structured error copy | Needed by this project's locked decisions | Keeps the demo honest about offline data quality |

**Deprecated/outdated:**
- Treating `loadPublicJson<T>()` as if it creates runtime safety: it only applies a cast after `response.json()`.
</sota_updates>

<open_questions>
## Open Questions

1. **Should shared geometry be a hard requirement in the dashboard boundary even though the phase requirements list catalog, AIS, forecast, and corridor data explicitly?**
   - What we know: `App.tsx` derives route labels, hotspot anchors, and study bounds from geometry, and currently reports `geometryLoadError`.
   - What's unclear: whether product copy should call this out as a separate asset class or fold it into general dataset unavailability.
   - Recommendation: treat geometry as required for dashboard readiness in Phase 2, but keep its message consistent with the unified unavailable surface.

2. **How strict should forecast narrative text be?**
   - What we know: charts and hotspot logic depend on structural fields; the UI already has fallback copy in `App.tsx` for some narrative strings.
   - What's unclear: whether all narrative strings should block the page if missing.
   - Recommendation: require structural fields and arrays, but allow existing UI-owned text fallback for non-structural narrative copy until a stronger content contract is defined later.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Local codebase: `demo-web/src/datasetCatalog.ts`, `demo-web/src/sharedContracts.ts`, `demo-web/src/App.tsx`, `demo-web/src/RouteEditor.tsx`
- Zod docs: https://zod.dev/
- Zod basics / safe parsing: https://zod.dev/basics

### Secondary (MEDIUM confidence)
- Local runtime payloads: `demo-web/public/data/dataset-catalog.json`, `ais-playback.json`, `flow-forecast.json`, `shared-geometry.json`, `main-corridor-tracks.json`

### Tertiary (LOW confidence)
- None
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Vite + React + TypeScript runtime data loading
- Ecosystem: Zod-based runtime validation without test-infra expansion
- Patterns: boundary parsing, structured runtime errors, strict structural contracts
- Pitfalls: silent fallbacks, type-only safety, overvalidation, premature refactor

**Confidence breakdown:**
- Standard stack: HIGH - local codebase plus official Zod docs are enough for this scope
- Architecture: HIGH - current loading boundaries are explicit in the repo
- Pitfalls: HIGH - directly observed in the existing loaders and component state flow
- Code examples: HIGH - based on official Zod parsing docs and local boundary usage

**Research date:** 2026-03-23
**Valid until:** 2026-04-22
</metadata>

---

*Phase: 02-runtime-data-contracts*
*Research completed: 2026-03-23*
*Ready for planning: yes*
