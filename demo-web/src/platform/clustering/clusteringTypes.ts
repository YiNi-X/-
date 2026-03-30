import type { MainCorridorTracksFile } from '../../sharedContracts.ts'

export type ClusteringLayerKey =
  | 'raw'
  | 'segmented'
  | 'compressed'
  | 'corridorExported'
  | 'corridorReview'

export type ClusteringPreviewPoint = {
  lon: number
  lat: number
  time?: string
  cog?: number | null
  sog?: number | null
}

export type ClusteringPreviewTrack = {
  trackId: string
  stage: string
  pointCount: number
  points: ClusteringPreviewPoint[]
  corridorId?: string
  directionLabel?: string
}

export type ClusteringStagePreviewLayer = {
  samplingMode: string
  trackCount: number
  tracks: ClusteringPreviewTrack[]
}

export type ClusteringStagePreviews = {
  artifactId: string
  module: string
  scenarioId: string
  generatedAt: string
  previews: Record<ClusteringLayerKey, ClusteringStagePreviewLayer>
}

export type ClusteringSummary = {
  artifactId?: string
  module?: string
  scenarioId?: string
  generatedAt?: string
  stageCounts: {
    rawAisRows: number
    rawMmsiCount: number
    filteredResearchRows: number
    filteredResearchMmsiCount: number
    segmentedTracks: number
    segmentedPoints: number
    compressedTracks: number
    compressedPoints: number
    corridorRuntimeCorridors: number
    corridorRuntimeTracks: number
    corridorReviewCorridors: number
    corridorReviewTracks: number
  }
  layerOrder: string[]
  reviewStatus: {
    corridorPromotion: string
    runtimeCorridorPath: string
    reviewCorridorPath: string
  }
  reviewFiles?: string[]
  deferred?: Array<{
    artifactId: string
    reason: string
    dependsOn: string[]
    status?: string
    fileBytes?: number
    filePath?: string
  }>
}

export type ClusteringBundle = {
  summary: ClusteringSummary
  stagePreviews: ClusteringStagePreviews
  corridorRuntime: MainCorridorTracksFile
  corridorReview: MainCorridorTracksFile
}

export type ClusteringNoiseFallback = {
  artifactId: string
  module: string
  scenarioId: string
  generatedAt: string
  summary: string
  sourceSummary: string
  sourceArtifacts: string[]
  deferredArtifact: {
    artifactId?: string
    fileName: string
    fileBytes: number
    filePath?: string
    status: string
    present?: boolean
    lastModified?: string | null
  }
  counts: {
    rawSegments: number
    candidateSegments: number
    keptSegments: number
    removedSegments: number
    rawPoints: number
    keptPoints: number
  }
  dropReasons: Array<{
    id: string
    label: string
    count: number
    narrative: string
  }>
}

export type ClusteringLayerDescriptor = {
  id: ClusteringLayerKey
  label: string
  shortLabel: string
  stageCode: string
  description: string
}

export type ClusteringStatItem = {
  label: string
  value: number | string
  detail?: string
}

export type ClusteringStoryStep = {
  id: string
  label: string
  stageCode: string
  value: string
  detail: string
}

export type ClusteringTrackPreview = {
  id: string
  label: string
  pointCount: number
  directionLabel?: string
  corridorId?: string
  startTime?: string
  endTime?: string
  points: ClusteringPreviewPoint[]
}

export type ClusteringViewModel = {
  meta: {
    availableLayers: ClusteringLayerDescriptor[]
    selectedLayer: ClusteringLayerKey
    reviewPromoted: boolean
    noiseReclusterReady: boolean
  }
  pipelineStory: {
    steps: ClusteringStoryStep[]
    compressionRatio: string
    corridorYield: string
  }
  selectedLayer: {
    descriptor: ClusteringLayerDescriptor
    samplingMode: string
    summary: string
    stats: ClusteringStatItem[]
    previewTracks: ClusteringTrackPreview[]
  }
  stats: {
    totalCorridors: number
    totalRuntimeTracks: number
    totalReviewTracks: number
    averageTracksPerCorridor: number
    topCorridors: Array<{
      corridorId: string
      directionLabel: string
      runtimeTrackCount: number
      reviewTrackCount: number
    }>
    selectedCorridor: {
      corridorId: string
      directionLabel: string
      runtimeTrackCount: number
      reviewTrackCount: number
      shareOfRuntimeTracks: number
      rank: number
      labelPoint: {
        lon: number
        lat: number
      }
    } | null
    noiseStatusMessage: string
    directionFamilyLabel: string
  }
  corridorLeaderboard: Array<{
    corridorId: string
    directionLabel: string
    runtimeTrackCount: number
    reviewTrackCount: number
    runtimeShare: number
    rank: number
  }>
  reviewComparison: {
    corridorDelta: number
    trackDelta: number
    selectedCorridorMatches: boolean
    runtimePath: string
    reviewPath: string
    status: string
  }
  recoveryChecklist: {
    artifactId: string
    blocker: string
    dependsOn: string[]
    artifactStatus: string
    artifactBytes?: number
    artifactPath?: string
    steps: string[]
  }
  routeEditorLink: string
}
