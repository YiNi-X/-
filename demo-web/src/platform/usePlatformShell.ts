import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_DATASET_CATALOG,
  loadDatasetCatalogResult,
  persistDatasetSelection,
  persistShellRouteSelection,
  readPreferredDatasetId,
  readPreferredShellRouteId,
  selectDatasetEntry,
} from '../datasetCatalog.ts'
import type { DatasetCatalog, DatasetCatalogEntry } from '../datasetCatalog.ts'
import type { ModuleId, ShellRouteId } from '../sharedContracts'
import type { ModuleDiscoveryDescriptor, ModuleRegistryEntry, ShellRouteDescriptor } from './moduleContracts.ts'
import { createModuleLoader, formatModuleLoaderFailure, type ModuleLoader } from './moduleLoader.ts'
import { getShellRouteDescriptor, isModuleRouteId, listPrimaryShellRoutes, listShellRoutes } from './routeRegistry.ts'

export type PlatformModuleStatus = {
  state: 'idle' | 'loading' | 'ready' | 'error'
  entry: ModuleRegistryEntry | null
  message: string
}

export type PlatformRegistryStatus = 'loading' | 'ready' | 'error'

export type PlatformShellOptions = {
  moduleLoader?: ModuleLoader
  initialRouteId?: ShellRouteId
  initialDatasetId?: string | null
  baseHref?: string
}

export type PlatformShellResult = {
  allRoutes: ShellRouteDescriptor[]
  primaryRoutes: ShellRouteDescriptor[]
  activeRouteId: ShellRouteId
  activeRoute: ShellRouteDescriptor
  activeModuleId: ModuleId | null
  activeModule: ModuleRegistryEntry | null
  activeModuleStatus: PlatformModuleStatus | null
  registryEntries: ModuleDiscoveryDescriptor[]
  registryStatus: PlatformRegistryStatus
  registryError: string
  selectedDatasetId: string
  selectedDataset: DatasetCatalogEntry
  selectedDatasetLabel: string
  availableDatasets: DatasetCatalogEntry[]
  catalogStatus: 'loading' | 'ready' | 'error'
  catalogError: string
  shellLoading: boolean
  shellUnavailableReason: string
  navigate: (routeId: ShellRouteId) => void
  selectDataset: (datasetId: string) => void
  retryRegistry: () => void
  retryActiveModule: () => void
}

const DEFAULT_MODULE_STATUS: PlatformModuleStatus = {
  state: 'idle',
  entry: null,
  message: '',
}

