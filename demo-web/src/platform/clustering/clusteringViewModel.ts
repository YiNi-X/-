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
    label: '原始轨迹',
    shortLabel: '原始',
    stageCode: 'RAW',
    description: '分段之前的精选 AIS 轨迹，是聚类叙事的 provenance 起点。',
  },
  segmented: {
    id: 'segmented',
    label: '分段轨迹',
    shortLabel: '分段',
    stageCode: 'SEGM',
    description: '分段后的轨迹片段，展示后续压缩与聚类真正消费的序列单元。',
  },
  compressed: {
    id: 'compressed',
    label: '压缩轨迹',
    shortLabel: '压缩',
    stageCode: 'COMP',
    description: '在聚类导出前降低点密度、但保留 corridor 形态意图的简化轨迹。',
  },
  corridorExported: {
    id: 'corridorExported',
    label: 'runtime corridor 提取',
    shortLabel: 'Runtime',
    stageCode: 'CORR',
    description: '已提升为正式 runtime 的 corridor 包，支撑网站共享路线与 RouteEditor 体验。',
  },
  corridorReview: {
    id: 'corridorReview',
    label: 'review corridor 提取',
    shortLabel: 'Review',
    stageCode: 'REVIEW',
    description: 'review-first 的 corridor 导出，在明确批准提升前与当前 runtime 数据集保持分离。',
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
        detail: `${stageCounts.rawMmsiCount} 个 MMSI 身份保留在归档窗口中。`,
      },
      {
        label: '研究侧过滤后行数',
        value: stageCounts.filteredResearchRows,
        detail: `${stageCounts.filteredResearchMmsiCount} 个 MMSI 身份通过研究侧过滤。`,
      },
      {
        label: '预览轨迹数',
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
        detail: `分段后保留 ${stageCounts.segmentedPoints} 个点。`,
      },
      {
        label: '预览轨迹数',
        value: bundle.stagePreviews.previews.segmented.trackCount,
        detail: bundle.stagePreviews.previews.segmented.samplingMode,
      },
      {
        label: '后续压缩占比',
        value: `${Math.round((stageCounts.compressedPoints / stageCounts.segmentedPoints) * 100)}%`,
        detail: '压缩阶段之后保留下来的点密度比例。',
      },
    ]
  }

  if (layer === 'compressed') {
    const savedPoints = stageCounts.segmentedPoints - stageCounts.compressedPoints
    return [
      {
        label: 'Compressed tracks',
        value: stageCounts.compressedTracks,
        detail: `${stageCounts.compressedPoints} 个保留点继续用于 corridor 导出。`,
      },
      {
        label: '移除点数',
        value: savedPoints,
        detail: `相对分段阶段减少 ${Math.round((savedPoints / stageCounts.segmentedPoints) * 100)}%。`,
      },
      {
        label: '预览轨迹数',
        value: bundle.stagePreviews.previews.compressed.trackCount,
        detail: bundle.stagePreviews.previews.compressed.samplingMode,
      },
    ]
  }

  return [
    {
      label: 'cluster 数',
      value: layer === 'corridorExported' ? stageCounts.corridorRuntimeCorridors : stageCounts.corridorReviewCorridors,
      detail: '当前版本对外呈现的聚类结果是按方向分组后的 corridor。',
    },
    {
      label: 'corridor 轨迹数',
      value: layer === 'corridorExported' ? stageCounts.corridorRuntimeTracks : stageCounts.corridorReviewTracks,
      detail: selectedCorridor
        ? `${selectedCorridor.corridorId} 在当前 corridor 组中贡献 ${selectedCorridor.trackCount} 条轨迹。`
        : '在右侧选择一条 corridor 查看其贡献。',
    },
    {
      label: '预览轨迹数',
      value: bundle.stagePreviews.previews[layer].trackCount,
      detail: bundle.stagePreviews.previews[layer].samplingMode,
    },
  ]
}

