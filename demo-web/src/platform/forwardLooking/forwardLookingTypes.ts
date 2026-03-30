import type { BenefitMetric, ForecastAlert, Recommendation, ShellRouteId } from '../../sharedContracts.ts'

export type ForwardLookingModelRank = {
  model: string
  rank: number
  value: number
}

export type ForwardLookingEvidenceAuthority = {
  selectedModel: string
  selectedHorizon: string
  rankingMetric: string
  rankingValue: number
  rankingLabel: string
  rationale: string
  comparedModels: ForwardLookingModelRank[]
}

export type ForwardLookingCorridorContext = {
  narrative: string
  leadingCorridorId: string
  leadingDirection: string
  leadingShare: number
  topThreeShare: number
  totalRuntimeTracks: number
  routeMappingClaim: string
}

export type ForwardLookingNoiseContext = {
  artifactId: string
  fileName: string
  fileBytes: number
  filePath: string
  status: string
  reason: string
}

export type ForwardLookingDeferredItem = {
  id: string
  label: string
  summary: string
  dependsOn: string[]
}

export type ForwardLookingCrossLink = {
  routeId: ShellRouteId
  label: string
  summary: string
}

export type ForwardLookingSummary = {
  artifactId: string
  module: 'forward-looking'
  scenarioId: string
  generatedAt: string
  status: 'partial' | 'ready'
  framing: string
  summary: string
  selectedModel: string
  selectedHorizon: string
  scenarioCount: number
  uniqueFocusRoutes: string[]
  uniqueFocusGrids: string[]
  evidenceAuthority: ForwardLookingEvidenceAuthority
  corridorContext: ForwardLookingCorridorContext
  noiseContext: ForwardLookingNoiseContext
  deferred: ForwardLookingDeferredItem[]
  crossLinks: ForwardLookingCrossLink[]
  sourceArtifacts: string[]
}

export type ForwardLookingScenario = {
  id: string
  title: string
  emphasis: string
  sceneId: string
  frameIndex: number
  time: string
  focusGrid: string
  focusRoute: string
  selectedModel: string
  selectedHorizon: string
  currentTotalFlow: number
  forecastTotalFlow: number
  focusGridCurrent: number
  focusGridFuture: number
  focusPressureBefore: number
  focusPressureAfter: number
  focusPressureDrop: number
  alertCountBefore: number
  alertCountAfter: number
  strategyHeadline: string
  strategySummary: string
  recommendations: Recommendation[]
  benefits: BenefitMetric[]
  alertsBefore: ForecastAlert[]
  alertsAfter: ForecastAlert[]
  evaluationContext: {
    rank: number
    metric: string
    value: number
    nextModel: string
    nextModelGap: number
    summary: string
  }
  corridorContext: {
    headline: string
    detail: string
  }
  evidenceLineage: Array<{
    artifactId: string
    label: string
    detail: string
  }>
  honestBoundary: string
}

export type ForwardLookingScenarioCatalog = {
  artifactId: string
  module: 'forward-looking'
  scenarioId: string
  generatedAt: string
  scenarios: ForwardLookingScenario[]
}
