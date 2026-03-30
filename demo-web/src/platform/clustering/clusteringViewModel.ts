import type { MainCorridorSummaryEntry } from '../../sharedContracts.ts'
import type {
  ClusteringBundle,
  ClusteringLayerDescriptor,
  ClusteringLayerKey,
  ClusteringStatItem,
  ClusteringStoryStep,
  ClusteringTrackPreview,
  ClusteringViewModel,
} from './clusteringTypes.ts'

const ORDER_TO_LAYER_KEY: Record<string, ClusteringLayerKey> = {
  raw: 'raw',
  segmented: 'segmented',
  compressed: 'compressed',
  'corridor/exported': 'corridorExported',
  'corridor/review': 'corridorReview',
}

const LAYER_DESCRIPTORS: Record<ClusteringLayerKey, ClusteringLayerDescriptor> = {
  raw: {
    id: 'raw',
    label: 'Original trajectories',
    shortLabel: 'Raw',
    stageCode: 'RAW',
    description: 'Curated AIS trajectories before segmentation, kept as the provenance entry point for the clustering story.',
  },
  segmented: {
    id: 'segmented',
    label: 'Segmented trajectories',
    shortLabel: 'Segmented',
    stageCode: 'SEGM',
    description: 'Track fragments after the segmentation step, which expose the sequence units fed into later compression and clustering.',
  },
  compressed: {
    id: 'compressed',
    label: 'Compressed trajectories',
    shortLabel: 'Compressed',
    stageCode: 'COMP',
    description: 'Simplified trajectory shapes that preserve corridor intent while cutting point density before clustering export.',
  },
  corridorExported: {
    id: 'corridorExported',
    label: 'Runtime corridor extraction',
    shortLabel: 'Runtime',
    stageCode: 'CORR',
    description: 'The promoted corridor runtime package that powers the shared website route and RouteEditor experience.',
  },
  corridorReview: {
    id: 'corridorReview',
    label: 'Review corridor extraction',
    shortLabel: 'Review',
    stageCode: 'REVIEW',
    description: 'The review-first corridor export kept separate from the live runtime dataset until promotion is explicitly approved.',
  },
}

function normalizeLayerKey(layer: string): ClusteringLayerKey | null {
  if (layer in ORDER_TO_LAYER_KEY) return ORDER_TO_LAYER_KEY[layer]
  if (layer in LAYER_DESCRIPTORS) return layer as ClusteringLayerKey
  return null
}

export function getDefaultClusteringLayer(bundleOrSummary: Pick<ClusteringBundle, 'summary'> | ClusteringBundle['summary']): ClusteringLayerKey {
  const summary = 'summary' in bundleOrSummary ? bundleOrSummary.summary : bundleOrSummary
  for (const layer of summary.layerOrder) {
    const normalized = normalizeLayerKey(layer)
    if (normalized) return normalized
  }
  return 'raw'
}

function getAvailableLayers(bundle: ClusteringBundle): ClusteringLayerDescriptor[] {
  const layers = bundle.summary.layerOrder
    .map(normalizeLayerKey)
    .filter((layer): layer is ClusteringLayerKey => layer !== null)

  const fallback = (Object.keys(bundle.stagePreviews.previews) as ClusteringLayerKey[]).filter((layer) => layer in LAYER_DESCRIPTORS)
  const ordered = layers.length > 0 ? layers : fallback
  return ordered.map((layer) => LAYER_DESCRIPTORS[layer])
}

function resolveSelectedCorridor(bundle: ClusteringBundle, selectedCorridorId: string) {
  const runtimeCorridor =
    bundle.corridorRuntime.corridors.find((corridor) => corridor.corridorId === selectedCorridorId) ??
    bundle.corridorRuntime.corridors[0] ??
    null
  const reviewCorridor = runtimeCorridor
    ? bundle.corridorReview.corridors.find((corridor) => corridor.corridorId === runtimeCorridor.corridorId) ?? null
    : null

  return {
    runtimeCorridor,
    reviewCorridor,
  }
}

