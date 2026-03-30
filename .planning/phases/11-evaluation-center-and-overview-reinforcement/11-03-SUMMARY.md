Phase 11 plan `11-03` is complete.

The overview bundle contract is now strong enough to carry the whole site story instead of a thin summary paragraph. `demo-web/scripts/export_phase6_secondary_bundles.py` now regenerates `overview-summary.json` with `framingPillars`, route-backed `businessLoop` steps, `moduleEntryPoints`, `scenarioEntryPoints`, and richer overview source lineage that explicitly points at forecast runtime, repair samples, clustering corridor runtime, and evaluation optimization artifacts.

On the frontend, the overview page now presents the business loop, module entry points, scenario entry points, framing pillars, scale summary, committed artifacts, source lineage, corridor-dominance context, and the shared deferred `CLUS-03` explanation in one coherent surface. The homepage command-center stage now includes an `Offline showcase framing` card with scenario chips so the archived-playback plus offline-inference boundary remains visible before a viewer ever opens a module page.

Verification completed:
- `node demo-web/tests/overview-module.test.mjs`
- `node demo-web/tests/platform-shell-smoke.test.mjs`
- `node demo-web/tests/clustering-module.test.mjs`
- `node demo-web/tests/evaluation-module.test.mjs`
- `npm.cmd run smoke`
- `npm.cmd run lint`
- `.\\node_modules\\.bin\\tsc.cmd -b`

Additional closeout:
- `demo-web/package.json` smoke now uses `node --experimental-test-isolation=none --test ...` so the consolidated smoke run works in the current sandbox instead of failing with `spawn EPERM`
- `.planning/ROADMAP.md` now marks `11-03` complete and closes Phase 11
- `.planning/REQUIREMENTS.md` now marks `OVER-01`, `OVER-02`, and `OVER-03` complete
- `.planning/STATE.md` now advances the project to Phase 12 as the next execution target

What remains:
- `12-01` should define the collaborative-decision data contract and evidence-linkage layer on top of the now-complete forecast, repair, clustering, evaluation, and overview modules