export function usePlatformShell(options: PlatformShellOptions = {}): PlatformShellResult {
  const [loader] = useState<ModuleLoader>(() => options.moduleLoader ?? createModuleLoader())
  const [activeRouteId, setActiveRouteId] = useState<ShellRouteId>(() => options.initialRouteId ?? readPreferredShellRouteId() ?? 'home')
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    () => options.initialDatasetId ?? readPreferredDatasetId() ?? DEFAULT_DATASET_CATALOG.defaultDatasetId,
  )
  const [datasetCatalog, setDatasetCatalog] = useState<DatasetCatalog | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogError, setCatalogError] = useState('')
  const [catalogReloadNonce, setCatalogReloadNonce] = useState(0)
  const [registryEntries, setRegistryEntries] = useState<ModuleDiscoveryDescriptor[]>([])
  const [registryStatus, setRegistryStatus] = useState<PlatformRegistryStatus>('loading')
  const [registryError, setRegistryError] = useState('')
  const [moduleStatuses, setModuleStatuses] = useState<Partial<Record<ModuleId, PlatformModuleStatus>>>({})
  const [registryReloadNonce, setRegistryReloadNonce] = useState(0)
  const [moduleReloadNonce, setModuleReloadNonce] = useState(0)

  const allRoutes = useMemo(() => listShellRoutes(), [])
  const primaryRoutes = useMemo(() => listPrimaryShellRoutes(), [])
  const activeRoute = useMemo(() => getShellRouteDescriptor(activeRouteId), [activeRouteId])
  const activeModuleId = useMemo(() => {
    if (!isModuleRouteId(activeRouteId)) return null
    return activeRouteId
  }, [activeRouteId])

  useEffect(() => {
    let cancelled = false

    loadDatasetCatalogResult(options.baseHref).then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setDatasetCatalog(null)
        setCatalogStatus('error')
        setCatalogError(result.detail)
        return
      }

      setDatasetCatalog(result.data)
      setCatalogStatus('ready')
      setCatalogError('')
    })

    return () => {
      cancelled = true
    }
  }, [catalogReloadNonce, options.baseHref])

  useEffect(() => {
    let cancelled = false

    loader.loadDiscovery(options.baseHref).then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setRegistryEntries([])
        setRegistryStatus('error')
        setRegistryError(`${result.message} ${result.detail}`)
        return
      }

      setRegistryEntries(result.entries)
      setRegistryStatus('ready')
      setRegistryError('')
    })

    return () => {
      cancelled = true
    }
  }, [loader, options.baseHref, registryReloadNonce])

  useEffect(() => {
    if (!activeModuleId || registryStatus !== 'ready') return

    let cancelled = false

    loader.loadModule(activeModuleId, options.baseHref).then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setModuleStatuses((current) => ({
          ...current,
          [activeModuleId]: {
            state: 'error',
            entry: current[activeModuleId]?.entry ?? null,
            message: formatModuleLoaderFailure(result),
          },
        }))
        return
      }

      setModuleStatuses((current) => ({
        ...current,
        [activeModuleId]: {
          state: 'ready',
          entry: result.entry,
          message: '',
        },
      }))
    })

    return () => {
      cancelled = true
    }
  }, [activeModuleId, loader, moduleReloadNonce, options.baseHref, registryStatus])

  const resolvedDatasetCatalog = datasetCatalog ?? DEFAULT_DATASET_CATALOG
  const availableDatasets = useMemo(
    () => resolvedDatasetCatalog.datasets.filter((item) => item.aisPlaybackPath && item.flowForecastPath) ?? [],
    [resolvedDatasetCatalog],
  )
  const selectedDataset = useMemo(
    () => selectDatasetEntry(resolvedDatasetCatalog, selectedDatasetId, ['ais', 'forecast']),
    [resolvedDatasetCatalog, selectedDatasetId],
  )
  const selectedDatasetLabel = selectedDataset.label
  const cachedActiveModule = activeModuleId ? loader.peekModule(activeModuleId) : null
  const activeModuleStatus = activeModuleId
    ? (moduleStatuses[activeModuleId] ??
      (cachedActiveModule
        ? { state: 'ready', entry: cachedActiveModule, message: '' }
        : registryStatus === 'ready'
          ? { state: 'loading', entry: null, message: '' }
          : DEFAULT_MODULE_STATUS))
    : null
  const activeModule = activeModuleStatus?.entry ?? null
  const shellUnavailableReason = catalogError || registryError
  const shellLoading = !shellUnavailableReason && (catalogStatus === 'loading' || registryStatus === 'loading')

  function navigate(routeId: ShellRouteId) {
    setActiveRouteId(routeId)
    persistShellRouteSelection(routeId)
  }

  function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId)
    persistDatasetSelection(datasetId)
  }

  function retryRegistry() {
    loader.clearCache()
    setRegistryEntries([])
    setModuleStatuses({})
    setCatalogError('')
    setCatalogStatus('loading')
    setRegistryError('')
    setRegistryStatus('loading')
    setCatalogReloadNonce((current) => current + 1)
    setRegistryReloadNonce((current) => current + 1)
  }

  function retryActiveModule() {
    if (!activeModuleId) return
    loader.clearCache(activeModuleId)
    setModuleStatuses((current) => {
      const next = { ...current }
      delete next[activeModuleId]
      return next
    })
    setModuleReloadNonce((current) => current + 1)
  }

  return {
    allRoutes,
    primaryRoutes,
    activeRouteId,
    activeRoute,
    activeModuleId,
    activeModule,
    activeModuleStatus,
    registryEntries,
    registryStatus,
    registryError,
    selectedDatasetId,
    selectedDataset,
    selectedDatasetLabel,
    availableDatasets,
    catalogStatus,
    catalogError,
    shellLoading,
    shellUnavailableReason,
    navigate,
    selectDataset,
    retryRegistry,
    retryActiveModule,
  }
}
