import { useEffect, useMemo, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { GeometryConfig, HorizonKey, MainCorridorTracksFile, ModuleBundleEntryFiles } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import {
  buildCorridorDominanceSummary,
  CLUSTERING_CORRIDOR_RUNTIME_PATH,
  type CorridorDominanceSummary,
} from '../clustering/corridorDominance.ts'
import { localizeFlowForecastData, localizeForecastMetrics } from '../zhCopy.ts'
import { buildForecastViewModel } from './forecastViewModel.ts'
import type {
  ForecastAnalysisTabId,
  ForecastEntryFiles,
  ForecastLoadedBundle,
  ForecastMetricsFile,
  ForecastModelConfig,
} from './forecastTypes.ts'

type ForecastModuleAssets = {
  metrics: ForecastMetricsFile
  geometry: GeometryConfig | null
  corridorDominance: CorridorDominanceSummary | null
  runtimeByModel: Record<string, ForecastLoadedBundle['runtime']>
  modelConfigByModel: Record<string, ForecastModelConfig | null>
}

type ForecastModuleState = {
  assets: ForecastModuleAssets | null
  selectedModel: string
  selectedHorizon: HorizonKey
  selectedFrameIndex: number
  selectedTab: ForecastAnalysisTabId
  selectedGridId: string | null
  isEvidenceDrawerOpen: boolean
  loading: boolean
  error: string
}

function asForecastEntryFiles(entryFiles: ModuleBundleEntryFiles): ForecastEntryFiles {
  return entryFiles as ForecastEntryFiles
}

function getAvailableModels(metrics: ForecastMetricsFile) {
  return Object.entries(metrics.models)
    .filter(([, value]) => value.status === 'available')
    .map(([model]) => model)
}

function modelEntryKey(prefix: 'runtime' | 'modelConfig', model: string) {
  return `${prefix}${model.replace(/[- ]/g, '')}`
}

function getRuntimePath(entryFiles: ForecastEntryFiles, model: string) {
  const entryKey = modelEntryKey('runtime', model)
  return entryFiles[entryKey] ?? entryFiles.runtime
}

function getModelConfigPath(entryFiles: ForecastEntryFiles, model: string) {
  const entryKey = modelEntryKey('modelConfig', model)
  return entryFiles[entryKey] ?? entryFiles.modelConfig
}

export function useForecastModule(entry: ModuleRegistryEntry) {
  const forecastEntryFiles = asForecastEntryFiles(entry.entryFiles)
  const [state, setState] = useState<ForecastModuleState>({
    assets: null,
    selectedModel: 'STGCN',
    selectedHorizon: '1h',
    selectedFrameIndex: 0,
    selectedTab: 'overview',
    selectedGridId: null,
    isEvidenceDrawerOpen: false,
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadForecastAssets() {
      const [rawMetrics, geometry, corridorRuntime] = await Promise.all([
        loadPublicJson<ForecastMetricsFile>(`/${forecastEntryFiles.metrics}`),
        loadPublicJson<GeometryConfig>('/data/shared-geometry.json').catch(() => null),
        loadPublicJson<MainCorridorTracksFile>(CLUSTERING_CORRIDOR_RUNTIME_PATH).catch(() => null),
      ])
      const metrics = localizeForecastMetrics(rawMetrics)

      const availableModels = getAvailableModels(metrics)
      const modelsToLoad = availableModels.length ? availableModels : ['STGCN']
      const runtimeEntries = await Promise.all(
        modelsToLoad.map(async (model) => {
          const runtime = await loadPublicJson<ForecastLoadedBundle['runtime']>(`/${getRuntimePath(forecastEntryFiles, model)}`)
          return [model, localizeFlowForecastData(runtime)] as const
        }),
      )
      const modelConfigEntries = await Promise.all(
        modelsToLoad.map(async (model) => {
          const configPath = getModelConfigPath(forecastEntryFiles, model)
          const modelConfig = configPath ? await loadPublicJson<ForecastModelConfig>(`/${configPath}`) : null
          return [model, modelConfig] as const
        }),
      )

      if (cancelled) return

      const runtimeByModel = Object.fromEntries(runtimeEntries)
      const modelConfigByModel = Object.fromEntries(modelConfigEntries)
      const firstModel = availableModels[0] ?? 'STGCN'
      const firstRuntime = runtimeByModel[firstModel]
      const firstHorizon = firstRuntime?.meta.horizons[0] ?? '1h'
      const defaultFrameIndex = firstRuntime ? Math.max(0, firstRuntime.timeline.length - 1) : 0
      const defaultGridId = firstRuntime?.timeline[defaultFrameIndex]?.derived.focusGrid ?? firstRuntime?.meta.hotspotIds[0] ?? null

      setState({
        assets: {
          metrics,
          geometry,
          corridorDominance: corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null,
          runtimeByModel,
          modelConfigByModel,
        },
        selectedModel: firstModel,
        selectedHorizon: firstHorizon,
        selectedFrameIndex: defaultFrameIndex,
        selectedTab: 'overview',
        selectedGridId: defaultGridId,
        isEvidenceDrawerOpen: false,
        loading: false,
        error: '',
      })
    }

    void loadForecastAssets().catch((loadError) => {
      if (cancelled) return
      setState((current) => ({
        ...current,
        assets: null,
        loading: false,
        error: loadError instanceof Error ? loadError.message : 'Failed to load forecast page data.',
      }))
    })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, forecastEntryFiles])

  const activeBundle = useMemo<ForecastLoadedBundle | null>(() => {
    if (!state.assets) return null
    const runtime = state.assets.runtimeByModel[state.selectedModel]
    if (!runtime) return null
    return {
      runtime,
      metrics: state.assets.metrics,
      modelConfig: state.assets.modelConfigByModel[state.selectedModel] ?? null,
      geometry: state.assets.geometry,
    }
  }, [state.assets, state.selectedModel])

  const viewModel = useMemo(() => {
    if (!activeBundle) return null
    return buildForecastViewModel(activeBundle, state.selectedModel, state.selectedHorizon, state.selectedFrameIndex)
  }, [activeBundle, state.selectedFrameIndex, state.selectedHorizon, state.selectedModel])

  const resolvedSelectedGridId =
    state.selectedGridId && viewModel?.hotspotSeries.byGrid[state.selectedGridId]
      ? state.selectedGridId
      : (viewModel?.frame?.derived.focusGrid ?? null)

  function setSelectedFrameIndex(selectedFrameIndex: number) {
    setState((current) => ({
      ...current,
      selectedFrameIndex,
      selectedGridId: current.assets?.runtimeByModel[current.selectedModel]?.timeline[selectedFrameIndex]?.derived.focusGrid ?? current.selectedGridId,
    }))
  }

  function setSelectedModel(selectedModel: string) {
    setState((current) => {
      const runtime = current.assets?.runtimeByModel[selectedModel]
      const nextFrameIndex = runtime ? Math.min(current.selectedFrameIndex, Math.max(0, runtime.timeline.length - 1)) : current.selectedFrameIndex
      const nextHorizon = runtime?.meta.horizons.includes(current.selectedHorizon) ? current.selectedHorizon : (runtime?.meta.horizons[0] ?? current.selectedHorizon)
      return {
        ...current,
        selectedModel,
        selectedHorizon: nextHorizon,
        selectedFrameIndex: nextFrameIndex,
        selectedGridId: runtime?.timeline[nextFrameIndex]?.derived.focusGrid ?? current.selectedGridId,
      }
    })
  }

  return {
    viewModel,
    loading: state.loading,
    error: state.error,
    corridorDominance: state.assets?.corridorDominance ?? null,
    selectedModel: state.selectedModel,
    selectedHorizon: state.selectedHorizon,
    selectedFrameIndex: state.selectedFrameIndex,
    selectedTab: state.selectedTab,
    selectedGridId: resolvedSelectedGridId,
    isEvidenceDrawerOpen: state.isEvidenceDrawerOpen,
    setSelectedModel,
    setSelectedHorizon: (selectedHorizon: HorizonKey) => setState((current) => ({ ...current, selectedHorizon })),
    setSelectedFrameIndex,
    setSelectedTab: (selectedTab: ForecastAnalysisTabId) => setState((current) => ({ ...current, selectedTab })),
    setSelectedGridId: (selectedGridId: string) => setState((current) => ({ ...current, selectedGridId })),
    setEvidenceDrawerOpen: (isEvidenceDrawerOpen: boolean) => setState((current) => ({ ...current, isEvidenceDrawerOpen })),
  }
}
