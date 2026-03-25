# Phase 7: Frontend Contracts and Website Shell - Research

**Researched:** 2026-03-25
**Domain:** Frontend contracts, module registry loading, shell composition, and baseline module-page delivery for the archived AIS showcase
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The homepage remains an independent command-center homepage rather than collapsing into one of the module pages.
- The site should feel like a real product shell, not a linear presentation website or click-through PPT.
- Primary navigation should be horizontal at the top.
- The primary navigation order is: `home -> forecast -> repair -> clustering -> evaluation -> forward-looking analysis`.
- The homepage must retain the command-center tone while also making module entry points obvious.
- The homepage should contain both summary information and clear module entry affordances; users should not need to discover everything through hidden local controls.
- The forward-looking analysis entry should remain first-class in navigation, but it must be labeled as incomplete or under construction and should also explain that status on entry.
- The website should not force an explicit recommended demo sequence in the shell; evaluation committee members should be able to navigate freely.
- Keep the homepage as a three-column control-screen composition instead of flattening it into a conventional overview page.
- Keep the center map and timeline as the homepage anchor because they preserve the strongest command-center identity.
- Rebuild both side rails around meaningful content instead of preserving their current low-value filler panels.
- The title area beneath the main platform title can be used for secondary shell content such as current scene, current module context, or lightweight switching cues.
- The left and right rails should both mix module entry points with key summaries rather than separating one side as pure navigation and the other as pure status.
- Homepage hover behavior may be used to preview a module, highlight a related map layer, or refresh a summary, but hover must never be the only way to access important content.
- Clicking should remain the primary way to enter a full module page.
- Module pages should use a medium-density layout: still professional and instrument-like, but easier to read than the current dense control wall.
- Shared shell elements across pages should include the top navigation and a persistent top status strip.
- Preserve the current homepage elements that already feel product-real: header shell, central map stage, timeline, focus card, hotspot or flow summaries, and runtime status framing.
- Replace low-value or placeholder-heavy panels such as the system log, observation feeds, and hardcoded benchmark cards with real module preview cards backed by Phase 6 bundles.
- Every homepage module preview should expose at least one real headline metric and one short explanatory summary.
- Forecast should surface compact live-style summary values on the homepage, such as current total flow, next-window prediction, hotspot count, or model readiness.
- Repair should appear as a teaser card on the homepage, emphasizing curated samples and current best-performing method rather than full trajectory detail.
- Clustering should appear as a pipeline summary on the homepage, emphasizing raw-to-segmented-to-compressed-to-corridor progression and corridor counts.
- Evaluation should appear as a scoreboard-style preview on the homepage, emphasizing metric readiness and current top-ranked methods.
- Forward-looking analysis should appear as a visible placeholder in the shell and homepage framing, but it should remain honest about being deferred.
- Every Phase 7 module page should share one baseline structure: top summary band, one main visualization area, and one supporting metrics or explanation column.
- Homepage cards should prioritize the entry action first and use summary content as support rather than turning into text-heavy introductions.
- Module-page summaries should use data-backed summary bands rather than long prose blocks or large decorative preview images.
- Each module summary band should combine concise KPI cards, one clear takeaway sentence, and one product-style primary action such as `View Details`, `Compare Results`, or `View Trajectory`.
- The homepage may show lightweight previews for each module, but deeper comparisons, timelines, geometry, and detailed rankings belong on the module pages.
- Overview, forecast, repair, clustering, and evaluation should all appear as full module destinations even if some sub-capabilities are not yet complete.
- Unfinished sub-capabilities should only be explained when the user reaches the relevant detail area or data-dependent section.
- Module pages should load into their finished layout shape first, then fill content with skeleton states rather than replacing the whole page with a blank loader.
- Deferred or not-yet-connected features should use restrained product language such as `Not available in this version` or `This capability will be connected in a later update`.
- Real data failures should show a formal in-module error surface with clear recovery actions such as retrying the load or returning home.
- When most of a module is available but one sub-capability is not, the page should remain normal and only the affected section should explain the limitation.
- The homepage and primary navigation should continue to present the product as whole; deferred messaging belongs at the detailed section level instead of dominating the shell.