function createLayerSummary(layer: ClusteringLayerDescriptor, selectedCorridor: MainCorridorSummaryEntry | null) {
  if (layer.id === 'corridorExported' || layer.id === 'corridorReview') {
    return selectedCorridor
      ? `${layer.description} 当前聚焦的 corridor 为 ${selectedCorridor.corridorId}（${selectedCorridor.directionLabel}）。`
      : layer.description
  }

  return layer.description
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function describeNoiseArtifactStatus(status: string | undefined, fileBytes: number | undefined) {
  if (status === 'zero-byte') return `工作区中存在，但仍为 ${fileBytes ?? 0} 字节`
  if (status === 'missing') return '工作区中缺失'
  if (status === 'present') return '已恢复，但尚未重新导出'
  return '当前环境下不可读'
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
        label: '归档窗口',
        stageCode: 'RAW',
        value: `${stageCounts.rawAisRows} rows`,
        detail: `研究侧过滤开始前，原始 AIS 归档中出现 ${stageCounts.rawMmsiCount} 艘船舶。`,
      },
      {
        id: 'segmented',
        label: '轨迹分段',
        stageCode: 'SEGM',
        value: `${stageCounts.segmentedTracks} tracks`,
        detail: `归档数据切分为可聚类轨迹片段后，保留 ${stageCounts.segmentedPoints} 个点。`,
      },
      {
        id: 'compressed',
        label: '压缩后几何',
        stageCode: 'COMP',
        value: `${stageCounts.compressedPoints} points`,
        detail: `压缩阶段保留了 ${compressionRatio} 的分段点密度，同时维持 ${stageCounts.compressedTracks} 条 corridor 候选轨迹。`,
      },
      {
        id: 'corridor',
        label: 'Corridor Runtime',
        stageCode: 'CORR',
        value: `${stageCounts.corridorRuntimeCorridors} corridors`,
        detail: `${stageCounts.corridorRuntimeTracks} 条轨迹进入面向网站的 corridor runtime，占压缩轨迹的 ${corridorYield}。`,
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
        ? 'review 导出已经被提升进入 runtime corridor 载荷。'
        : bundle.corridorReview.corridorCount === bundle.corridorRuntime.corridorCount &&
            bundle.corridorReview.trackCount === bundle.corridorRuntime.trackCount
          ? 'runtime 与 review 的 corridor 导出在契约层面当前一致，因此可以保留 review-first 边界而不阻塞模块上线。'
          : 'runtime 与 review 的 corridor 导出仍有差异，因此提升动作应继续由人工审核把关。',
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
    ? `${runtimeCorridor.directionLabel} 家族 | ${
        corridorLeaderboard.filter((corridor) => corridor.directionLabel === runtimeCorridor.directionLabel).length
      } 条 corridor 属于该方向组`
    : '方向家族信息不可用'
  const deferredItem = bundle.summary.deferred?.[0]
  const recoveryChecklist = {
    artifactId: deferredItem?.artifactId ?? 'clustering-noise-reclustered',
    blocker:
      deferredItem?.reason ??
      'notebook 侧 noise re-clustering 产物当前不可用，因此网站还不能上线一个真实可信的 CLUS-03 对比结果。',
    dependsOn: deferredItem?.dependsOn ?? ['CLUS-03', 'Phase 10'],
    artifactStatus: describeNoiseArtifactStatus(deferredItem?.status, deferredItem?.fileBytes),
    artifactBytes: deferredItem?.fileBytes,
    artifactPath: deferredItem?.filePath,
    steps: [
      deferredItem?.status === 'zero-byte'
        ? '先用可读、可信的距离矩阵产物替换当前 0 字节的 `normalized_distances(60,90,0.03).pkl`。'
        : '恢复一个可读的 `normalized_distances(60,90,0.03).pkl`，或重新生成等价且可信的距离矩阵产物。',
      '在稳定的本地环境中重跑 notebook 级 noise re-clustering 路径，并导出面向网站的 bundle。',
      '确认恢复结果与现有 corridor 实体模型保持一致后，再重新开放 CLUS-03 相关界面。',
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
        'noise re-clustering 仍保持 deferred，因为缺失的 notebook 产物在当前环境中还不稳定。',
      directionFamilyLabel: selectedDirectionFamilyLabel,
    },
    corridorLeaderboard,
    reviewComparison,
    recoveryChecklist,
    routeEditorLink: '/route-editor.html',
  }
}
