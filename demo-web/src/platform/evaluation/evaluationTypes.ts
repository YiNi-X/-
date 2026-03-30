import type { ModuleManifestArtifact } from '../../sharedContracts.ts'

export type EvaluationForecastMetricKey = 'rmse' | 'mae' | 'r2'
export type EvaluationRepairMetricKey = 'rmse' | 'mae' | 'dtwSimilarity' | 'ade' | 'r2' | 'hausdorffDistance'
export type EvaluationMetricDirection = 'lower' | 'higher'

export type EvaluationMetricOption<TMetric extends string = string> = {
  id: TMetric
  label: string
  direction: EvaluationMetricDirection
}

export type EvaluationRankedMetric = {
  model: string
  value: number
  rank: number
}

export type EvaluationForecastMetricEntry = {
  sampleCount: number
  mae: number
  rmse: number
  r2: number
}

export type EvaluationForecastModelEntry = {
  status: string
  horizons?: Record<string, EvaluationForecastMetricEntry>
}

export type EvaluationRepairModelMetricEntry = {
  modelId: string
  modelLabel: string
  mse?: number
  rmse: number
  mae: number
  dtwSimilarity: number
  ade: number
  r2: number
  hausdorffDistance: number
  lonDifferenceMean?: number
  latDifferenceMean?: number
  euclideanDistanceMean?: number
}

export type EvaluationRepairSampleEntry = {
  sampleId: string
  targetId: string
  metrics: EvaluationRepairModelMetricEntry[]
}

export type EvaluationRepairAggregateEntry = EvaluationRepairModelMetricEntry & {
  sampleCount: number
  rankByRmse: number
}

export type EvaluationOptimizationPoint = {
  trial: number
  value: number
}

export type EvaluationOptimizationParameter = {
  id: string
  label: string
  importance: number
  rank: number
}

export type EvaluationOptimizationBestParameter = {
  id: string
  label: string
  value: number
  displayValue: string
  observedMin: number
  observedMax: number
  observedMinDisplay: string
  observedMaxDisplay: string
  scale: 'linear' | 'log10'
}

export type EvaluationOptimizationView = {
  id: string
  label: string
  path: string
  detail: string
}

export type EvaluationOptimizationFile = {
  artifactId: string
  module: string
  scenarioId: string
  generatedAt: string
  studyId: string
  studyLabel: string
  summary: string
  objective: {
    metricLabel: string
    direction: EvaluationMetricDirection
    totalTrialSlots: number
    completedTrials: number
    nonCompletedTrialSlots: number
    infeasibleTrials: number
    firstCompletedTrial: number
    firstCompletedValue: number
    bestTrial: number
    bestValue: number
    improvementRatio: number
    improvementCount: number
    completedPoints: EvaluationOptimizationPoint[]
    bestCurvePoints: EvaluationOptimizationPoint[]
    checkpoints: EvaluationOptimizationPoint[]
  }
  importance: {
    parameters: EvaluationOptimizationParameter[]
    topTwoShare: number
  }
  bestParameters: EvaluationOptimizationBestParameter[]
  supportingViews: EvaluationOptimizationView[]
  traceability?: Record<string, string>
}

export type EvaluationMetricsFile = {
  artifactId: string
  module: string
  scenarioId: string
  generatedAt: string
  forecast?: {
    metricScope?: string
    supportedMetrics?: EvaluationForecastMetricKey[]
    models?: Record<string, EvaluationForecastModelEntry>
    deferredModels?: Array<{ model: string; reason: string }>
    rankings?: Record<string, Partial<Record<EvaluationForecastMetricKey, EvaluationRankedMetric[]>>>
  }
  repair?: {
    supportedMetrics?: EvaluationRepairMetricKey[]
    sampleMetrics?: EvaluationRepairSampleEntry[]
    aggregateByModel?: EvaluationRepairAggregateEntry[]
    rankings?: Partial<Record<EvaluationRepairMetricKey | 'mse', EvaluationRankedMetric[]>>
  }
  traceability?: Record<string, string>
}

export type EvaluationSummaryCard = {
  label: string
  value: string
  detail: string
  tone: 'default' | 'accent' | 'warning'
}

export type EvaluationForecastLeaderCard = {
  horizon: string
  sampleCount: number
  rmseLeader: EvaluationRankedMetric | null
  maeLeader: EvaluationRankedMetric | null
  r2Leader: EvaluationRankedMetric | null
}

export type EvaluationForecastRankingRow = {
  rank: number
  model: string
  value: number
  sampleCount: number
  mae: number
  rmse: number
  r2: number
  leaderSlots: number
}

export type EvaluationRepairScopeOption = {
  id: string
  label: string
  description: string
  kind: 'aggregate' | 'sample'
}

export type EvaluationRepairRankingRow = {
  rank: number
  modelId: string
  modelLabel: string
  value: number
  rmse: number
  mae: number
  dtwSimilarity: number
  ade: number
  r2: number
  hausdorffDistance: number
  sampleCount?: number
}

export type EvaluationTraceabilityEntry = {
  id: string
  label: string
  path: string
  detail: string
}

export type EvaluationViewModel = {
  summary: {
    cards: EvaluationSummaryCard[]
    narrative: string
  }
  forecast: {
    modelCount: number
    selectedHorizon: string
    selectedMetric: EvaluationForecastMetricKey
    horizonOptions: string[]
    metricOptions: EvaluationMetricOption<EvaluationForecastMetricKey>[]
    leaderCards: EvaluationForecastLeaderCard[]
    rows: EvaluationForecastRankingRow[]
  }
  repair: {
    modelCount: number
    selectedScope: EvaluationRepairScopeOption
    selectedMetric: EvaluationRepairMetricKey
    scopeOptions: EvaluationRepairScopeOption[]
    metricOptions: EvaluationMetricOption<EvaluationRepairMetricKey>[]
    rows: EvaluationRepairRankingRow[]
  }
  traceability: {
    artifactEntries: Array<EvaluationTraceabilityEntry & { artifact: ModuleManifestArtifact }>
    sourceEntries: EvaluationTraceabilityEntry[]
    requirementCodes: string[]
    totalLinks: number
  }
}