### Claude's Discretion
- Exact folder and file breakdown for the new shell, registry, contract, loader, and module-page components
- Whether navigation state uses URL hash, query parameters, or another lightweight browser-history synchronization approach
- Exact schema breakdown for artifact-index, manifest, bundle, and page-level view models
- Exact component names and CSS organization for the new shell and baseline pages
- Exact smoke-test additions, so long as Phase 7 ends with one repeatable verification surface

### Deferred Ideas (OUT OF SCOPE)
- Full forecast multi-model interactions beyond the baseline page
- Full repair comparison experience beyond the baseline page
- Full clustering workflow and noise re-clustering visuals beyond the baseline page
- Optimization history deep integration
- Completed collaborative decision logic or evidence package
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BASE-01 | Demo viewer can navigate between overview, flow prediction, trajectory repair, trajectory clustering, collaborative decision, and evaluation from one coherent website shell | Introduce a dedicated shell layer above the current dashboard, keep the command-center homepage as one destination, and add explicit module destinations backed by a shared registry rather than one monolithic `App.tsx`. |
| BASE-03 | Demo viewer can switch scenarios or time slices without broken module state or missing data contracts | Extend the repo's validated runtime-loading pattern so module manifests and bundles load through explicit schemas, and centralize shell state for active module, selected dataset, and module-status handling. |
| BASE-04 | Website lazy-loads module or scenario artifacts so new datasets do not force one monolithic initial payload | Use `artifact-index.json` plus module manifest/bundle loading to discover modules and fetch only the selected module's resources on demand. |
</phase_requirements>

## Summary

Phase 7 should turn the repo from a single dense dashboard into a real shell without throwing away the strongest existing surface. The current code already has three important assets: a convincing command-center homepage in `demo-web/src/App.tsx`, a clean validated loading seam in `demo-web/src/runtimeData.ts` and `demo-web/src/dashboard/useDashboardRuntime.ts`, and committed Phase 6 module packages under `demo-web/public/data/modules/`. The right plan is therefore not a framework rewrite; it is a shell-over-modules refactor.

The homepage should remain the command center. It already contains the best product-facing stage: header shell, live framing, center map, focus card, timeline, and hotspot/flow summaries. Those are the strongest parts of the current experience and should stay. What should change is the shell around them: `App.tsx` should stop being the only page and become a host for a new website shell plus separate baseline module pages. Side rails should shift from filler panels to module-entry previews backed by the Phase 6 bundles.

Technically, the cleanest Phase 7 path is contract-first and registry-driven. The repo currently validates dashboard runtime data with Zod and uses a generic `loadValidatedRuntimeJson` helper. Phase 7 should extend that exact pattern to `artifact-index.json`, module manifests, and bundle metadata. Once those contracts exist, the shell can lazy-load one module package at a time, maintain shared shell state, and render consistent loading, unavailable, and deferred surfaces without forcing one giant initial payload.

A router rewrite is not required to succeed in this phase. The current repo has no route library and runs one main React entry plus a separate RouteEditor surface. Phase 7 can define route descriptors and synchronize the active module with lightweight browser state instead of adding major navigation infrastructure before the shell exists. The important thing is that module destinations behave like real pages, not that they must start with a new router dependency.

**Primary recommendation:** Plan Phase 7 as a three-step sequence: 1) define typed module contracts and registry metadata for `artifact-index + manifest + bundle`, 2) implement a shared shell runtime that discovers and lazily loads module packages while preserving dashboard-grade status handling, and 3) build the homepage plus baseline module pages using real Phase 6 data with honest deferred section messaging.

## Standard Stack

### Core
| Library / Surface | Version / State | Purpose | Why Standard |
|-------------------|-----------------|---------|--------------|
| React + Vite in `demo-web/` | Existing repo surface | Frontend shell and page composition | The repo already ships the dashboard and RouteEditor with this stack; Phase 7 should evolve it rather than rewrite it. |
| Zod runtime validation in `demo-web/src/runtimeSchemas.ts` | Existing repo surface | Runtime contract parsing and load failure shaping | The dashboard already relies on strict parsed JSON contracts; Phase 7 should extend this boundary to module registry/manifests. |
| Generic loader in `demo-web/src/runtimeData.ts` | Existing repo surface | Validated runtime JSON loading | It already supports structured `loading / http / json / contract` failures and is the cleanest base for module loaders. |
| Phase 6 module packages in `demo-web/public/data/modules/` | Existing repo surface | Module registry, manifests, and runtime data bundles | Phase 7 exists specifically to consume this committed bundle surface. |

