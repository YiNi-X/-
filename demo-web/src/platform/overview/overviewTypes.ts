import type { ModuleArtifactIndexEntry, ShellRouteId } from '../../sharedContracts'

export type OverviewFramingPillar = {
  id: string
  kicker: string
  title: string
  detail: string
}

export type OverviewBusinessLoopStep = {
  step: string
  description: string
  sourceArtifacts: string[]
  routeId: ShellRouteId
  status: 'ready' | 'partial' | 'deferred'
}

export type OverviewEntryMetric = {
  label: string
  value: string
}

export type OverviewModuleEntryPoint = {
  routeId: ShellRouteId
  label: string
  status: 'ready' | 'partial' | 'deferred'
  scenarioId: string
  summary: string
  primaryMetric: OverviewEntryMetric
  secondaryMetric: OverviewEntryMetric
  evidence: string[]
  requirementCodes: string[]
}

export type OverviewScenarioEntryPoint = {
  id: string
  routeId: ShellRouteId
  label: string
  signal: string
  summary: string
  detail: string
}

export type OverviewSummary = {
  framing: string
  framingPillars: OverviewFramingPillar[]
  businessLoop: OverviewBusinessLoopStep[]
  modules?: ModuleArtifactIndexEntry[]
  dataScale?: {
    forecast?: {
      timelineFrames: number
      availableModels: string[]
      deferredModels: string[]
      horizons: string[]
    }
    repair?: {
      sampleCount: number
      availableModels: string[]
      curatedSamples: string[]
    }
    clustering?: {
      rawAisRows: number
      rawMmsiCount?: number
      filteredResearchRows?: number
      filteredResearchMmsiCount?: number
      segmentedTracks?: number
      segmentedPoints?: number
      compressedTracks: number
      compressedPoints?: number
      corridorRuntimeCorridors: number
      corridorRuntimeTracks?: number
      corridorReviewCorridors?: number
      corridorReviewTracks?: number
    }
  }
  evaluationReady?: {
    forecastMetrics: string[]
    repairMetrics: string[]
  }
  moduleEntryPoints: OverviewModuleEntryPoint[]
  scenarioEntryPoints: OverviewScenarioEntryPoint[]
  deferredModules?: Array<{ module: string; status: string; reason: string }>
}
