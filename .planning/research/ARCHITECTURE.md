# Architecture Research

**Domain:** Offline algorithm showcase website for archived AIS traffic analysis
**Researched:** 2026-03-24
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
[Archived AIS + code-basis outputs]
            |
            v
[Offline packaging scripts + manifests]
            |
            v
[Static artifact catalog in public/data]
            |
            v
[Website Shell / Shared Scenario Context]
   |         |         |         |         |
   v         v         v         v         v
[Flow]   [Repair]  [Cluster] [Decision] [Evaluation]
   \         |         |         |         /
             v         v         v
          [Overview + Business Loop Framing]
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Website shell | Navigation, shared scenario selection, route-level lazy loading | React route shell or module tabs with URL-backed state |
| Artifact catalog | Discover what datasets, models, horizons, and samples exist | JSON manifest plus Zod validation |
| Module loaders | Fetch only the data needed by the active module | Module-owned hooks or loaders |
| Visualization modules | Render the story for one algorithm area | Feature-scoped components and utilities |
| Offline packaging layer | Translate notebooks and research outputs into stable frontend bundles | Python scripts that emit versioned JSON or CSV artifacts |

## Recommended Project Structure

```text
demo-web/src/
├─ app/                # shell, routing, shared page layout
├─ modules/
│  ├─ overview/        # project overview and business loop
│  ├─ flow/            # flow prediction module
│  ├─ repair/          # trajectory repair module
│  ├─ clustering/      # trajectory clustering module
│  ├─ decision/        # collaborative decision module
│  └─ evaluation/      # unified metrics and rankings
├─ data/
│  ├─ contracts/       # zod schemas and TypeScript contracts
│  ├─ catalog/         # scenario and artifact manifest helpers
│  └─ loaders/         # fetch helpers and module data hooks
├─ shared/             # reusable UI pieces, formatting, chart helpers
└─ tools/              # RouteEditor and other supporting surfaces
```

### Structure Rationale

- **`modules/`**: Each algorithm surface owns its UI, derived state, and rendering concerns
- **`data/`**: Contracts and loaders are shared across modules, but notebook-native structures never leak directly into UI code
- **`app/`**: Keeps module navigation and site framing separate from algorithm implementation details
- **`tools/`**: Preserves specialized supporting experiences like RouteEditor without forcing them into the main showcase flow

## Architectural Patterns

### Pattern 1: Manifest-Driven Static Delivery

**What:** A small catalog file declares available scenarios, models, horizons, samples, and artifact paths.
**When to use:** Use this for every module in this milestone.
**Trade-offs:** Slightly more packaging work offline, but far safer than hardcoding paths in UI code.

### Pattern 2: Module-Owned Loaders

**What:** Each module has a focused loader or hook that fetches only its own artifacts and exposes normalized view-state inputs.
**When to use:** Default pattern for flow, repair, clustering, decision, and evaluation.
**Trade-offs:** Slightly more files, but much lower regression risk than centralizing every derived state path in one page component.

### Pattern 3: Shared Scenario Context with URL Persistence

**What:** Keep selected scenario, frame, or sample in URL or shared context so the site feels coherent across modules.
**When to use:** Use when modules should reference the same archived time range or scenario identity.
**Trade-offs:** Requires clear ownership of what is shared globally versus locally.

## Data Flow

### Request Flow

```text
[User selects module/scenario]
    -> [Shell route/context]
    -> [Module loader]
    -> [Artifact manifest]
    -> [Static JSON/CSV result bundle]
    -> [Module-specific transforms]
    -> [UI charts, maps, tables]
```

### State Management

```text
[Shared scenario context]
    <-> [Module routes]
    <-> [Module-local state]
    <-> [Loader results]
```

### Key Data Flows

1. **Forecast flow:** scenario -> model -> horizon -> metrics + hotspot grids + timeline overlays
2. **Repair flow:** sample -> model -> repaired coordinates + per-axis errors + metrics
3. **Clustering flow:** scenario -> processing stage -> cluster stats + corridor outputs
4. **Decision flow:** frame/scenario -> evidence bundle -> recommendations + before/after benefits

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current state (single scenario, <20 MB shipped artifacts) | Static delivery with module lazy loading is sufficient |
| Moderate growth (multiple scenarios, tens of MB per module family) | Split artifacts by scenario and module, load on demand, keep manifests small |
| Large growth (many scenarios, user uploads, or heavy live queries) | Introduce a lightweight backend or object storage manifest layer |

### Scaling Priorities

1. **First bottleneck:** Initial load size - solve with module and scenario splitting, not a framework rewrite
2. **Second bottleneck:** Contract drift between notebooks and frontend - solve with packaging scripts plus schemas

## Anti-Patterns

### Anti-Pattern 1: Single Giant Dashboard State

**What people do:** Keep every module, selector, metric, and chart in one page component or one huge data hook.
**Why it's wrong:** The site becomes harder to explain, test, and extend with each new module.
**Do this instead:** Give each module its own route or bounded surface plus its own loader.

### Anti-Pattern 2: Frontend Coupled to Notebook Output Shapes

**What people do:** Read notebook-exported arrays or ad hoc HTML directly in UI code.
**Why it's wrong:** Every notebook refactor becomes a website regression.
**Do this instead:** Introduce packaging scripts that emit stable website-facing artifact contracts.

### Anti-Pattern 3: Premature Backend Migration

**What people do:** Add a backend just because artifacts are getting larger.
**Why it's wrong:** It adds operational work before the static architecture is exhausted.
**Do this instead:** Split artifacts by module and scenario first; add a backend only when static delivery is no longer enough.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required for v1.1 | Static artifact delivery only | Keep the milestone portable and demo-friendly |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Offline packaging -> frontend | Versioned JSON or CSV manifests | Must be schema-validated and documented |
| Shared shell -> modules | Route params, shared context, or query state | Keep only scenario identity shared globally |
| Clustering -> decision | Evidence bundle or derived corridor metadata | Do not make the decision module parse raw clustering notebooks |

## Sources

- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STACK.md`
- `demo-web/public/data/*` artifact size and structure audit
- `代码依据/流量预测`
- `代码依据/轨迹修复`
- `代码依据/轨迹聚类`

---
*Architecture research for: offline AIS algorithm showcase website*
*Researched: 2026-03-24*