### Supporting
| Library / Surface | Purpose | When to Use |
|-------------------|---------|-------------|
| `demo-web/src/dashboard/useDashboardRuntime.ts` | Pattern for validated loader orchestration and readiness gating | Reuse for shell-level or module-level loading states and unavailable screens. |
| `demo-web/src/dashboard/DashboardStatusScreen.tsx` | Pattern for polished unavailable/loading surfaces | Reuse for module or shell error/loading fallbacks instead of raw exceptions or blank screens. |
| `demo-web/src/App.tsx` and `demo-web/src/App.css` | Current command-center homepage implementation | Keep as the homepage content seam, but extract it under a new shell rather than keep growing it monolithically. |
| `demo-web/src/RouteEditor.tsx` and related hooks | Evidence that the repo can support separate top-level workspaces | Use as precedent for focused workspace components, but not as a cue to create many standalone HTML entries. |
| `demo-web/src/datasetCatalog.ts` | Existing persisted selection and URL synchronization pattern | Reuse for dataset or scenario persistence at the shell level. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell-managed route descriptors + browser-state sync | Add a router library immediately | Possible, but not required for Phase 7 and adds surface area before the shell contracts exist. |
| Registry-driven lazy loading from `artifact-index.json` | Hardcode module file imports in React | Faster short term, but violates BASE-04 and weakens future dataset growth. |
| Keep homepage dashboard logic as one destination | Rewrite the whole app into new pages from scratch | Higher visual risk and more regression risk than evolving the current strongest screen. |
| Extend current validated loader pattern | Create new ad hoc loaders per module | Increases contract drift and makes failure states inconsistent. |

## Architecture Patterns

### Recommended Project Structure
```text
demo-web/src/
  app/
    PlatformShell.tsx
    platformShell.css
    routeRegistry.ts
    shellState.ts
  modules/
    contracts/
    registry/
    loaders/
    pages/
      HomePage.tsx
      OverviewPage.tsx
      ForecastPage.tsx
      RepairPage.tsx
      ClusteringPage.tsx
      EvaluationPage.tsx
      ForwardLookingPage.tsx
```

### Pattern 1: Shell over existing homepage
**What:** Build a website shell that treats the current dashboard/control-center surface as the homepage implementation, not as the whole app.  
**When to use:** As the first structural refactor in Phase 7.  
**Why:** `App.tsx` already contains the strongest homepage stage, but it is too monolithic to host all later modules.

### Pattern 2: Registry-driven module discovery
**What:** Use `artifact-index.json` as the first discovery surface, then load a selected module's manifest and bundle on demand.  
**When to use:** For module navigation, lazy loading, and deferred-state messaging.  
**Why:** Phase 6 already created the module package surface specifically for this purpose, and it directly satisfies BASE-04.

### Pattern 3: Contract-first module loaders
**What:** Extend `runtimeSchemas.ts` and `runtimeData.ts` so module registry, manifests, and bundles validate before any page derives view state.  
**When to use:** For all Phase 7 module data access.  
**Why:** The repo already depends on strict parsed contracts for the dashboard; Phase 7 should not weaken that safety line.

### Pattern 4: Shared shell state, module-local view state
**What:** Keep shell concerns such as active module, dataset selection, and module-status caching at the top level, while module pages own their local visualization or tab state.  
**When to use:** Throughout Phase 7 shell construction.  
**Why:** Current dashboard scene state is too local to `App.tsx`; future modules need consistency without collapsing all page-specific behavior into one global object.

### Pattern 5: Deferred-at-section, not deferred-at-shell
**What:** Present incomplete sub-capabilities inside the affected module section, not as dominant shell-level disabled pages.  
**When to use:** For forecast deferred models, clustering noise re-clustering, repair Optuna, and collaborative decision placeholder messaging.  
**Why:** The user wants module destinations to remain first-class and product-complete at the shell level.