function createPreviewTracks(bundle: ClusteringBundle, layer: ClusteringLayerKey, selectedCorridorId: string): ClusteringTrackPreview[] {
  const previewLayer = bundle.stagePreviews.previews[layer]
  if (!previewLayer) return []

  const filteredTracks =
    layer === 'corridorExported' || layer === 'corridorReview'
      ? previewLayer.tracks.filter((track) => track.corridorId === selectedCorridorId)
      : previewLayer.tracks

  const tracks = (filteredTracks.length > 0 ? filteredTracks : previewLayer.tracks).slice(0, 6)

  return tracks.map((track) => ({
    id: track.trackId,
    label: track.corridorId ? `${track.corridorId} / ${track.trackId}` : track.trackId,
    pointCount: track.pointCount,
    directionLabel: track.directionLabel,
    corridorId: track.corridorId,
    startTime: track.points[0]?.time,
    endTime: track.points[track.points.length - 1]?.time,
    points: track.points,
  }))
}

function createLayerStats(bundle: ClusteringBundle, layer: ClusteringLayerKey, selectedCorridor: MainCorridorSummaryEntry | null): ClusteringStatItem[] {
  const { stageCounts } = bundle.summary

  if (layer === 'raw') {
    return [
      {
        label: 'Raw AIS rows',
        value: stageCounts.rawAisRows,
        detail: `${stageCounts.rawMmsiCount} MMSI identities remain in the archive window.`,
      },
      {
        label: 'Filtered research rows',
        value: stageCounts.filteredResearchRows,
        detail: `${stageCounts.filteredResearchMmsiCount} MMSI identities survive the research-side filtering pass.`,
      },
      {
        label: 'Preview traces',
        value: bundle.stagePreviews.previews.raw.trackCount,
        detail: bundle.stagePreviews.previews.raw.samplingMode,
      },
    ]
  }

  if (layer === 'segmented') {
    return [
      {
        label: 'Segmented tracks',
        value: stageCounts.segmentedTracks,
        detail: `${stageCounts.segmentedPoints} points remain after segmentation.`,
      },
      {
        label: 'Preview traces',
        value: bundle.stagePreviews.previews.segmented.trackCount,
        detail: bundle.stagePreviews.previews.segmented.samplingMode,
      },
      {
        label: 'Compression next',
        value: `${Math.round((stageCounts.compressedPoints / stageCounts.segmentedPoints) * 100)}%`,
        detail: 'Point density that remains after the compression stage.',
      },
    ]
  }

  if (layer === 'compressed') {
    const savedPoints = stageCounts.segmentedPoints - stageCounts.compressedPoints
    return [
      {
        label: 'Compressed tracks',
        value: stageCounts.compressedTracks,
        detail: `${stageCounts.compressedPoints} retained points stay available for corridor export.`,
      },
      {
        label: 'Points removed',
        value: savedPoints,
        detail: `${Math.round((savedPoints / stageCounts.segmentedPoints) * 100)}% reduction from the segmented stage.`,
      },
      {
        label: 'Preview traces',
        value: bundle.stagePreviews.previews.compressed.trackCount,
        detail: bundle.stagePreviews.previews.compressed.samplingMode,
      },
    ]
  }

  return [
    {
      label: 'Cluster count',
      value: layer === 'corridorExported' ? stageCounts.corridorRuntimeCorridors : stageCounts.corridorReviewCorridors,
      detail: 'Directional corridor groups are the product-facing clustering outcome in this release.',
    },
    {
      label: 'Corridor tracks',
      value: layer === 'corridorExported' ? stageCounts.corridorRuntimeTracks : stageCounts.corridorReviewTracks,
      detail: selectedCorridor
        ? `${selectedCorridor.corridorId} contributes ${selectedCorridor.trackCount} tracks in the selected corridor group.`
        : 'Select a corridor on the right to inspect its contribution.',
    },
    {
      label: 'Preview traces',
      value: bundle.stagePreviews.previews[layer].trackCount,
      detail: bundle.stagePreviews.previews[layer].samplingMode,
    },
  ]
}

