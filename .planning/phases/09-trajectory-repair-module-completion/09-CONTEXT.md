# Phase 9 Context: Trajectory Repair Module Completion

_Last updated: 2026-03-29_

## Working Direction

Phase 9 should turn the repair module into an honest, curated product surface on top of the Phase 7 shell and the already-exported repair bundles. The module should stay explicit that it is driven by offline notebook-derived artifacts, not a live vessel replay or online inference service.

The most important practical distinction for planning is that the worktree already contains substantial Phase 9 material:

1. A structured repair data package is already exported under `demo-web/public/data/modules/repair/`.
2. A repair cockpit UI is already present under `demo-web/src/platform/repair/` and `demo-web/src/platform/pages/RepairPage.tsx`.
3. The remaining likely gap is not basic data loading or sample/model switching, but final polish around metric-summary completeness, verification, and planning traceability.

This means downstream planning should avoid pretending Phase 9 starts from zero. The right question is how much of `09-01`, `09-02`, and `09-03` is already satisfied, and what narrow slice still needs explicit completion.

## Existing Data Already Ready

These artifacts are already sufficient for a real first-pass repair module and should not block UI work:

- `repair-bundle.json`: module entry bundle with sample count, entry files, available models, and deferred optuna export metadata
- `repair-samples.json`: curated sample catalog with target IDs, missing-point counts, ground-truth counts, and available models
- `repair-trajectories.json`: missing, ground-truth, and repaired trajectories for each curated sample
- `repair-errors.json`: per-model longitude, latitude, and euclidean error arrays
- `repair-metrics.json`: scalar metrics for each sample and model, including MAE, RMSE, DTW similarity, ADE, R-squared, Hausdorff distance, and per-axis means
- `manifest.json`: lineage and requirement mapping for the repair package

## Repair UI Already Present In The Worktree

The current worktree already exposes a substantial repair experience:

- `RepairPage.tsx` wires a dedicated repair module page into the platform shell
- `useRepairModule.ts` loads the repair bundle and keeps sample, model, error metric, and layer toggles in one state contract
- `RepairPrimaryStage.tsx` supports sample switching, model switching, visible-layer switching, and repair-stage metric spotlights
- `RepairTrajectoryPlot.tsx` overlays missing, ground-truth, and repaired trajectories on one visual stage
- `RepairDetailGrid.tsx` renders error curves and a sample-level ranking surface for the selected method
- `RepairSummaryBand.tsx` provides top-level sample and model summary cards plus evaluation navigation

## Current Phase Assessment

### `09-01` Data curation and structured export

This appears effectively landed in the worktree.

Evidence:

- curated sample catalog exists in `repair-samples.json`
- structured trajectory payload exists in `repair-trajectories.json`
- structured error arrays exist in `repair-errors.json`
- structured scalar metrics exist in `repair-metrics.json`
- manifest maps those exports to `REPR-01` through `REPR-05`

### `09-02` Repair comparison module with sample and model switching

This also appears effectively landed in the worktree.

Evidence:

- sample switching is implemented in `RepairPrimaryStage.tsx`
- model switching is implemented in `RepairPrimaryStage.tsx` and `useRepairModule.ts`
- missing, ground-truth, and repaired trajectory overlays are implemented in `RepairTrajectoryPlot.tsx`
- the repair page already loads and renders this stage through `RepairPage.tsx`

### `09-03` Error charts and metric summaries

This appears mostly landed, but it is the most likely place where Phase 9 still needs explicit finish work.

Already present:

- error charts for longitude, latitude, and euclidean distance
- sample-level model ranking cards
- spotlight metrics for RMSE, MAE, DTW similarity, and Hausdorff distance

Likely remaining gap:

- the current repair UI does not obviously surface the full metric-summary set promised by `REPR-05`, especially `R-squared` and `ADE`, even though those values already exist in `repair-metrics.json`
- there is no repair-specific module test yet comparable to the forecast module coverage added in Phase 8

## Phase Boundary Guidance

Phase 9 should stay focused on the repair module itself:

- curated sample selection
- model switching
- missing vs repaired vs ground-truth comparison
- error charts
- metric summaries

Do not expand Phase 9 into:

- optuna study visualization
- parameter-importance analysis
- evaluation-center redesign
- additional live or user-upload workflows

Those belong to later evaluation or future capability phases.

## Recommended Planning Direction

The next plan should not restart `09-01` from scratch. Instead, planning should treat the worktree as already containing:

- a landed `09-01` data-export baseline
- a landed `09-02` repair-cockpit baseline
- a near-finished `09-03` detail layer

Recommended next action:

1. audit the repair UI against `REPR-01` through `REPR-05`
2. close any remaining `09-03` metric-summary gaps, especially `R-squared` and `ADE` visibility
3. add repair-specific verification so the module has explicit smoke coverage rather than only shell-level presence

## Practical Notes

- keep the repair page honest that all evidence is sample-scoped and notebook-derived
- preserve the current curated-sample framing rather than implying arbitrary trajectory upload or live reconstruction
- prefer narrowing the remaining work to polish and verification instead of reopening bundle-generation scope unless audit finds a real data mismatch