### Anti-Patterns to Avoid
- **App-as-everything:** Do not continue growing `demo-web/src/App.tsx` into the only shell, homepage, module router, and module runtime container.
- **Placeholder contamination:** Do not let `scenarioPacks.ts` continue supplying placeholder model comparison or feed content to the new module pages.
- **Eager all-module boot:** Do not preload every module bundle during initial homepage load.
- **Many standalone HTML entries:** Do not respond to module growth by copying the RouteEditor pattern into many top-level pages outside one shell.
- **Deferred-as-navigation-damage:** Do not gray out or hide whole module destinations just because one detail section is unfinished.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module data loading | One custom fetch flow per module | Extend `loadValidatedRuntimeJson` in `runtimeData.ts` plus typed parsers in `runtimeSchemas.ts` | The repo already has one strong contract boundary. |
| Shell readiness logic | Ad hoc boolean chains in each page | Reuse the `loading / unavailable / validated` pattern from `useDashboardRuntime.ts` and `DashboardStatusScreen.tsx` | This keeps user-facing status behavior consistent. |
| Module discovery | Hardcoded module JSON paths in components | Use `artifact-index.json` + manifest paths + bundle entry files | This preserves BASE-04 and future bundle growth. |
| New site identity | Replace the dashboard with a generic overview landing page | Keep the command-center homepage and refactor around it | The user explicitly wants product-like information-terminal identity. |
| New backend or server routing | Infrastructure for navigation or data orchestration | Static browser-state navigation plus committed bundle files | Phase 7 is frontend-shell work on top of offline artifacts. |

## Common Pitfalls

### Pitfall 1: Letting Phase 7 become a silent rewrite of every future module
**What goes wrong:** The shell phase expands into finishing forecast, repair, clustering, evaluation, and collaborative decision in one pass.  
**Why it happens:** Once module pages exist, it is tempting to overfill them immediately.  
**How to avoid:** Keep Phase 7 baseline pages intentionally shallow: summary band, main visualization, supporting metrics/explanation, and honest deferred sections only.  
**Warning signs:** Tasks start requiring full forecast model switching or full repair comparisons instead of baseline consumption of Phase 6 bundles.

### Pitfall 2: Keeping placeholder display packs in the new shell
**What goes wrong:** The new shell looks structurally improved but still reads from `scenarioPacks.ts` for model comparisons or pseudo-feeds.  
**Why it happens:** Those packs are convenient and already wired into `App.tsx`.  
**How to avoid:** Isolate the homepage-specific dashboard logic and replace low-value placeholder panels with Phase 6 bundle-backed previews early in the phase.  
**Warning signs:** Forecast or evaluation previews still advertise LSTM/BiLSTM as if they are fully ready in Phase 7.

### Pitfall 3: Building lazy loading without contract coverage
**What goes wrong:** Module pages fetch manifests or bundles directly and only fail at render time.  
**Why it happens:** The Phase 6 bundles are simple JSON files, so it feels safe to skip schemas.  
**How to avoid:** Define parsers for registry, manifests, and module bundle metadata before wiring module pages.  
**Warning signs:** The shell can navigate but malformed bundle JSON crashes React or causes undefined-property rendering.

### Pitfall 4: Losing shell continuity across modules
**What goes wrong:** The homepage feels polished, but module pages feel like disconnected mini-sites or stripped-down docs pages.  
**Why it happens:** Module pages are built individually without shared status strip, navigation, summary-band grammar, or density rules.  
**How to avoid:** Plan one shell runtime and one baseline module-page grammar before deepening any individual module.  
**Warning signs:** Every module chooses different loading behavior, different top layout, or different navigation placement.

### Pitfall 5: Tying module navigation to dashboard-only state
**What goes wrong:** Changing modules resets dataset or scene context unpredictably, or module pages inherit unrelated homepage playback state.  
**Why it happens:** `App.tsx` currently owns most interactive state locally.  
**How to avoid:** Separate shell-level shared state from page-local view state and document what should persist across module navigation.  
**Warning signs:** The module shell depends on `sceneIndex`, `planApplied`, or other dashboard-local controls for unrelated pages.

## Code Examples

Verified patterns from the current repo:

### Generic validated loader
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

