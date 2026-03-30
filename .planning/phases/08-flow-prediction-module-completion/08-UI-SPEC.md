# Phase 8 Forecast UI Spec

_Last updated: 2026-03-26_

## Purpose

This document turns the Phase 8 forecast direction into a developer-ready page specification. The goal is to replace the current baseline `ForecastPage` with a true forecast cockpit that:

- reads the Phase 6/7 forecast bundle honestly
- supports later model and node-level backfills without redesigning the page shell
- looks like a product module first, but still leaves room for paper-style evidence views

## Design Direction

The visual direction should stay consistent with the current shell: a serious command-center product surface, not a bright notebook export. The page should feel like a **prediction cockpit**:

- a strong summary band at the top
- one dominant primary chart in the center
- a compact right-side interpretation and control rail
- lower-level evidence views behind tabs and drawers rather than dumped onto the main stage

## Phase 8 Boundary

### Phase 8 must ship

- horizon switching (`1h / 2h / 3h`)
- model readiness surface
- timeline-linked total-flow forecast view
- hotspot-focused charts for the 4 productized grids
- metric view for the current selected model and horizon
- narrative / alert / recommendation panel
- evidence drawer entry for matrices and paper support assets

### Phase 8 may reserve but not fake

- full 60-node radar chart
- all-node heatmap
- node-level animated views
- true multi-model node comparison
- paper-parity animations

These should appear only when their data contracts are present.

## Page Information Architecture

The forecast page should have four permanent layers:

1. `Summary Band`
2. `Primary Stage`
3. `Analysis Tabs`
4. `Evidence Drawer`

### Layer 1: Summary Band

This is always visible at the top of the page.

Contents:
- module title + short framing line
- selected model badge
- selected horizon badge
- current frame time
- four KPI cards
- primary action button to evaluation center

Recommended KPI cards:
- `Current Total Flow`
- `Selected Horizon Forecast`
- `Hotspot Count`
- `Focus Grid / Focus Route`

### Layer 2: Primary Stage

This is the main visual area and should dominate the page.

Layout:
- left: main chart zone
- right: control and interpretation rail

### Layer 3: Analysis Tabs

This is the secondary content layer directly below the primary stage.

Tabs:
- `Overview`
- `Grid Focus`
- `Node View`
- `Evidence`

`Node View` can exist from the first release, but if node-level data is absent it should show a proper staged-extension panel rather than fake data.

### Layer 4: Evidence Drawer

This is collapsible and holds paper-facing support visuals:
- correlation matrix
- distance matrix
- scatter-matrix thumbnail or paper reference
- architecture metadata summary
- data-readiness note for deferred views

## Wireframe

```text
+--------------------------------------------------------------------------------------+
| Forecast Summary Band                                                                |
| [Flow Prediction] [STGCN ready] [1h selected] [2020-01-01 03:55]   [Compare Results]|
| [Current Total] [Forecast Total] [Hotspot Count] [Focus Grid / Route]                |
+--------------------------------------------------------------------------------------+
| Primary Stage                                                                        |
| +-----------------------------------------------------------+ +--------------------+ |
| | Total Flow Timeline Chart                                 | | Control Rail       | |
| | - actual total flow                                       | | - model switch     | |
| | - 1h/2h/3h lines or selected horizon emphasis             | | - horizon tabs     | |
| | - current-frame marker                                    | | - frame summary    | |
| | - brush / zoom                                            | | - alert summary    | |
| +-----------------------------------------------------------+ | - narrative        | |
|                                                             | | - recommendation   | |
|                                                             | | - playback actions | |
|                                                             | +--------------------+ |
+--------------------------------------------------------------------------------------+
| Analysis Tabs: [Overview] [Grid Focus] [Node View] [Evidence]                        |
|                                                                                      |
| Overview Tab: horizon metric cards + forecast degradation chart                      |
| Grid Focus Tab: 4 hotspot small multiples + selected-frame compare bars              |
| Node View Tab: staged-extension panel or node chart surface                          |
| Evidence Tab: compact paper-facing cards + open drawer                               |
+--------------------------------------------------------------------------------------+
| Evidence Drawer                                                                      |
| [Correlation Matrix] [Distance Matrix] [Scatter/Paper Evidence] [Architecture Card]  |
+--------------------------------------------------------------------------------------+
```

## Tab Structure

## 1. `Overview` tab

Purpose:
- give the broadest understanding of the selected model and horizon
- explain how the forecast evolves across the full replay window

Required widgets:
- `ForecastMetricTrendCard`
- `ForecastHorizonQualityStrip`
- `ForecastFrameSummaryCard`
- `ForecastNarrativePanel`

Data sources:
- `forecast-metrics.json`
- `forecast-runtime.json.timeline[selectedFrame]`
- `forecast-runtime.json.series.totalFlow`
- `forecast-runtime.json.series.forecastTotals`

## 2. `Grid Focus` tab

