# 06-01 Summary

## What Changed

- Added `06-ASSET-INVENTORY.md` with one global audit table plus per-module appendices for forecast, repair, clustering, evaluation, and overview.
- Added `06-LINEAGE-MATRIX.md` to freeze authoritative source aliases, exported artifact IDs, clustering layer boundaries, and deferred artifacts before bundle generation.

## Key Decisions Captured

- Forecast Phase 6 work is STGCN-authoritative only; LSTM/BiLSTM stay deferred until committed structured results exist.
- Repair can be exported directly from the existing CSV and PKL evidence without rerunning notebooks.
- Clustering provenance stays layered: raw `cleaned_ais.CSV`, segmented `segments(60-90).pkl`, compressed `compressed_segments(60,90,0.03).pkl`, and corridor/exported `main-corridor-tracks.json`.
- Corridor regeneration is review-first and must not overwrite the live runtime corridor file during Phase 6.

## Verification

- Inventory contains forecast, repair, clustering, evaluation, overview module sections.
- Lineage matrix contains `artifactId`, `sourceStage`, `derivedFrom`, `scenarioId`, `timeRange`, and `authoritativeFor` fields.
