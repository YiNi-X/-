import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import type {
  EvaluationForecastLeaderCard,
  EvaluationForecastMetricKey,
  EvaluationForecastRankingRow,
  EvaluationMetricDirection,
  EvaluationMetricOption,
  EvaluationMetricsFile,
  EvaluationRepairMetricKey,
  EvaluationRepairRankingRow,
  EvaluationRepairScopeOption,
  EvaluationSummaryCard,
  EvaluationTraceabilityEntry,
  EvaluationViewModel,
} from './evaluationTypes.ts'

export const AGGREGATE_REPAIR_SCOPE_ID = 'aggregate'

const FORECAST_METRIC_OPTIONS: EvaluationMetricOption<EvaluationForecastMetricKey>[] = [
  { id: 'rmse', label: 'RMSE', direction: 'lower' },
  { id: 'mae', label: 'MAE', direction: 'lower' },
  { id: 'r2', label: 'R2', direction: 'higher' },
]

const REPAIR_METRIC_OPTIONS: EvaluationMetricOption<EvaluationRepairMetricKey>[] = [
  { id: 'rmse', label: 'RMSE', direction: 'lower' },
  { id: 'mae', label: 'MAE', direction: 'lower' },
  { id: 'dtwSimilarity', label: 'DTW', direction: 'higher' },
  { id: 'ade', label: 'ADE', direction: 'lower' },
  { id: 'r2', label: 'R2', direction: 'higher' },
  { id: 'hausdorffDistance', label: 'Hausdorff', direction: 'lower' },
]

