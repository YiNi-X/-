import type {
  RepairErrorMetricKey,
  RepairErrorsFile,
  RepairLoadedBundle,
  RepairModelSummary,
  RepairPoint,
  RepairViewModel,
  RepairViewPoint,
} from './repairTypes.ts'

const MODEL_LABELS: Record<string, string> = {
  'att-bilstm': 'ATT-BILSTM',
  bilstm: 'BiLSTM',
  lstm: 'LSTM',
  'linear-interpolation': '线性插值',
  'spline-interpolation': '样条插值',
}

function normalizeModelLabel(modelId: string, fallback?: string) {
  return MODEL_LABELS[modelId] ?? fallback ?? modelId
}

function buildAggregateRanking(metricsFile: RepairLoadedBundle['metrics']) {
  const aggregate = new Map<string, { modelLabel: string; rmseTotal: number; maeTotal: number; count: number }>()

  for (const sample of metricsFile.samples) {
    for (const metric of sample.metrics) {
      const current = aggregate.get(metric.modelId) ?? {
        modelLabel: normalizeModelLabel(metric.modelId, metric.modelLabel),
        rmseTotal: 0,
        maeTotal: 0,
        count: 0,
      }
      aggregate.set(metric.modelId, {
        modelLabel: current.modelLabel,
        rmseTotal: current.rmseTotal + metric.rmse,
        maeTotal: current.maeTotal + metric.mae,
        count: current.count + 1,
      })
    }
  }

  return [...aggregate.entries()]
    .map(([modelId, value]) => ({
      modelId,
      modelLabel: value.modelLabel,
      averageRmse: value.rmseTotal / value.count,
      averageMae: value.maeTotal / value.count,
    }))
    .sort((left, right) => left.averageRmse - right.averageRmse)
}

function buildViewPoints(points: RepairPoint[], bounds: RepairViewModel['trajectoryStage']['bounds']) {
  const width = 100
  const height = 100
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 1e-9)
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 1e-9)

  return points.map((point): RepairViewPoint => ({
    index: point.index,
    x: ((point.lon - bounds.minLon) / lonSpan) * width,
    y: height - ((point.lat - bounds.minLat) / latSpan) * height,
  }))
}

function buildBounds(sampleTrajectory: RepairLoadedBundle['trajectories']['samples'][number]) {
  const repairEntries = Object.values(sampleTrajectory.repairs).flatMap((repair) => repair.points)
  const allPoints = [...sampleTrajectory.missing, ...sampleTrajectory.groundTruth, ...repairEntries]
  const lons = allPoints.map((point) => point.lon)
  const lats = allPoints.map((point) => point.lat)
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  }
}

function buildSampleRanking(metricsFile: RepairLoadedBundle['metrics'], sampleId: string): RepairModelSummary[] {
  const sampleMetrics = metricsFile.samples.find((sample) => sample.sampleId === sampleId)?.metrics ?? []
  return sampleMetrics
    .map((metric) => ({
      modelId: metric.modelId,
      modelLabel: normalizeModelLabel(metric.modelId, metric.modelLabel),
      rmse: metric.rmse,
      mae: metric.mae,
      dtwSimilarity: metric.dtwSimilarity,
      ade: metric.ade,
      r2: metric.r2,
      hausdorffDistance: metric.hausdorffDistance,
      lonDifferenceMean: metric.lonDifferenceMean,
      latDifferenceMean: metric.latDifferenceMean,
      euclideanDistanceMean: metric.euclideanDistanceMean,
    }))
    .sort((left, right) => left.rmse - right.rmse)
}

function buildErrorSeries(
  errorsFile: RepairErrorsFile,
  sampleId: string,
  selectedMetric: RepairErrorMetricKey,
  selectedModelId: string,
): RepairViewModel['errors']['selectedSeriesByModel'] {
  const sampleErrors = errorsFile.samples.find((sample) => sample.sampleId === sampleId)
  if (!sampleErrors) return []

  return Object.values(sampleErrors.models)
    .map((model) => ({
      modelId: model.modelId,
      modelLabel: normalizeModelLabel(model.modelId, model.modelLabel),
      values: model[selectedMetric],
      highlighted: model.modelId === selectedModelId,
    }))
    .sort((left, right) => Number(right.highlighted) - Number(left.highlighted) || left.modelLabel.localeCompare(right.modelLabel))
}