function createLayerSummary(layer: ClusteringLayerDescriptor, selectedCorridor: MainCorridorSummaryEntry | null) {
  if (layer.id === 'corridorExported' || layer.id === 'corridorReview') {
    return selectedCorridor
      ? `${layer.description} The current corridor focus is ${selectedCorridor.corridorId} (${selectedCorridor.directionLabel}).`
      : layer.description
  }

  return layer.description
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function describeNoiseArtifactStatus(status: string | undefined, fileBytes: number | undefined) {
  if (status === 'zero-byte') return `Present in workspace but ${fileBytes ?? 0} bytes`
  if (status === 'missing') return 'Missing from workspace'
  if (status === 'present') return 'Recovered but not yet exported'
  return 'Unreadable in current environment'
}

function createPipelineStory(bundle: ClusteringBundle): { steps: ClusteringStoryStep[]; compressionRatio: string; corridorYield: string } {
  const { stageCounts } = bundle.summary
  const compressionRatio =
    stageCounts.segmentedPoints > 0 ? formatPercent(stageCounts.compressedPoints / stageCounts.segmentedPoints) : '0%'
  const corridorYield =
    stageCounts.compressedTracks > 0 ? formatPercent(stageCounts.corridorRuntimeTracks / stageCounts.compressedTracks) : '0%'

  return {
    steps: [
      {
        id: 'raw',
        label: 'Archive Window',
        stageCode: 'RAW',
        value: `${stageCounts.rawAisRows} rows`,
        detail: `${stageCounts.rawMmsiCount} vessels appear in the raw AIS archive before research-side filtering starts.`,
      },
      {
        id: 'segmented',
        label: 'Trajectory Segments',
        stageCode: 'SEGM',
        value: `${stageCounts.segmentedTracks} tracks`,
        detail: `${stageCounts.segmentedPoints} points remain once the archive is split into clustering-ready trajectory fragments.`,
      },
      {
        id: 'compressed',
        label: 'Compressed Geometry',
        stageCode: 'COMP',
        value: `${stageCounts.compressedPoints} points`,
        detail: `Compression preserves ${compressionRatio} of segmented point density while keeping ${stageCounts.compressedTracks} corridor candidates intact.`,
      },
      {
        id: 'corridor',
        label: 'Corridor Runtime',
        stageCode: 'CORR',
        value: `${stageCounts.corridorRuntimeCorridors} corridors`,
        detail: `${stageCounts.corridorRuntimeTracks} tracks survive into the website-facing corridor runtime, or ${corridorYield} of compressed trajectories.`,
      },
    ],
    compressionRatio,
    corridorYield,
  }
}

export function buildClusteringViewModel(
  bundle: ClusteringBundle,
  requestedLayer: ClusteringLayerKey,
  requestedCorridorId: string,
): ClusteringViewModel {
  const availableLayers = getAvailableLayers(bundle)
  const availableLayerIds = availableLayers.map((layer) => layer.id)
  const selectedLayer = availableLayerIds.includes(requestedLayer) ? requestedLayer : availableLayers[0]?.id ?? 'raw'
  const selectedLayerDescriptor = LAYER_DESCRIPTORS[selectedLayer]

  const { runtimeCorridor, reviewCorridor } = resolveSelectedCorridor(bundle, requestedCorridorId)
  const previewTracks = createPreviewTracks(bundle, selectedLayer, runtimeCorridor?.corridorId ?? '')
  const reviewComparison = {
    corridorDelta: bundle.corridorReview.corridorCount - bundle.corridorRuntime.corridorCount,
    trackDelta: bundle.corridorReview.trackCount - bundle.corridorRuntime.trackCount,
    selectedCorridorMatches:
      runtimeCorridor !== null &&
      reviewCorridor !== null &&
      runtimeCorridor.trackCount === reviewCorridor.trackCount,
    runtimePath: bundle.summary.reviewStatus.runtimeCorridorPath,
    reviewPath: bundle.summary.reviewStatus.reviewCorridorPath,
    status:
      bundle.summary.reviewStatus.corridorPromotion === 'promoted'
        ? 'The review export is already promoted into the runtime corridor payload.'
        : bundle.corridorReview.corridorCount === bundle.corridorRuntime.corridorCount &&
            bundle.corridorReview.trackCount === bundle.corridorRuntime.trackCount
          ? 'Runtime and review corridor exports currently match at the contract level, so the review-first boundary can stay visible without blocking the module.'
          : 'Runtime and review corridor exports differ, so promotion should stay gated behind manual review.',
  }

  const corridorLeaderboard = bundle.corridorRuntime.corridors
    .map((corridor, index) => ({
      corridorId: corridor.corridorId,
      directionLabel: corridor.directionLabel,
      runtimeTrackCount: corridor.trackCount,
      reviewTrackCount:
        bundle.corridorReview.corridors.find((review) => review.corridorId === corridor.corridorId)?.trackCount ?? 0,
      runtimeShare: bundle.corridorRuntime.trackCount > 0 ? corridor.trackCount / bundle.corridorRuntime.trackCount : 0,
      rank: index + 1,
    }))
  const topCorridors = corridorLeaderboard.slice(0, 6)
  const selectedCorridorRank =
    runtimeCorridor ? corridorLeaderboard.find((corridor) => corridor.corridorId === runtimeCorridor.corridorId)?.rank ?? 0 : 0
  const selectedDirectionFamilyLabel = runtimeCorridor
    ? `${runtimeCorridor.directionLabel} family | ${
        corridorLeaderboard.filter((corridor) => corridor.directionLabel === runtimeCorridor.directionLabel).length
      } corridors in this direction group`
    : 'Direction family unavailable'
  const deferredItem = bundle.summary.deferred?.[0]
  const recoveryChecklist = {
    artifactId: deferredItem?.artifactId ?? 'clustering-noise-reclustered',
    blocker:
      deferredItem?.reason ??
      'The notebook-side noise re-clustering artifact is unavailable, so the website cannot ship a truthful CLUS-03 comparison yet.',
    dependsOn: deferredItem?.dependsOn ?? ['CLUS-03', 'Phase 10'],
    artifactStatus: describeNoiseArtifactStatus(deferredItem?.status, deferredItem?.fileBytes),
    artifactBytes: deferredItem?.fileBytes,
    artifactPath: deferredItem?.filePath,
    steps: [
      deferredItem?.status === 'zero-byte'
        ? 'Replace the zero-byte `normalized_distances(60,90,0.03).pkl` with a readable authoritative distance artifact.'
        : 'Recover a readable `normalized_distances(60,90,0.03).pkl` or regenerate an equivalent authoritative distance artifact.',
      'Re-run the notebook-grade noise re-clustering path in a stable local environment and export a website-facing bundle.',
      'Validate that runtime and recovery outputs stay aligned with the existing corridor entity model before reopening CLUS-03 surfaces.',
    ],
  }

  return {
    meta: {
      availableLayers,
      selectedLayer,
      reviewPromoted: bundle.summary.reviewStatus.corridorPromotion === 'promoted',
      noiseReclusterReady: false,
    },
    pipelineStory: createPipelineStory(bundle),
    selectedLayer: {
      descriptor: selectedLayerDescriptor,
      samplingMode: bundle.stagePreviews.previews[selectedLayer]?.samplingMode ?? 'not-exported',
      summary: createLayerSummary(selectedLayerDescriptor, runtimeCorridor),
      stats: createLayerStats(bundle, selectedLayer, runtimeCorridor),
      previewTracks,
    },
    stats: {
      totalCorridors: bundle.corridorRuntime.corridorCount,
      totalRuntimeTracks: bundle.corridorRuntime.trackCount,
      totalReviewTracks: bundle.corridorReview.trackCount,
      averageTracksPerCorridor:
        bundle.corridorRuntime.corridorCount > 0 ? bundle.corridorRuntime.trackCount / bundle.corridorRuntime.corridorCount : 0,
      topCorridors,
      selectedCorridor: runtimeCorridor
        ? {
            corridorId: runtimeCorridor.corridorId,
            directionLabel: runtimeCorridor.directionLabel,
            runtimeTrackCount: runtimeCorridor.trackCount,
            reviewTrackCount: reviewCorridor?.trackCount ?? 0,
            shareOfRuntimeTracks:
              bundle.corridorRuntime.trackCount > 0 ? runtimeCorridor.trackCount / bundle.corridorRuntime.trackCount : 0,
            rank: selectedCorridorRank,
            labelPoint: runtimeCorridor.labelPoint,
          }
        : null,
      noiseStatusMessage:
        bundle.summary.deferred?.[0]?.reason ??
        'Noise re-clustering remains deferred because the missing notebook artifact is not stable in the current environment.',
      directionFamilyLabel: selectedDirectionFamilyLabel,
    },
    corridorLeaderboard,
    reviewComparison,
    recoveryChecklist,
    routeEditorLink: '/route-editor.html',
  }
}
