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

export function useDashboardRuntime() {
  const [aisPlayback, setAisPlayback] = useState<AisPlaybackData | null>(null)
  const [flowForecast, setFlowForecast] = useState<FlowForecastData | null>(null)
  const [geometryConfig, setGeometryConfig] = useState<GeometryConfig | null>(null)
  const [datasetCatalog, setDatasetCatalog] = useState<DatasetCatalog | null>(null)
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => readPreferredDatasetId() ?? DEFAULT_DATASET_CATALOG.defaultDatasetId)
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
    () => selectedDataset?.label ?? (datasetCatalog ? 'No operable dataset' : 'Waiting for catalog'),
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
        setFlowForecast(forecastResult.data)
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
      ? 'Traffic data unavailable. The dataset catalog does not currently provide a validated AIS playback and forecast pair.'
      : '')
  const dashboardReady = Boolean(datasetCatalog && selectedDataset && geometryConfig && aisPlayback && flowForecast)
  const dashboardLoading = !dashboardUnavailableReason && !dashboardReady

  function selectDataset(nextDatasetId: string) {
    setSelectedDatasetId(nextDatasetId)
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