function sortHorizonKeys(left: string, right: string) {
  const leftNumber = Number.parseInt(left, 10)
  const rightNumber = Number.parseInt(right, 10)
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return left.localeCompare(right)
  return leftNumber - rightNumber
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function normalizeSelection<T extends string>(requested: string, available: T[], fallback: T) {
  if (available.includes(requested as T)) return requested as T
  return available[0] ?? fallback
}

function compareMetric(left: number, right: number, direction: EvaluationMetricDirection) {
  if (direction === 'lower') return left - right
  return right - left
}

function sortRowsByMetric<T extends { rank: number; value: number; sortLabel: string }>(rows: T[], direction: EvaluationMetricDirection) {
  return rows.slice().sort((left, right) => {
    if (left.rank > 0 && right.rank > 0 && left.rank !== right.rank) return left.rank - right.rank
    const metricDelta = compareMetric(left.value, right.value, direction)
    if (metricDelta !== 0) return metricDelta
    return left.sortLabel.localeCompare(right.sortLabel)
  })
}

function getForecastHorizonOptions(metrics: EvaluationMetricsFile) {
  const horizons = new Set<string>()
  for (const entry of Object.values(metrics.forecast?.models ?? {})) {
    for (const horizon of Object.keys(entry.horizons ?? {})) {
      horizons.add(horizon)
    }
  }
  return Array.from(horizons).sort(sortHorizonKeys)
}

function getForecastLeaderCards(metrics: EvaluationMetricsFile): EvaluationForecastLeaderCard[] {
  return getForecastHorizonOptions(metrics).map((horizon) => {
    const sampleCount =
      Object.values(metrics.forecast?.models ?? {}).find((entry) => entry.horizons?.[horizon])?.horizons?.[horizon]?.sampleCount ?? 0
    const rankingSet = metrics.forecast?.rankings?.[horizon] ?? {}
    return {
      horizon,
      sampleCount,
      rmseLeader: rankingSet.rmse?.[0] ?? null,
      maeLeader: rankingSet.mae?.[0] ?? null,
      r2Leader: rankingSet.r2?.[0] ?? null,
    }
  })
}

function getForecastLeaderCounts(metrics: EvaluationMetricsFile) {
  const counts = new Map<string, number>()
  for (const rankingSet of Object.values(metrics.forecast?.rankings ?? {})) {
    for (const option of FORECAST_METRIC_OPTIONS) {
      const leader = rankingSet[option.id]?.[0]?.model
      if (!leader) continue
      counts.set(leader, (counts.get(leader) ?? 0) + 1)
    }
  }
  return counts
}

function getForecastRows(
  metrics: EvaluationMetricsFile,
  selectedHorizon: string,
  selectedMetric: EvaluationForecastMetricKey,
  leaderCounts: Map<string, number>,
): EvaluationForecastRankingRow[] {
  const rankingLookup = new Map(
    (metrics.forecast?.rankings?.[selectedHorizon]?.[selectedMetric] ?? []).map((entry) => [entry.model, { rank: entry.rank, value: entry.value }]),
  )

  const rows = Object.entries(metrics.forecast?.models ?? {})
    .filter(([, modelEntry]) => modelEntry.status === 'available' && modelEntry.horizons?.[selectedHorizon])
    .map(([model, modelEntry]) => {
      const horizonMetrics = modelEntry.horizons?.[selectedHorizon]
      if (!horizonMetrics) return null
      const ranked = rankingLookup.get(model)
      return {
        rank: ranked?.rank ?? 0,
        model,
        value: ranked?.value ?? horizonMetrics[selectedMetric],
        sampleCount: horizonMetrics.sampleCount,
        mae: horizonMetrics.mae,
        rmse: horizonMetrics.rmse,
        r2: horizonMetrics.r2,
        leaderSlots: leaderCounts.get(model) ?? 0,
        sortLabel: model,
      }
    })
    .filter((row): row is EvaluationForecastRankingRow & { sortLabel: string } => row !== null)

  return sortRowsByMetric(rows, FORECAST_METRIC_OPTIONS.find((option) => option.id === selectedMetric)?.direction ?? 'lower').map((row, index) => ({
    rank: row.rank > 0 ? row.rank : index + 1,
    model: row.model,
    value: row.value,
    sampleCount: row.sampleCount,
    mae: row.mae,
    rmse: row.rmse,
    r2: row.r2,
    leaderSlots: row.leaderSlots,
  }))
}

function getRepairScopeOptions(metrics: EvaluationMetricsFile): EvaluationRepairScopeOption[] {
  const aggregateSampleCount = metrics.repair?.aggregateByModel?.[0]?.sampleCount ?? metrics.repair?.sampleMetrics?.length ?? 0
  const scopes: EvaluationRepairScopeOption[] = [
    {
      id: AGGREGATE_REPAIR_SCOPE_ID,
      label: '聚合',
      description: `覆盖 ${aggregateSampleCount} 个精选修复样本的聚合记分板。`,
      kind: 'aggregate',
    },
  ]

  for (const [index, sample] of (metrics.repair?.sampleMetrics ?? []).entries()) {
    scopes.push({
      id: sample.sampleId,
      label: `样本 ${index + 1}`,
      description: `${sample.targetId} 的样本级对比。`,
      kind: 'sample',
    })
  }

  return scopes
}

function getRepairRows(
  metrics: EvaluationMetricsFile,
  selectedScope: EvaluationRepairScopeOption,
  selectedMetric: EvaluationRepairMetricKey,
): EvaluationRepairRankingRow[] {
  const direction = REPAIR_METRIC_OPTIONS.find((option) => option.id === selectedMetric)?.direction ?? 'lower'

  if (selectedScope.kind === 'aggregate') {
    const rows = (metrics.repair?.aggregateByModel ?? []).map((entry) => ({
      rank: selectedMetric === 'rmse' ? entry.rankByRmse : 0,
      modelId: entry.modelId,
      modelLabel: entry.modelLabel,
      value: entry[selectedMetric],
      rmse: entry.rmse,
      mae: entry.mae,
      dtwSimilarity: entry.dtwSimilarity,
      ade: entry.ade,
      r2: entry.r2,
      hausdorffDistance: entry.hausdorffDistance,
      sampleCount: entry.sampleCount,
      sortLabel: entry.modelLabel,
    }))

    return sortRowsByMetric(rows, direction).map((row, index) => ({
      rank: row.rank > 0 ? row.rank : index + 1,
      modelId: row.modelId,
      modelLabel: row.modelLabel,
      value: row.value,
      rmse: row.rmse,
      mae: row.mae,
      dtwSimilarity: row.dtwSimilarity,
      ade: row.ade,
      r2: row.r2,
      hausdorffDistance: row.hausdorffDistance,
      sampleCount: row.sampleCount,
    }))
  }

  const selectedSample =
    metrics.repair?.sampleMetrics?.find((entry) => entry.sampleId === selectedScope.id) ?? metrics.repair?.sampleMetrics?.[0] ?? null

  const rows = (selectedSample?.metrics ?? []).map((entry) => ({
    rank: 0,
    modelId: entry.modelId,
    modelLabel: entry.modelLabel,
    value: entry[selectedMetric],
    rmse: entry.rmse,
    mae: entry.mae,
    dtwSimilarity: entry.dtwSimilarity,
    ade: entry.ade,
    r2: entry.r2,
    hausdorffDistance: entry.hausdorffDistance,
    sortLabel: entry.modelLabel,
  }))

  return sortRowsByMetric(rows, direction).map((row, index) => ({
    rank: index + 1,
    modelId: row.modelId,
    modelLabel: row.modelLabel,
    value: row.value,
    rmse: row.rmse,
    mae: row.mae,
    dtwSimilarity: row.dtwSimilarity,
    ade: row.ade,
    r2: row.r2,
    hausdorffDistance: row.hausdorffDistance,
  }))
}

function getRepairSampleLeaderSummary(metrics: EvaluationMetricsFile) {
  const counts = new Map<string, number>()
  for (const sample of metrics.repair?.sampleMetrics ?? []) {
    const leader = sample.metrics
      .slice()
      .sort((left, right) => compareMetric(left.rmse, right.rmse, 'lower') || left.modelLabel.localeCompare(right.modelLabel))[0]
    if (!leader) continue
    counts.set(leader.modelLabel, (counts.get(leader.modelLabel) ?? 0) + 1)
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null
}

function getTraceabilityEntries(metrics: EvaluationMetricsFile, entry: ModuleRegistryEntry): EvaluationViewModel['traceability'] {
  const artifactEntries = entry.artifacts.map((artifact) => ({
    id: artifact.artifactId,
    label: artifact.artifactId,
    path: artifact.path,
    detail: `${artifact.status} | derived from ${artifact.derivedFrom.join(', ')}`,
    artifact,
  }))

  const sourceMap = new Map<string, EvaluationTraceabilityEntry>()

  for (const [key, path] of Object.entries(metrics.traceability ?? {})) {
    sourceMap.set(`metric:${key}`, {
      id: `metric:${key}`,
      label: titleCase(key),
      path,
      detail: '直接来自 evaluation-metrics.json 的链路',
    })
  }

  for (const [key, path] of Object.entries(entry.sources)) {
    sourceMap.set(`manifest:${key}`, {
      id: `manifest:${key}`,
      label: titleCase(key),
      path,
      detail: '来自评估模块 manifest 的链路',
    })
  }

  const sourceEntries = Array.from(sourceMap.values())

  return {
    artifactEntries,
    sourceEntries,
    requirementCodes: entry.authoritativeFor,
    totalLinks: artifactEntries.length + sourceEntries.length,
  }
}

function getSummaryCards(
  metrics: EvaluationMetricsFile,
  traceability: EvaluationViewModel['traceability'],
  forecastLeaderCounts: Map<string, number>,
  leaderCardCount: number,
): EvaluationSummaryCard[] {
  const totalForecastLeaderSlots = leaderCardCount * FORECAST_METRIC_OPTIONS.length
  const topForecastLeader =
    Array.from(forecastLeaderCounts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? null
  const repairAggregateLeader =
    (metrics.repair?.aggregateByModel ?? []).slice().sort((left, right) => left.rankByRmse - right.rankByRmse || left.modelLabel.localeCompare(right.modelLabel))[0] ??
    null
  const repairSampleLeader = getRepairSampleLeaderSummary(metrics)

  return [
      {
        label: '预测主导度',
        value: topForecastLeader ? `${topForecastLeader[0]} ${topForecastLeader[1]}/${totalForecastLeaderSlots}` : '--',
        detail: topForecastLeader
        ? `${topForecastLeader[0]} 在 ${leaderCardCount} 个 horizon 与 3 个核心指标组成的已上线预测排名位中占据最多领先席位。`
        : '当前还没有可用的预测领先席位信息。',
        tone: 'accent',
      },
      {
        label: '修复聚合领先者',
        value: repairAggregateLeader?.modelLabel ?? '--',
        detail: repairSampleLeader
        ? `${repairSampleLeader[0]} 在 ${repairSampleLeader[1]} 个样本级 RMSE 排名中领先，而聚合 RMSE 当前由 ${repairAggregateLeader?.modelLabel ?? '领先模型'} 占优。`
        : '当前还没有可用的修复样本级领先信息。',
        tone: 'accent',
      },
      {
        label: '可追溯证据',
        value: `${traceability.totalLinks} 条链路`,
        detail: `本页当前可见 ${traceability.artifactEntries.length} 个模块产物与 ${traceability.sourceEntries.length} 条 lineage 链路。`,
        tone: 'default',
      },
      {
        label: '需求覆盖',
        value: `${traceability.requirementCodes.length} 个代码`,
        detail: `评估模块当前声明 ${traceability.requirementCodes.join(', ')} 为权威覆盖范围。`,
        tone: 'warning',
      },
  ]
}

export function buildEvaluationViewModel(
  metrics: EvaluationMetricsFile,
  entry: ModuleRegistryEntry,
  selections: {
    selectedForecastHorizon: string
    selectedForecastMetric: string
    selectedRepairScopeId: string
    selectedRepairMetric: string
  },
): EvaluationViewModel {
  const horizonOptions = getForecastHorizonOptions(metrics)
  const selectedForecastHorizon = normalizeSelection(selections.selectedForecastHorizon, horizonOptions, horizonOptions[0] ?? '1h')
  const selectedForecastMetric = normalizeSelection(
    selections.selectedForecastMetric,
    FORECAST_METRIC_OPTIONS.map((option) => option.id),
    FORECAST_METRIC_OPTIONS[0].id,
  )
  const leaderCards = getForecastLeaderCards(metrics)
  const forecastLeaderCounts = getForecastLeaderCounts(metrics)
  const forecastRows = getForecastRows(metrics, selectedForecastHorizon, selectedForecastMetric, forecastLeaderCounts)

  const scopeOptions = getRepairScopeOptions(metrics)
  const selectedRepairScopeId = normalizeSelection(
    selections.selectedRepairScopeId,
    scopeOptions.map((option) => option.id),
    scopeOptions[0]?.id ?? AGGREGATE_REPAIR_SCOPE_ID,
  )
  const selectedRepairScope = scopeOptions.find((option) => option.id === selectedRepairScopeId) ?? scopeOptions[0]
  const selectedRepairMetric = normalizeSelection(
    selections.selectedRepairMetric,
    REPAIR_METRIC_OPTIONS.map((option) => option.id),
    REPAIR_METRIC_OPTIONS[0].id,
  )
  const repairRows = selectedRepairScope ? getRepairRows(metrics, selectedRepairScope, selectedRepairMetric) : []

  const traceability = getTraceabilityEntries(metrics, entry)
  const summaryCards = getSummaryCards(metrics, traceability, forecastLeaderCounts, leaderCards.length)
  const forecastModelCount = Object.values(metrics.forecast?.models ?? {}).filter((modelEntry) => modelEntry.status === 'available').length
  const repairModelCount = metrics.repair?.aggregateByModel?.length ?? metrics.repair?.sampleMetrics?.[0]?.metrics.length ?? 0

  return {
    summary: {
      cards: summaryCards,
      narrative: `预测当前比较 ${forecastModelCount} 个已上线模型与 ${horizonOptions.length} 个 horizon，修复则在聚合与样本两个视角下比较 ${repairModelCount} 种方法。这个中心把两套记分板放进同一壳层，并显式暴露页面数字背后的 artifact lineage。`,
    },
    forecast: {
      modelCount: forecastModelCount,
      selectedHorizon: selectedForecastHorizon,
      selectedMetric: selectedForecastMetric,
      horizonOptions,
      metricOptions: FORECAST_METRIC_OPTIONS,
      leaderCards,
      rows: forecastRows,
    },
    repair: {
      modelCount: repairModelCount,
      selectedScope:
        selectedRepairScope ?? {
          id: AGGREGATE_REPAIR_SCOPE_ID,
          label: '聚合',
          description: '聚合记分板。',
          kind: 'aggregate',
        },
      selectedMetric: selectedRepairMetric,
      scopeOptions,
      metricOptions: REPAIR_METRIC_OPTIONS,
      rows: repairRows,
    },
    traceability,
  }
}
