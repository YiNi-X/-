import type { FlowForecastData, GeometryConfig, ModuleBundleEntryFiles } from '../../sharedContracts'

export type ForecastMetricEntry = {
  sampleCount: number
  mae: number
  rmse: number
  r2: number
}

export type ForecastAnalysisTabId = 'overview' | 'grid-focus' | 'node-view' | 'evidence'

export type ForecastMetricsFile = {
  module: 'forecast'
  scenarioId: string
  metricBasis: string
  generatedAt: string
  models: Record<
    string,
    {
      status: 'available' | 'deferred'
      horizons?: Record<string, ForecastMetricEntry>
    }
  >
  deferredModels?: Array<{ model: string; reason: string }>
}

export type ForecastEntryFiles = ModuleBundleEntryFiles & {
  runtime: string
  metrics: string
  modelConfig?: string
}

export type ForecastModelConfig = {
  meta: {
    version: number
    modelName: string
    generatedBy: string
    flowSeriesSource: string
    graphSource: string
    weightSource: string
    weightSha256: string
    flowResolutionMinutes: number
    playbackResolutionMinutes: number
    windowStart: string
    windowEnd: string
    warmStartMode: string
  }
  architecture: {
    modelFamily?: string
    n_his: number
    n_pred: number
    n_route: number
    inputDim?: number
    hiddenDim?: number
    numLayers?: number
    bidirectional?: boolean
    Ks?: number
    Kt?: number
    blocks?: number[][]
    dropProb?: number
  }
  split: {
    trainRatio: number
    valRatio: number
    testRatio: number
    trainLength: number
    valLength: number
    testLength: number
  }
  nodeOrder: string[]
  hotspotNodeMap: Record<string, string>
  routeFocusMap?: Record<string, string>
}

export type ForecastLoadedBundle = {
  runtime: FlowForecastData
  metrics: ForecastMetricsFile
  modelConfig: ForecastModelConfig | null
  geometry: GeometryConfig | null
}

export type ForecastEvidenceAsset = {
  id: string
  label: string
  type: 'matrix' | 'scatter' | 'paper' | 'metadata'
  description: string
  readiness: 'ready' | 'pending'
}

export type ForecastGridSeries = {
  gridId: string
  current: number[]
  forecastByHorizon: Record<string, number[]>
}

export type ForecastMetricTrendRow = {
  horizon: string
  sampleCount: number
  mae: number
  rmse: number
  r2: number
}

export type ForecastFrameComparisonRow = {
  gridId: string
  routeId: string | null
  current: number
  forecast: number
  delta: number
  alertLevel: string | null
  hotspotLevel: string | null
  isFocus: boolean
}

export type ForecastEvidenceFact = {
  label: string
  value: string
}

export type ForecastHotspotNodeLink = {
  gridId: string
  nodeId: string
  routeId: string | null
}

export type ForecastViewModel = {
  meta: {
    availableModels: string[]
    deferredModels: Array<{ model: string; reason: string }>
    availableHorizons: string[]
    nodeViewReady: boolean
    evidenceReady: boolean
    metricBasis: string
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
    visibleVessels: number | null
  }
  timeline: {
    labels: string[]
    totalFlow: number[]
    forecastTotalsByHorizon: Record<string, number[]>
    selectedFrameIndex: number
  }
  frame: FlowForecastData['timeline'][number] | null
  metrics: {
    byModel: ForecastMetricsFile['models']
    selectedModelHorizons: Record<string, ForecastMetricEntry>
    degradationRows: ForecastMetricTrendRow[]
  }
  hotspotSeries: {
    gridIds: string[]
    byGrid: Record<string, ForecastGridSeries>
  }
  frameComparison: {
    rows: ForecastFrameComparisonRow[]
  }
  focusMap: {
    focusRouteId: string | null
    focusGridId: string | null
    routeIds: string[]
    hotspotIds: string[]
  }
  evidenceAssets: ForecastEvidenceAsset[]
  evidence: {
    runtimeFacts: ForecastEvidenceFact[]
    architectureFacts: ForecastEvidenceFact[]
    hotspotNodeLinks: ForecastHotspotNodeLink[]
  }
  readiness: {
    selectedModelDeferredReason?: string
    nodeViewMessage: string
    evidenceMessage: string
  }
}