function getSelectedModel(sampleRanking: RepairModelSummary[], selectedModelId: string) {
  return sampleRanking.find((item) => item.modelId === selectedModelId) ?? sampleRanking[0] ?? null
}

export function buildRepairViewModel(
  bundle: RepairLoadedBundle,
  selectedSampleId: string,
  selectedModelId: string,
  selectedErrorMetric: RepairErrorMetricKey,
): RepairViewModel {
  const aggregateRanking = buildAggregateRanking(bundle.metrics)
  const selectedCatalogSample =
    bundle.samples.samples.find((sample) => sample.sampleId === selectedSampleId) ?? bundle.samples.samples[0]
  const selectedTrajectorySample =
    bundle.trajectories.samples.find((sample) => sample.sampleId === selectedCatalogSample.sampleId) ?? bundle.trajectories.samples[0]

  const sampleRanking = buildSampleRanking(bundle.metrics, selectedCatalogSample.sampleId)
  const selectedModel = getSelectedModel(sampleRanking, selectedModelId)
  const selectedRepair =
    (selectedModel && selectedTrajectorySample.repairs[selectedModel.modelId]) ||
    selectedTrajectorySample.repairs[Object.keys(selectedTrajectorySample.repairs)[0]]

  const bounds = buildBounds(selectedTrajectorySample)
  const availableModels = selectedCatalogSample.availableModels.map((modelId) => ({
    modelId,
    modelLabel: normalizeModelLabel(modelId),
  }))

  return {
    meta: {
      sampleCount: bundle.samples.samples.length,
      availableModels,
      bestOverallModel: aggregateRanking[0]
        ? { modelId: aggregateRanking[0].modelId, modelLabel: aggregateRanking[0].modelLabel }
        : null,
      deferredItems: ['repair-optuna-study-export'],
    },
    summaryBand: {
      sampleLabel: selectedCatalogSample.label,
      targetId: selectedCatalogSample.targetId,
      selectedModelLabel: selectedModel?.modelLabel ?? normalizeModelLabel(selectedRepair.modelId, selectedRepair.modelLabel),
      missingPointCount: selectedCatalogSample.missingPointCount,
      groundTruthPointCount: selectedCatalogSample.groundTruthPointCount,
      availableMethodCount: selectedCatalogSample.availableModels.length,
      bestSampleModelLabel: sampleRanking[0]?.modelLabel ?? '--',
    },
    sampleSelector: {
      items: bundle.samples.samples.map((sample) => ({
        sampleId: sample.sampleId,
        label: sample.label,
        targetId: sample.targetId,
      })),
    },
    modelSelector: {
      items: availableModels,
    },
    trajectoryStage: {
      bounds,
      missing: buildViewPoints(selectedTrajectorySample.missing, bounds),
      groundTruth: buildViewPoints(selectedTrajectorySample.groundTruth, bounds),
      repair: buildViewPoints(selectedRepair.points, bounds),
    },
    metrics: {
      selectedModel,
      sampleRanking,
      aggregateRanking,
    },
    errors: {
      selectedMetric: selectedErrorMetric,
      selectedSeriesByModel: buildErrorSeries(bundle.errors, selectedCatalogSample.sampleId, selectedErrorMetric, selectedRepair.modelId),
    },
    readiness: {
      trajectoryMessage: '修复主舞台叠加展示缺失轨迹、真实轨迹与修复轨迹，这些都来自已提交导出结果，而不是实时回放。',
      errorMessage: '误差曲线按修复点序号索引，而不按真实时间展开，以保持对 notebook 导出证据的忠实表达。',
    },
  }
}

