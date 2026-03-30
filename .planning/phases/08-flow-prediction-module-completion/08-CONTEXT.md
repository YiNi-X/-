# Phase 8 Context: Flow Prediction Module Completion

_Last updated: 2026-03-26_

## Working Direction

Phase 8 should complete the flow-prediction module as a real product module on top of the Phase 7 shell, but it must remain extensible for later paper-style visuals and animations. We should not fabricate node-level outputs, multi-model comparisons, or animated surfaces before their authoritative exported data exists.

The module should therefore be built in two layers:

1. **Phase 8 core layer**: a forecast cockpit driven by the already-stable summary timeline, hotspot, metric, and STGCN bundle fields.
2. **Phase 8 extension layer**: optional data backfills that unlock node-level paper-like figures, richer model comparison, and animation-capable views without forcing a later redesign.

## Existing Data Already Ready

These artifacts are already sufficient for the first honest version of the module and do **not** need to block UI work:

- `forecast-runtime.json`: archived timeline frames, total flow series, 1h/2h/3h horizons, hotspot summaries, per-frame narrative fields
- `forecast-metrics.json`: shipped metric summary for the current structured forecast module
- `forecast-model-config.json`: STGCN architecture metadata, `nodeOrder`, graph adjacency, and hotspot-node mapping
- `evaluation-metrics.json`: current forecast ranking surface, which is STGCN-first today
- `shared-geometry.json`: study-area bounds, corridor polylines, and hotspot points for the current product-facing geography

## Forecast Data Backfill Schedule

The table below records the recommended timing, method, and difficulty for each forecast data artifact that would strengthen the module beyond the current baseline.

| Data artifact | Current state | Recommended timing | How to complete it | Difficulty | Estimated local effort / rerun time | Unlocks |
|---|---|---|---|---|---|---|
| `forecast-summary-and-hotspot bundle` | Already shipped via `forecast-runtime.json`, `forecast-metrics.json`, and `forecast-model-config.json` | No extra backfill needed before Phase 8 UI work | Reuse existing Phase 6 bundle and keep the UI on top of these fields for the cockpit summary, horizon switching, hotspot cards, and narrative panel | Low | Already available | Honest Phase 8 P0 UI: total-flow timeline, hotspot small multiples, metric cards, evidence drawer entry points |
| `forecast-lstm-runtime` | Deferred since Phase 6; only notebook definitions are committed | **Phase 8 early** (`08-01A`) before finalizing model switching UI | Re-run the existing `LSTM.ipynb` logic on the same archived scenario window, then export `runtime + metrics + manifest` in the same schema family as the STGCN bundle | Medium | ~0.5-1 day of cleanup/export work; ~1-3 hours local rerun depending on notebook stability | Honest `STGCN / LSTM` model switching and fairer evaluation comparison |
| `forecast-bilstm-runtime` | Deferred since Phase 6; only notebook definitions are committed | **Phase 8 early** (`08-01A`) before finalizing model switching UI | Re-run the existing `BILSTM.ipynb` logic on the same archived scenario window, then export `runtime + metrics + manifest` in the same schema family as the STGCN bundle | Medium | ~0.5-1 day of cleanup/export work; ~1-3 hours local rerun depending on notebook stability | Honest `STGCN / BiLSTM` model switching and fairer evaluation comparison |
| `forecast-node-series-actual` | Missing from the shipped website bundle; raw 60-grid hourly source exists in `grid_mmsi_count（流量数据）.csv` | **Phase 8 mid**, only if we want paper-like node-level charts in the same iteration | Export a frame-aligned `actual[node][frame]` or equivalent `frames -> nodes` structure from the hourly grid source using the same archived window and timeline alignment rules as the current runtime bundle | Medium | ~0.5 day exporter/alignment work; compute cost is light | 60-node radar, all-node heatmap, node-detail panel, paper-mode snapshots |
| `forecast-node-series-stgcn` | Missing from the shipped website bundle; only hotspot slices are currently productized | **Phase 8 mid or late** (`08-01B`) after the cockpit baseline is stable | Re-run STGCN inference and export per-node predictions for `1h / 2h / 3h` aligned to the same playback frames as the website bundle | Medium-High | ~0.5-1 day exporter/alignment work; ~1-3 hours local rerun | Honest node-level STGCN paper visuals, all-node comparison charts, future animation support |
| `forecast-node-series-lstm-bilstm` | Missing and depends on both deferred model runtimes being stable first | **After the main Phase 8 cockpit is stable**; acceptable as `08.x` enhancement if time is tight | Extend the LSTM and BiLSTM reruns to export node-level predictions in the same aligned schema as STGCN node series | High | ~1-2 days cleanup/alignment work after the model reruns; ~2-6 hours total local rerun time across both models | True paper-style multi-model node comparisons, multi-model radar, later animation parity |
| `forecast-node-geometry` | Only hotspot geometry is currently productized; full 60-grid spatial metadata is not yet shipped | **Only when we want all-node spatial heatmaps or map animations**; not required for the first cockpit | Derive or author authoritative centroids/polygons for the 60 forecast nodes from the study-area grid definition and ship them as a separate metadata artifact | Medium-High | ~0.5-1 day data-authoring/verification work; little compute cost | All-node spatial heatmaps, grid-map overlays, node animation on the map instead of only chart views |
| `forecast-evidence-assets` | Correlation and distance matrices already exist in `代码依据/流量预测`; scatter-matrix style evidence mostly lives in notebooks/papers | **Can land during Phase 8 UI work** because it does not block the main cockpit | Export thumbnails or structured references for matrix/evidence panels; keep them in an evidence drawer rather than forcing them into the main stage | Low | ~0.5 day to curate/export images or compact data references | Paper-like evidence drawer without overcomplicating the primary forecast story |

## Recommended Sequencing

### Must complete before the final Phase 8 UI is considered done

- `forecast-lstm-runtime`
- `forecast-bilstm-runtime`

These two items are the honest minimum required to satisfy the existing roadmap promise of model switching.

### Strongly recommended, but allowed to slip behind the first stable cockpit

- `forecast-node-series-actual`
- `forecast-node-series-stgcn`
- `forecast-evidence-assets`

These unlock the first true paper-style node/detail views, but the module can still ship a credible Phase 8 cockpit without them if the team needs to protect schedule.

### Safe to defer to an `08.x` enhancement or later phase if needed

- `forecast-node-series-lstm-bilstm`
- `forecast-node-geometry`

These are enhancement layers for exact paper-like multi-model node views, map heat layers, and animation parity. They should not be fabricated just to satisfy a visual idea.

## Extensibility Rules For The Phase 8 UI

To preserve room for later paper-like visuals and animations, the Phase 8 UI should reserve optional data slots even if some remain absent in the first implementation.

Recommended optional view-model fields:

- `summarySeries`
- `hotspotSeries`
- `modelRuns`
- `nodeSeries`
- `nodeGeometry`
- `frameSnapshots`
- `evidenceAssets`
- `animationPresets`

The initial Phase 8 cockpit can leave some of these empty, but components should be designed so later node-level exports plug in without replacing the page shell.

## Practical Guidance

- Build the main module first around the already-ready summary and hotspot data.
- Treat node-level paper visuals as an upgrade path, not a fake requirement.
- Keep the UI honest: if a figure needs data we have not exported yet, expose it as a later extension rather than simulating it with arbitrary sliders.
- If time pressure appears, prefer shipping a strong STGCN-first cockpit plus real evidence drawers over rushing unstable notebook conversions.
