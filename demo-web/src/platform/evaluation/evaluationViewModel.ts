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
      label: 'Aggregate',
      description: `Aggregate scoreboard across ${aggregateSampleCount} curated repair samples.`,
      kind: 'aggregate',
    },
  ]

  for (const [index, sample] of (metrics.repair?.sampleMetrics ?? []).entries()) {
    scopes.push({
      id: sample.sampleId,
      label: `Sample ${index + 1}`,
      description: `${sample.targetId} sample-level comparison.`,
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
      detail: 'Linked directly from evaluation-metrics.json',
    })
  }

  for (const [key, path] of Object.entries(entry.sources)) {
    sourceMap.set(`manifest:${key}`, {
      id: `manifest:${key}`,
      label: titleCase(key),
      path,
      detail: 'Linked from the evaluation module manifest',
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
      label: 'Forecast dominance',
      value: topForecastLeader ? `${topForecastLeader[0]} ${topForecastLeader[1]}/${totalForecastLeaderSlots}` : '--',
      detail: topForecastLeader
        ? `${topForecastLeader[0]} leads the shipped forecast ranking slots across ${leaderCardCount} horizons and three core metrics.`
        : 'Forecast leader slots are not available yet.',
      tone: 'accent',
    },
    {
      label: 'Repair aggregate leader',
      value: repairAggregateLeader?.modelLabel ?? '--',
      detail: repairSampleLeader
        ? `${repairSampleLeader[0]} leads ${repairSampleLeader[1]} sample-level RMSE rankings, while aggregate RMSE is currently led by ${repairAggregateLeader?.modelLabel ?? 'the top model'}.`
        : 'Repair sample-level leadership is not available yet.',
      tone: 'accent',
    },
    {
      label: 'Traceable evidence',
      value: `${traceability.totalLinks} links`,
      detail: `${traceability.artifactEntries.length} module artifacts and ${traceability.sourceEntries.length} lineage links are visible from this page.`,
      tone: 'default',
    },
    {
      label: 'Requirement coverage',
      value: `${traceability.requirementCodes.length} codes`,
      detail: `The evaluation module currently declares ${traceability.requirementCodes.join(', ')} as authoritative coverage.`,
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
      narrative: `Forecast currently compares ${forecastModelCount} shipped models across ${horizonOptions.length} horizons, while repair compares ${repairModelCount} methods across aggregate and sample-level views. The center keeps those scoreboards in one shell, then exposes the exact artifact lineage behind the displayed numbers.`,
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
          label: 'Aggregate',
          description: 'Aggregate scoreboard.',
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
