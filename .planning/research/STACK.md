# Stack Research

**Domain:** Offline algorithm showcase website for archived AIS traffic analysis
**Researched:** 2026-03-24
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite + React + TypeScript | Existing repo stack | Static web shell, module routing, typed UI composition | The current site already runs on this stack, and the milestone problem is information architecture plus data packaging rather than framework capability |
| Zod-backed runtime contracts | Existing repo pattern | Validate website-facing artifact bundles before rendering | Module count and data volume are growing; typed contracts are the cheapest way to keep offline artifacts trustworthy |
| Python offline packaging scripts | Existing repo pattern | Convert `代码依据` experiments into website-ready manifests and result bundles | The research assets already live in Python and notebooks, so the fastest credible path is packaging them, not rewriting the toolchain |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-router-dom` or equivalent route shell | React-compatible stable | Give each major module a first-class route or shell boundary | Use when the current one-page dashboard stops being a clear navigation surface |
| Existing SVG/chart utilities first; one charting library only if repeated complexity appears | Deferred choice | Render metrics, ranking plots, and result comparisons | Use only if custom chart code becomes slower to build than adopting one well-scoped charting dependency |
| Lightweight shared state via React context or focused hooks | Existing React primitives | Share scenario, frame, and module selections without introducing a heavy global store | Use as the default; only add a dedicated state library if cross-module coordination becomes hard to reason about |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + TypeScript | Keep module boundaries and contracts maintainable | Reuse the repo's current verification flow instead of inventing a second standard |
| Static artifact manifests under `public/data/` | Keep delivery backend-free and demo-portable | Pair each manifest with schema validation and lazy loading |
| Pipeline verification command | Confirm artifact generation plus build correctness | Should check both Python packaging outputs and frontend data loading paths |

## Installation

```bash
# Existing frontend
cd demo-web
npm install

# Existing offline packaging flow
python -m pip install -r requirements.txt  # or documented equivalent once added
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Keep Vite + React + TypeScript | Rewrite to Next.js or another app framework | Only if the product later needs SSR, auth, server-side routing, or live backend capabilities |
| Static JSON manifests and lazy loading | Introduce backend APIs now | Only if artifact volume, access control, or live data updates exceed what a static site can reasonably ship |
| React context and focused hooks | Redux or another heavy global store | Only if scenario, route, and metric state become deeply coupled across many distant surfaces |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Full framework rewrite during this milestone | It adds migration risk without solving the actual presentation problem | Keep the current stack and modularize the app |
| One giant all-in-one runtime JSON | Initial load time and debugging cost will grow with every module | Split artifacts by module, scenario, and result type |
| Pretend-live backends or fake online inference services | They increase scope and can undermine demo credibility when questioned | Use archived playback plus honest offline result bundles |

## Stack Patterns by Variant

**If the site remains a curated defense/demo artifact:**
- Keep static deployment, precomputed bundles, and lazy route loading
- Because this matches the real data source and minimizes operational risk

**If later the project needs live data or user uploads:**
- Add a lightweight backend and object storage manifest layer
- Because compute scheduling, result history, and access control stop fitting a static-only delivery model

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@19` | Current repo TypeScript + Vite setup | Already proven in this codebase |
| `zod@4` | Current runtime validation layer | Good fit for static artifact contracts |
| Python packaging scripts | Existing research assets in `代码依据` | Faster to harden than to replace |

## Sources

- `.planning/codebase/STACK.md` - current repo stack and deployment model
- `.planning/codebase/ARCHITECTURE.md` - current component and data-loading architecture
- `demo-web/package.json` - installed frontend tooling and dependencies
- `代码依据/` audit - confirms the current project already depends on Python research outputs and offline artifacts

---
*Stack research for: offline AIS algorithm showcase website*
*Researched: 2026-03-24*
