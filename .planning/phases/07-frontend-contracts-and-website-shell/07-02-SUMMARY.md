# 07-02 Summary

## Outcome
Wave 2 established the shared shell runtime for Phase 7.
The frontend can now discover Phase 6 modules from the registry, lazy-load one module package at a time, cache loaded entries across navigation, persist the selected dataset and shell route, and reuse one common status surface for loading, error, unavailable, and deferred states.

## Completed
- added `demo-web/src/platform/moduleLoader.ts` as the registry-driven lazy-loading and cache boundary for `artifact-index`, manifests, and bundles
- added `demo-web/src/platform/usePlatformShell.ts` to keep `activeModule`, `selectedDataset`, registry state, and retry behavior coherent at shell scope
- added `demo-web/src/platform/PlatformStatusSurface.tsx` as the shared status surface for loading, unavailable, error, and deferred states
- added `demo-web/src/platform/PlatformShell.tsx` as the reusable shell wrapper with top navigation, dataset selector, and status-strip wiring
- extended `demo-web/src/datasetCatalog.ts` so the shell can persist `view` alongside the existing dataset preference
- updated `demo-web/src/platform/routeRegistry.ts` with `isModuleRouteId` to support route-aware shell loading
- added `demo-web/tests/platform-runtime.test.mjs` to prove discovery-only loading, per-module lazy loading, deferred propagation, and explicit failure stages

## Verification
- `node --test demo-web/tests/platform-runtime.test.mjs`
- `rg "activeModule|selectedDataset|deferred|unavailable|error" demo-web/src/platform/usePlatformShell.ts demo-web/src/platform/PlatformStatusSurface.tsx`
- `npm run lint`
- `npm run build`

## Notes For Wave 3
- the shell runtime is now ready to host the homepage and baseline module pages without hardcoded bundle paths
- `home` and `forward-looking analysis` can stay shell-first routes while overview remains addressable but hidden from the primary top-nav sequence
- baseline pages can rely on `PlatformShell` and `usePlatformShell` instead of rebuilding route, loader, and status logic locally
