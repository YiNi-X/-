import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_DATASET_CATALOG,
  type DatasetCatalog,
  type DatasetCatalogEntry,
  loadDatasetCatalogResult,
  persistDatasetSelection,
  readPreferredDatasetId,
  selectDatasetEntry,
} from '../datasetCatalog'
import type { AisPlaybackData, FlowForecastData, GeometryConfig } from '../sharedContracts'
import { formatRuntimeLoadFailure, loadAisPlaybackResource, loadFlowForecastResource, loadGeometryConfigResource } from '../runtimeData'
import { SHARED_GEOMETRY_PATH } from './dashboardUtils'
import { localizeFlowForecastData } from '../platform/zhCopy.ts'

export function useDashboardRuntime(preferredDatasetId?: string | null) {
  const [aisPlayback, setAisPlayback] = useState<AisPlaybackData | null>(null)
  const [flowForecast, setFlowForecast] = useState<FlowForecastData | null>(null)
  const [geometryConfig, setGeometryConfig] = useState<GeometryConfig | null>(null)
  const [datasetCatalog, setDatasetCatalog] = useState<DatasetCatalog | null>(null)
  const [localSelectedDatasetId, setLocalSelectedDatasetId] = useState(() => readPreferredDatasetId() ?? DEFAULT_DATASET_CATALOG.defaultDatasetId)
  const selectedDatasetId = preferredDatasetId ?? localSelectedDatasetId
  const [catalogLoadError, setCatalogLoadError] = useState('')
  const [datasetLoadError, setDatasetLoadError] = useState('')
  const [geometryLoadError, setGeometryLoadError] = useState('')

  const availableDatasets = useMemo(
    () => datasetCatalog?.datasets.filter((item) => item.aisPlaybackPath && item.flowForecastPath) ?? [],
    [datasetCatalog],
  )

  const selectedDataset = useMemo<DatasetCatalogEntry | null>(() => {
    if (!datasetCatalog || !availableDatasets.length) return null
    return selectDatasetEntry(datasetCatalog, selectedDatasetId, ['ais', 'forecast'])
  }, [availableDatasets.length, datasetCatalog, selectedDatasetId])

  const selectedDatasetLabel = useMemo(
    () => selectedDataset?.label ?? (datasetCatalog ? '暂无可用数据集' : '等待数据目录'),
    [datasetCatalog, selectedDataset],
  )

  useEffect(() => {
    let cancelled = false

    loadDatasetCatalogResult().then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setDatasetCatalog(null)
        setCatalogLoadError(formatRuntimeLoadFailure(result))
        setAisPlayback(null)
        setFlowForecast(null)
        return
      }

      setDatasetCatalog(result.data)
      setCatalogLoadError('')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadGeometryConfigResource(SHARED_GEOMETRY_PATH).then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setGeometryConfig(null)
        setGeometryLoadError(formatRuntimeLoadFailure(result))
        return
      }

      setGeometryConfig(result.data)
      setGeometryLoadError('')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (selectedDataset) {
      void (async () => {
        if (cancelled) return

        setAisPlayback(null)
        setFlowForecast(null)
        setDatasetLoadError('')

        const [playbackResult, forecastResult] = await Promise.all([
          loadAisPlaybackResource(selectedDataset.aisPlaybackPath),
          loadFlowForecastResource(selectedDataset.flowForecastPath ?? 'data/flow-forecast.json'),
        ])

        if (cancelled) return

        if (!playbackResult.ok) {
          setAisPlayback(null)
          setFlowForecast(null)
          setDatasetLoadError(formatRuntimeLoadFailure(playbackResult))
          return
        }

        if (!forecastResult.ok) {
          setAisPlayback(null)
          setFlowForecast(null)
          setDatasetLoadError(formatRuntimeLoadFailure(forecastResult))
          return
        }

        setAisPlayback(playbackResult.data)
        setFlowForecast(localizeFlowForecastData(forecastResult.data))
        setDatasetLoadError('')
      })()
    }

    return () => {
      cancelled = true
    }
  }, [selectedDataset])

  const runtimeLoadError = catalogLoadError || geometryLoadError || datasetLoadError
  const dashboardUnavailableReason =
    runtimeLoadError ||
    (datasetCatalog && !selectedDataset
      ? '交通数据暂不可用。当前数据集目录中没有同时通过校验的 AIS 回放与流量预测配对。'
      : '')
  const dashboardReady = Boolean(datasetCatalog && selectedDataset && geometryConfig && aisPlayback && flowForecast)
  const dashboardLoading = !dashboardUnavailableReason && !dashboardReady

  function selectDataset(nextDatasetId: string) {
    setLocalSelectedDatasetId(nextDatasetId)
    persistDatasetSelection(nextDatasetId)
  }

  return {
    aisPlayback,
    flowForecast,
    geometryConfig,
    datasetCatalog,
    selectedDataset,
    selectedDatasetLabel,
    availableDatasets,
    runtimeLoadError,
    dashboardUnavailableReason,
    dashboardReady,
    dashboardLoading,
    selectDataset,
  }
}
