import type { ShellRouteId } from './sharedContracts'
import {
  formatRuntimeLoadFailure,
  loadDatasetCatalogResource,
  normalizeRuntimeResourcePath,
  resolveRuntimeResource,
} from './runtimeData.ts'
import type { RuntimeLoadResult } from './runtimeData.ts'

export type DatasetCatalogEntry = {
  id: string
  label: string
  description: string
  aisPlaybackPath: string
  flowForecastPath?: string
}

export type DatasetCatalog = {
  defaultDatasetId: string
  datasets: DatasetCatalogEntry[]
}

export type DatasetAssetRequirement = 'ais' | 'forecast'

const DATASET_QUERY_PARAM = 'dataset'
const DATASET_STORAGE_KEY = 'route-motion.dataset-id'
const SHELL_ROUTE_QUERY_PARAM = 'view'
const SHELL_ROUTE_STORAGE_KEY = 'route-motion.shell-route'
const KNOWN_SHELL_ROUTE_IDS: ShellRouteId[] = ['home', 'overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking']

const DEFAULT_DATASET_ENTRY: DatasetCatalogEntry = {
  id: 'full-cleaned-ais',
  label: 'Full cleaned AIS',
  description: 'Full cleaned AIS playback and forecast timeline covering 2020-01-01 00:00 to 2020-01-03 00:00.',
  aisPlaybackPath: 'data/ais-playback.json',
  flowForecastPath: 'data/flow-forecast.json',
}

export const DEFAULT_DATASET_CATALOG: DatasetCatalog = {
  defaultDatasetId: DEFAULT_DATASET_ENTRY.id,
  datasets: [DEFAULT_DATASET_ENTRY],
}

function sanitizeSelectionToken(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed && /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

function sanitizeDatasetId(value: string | null | undefined) {
  return sanitizeSelectionToken(value)
}

function sanitizeShellRouteId(value: string | null | undefined): ShellRouteId | null {
  const safeRouteId = sanitizeSelectionToken(value)
  if (!safeRouteId) return null
  return KNOWN_SHELL_ROUTE_IDS.includes(safeRouteId as ShellRouteId) ? (safeRouteId as ShellRouteId) : null
}

function readPersistedSelection(queryParam: string, storageKey: string) {
  if (typeof window === 'undefined') return null

  const fromQuery = sanitizeSelectionToken(new URLSearchParams(window.location.search).get(queryParam))
  if (fromQuery) return fromQuery

  try {
    return sanitizeSelectionToken(window.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

function persistSelection(queryParam: string, storageKey: string, value: string) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, value)
  } catch {
    // Ignore storage failures and continue using the URL.
  }

  const url = new URL(window.location.href)
  if (url.searchParams.get(queryParam) === value) return
  url.searchParams.set(queryParam, value)
  window.history.replaceState({}, '', url.toString())
}

export { resolveRuntimeResource }

export async function loadDatasetCatalogResult(baseHref?: string): Promise<RuntimeLoadResult<DatasetCatalog>> {
  return loadDatasetCatalogResource(baseHref)
}

export async function loadDatasetCatalog(baseHref?: string): Promise<DatasetCatalog> {
  const result = await loadDatasetCatalogResult(baseHref)
  if (!result.ok) {
    throw new Error(formatRuntimeLoadFailure(result))
  }
  return result.data
}

export function readPreferredDatasetId() {
  return sanitizeDatasetId(readPersistedSelection(DATASET_QUERY_PARAM, DATASET_STORAGE_KEY))
}

export function readPreferredShellRouteId(): ShellRouteId | null {
  return sanitizeShellRouteId(readPersistedSelection(SHELL_ROUTE_QUERY_PARAM, SHELL_ROUTE_STORAGE_KEY))
}

function hasRequiredAssets(entry: DatasetCatalogEntry, requiredAssets: DatasetAssetRequirement[]) {
  return requiredAssets.every((asset) => (asset === 'ais' ? Boolean(entry.aisPlaybackPath) : Boolean(entry.flowForecastPath)))
}

export function selectDatasetEntry(
  catalog: DatasetCatalog,
  requestedId: string | null | undefined,
  requiredAssets: DatasetAssetRequirement[] = ['ais', 'forecast'],
) {
  const eligibleDatasets = catalog.datasets.filter((entry) => hasRequiredAssets(entry, requiredAssets))
  if (!eligibleDatasets.length) return DEFAULT_DATASET_ENTRY

  const safeRequestedId = sanitizeDatasetId(requestedId)
  return (
    eligibleDatasets.find((entry) => entry.id === safeRequestedId) ??
    eligibleDatasets.find((entry) => entry.id === catalog.defaultDatasetId) ??
    eligibleDatasets[0]
  )
}

export function persistDatasetSelection(datasetId: string) {
  const safeDatasetId = sanitizeDatasetId(datasetId)
  if (!safeDatasetId) return
  persistSelection(DATASET_QUERY_PARAM, DATASET_STORAGE_KEY, safeDatasetId)
}

export function persistShellRouteSelection(routeId: ShellRouteId) {
  persistSelection(SHELL_ROUTE_QUERY_PARAM, SHELL_ROUTE_STORAGE_KEY, routeId)
}

export function formatDatasetPath(value?: string) {
  return value ? `/${normalizeRuntimeResourcePath(value)}` : 'Unavailable'
}
