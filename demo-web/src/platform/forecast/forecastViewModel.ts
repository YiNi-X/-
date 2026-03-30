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
  const architectureLabel = runtime.meta.model === 'STGCN' ? 'STGCN 架构' : `${runtime.meta.model} 架构`
  const assets: ForecastEvidenceAsset[] = [
    {
      id: 'correlation-matrix',
      label: '相关性矩阵',
      type: 'matrix',
      description: '相关性证据已经存在于研究底稿中，更适合通过证据抽屉呈现，而不是直接塞进主舞台。',
      readiness: 'pending',
    },
    {
      id: 'distance-matrix',
      label: '距离矩阵',
      type: 'matrix',
      description: '距离矩阵可以作为论文向证据卡后续补充，而不必改动当前预测驾驶舱壳层。',
      readiness: 'pending',
    },
    {
      id: 'scatter-matrix',
      label: '散点矩阵',
      type: 'scatter',
      description: '成对散点证据应放进后续证据资源包，而不是第一版主图的一部分。',
      readiness: 'pending',
    },
    {
      id: `${runtime.meta.model.toLowerCase()}-architecture`,
      label: architectureLabel,
      type: 'metadata',
      description: `当前 runtime 使用 ${runtime.meta.model}，历史窗口为 ${runtime.meta.historyWindowHours}h，并已上线 ${runtime.meta.horizons.length} 个 horizon。`,
      readiness: 'ready',
    },
  ]

  if (geometry?.hotspots?.length) {
    assets.push({
      id: 'hotspot-geometry',
      label: '热点几何',
      type: 'metadata',
      description: `共享 geometry 当前提供 ${geometry.hotspots.length} 个产品侧热点点位，用于地图联动预测叙事。`,
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
    { label: '回放来源', value: shortLabel(bundle.runtime.meta.source) },
    { label: '预测模式', value: bundle.runtime.meta.forecastMode },
    {
      label: '时间分辨率',
      value: `${bundle.runtime.meta.inferenceResolutionMinutes} 分钟推理 / ${bundle.runtime.meta.playbackResolutionMinutes} 分钟回放`,
    },
    {
      label: '时间窗口',
      value: `${formatFrameLabel(bundle.runtime.meta.windowStart)} -> ${formatFrameLabel(bundle.runtime.meta.windowEnd)}`,
    },
    { label: '指标口径', value: bundle.metrics.metricBasis },
  ]

  const architectureFacts: ForecastEvidenceFact[] = bundle.modelConfig
    ? [
        { label: '模型族', value: bundle.modelConfig.architecture.modelFamily ?? bundle.runtime.meta.model },
        { label: '历史 / 预测步长', value: `${bundle.modelConfig.architecture.n_his} -> ${bundle.modelConfig.architecture.n_pred}` },
        { label: '航线 / 节点数', value: String(bundle.modelConfig.architecture.n_route) },
        { label: '训练 / 验证 / 测试', value: `${formatPercent(bundle.modelConfig.split.trainRatio)} / ${formatPercent(bundle.modelConfig.split.valRatio)} / ${formatPercent(bundle.modelConfig.split.testRatio)}` },
        ...(typeof bundle.modelConfig.architecture.inputDim === 'number' ? [{ label: '输入维度', value: String(bundle.modelConfig.architecture.inputDim) }] : []),
        ...(typeof bundle.modelConfig.architecture.hiddenDim === 'number' ? [{ label: '隐藏维度', value: String(bundle.modelConfig.architecture.hiddenDim) }] : []),
        ...(typeof bundle.modelConfig.architecture.numLayers === 'number' ? [{ label: '层数', value: String(bundle.modelConfig.architecture.numLayers) }] : []),
        ...(typeof bundle.modelConfig.architecture.bidirectional === 'boolean'
          ? [{ label: '双向', value: bundle.modelConfig.architecture.bidirectional ? '是' : '否' }]
          : []),
        ...(typeof bundle.modelConfig.architecture.Ks === 'number' && typeof bundle.modelConfig.architecture.Kt === 'number'
          ? [{ label: 'Ks / Kt', value: `${bundle.modelConfig.architecture.Ks} / ${bundle.modelConfig.architecture.Kt}` }]
          : []),
        ...(bundle.modelConfig.architecture.blocks?.length ? [{ label: '卷积块', value: formatBlocks(bundle.modelConfig.architecture.blocks) }] : []),
        ...(typeof bundle.modelConfig.architecture.dropProb === 'number'
          ? [{ label: 'Drop prob', value: bundle.modelConfig.architecture.dropProb.toFixed(2) }]
          : []),
      ]
    : [
        { label: '模型配置', value: '当前壳层尚未提供可读取的模型配置文件。' },
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
        (bundle.metrics.models[selectedModel]?.status === 'deferred' ? '该模型尚未导出到当前版本。' : undefined),
      nodeViewMessage:
        '节点级预测导出被明确保留到后续扩展阶段，当前驾驶舱不会假装已经拥有完整的 60 节点 runtime 证据。',
      evidenceMessage:
        '论文向证据可以继续在这个抽屉后方扩展，但不会挤占主预测驾驶舱，也不会伪造当前并不存在的交互。',
    },
  }
}
