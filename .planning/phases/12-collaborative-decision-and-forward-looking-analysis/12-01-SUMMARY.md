Phase 12 plan `12-01` is complete.

The repo now ships a real `forward-looking` module instead of a placeholder route. `demo-web/scripts/export_phase6_secondary_bundles.py` generates `forward-looking-summary.json`, `forward-looking-scenarios.json`, `forward-looking-bundle.json`, and `manifest.json` from committed BiLSTM 1h forecast frames, evaluation rankings, corridor-dominance runtime data, and the honest zero-byte `CLUS-03` fallback. The module is marked `partial`, with `12-02` and `12-03` preserved as explicit deferred follow-ups instead of being faked in this wave.

On the frontend, the shell now discovers `forward-looking` as a real module, the new page renders curated focus route/grid scenarios plus recommendation and evidence sections, and overview/home now cross-link collaborative decision as part of the site-wide offline-showcase story. Corridor dominance remains contextual rather than being overstated as a route-level reclustering fact, and the page keeps the same no-live-optimizer boundary already used elsewhere on the site.

Verification completed:
- `python demo-web/scripts/export_phase6_secondary_bundles.py --module forward-looking`
- `python demo-web/scripts/export_phase6_secondary_bundles.py --module overview`
- `node demo-web/tests/module-registry.test.mjs`
- `node demo-web/tests/platform-runtime.test.mjs`
- `node demo-web/tests/overview-module.test.mjs`
- `node demo-web/tests/forward-looking-module.test.mjs`
- `node demo-web/tests/platform-shell-smoke.test.mjs`
- `npm.cmd run smoke`
- `npm.cmd run lint`
- `.\\node_modules\\.bin\\tsc.cmd -b`

Planning closeout:
- `.planning/ROADMAP.md` now marks `12-01` complete and advances Phase 12 to `1/3` in progress
- `.planning/STATE.md` now moves the current plan to `12-02`
- `.planning/REQUIREMENTS.md` now marks `DECI-01`, `DECI-02`, and `DECI-04` complete while keeping `DECI-03` pending for the real before/after toggle

What remains:
- `12-02` should deepen the focus route/grid and recommendation UI into a richer interactive surface
- `12-03` should add the explicit before/after toggle and state-summary switching on top of the already-shipped applied-state evidence
