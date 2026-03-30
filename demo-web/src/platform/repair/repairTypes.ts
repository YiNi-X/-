import type { ModuleBundleEntryFiles } from '../../sharedContracts'

export type RepairSampleCatalog = {
  module: 'repair'
  scenarioId: string
  samples: Array<{
    sampleId: string
    label: string
    targetId: string
    missingPointCount: number
    groundTruthPointCount: number
    availableModels: string[]
    sourceFiles: {
      missingTrajectory: string
      predictions: string
      metrics: string
    }
  }>
}

export type RepairMetricsFile = {
  module: 'repair'
  scenarioId: string
  samples: Array<{
    sampleId: string
    targetId: string
    metrics: Array<{
      modelId: string
      modelLabel: string
      mse: number
      rmse: number
      mae: number
      dtwSimilarity: number
      ade: number
      r2: number
      hausdorffDistance: number
      lonDifferenceMean: number
      latDifferenceMean: number
      euclideanDistanceMean: number
    }>
  }>
}

export type RepairTrajectoriesFile = {
  module: 'repair'
  scenarioId: string
  samples: Array<{
    sampleId: string
    targetId: string
    missing: RepairPoint[]
    groundTruth: RepairPoint[]
    repairs: Record<
      string,
      {
        modelId: string
        modelLabel: string
        points: RepairPoint[]
      }
    >
  }>
}

export type RepairErrorsFile = {
  module: 'repair'
  scenarioId: string
  samples: Array<{
    sampleId: string
    targetId: string
    models: Record<
      string,
      {
        modelId: string
        modelLabel: string
        lonDifference: number[]
        latDifference: number[]
        euclideanDistance: number[]
      }
    >
  }>
}

export type RepairEntryFiles = ModuleBundleEntryFiles & {
  samples: string
  trajectories: string
  errors: string
  metrics: string
}

export type RepairLoadedBundle = {
  samples: RepairSampleCatalog
  trajectories: RepairTrajectoriesFile
  errors: RepairErrorsFile
  metrics: RepairMetricsFile
}

export type RepairPoint = {
  index: number
  lon: number
  lat: number
}

export type RepairErrorMetricKey = 'euclideanDistance' | 'lonDifference' | 'latDifference'

export type RepairModelSummary = {
  modelId: string
  modelLabel: string
  rmse: number
  mae: number
  dtwSimilarity: number
  ade: number
  r2: number
  hausdorffDistance: number
  lonDifferenceMean: number
  latDifferenceMean: number
  euclideanDistanceMean: number
}

export type RepairViewPoint = {
  x: number
  y: number
  index: number
}

export type RepairViewModel = {
  meta: {
    sampleCount: number
    availableModels: Array<{ modelId: string; modelLabel: string }>
    bestOverallModel: { modelId: string; modelLabel: string } | null
    deferredItems: string[]
  }
  summaryBand: {
    sampleLabel: string
    targetId: string
    selectedModelLabel: string
    missingPointCount: number
    groundTruthPointCount: number
    availableMethodCount: number
    bestSampleModelLabel: string
  }
  sampleSelector: {
    items: Array<{ sampleId: string; label: string; targetId: string }>
  }
  modelSelector: {
    items: Array<{ modelId: string; modelLabel: string }>
  }
  trajectoryStage: {
    bounds: {
      minLon: number
      maxLon: number
      minLat: number
      maxLat: number
    }
    missing: RepairViewPoint[]
    groundTruth: RepairViewPoint[]
    repair: RepairViewPoint[]
  }
  metrics: {
    selectedModel: RepairModelSummary | null
    sampleRanking: RepairModelSummary[]
    aggregateRanking: Array<{ modelId: string; modelLabel: string; averageRmse: number; averageMae: number }>
  }
  errors: {
    selectedMetric: RepairErrorMetricKey
    selectedSeriesByModel: Array<{
      modelId: string
      modelLabel: string
      values: number[]
      highlighted: boolean
    }>
  }
  readiness: {
    trajectoryMessage: string
    errorMessage: string
  }
}
