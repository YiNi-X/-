import {
  formatRuntimeLoadFailure,
  loadDatasetCatalogResource,
  normalizeRuntimeResourcePath,
  resolveRuntimeResource,
} from './runtimeData'
import type { RuntimeLoadResult } from './runtimeData'

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

function sanitizeDatasetId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed && /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
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
  if (typeof window === 'undefined') return null

  const fromQuery = sanitizeDatasetId(new URLSearchParams(window.location.search).get(DATASET_QUERY_PARAM))
  if (fromQuery) return fromQuery

  try {
    return sanitizeDatasetId(window.localStorage.getItem(DATASET_STORAGE_KEY))
  } catch {
    return null
  }
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
  if (typeof window === 'undefined') return

  const safeDatasetId = sanitizeDatasetId(datasetId)
  if (!safeDatasetId) return

  try {
    window.localStorage.setItem(DATASET_STORAGE_KEY, safeDatasetId)
  } catch {
    // Ignore storage failures and continue using the URL.
  }

  const url = new URL(window.location.href)
  if (url.searchParams.get(DATASET_QUERY_PARAM) === safeDatasetId) return
  url.searchParams.set(DATASET_QUERY_PARAM, safeDatasetId)
  window.history.replaceState({}, '', url.toString())
}

export function formatDatasetPath(value?: string) {
  return value ? `/${normalizeRuntimeResourcePath(value)}` : 'Unavailable'
}