Purpose:
- turn the 4 productized hotspot grids into a usable forecast story
- support the first real detailed interaction even before node-level exports exist

Required widgets:
- `ForecastHotspotSmallMultiples`
- `ForecastFrameCompareBars`
- `ForecastAlertTable`
- `ForecastFocusMapCard`

Data sources:
- `forecast-runtime.json.timeline[selectedFrame].current.keyGrids`
- `forecast-runtime.json.timeline[selectedFrame].forecast[selectedHorizon].keyGrids`
- `forecast-runtime.json.timeline[selectedFrame].derived.hotspots`
- `forecast-runtime.json.timeline[selectedFrame].derived.alerts`
- `shared-geometry.json.hotspots`

## 3. `Node View` tab

Purpose:
- reserve space for future paper-like node-level charts
- avoid redesign later when node exports land

Phase 8 first release behavior:
- if `nodeSeries` is missing, show a staged-extension status card explaining that node-level forecast exports are not yet shipped in this version
- if `nodeSeries` exists later, switch to a real node-level canvas

Future widgets:
- `ForecastNodeRadarCard`
- `ForecastNodeHeatmap`
- `ForecastNodeLeaderboard`
- `ForecastNodeAnimationPanel`

## 4. `Evidence` tab

Purpose:
- keep paper evidence visible but subordinate to the product story

Required widgets:
- `ForecastEvidenceOverviewCard`
- `ForecastEvidenceAssetGrid`
- `ForecastArchitectureCard`
- button to open full evidence drawer

Future upgrade path:
- evidence assets can remain images or compact references without blocking the main charts

## Component Tree

```text
ForecastPageShell
- ForecastDataLoader
- ForecastViewModelProvider
  - ForecastSummaryBand
    - ForecastTitleBlock
    - ForecastModelBadgeGroup
    - ForecastKpiGrid
    - ForecastPrimaryAction
  - ForecastPrimaryStage
    - ForecastPrimaryChartPanel
      - ForecastTimelineChart
      - ForecastTimelineBrush
      - ForecastFrameMarker
    - ForecastControlRail
      - ForecastModelSwitch
      - ForecastHorizonTabs
      - ForecastFrameInspector
      - ForecastQuickStats
      - ForecastNarrativePanel
  - ForecastAnalysisTabs
    - ForecastOverviewTab
      - ForecastMetricTrendCard
      - ForecastHorizonQualityStrip
      - ForecastFrameSummaryCard
    - ForecastGridFocusTab
      - ForecastHotspotSmallMultiples
      - ForecastFrameCompareBars
      - ForecastAlertTable
      - ForecastFocusMapCard
    - ForecastNodeViewTab
      - ForecastNodeStateSurface
      - ForecastNodeRadarCard (future)
      - ForecastNodeHeatmap (future)
    - ForecastEvidenceTab
      - ForecastEvidenceOverviewCard
      - ForecastEvidenceAssetGrid
      - ForecastArchitectureCard
  - ForecastEvidenceDrawer
    - ForecastMatrixPanel
    - ForecastScatterEvidencePanel
    - ForecastDeferredModelsPanel
```

## Shared State Model

The page should centralize state instead of letting each panel manage its own selection.

Required page-level state:
- `selectedModel`
- `selectedHorizon`
- `selectedFrameIndex`
- `selectedTab`
- `selectedGridId`
- `isEvidenceDrawerOpen`
- `nodeViewAvailability`

Recommended defaults:
- `selectedModel = first available model` (`STGCN` today)
- `selectedHorizon = '1h'`
- `selectedFrameIndex = latest visible or meaningful default frame`
- `selectedTab = 'overview'`
- `selectedGridId = timeline[selectedFrame].derived.focusGrid`

## View Model Contract

The React page should not read raw bundle fields directly everywhere. Create one adapter layer that maps the current JSON into a stable page-facing view model.

Recommended shape:

