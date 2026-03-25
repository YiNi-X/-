# Phase 6 Rerun Times

_Last updated: 2026-03-25_

Measured locally on this workspace using `Measure-Command`.

| Command | Time (seconds) | Notes |
|---|---:|---|
| `python demo-web/scripts/export_phase6_primary_bundles.py --module all` | 1.58 | Rewrites forecast and repair module packages plus the shared artifact index |
| `python demo-web/scripts/export_phase6_secondary_bundles.py --module all` | 14.64 | Rewrites clustering, evaluation, and overview packages plus review artifacts |
| `python demo-web/scripts/verify_phase6_bundles.py` | 0.19 | Validates Phase 6 manifests, artifact paths, invariants, and review files |
| `npm run verify:phase6` | 9.92 | Runs Phase 6 bundle validation first, then the existing frontend lint/test/build gate |

## Practical Interpretation

- Forecast and repair re-export is cheap enough to rerun whenever lineage or schema changes.
- Clustering plus review generation is the longest local Phase 6 step, but still comfortably within a short demo-prep loop.
- Full Phase 6 verification remains fast enough to run before every showcase build.

## Environment Notes

- These timings do **not** include rebuilding notebook-only research outputs that are still deferred.
- They assume the current local Python environment can read the existing PKL and CSV artifacts already present in `代码依据/`.