### Dashboard readiness split
```typescript
const dashboardUnavailableReason =
  runtimeLoadError ||
  (datasetCatalog && !selectedDataset
    ? 'Traffic data unavailable. The dataset catalog does not currently provide a validated AIS playback and forecast pair.'
    : '')
const dashboardReady = Boolean(datasetCatalog && selectedDataset && geometryConfig && aisPlayback && flowForecast)
const dashboardLoading = !dashboardUnavailableReason && !dashboardReady
```
Source: `demo-web/src/dashboard/useDashboardRuntime.ts`

### Current app entry point proves there is no shell router yet
```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
Source: `demo-web/src/main.tsx`

### RouteEditor proves the repo can support separate workspace surfaces
```typescript
export function RouteEditor() {
  const { ... } = useRouteEditorWorkspace()
  const { ... } = useRouteEditorStage({ studyBounds, geoViewport })
```
Source: `demo-web/src/RouteEditor.tsx`

## State of the Art

| Old Approach | Phase 7 Direction | Why It Changes | Impact |
|--------------|------------------|----------------|--------|
| Single dense dashboard page in `App.tsx` | One shell with homepage plus module destinations | The project now has committed module bundles and needs product-like navigation | Phase 7 must extract shell structure before module-completion phases can scale cleanly |
| Dashboard-only runtime contracts | Contracts for registry, manifests, and module bundles | Phase 6 added a new module-package surface | Phase 7 should extend validation rather than using ad hoc fetch logic |
| Placeholder-rich side rails and hardcoded comparison packs | Bundle-backed homepage previews and baseline module pages | The homepage now needs to preview real module readiness instead of fake panels | Side rails become module-entry surfaces rather than filler |
| One eager workspace | Per-module lazy loading | The site now has five committed module packages plus a deferred module surface | Module pages can load independently and scale to more datasets |

## Open Questions

1. **Should Phase 7 synchronize module navigation through hash, query param, or another lightweight browser-state surface?**
   - What we know: the repo already persists dataset selection through URL/local storage in `datasetCatalog.ts`, and there is no route library today.
   - Recommendation: planning should choose one lightweight synchronization surface and use it consistently, but it does not need to add a full router dependency unless the plan proves it clearly safer.

2. **Which current homepage controls should persist as shell-level controls versus stay dashboard-only?**
   - What we know: dataset choice likely belongs to shell scope, while playback speed or plan-apply state is homepage-specific.
   - Recommendation: planning should explicitly classify shell-persistent versus page-local state so navigation does not cause confusing resets.

## Sources

### Primary (HIGH confidence)
- Local repo: `demo-web/src/App.tsx` and `demo-web/src/App.css` - current command-center homepage and shell density
- Local repo: `demo-web/src/main.tsx` - current app entrypoint
- Local repo: `demo-web/src/runtimeData.ts` and `demo-web/src/runtimeSchemas.ts` - validated runtime-loading seam
- Local repo: `demo-web/src/dashboard/useDashboardRuntime.ts` and `demo-web/src/dashboard/DashboardStatusScreen.tsx` - loader orchestration and polished status surfaces
- Local repo: `demo-web/src/datasetCatalog.ts` - persisted dataset and URL selection pattern
- Local repo: `demo-web/public/data/modules/` - Phase 6 registry, manifests, and module bundle metadata
- Local repo: `demo-web/src/RouteEditor.tsx`, `demo-web/src/route-editor/`, `demo-web/vite.config.ts`, and `demo-web/route-editor.html` - proof of separate workspace surfaces inside the same repo

### Secondary (MEDIUM confidence)
- Local repo: `demo-web/src/scenarioPacks.ts` - identifies placeholder or presentation-only data that should not leak into the new module shell
- Local repo: `.planning/phases/06-data-completion-and-lineage/06-RESEARCH.md` - prior phase precedent for extending the repo's existing offline-and-validated runtime patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - based on shipped repo surfaces and current dependency set
- Architecture: HIGH - directly derived from locked Phase 7 context plus current code seams
- Pitfalls: HIGH - backed by current monolithic `App.tsx`, placeholder packs, and missing module loader contracts

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 unless shell architecture, Phase 6 bundle contracts, or roadmap scope change first