```ts
export type ForecastViewModel = {
  meta: {
    availableModels: string[]
    deferredModels: Array<{ model: string; reason: string }>
    availableHorizons: string[]
    nodeViewReady: boolean
    evidenceReady: boolean
  }
  summaryBand: {
    modelLabel: string
    horizonLabel: string
    frameLabel: string
    currentTotal: number | null
    selectedForecastTotal: number | null
    hotspotCount: number | null
    focusGridId: string | null
    focusRouteId: string | null
  }
  timeline: {
    labels: string[]
    totalFlow: number[]
    forecastTotalsByHorizon: Record<string, number[]>
    selectedFrameIndex: number
  }
  frame: {
    current: {
      totalFlow: number
      visibleVessels: number
      keyGrids: Record<string, number>
    }
    forecastByHorizon: Record<string, { totalFlow: number; keyGrids: Record<string, number> }>
    derived: {
      focusGrid: string
      focusRoute: string
      hotspotCount: number
      hotspots: Array<{ id: string; intensity: number; level: string }>
      alerts: Array<{ grid: string; level: string; current: number; future: number; note: string }>
    }
    narrative: {
      phase: string
      status: string
      summary: string
      logs: string[]
      strategy?: { headline: string; summary: string }
      recommendations?: Array<{ target: string; action: string; reason: string; effect: string }>
      benefits?: Array<{ label: string; before: string; after: string; unit?: string }>
    }
  }
  metrics: {
    byModel: Record<string, { status: 'available' | 'deferred'; horizons?: Record<string, { mae: number; rmse: number; r2: number; sampleCount: number }> }>
  }
  hotspotSeries: {
    gridIds: string[]
    byGrid: Record<string, { currentSeries: number[]; forecastSeriesByHorizon: Record<string, number[]> }>
  }
  nodeSeries?: {
    actual: number[][]
    forecastByModel: Record<string, Record<string, number[][]>>
  }
  evidenceAssets?: Array<{ id: string; label: string; type: 'matrix' | 'scatter' | 'paper'; src: string; description: string }>
}
```

## Data Mapping Rules

### Summary band

- `currentTotal` -> `timeline[selectedFrame].current.totalFlow`
- `selectedForecastTotal` -> `timeline[selectedFrame].forecast[selectedHorizon].totalFlow`
- `hotspotCount` -> `timeline[selectedFrame].derived.hotspotCount`
- `focusGrid / focusRoute` -> `timeline[selectedFrame].derived.focusGrid` + `focusRoute`

### Main timeline chart

- actual line -> `series.totalFlow`
- horizon lines -> `series.forecastTotals[horizon]`
- marker -> `selectedFrameIndex`

### Grid small multiples

For each of `G03 / G25 / G60 / G15`:
- actual series -> collect from all timeline frames `current.keyGrids[gridId]`
- forecast series -> collect from all timeline frames `forecast[selectedHorizon].keyGrids[gridId]`

### Metric trend card

- read `mae / rmse / r2` from `forecast-metrics.json.models[selectedModel].horizons`
- draw a horizon progression chart rather than only numeric cards

### Deferred models panel

- read from `forecast-metrics.json.deferredModels`
- keep this panel visible until LSTM/BiLSTM bundles really exist

## Interaction Rules

### Allowed now

- model switch when multiple model bundles become available
- horizon tab switch
- timeline click and brush
- hotspot card selection
- open/close evidence drawer
- tab switch

### Not allowed as fake interaction

- arbitrary slider that modifies outputs without a real rerun or precomputed bundle
- fake confidence interval
- fake node-level animation when `nodeSeries` is absent

## Loading and Error Behavior

### Loading

- show the summary band shell immediately
- use chart skeletons in the primary stage
- keep tab headers visible while content skeletons load

### Error

- page-level load failure -> `PlatformStatusSurface` in the main stage
- partial data absence -> local status card only in the affected subpanel
- node/evidence absence -> staged-extension card, not page failure

## Suggested File Structure

```text
demo-web/src/platform/forecast/
- useForecastModule.ts
- forecastViewModel.ts
- forecastTypes.ts
- ForecastSummaryBand.tsx
- ForecastPrimaryStage.tsx
- ForecastTimelineChart.tsx
- ForecastControlRail.tsx
- ForecastAnalysisTabs.tsx
- ForecastOverviewTab.tsx
- ForecastGridFocusTab.tsx
- ForecastNodeViewTab.tsx
- ForecastEvidenceTab.tsx
- ForecastEvidenceDrawer.tsx
- ForecastMetricTrendCard.tsx
- ForecastHotspotSmallMultiples.tsx
- ForecastFrameCompareBars.tsx
- ForecastAlertTable.tsx
- ForecastNarrativePanel.tsx
```

The existing `ForecastPage.tsx` should become a composition shell rather than a data-parsing page.

## Implementation Slices

### Slice P0

- `useForecastModule`
- `forecastViewModel` adapter
- `ForecastSummaryBand`
- `ForecastPrimaryStage`
- `ForecastTimelineChart`
- `ForecastControlRail`
- `Overview` tab

### Slice P1

- `Grid Focus` tab
- `ForecastHotspotSmallMultiples`
- `ForecastFrameCompareBars`
- `ForecastAlertTable`
- `ForecastNarrativePanel`

### Slice P2

- `Evidence` tab
- `ForecastEvidenceDrawer`
- architecture and matrix cards
- deferred node-view state surface

### Slice P3

Only after the data backfills exist:
- real model switch beyond STGCN
- node-level charts
- paper-mode animation hooks

## Acceptance Checklist

The new Forecast module is ready for Phase 8 implementation when all are true:

- a developer can implement the page without guessing where each visual belongs
- every current widget maps to a real bundle field
- future paper-style visuals have a reserved home
- the page can ship with missing node-level data without becoming misleading
- `ForecastPage.tsx` can be simplified into a shell over focused forecast components
