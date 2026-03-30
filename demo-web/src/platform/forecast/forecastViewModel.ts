import type { FlowForecastData, GeometryConfig } from '../../sharedContracts'
import type {
  ForecastEvidenceAsset,
  ForecastEvidenceFact,
  ForecastFrameComparisonRow,
  ForecastGridSeries,
  ForecastHotspotNodeLink,
  ForecastLoadedBundle,
  ForecastMetricEntry,
  ForecastMetricsFile,
  ForecastMetricTrendRow,
  ForecastViewModel,
} from './forecastTypes.ts'

function formatFrameLabel(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function shortLabel(input: string) {
  const normalized = input.replace(/\\/g, '/').split('/').pop() ?? input
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized
}

function formatPercent(input: number) {
  return `${(input * 100).toFixed(1)}%`
}

function formatBlocks(blocks: number[][]) {
  return blocks.map((block) => `[${block.join(', ')}]`).join(' -> ')
}

function getAvailableModels(metrics: ForecastMetricsFile) {
  return Object.entries(metrics.models)
    .filter(([, value]) => value.status === 'available')
    .map(([model]) => model)
}

function buildEvidenceAssets(runtime: FlowForecastData, geometry: GeometryConfig | null): ForecastEvidenceAsset[] {
  const architectureLabel = runtime.meta.model === 'STGCN' ? 'STGCN Architecture' : `${runtime.meta.model} Architecture`
  const assets: ForecastEvidenceAsset[] = [
    {
      id: 'correlation-matrix',
      label: 'Correlation Matrix',
      type: 'matrix',
      description: 'Correlation evidence exists in the research base and should surface through the evidence drawer rather than the main stage.',
      readiness: 'pending',
    },
    {
      id: 'distance-matrix',
      label: 'Distance Matrix',
      type: 'matrix',
      description: 'Distance-matrix support can be added as a paper-facing evidence card without changing the forecast cockpit shell.',
      readiness: 'pending',
    },
    {
      id: 'scatter-matrix',
      label: 'Scatter Matrix',
      type: 'scatter',
      description: 'Pairwise scatter evidence belongs in a later evidence asset pack, not the first-pass primary chart.',
      readiness: 'pending',
    },
    {
      id: `${runtime.meta.model.toLowerCase()}-architecture`,
      label: architectureLabel,
      type: 'metadata',
      description: `Current runtime uses ${runtime.meta.model} with ${runtime.meta.historyWindowHours}h history and ${runtime.meta.horizons.length} shipped horizons.`,
      readiness: 'ready',
    },
  ]

  if (geometry?.hotspots?.length) {
    assets.push({
      id: 'hotspot-geometry',
      label: 'Hotspot Geometry',
      type: 'metadata',
      description: `Shared geometry currently ships ${geometry.hotspots.length} product-facing hotspot points for map-linked forecast storytelling.`,
      readiness: 'ready',
    })
  }

  return assets
}

function buildHotspotSeries(runtime: FlowForecastData): ForecastViewModel['hotspotSeries'] {
  const gridIds = runtime.meta.hotspotIds
  const byGrid = gridIds.reduce<Record<string, ForecastGridSeries>>((accumulator, gridId) => {
    accumulator[gridId] = {
      gridId,
      current: runtime.timeline.map((entry) => entry.current.keyGrids[gridId] ?? 0),
      forecastByHorizon: runtime.meta.horizons.reduce<Record<string, number[]>>((horizonAccumulator, horizon) => {
        horizonAccumulator[horizon] = runtime.timeline.map((entry) => entry.forecast[horizon].keyGrids[gridId] ?? 0)
        return horizonAccumulator
      }, {}),
    }
    return accumulator
  }, {})

  return { gridIds, byGrid }
}

function getSelectedModelHorizons(metrics: ForecastMetricsFile, selectedModel: string): Record<string, ForecastMetricEntry> {
  const selected = metrics.models[selectedModel]
  if (!selected || selected.status !== 'available' || !selected.horizons) return {}
  return selected.horizons
}

function buildMetricTrendRows(selectedModelHorizons: Record<string, ForecastMetricEntry>): ForecastMetricTrendRow[] {
  return Object.entries(selectedModelHorizons).map(([horizon, values]) => ({
    horizon,
    sampleCount: values.sampleCount,
    mae: values.mae,
    rmse: values.rmse,
    r2: values.r2,
  }))
}

function buildFrameComparisonRows(runtime: FlowForecastData, frame: FlowForecastData['timeline'][number] | null, selectedHorizon: string): ForecastFrameComparisonRow[] {
  if (!frame) return []

  const selectedForecast = frame.forecast[selectedHorizon as keyof typeof frame.forecast]
  const hotspotLevels = new Map(frame.derived.hotspots.map((item) => [item.id, item.level]))
  const alertLevels = new Map(frame.derived.alerts.map((item) => [item.grid, item.level]))

  return runtime.meta.hotspotIds.map((gridId) => {
    const current = frame.current.keyGrids[gridId] ?? 0
    const forecast = selectedForecast?.keyGrids[gridId] ?? 0
    return {
      gridId,
      routeId: runtime.meta.routeFocusMap[gridId] ?? null,
      current,
      forecast,
      delta: forecast - current,
      alertLevel: alertLevels.get(gridId) ?? null,
      hotspotLevel: hotspotLevels.get(gridId) ?? null,
      isFocus: frame.derived.focusGrid === gridId,
    }
  })
}

function buildEvidenceFacts(bundle: ForecastLoadedBundle): {
  runtimeFacts: ForecastEvidenceFact[]
  architectureFacts: ForecastEvidenceFact[]
  hotspotNodeLinks: ForecastHotspotNodeLink[]
} {
  const runtimeFacts: ForecastEvidenceFact[] = [
    { label: 'Replay source', value: shortLabel(bundle.runtime.meta.source) },
    { label: 'Forecast mode', value: bundle.runtime.meta.forecastMode },
    {
      label: 'Time resolution',
      value: `${bundle.runtime.meta.inferenceResolutionMinutes}m inference / ${bundle.runtime.meta.playbackResolutionMinutes}m replay`,
    },
    {
      label: 'Window',
      value: `${formatFrameLabel(bundle.runtime.meta.windowStart)} -> ${formatFrameLabel(bundle.runtime.meta.windowEnd)}`,
    },
    { label: 'Metric basis', value: bundle.metrics.metricBasis },
  ]

  const architectureFacts: ForecastEvidenceFact[] = bundle.modelConfig
    ? [
        { label: 'Model family', value: bundle.modelConfig.architecture.modelFamily ?? bundle.runtime.meta.model },
        { label: 'History / prediction', value: `${bundle.modelConfig.architecture.n_his} -> ${bundle.modelConfig.architecture.n_pred}` },
        { label: 'Routes / nodes', value: String(bundle.modelConfig.architecture.n_route) },
        { label: 'Train / val / test', value: `${formatPercent(bundle.modelConfig.split.trainRatio)} / ${formatPercent(bundle.modelConfig.split.valRatio)} / ${formatPercent(bundle.modelConfig.split.testRatio)}` },
        ...(typeof bundle.modelConfig.architecture.inputDim === 'number' ? [{ label: 'Input dim', value: String(bundle.modelConfig.architecture.inputDim) }] : []),
        ...(typeof bundle.modelConfig.architecture.hiddenDim === 'number' ? [{ label: 'Hidden dim', value: String(bundle.modelConfig.architecture.hiddenDim) }] : []),
        ...(typeof bundle.modelConfig.architecture.numLayers === 'number' ? [{ label: 'Layers', value: String(bundle.modelConfig.architecture.numLayers) }] : []),
        ...(typeof bundle.modelConfig.architecture.bidirectional === 'boolean'
          ? [{ label: 'Bidirectional', value: bundle.modelConfig.architecture.bidirectional ? 'Yes' : 'No' }]
          : []),
        ...(typeof bundle.modelConfig.architecture.Ks === 'number' && typeof bundle.modelConfig.architecture.Kt === 'number'
          ? [{ label: 'Ks / Kt', value: `${bundle.modelConfig.architecture.Ks} / ${bundle.modelConfig.architecture.Kt}` }]
          : []),
        ...(bundle.modelConfig.architecture.blocks?.length ? [{ label: 'Blocks', value: formatBlocks(bundle.modelConfig.architecture.blocks) }] : []),
        ...(typeof bundle.modelConfig.architecture.dropProb === 'number'
          ? [{ label: 'Drop prob', value: bundle.modelConfig.architecture.dropProb.toFixed(2) }]
          : []),
      ]
    : [
        { label: 'Architecture', value: 'Model configuration file is not available in the current shell.' },
      ]

  const hotspotNodeLinks: ForecastHotspotNodeLink[] = bundle.modelConfig
    ? Object.entries(bundle.modelConfig.hotspotNodeMap).map(([gridId, nodeId]) => ({
        gridId,
        nodeId,
        routeId: bundle.runtime.meta.routeFocusMap[gridId] ?? null,
      }))
    : bundle.runtime.meta.hotspotIds.map((gridId) => ({
        gridId,
        nodeId: '--',
        routeId: bundle.runtime.meta.routeFocusMap[gridId] ?? null,
      }))

  return { runtimeFacts, architectureFacts, hotspotNodeLinks }
}

export function buildForecastViewModel(
  bundle: ForecastLoadedBundle,
  selectedModel: string,
  selectedHorizon: string,
  selectedFrameIndex: number,
): ForecastViewModel {
  const availableModels = getAvailableModels(bundle.metrics)
  const clampedFrameIndex = Math.max(0, Math.min(selectedFrameIndex, bundle.runtime.timeline.length - 1))
  const frame = bundle.runtime.timeline[clampedFrameIndex] ?? null
  const selectedModelHorizons = getSelectedModelHorizons(bundle.metrics, selectedModel)
  const evidenceAssets = buildEvidenceAssets(bundle.runtime, bundle.geometry)
  const hotspotSeries = buildHotspotSeries(bundle.runtime)
  const selectedForecast = frame ? frame.forecast[selectedHorizon as keyof typeof frame.forecast] : null
  const degradationRows = buildMetricTrendRows(selectedModelHorizons)
  const frameComparisonRows = buildFrameComparisonRows(bundle.runtime, frame, selectedHorizon)
  const evidenceFacts = buildEvidenceFacts(bundle)

  return {
    meta: {
      availableModels,
      deferredModels: bundle.metrics.deferredModels ?? [],
      availableHorizons: bundle.runtime.meta.horizons,
      nodeViewReady: false,
      evidenceReady: evidenceAssets.some((asset) => asset.readiness === 'ready'),
      metricBasis: bundle.metrics.metricBasis,
    },
    summaryBand: {
      modelLabel: selectedModel,
      horizonLabel: selectedHorizon,
      frameLabel: frame ? formatFrameLabel(frame.time) : '--',
      currentTotal: frame?.current.totalFlow ?? null,
      selectedForecastTotal: selectedForecast?.totalFlow ?? null,
      hotspotCount: frame?.derived.hotspotCount ?? null,
      focusGridId: frame?.derived.focusGrid ?? null,
      focusRouteId: frame?.derived.focusRoute ?? null,
      visibleVessels: frame?.current.visibleVessels ?? null,
    },
    timeline: {
      labels: bundle.runtime.timeline.map((entry) => formatFrameLabel(entry.time)),
      totalFlow: bundle.runtime.series.totalFlow,
      forecastTotalsByHorizon: bundle.runtime.series.forecastTotals,
      selectedFrameIndex: clampedFrameIndex,
    },
    frame,
    metrics: {
      byModel: bundle.metrics.models,
      selectedModelHorizons,
      degradationRows,
    },
    hotspotSeries,
    frameComparison: {
      rows: frameComparisonRows,
    },
    focusMap: {
      focusRouteId: frame?.derived.focusRoute ?? null,
      focusGridId: frame?.derived.focusGrid ?? null,
      routeIds: bundle.geometry?.meta.routeOrder ?? [],
      hotspotIds: bundle.geometry?.meta.hotspotOrder ?? bundle.runtime.meta.hotspotIds,
    },
    evidenceAssets,
    evidence: evidenceFacts,
    readiness: {
      selectedModelDeferredReason:
        bundle.metrics.deferredModels?.find((item) => item.model === selectedModel)?.reason ??
        (bundle.metrics.models[selectedModel]?.status === 'deferred' ? 'This model is not exported yet.' : undefined),
      nodeViewMessage:
        'Node-level forecast exports are intentionally staged for a later extension so the current cockpit does not pretend to have full 60-node runtime evidence.',
      evidenceMessage:
        'Paper-facing evidence can grow behind this drawer without displacing the main forecast cockpit or inventing unsupported interactions.',
    },
  }
}
