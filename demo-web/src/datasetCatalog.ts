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
const FALLBACK_BASE_URL = 'http://localhost/'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePath(value: string) {
  return value.trim().replace(/^\//, '')
}

function sanitizeDatasetId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed && /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

function toCatalogEntry(value: unknown): DatasetCatalogEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.label !== 'string' || typeof value.aisPlaybackPath !== 'string') return null

  const id = sanitizeDatasetId(value.id)
  const label = value.label.trim()
  const aisPlaybackPath = normalizePath(value.aisPlaybackPath)

  if (!id || !label || !aisPlaybackPath) return null

  return {
    id,
    label,
    description: typeof value.description === 'string' ? value.description.trim() : '',
    aisPlaybackPath,
    flowForecastPath:
      typeof value.flowForecastPath === 'string' && value.flowForecastPath.trim()
        ? normalizePath(value.flowForecastPath)
        : undefined,
  }
}

function normalizeCatalog(value: unknown): DatasetCatalog {
  if (!isRecord(value) || !Array.isArray(value.datasets)) return DEFAULT_DATASET_CATALOG

  const datasets = value.datasets.map(toCatalogEntry).filter((entry): entry is DatasetCatalogEntry => Boolean(entry))
  if (!datasets.length) return DEFAULT_DATASET_CATALOG

  const requestedDefaultId = typeof value.defaultDatasetId === 'string' ? sanitizeDatasetId(value.defaultDatasetId) : null
  const defaultDatasetId = datasets.some((entry) => entry.id === requestedDefaultId) ? requestedDefaultId ?? datasets[0].id : datasets[0].id

  return {
    defaultDatasetId,
    datasets,
  }
}

function getRuntimeBaseHref(baseHref?: string) {
  if (baseHref) return baseHref
  if (typeof window !== 'undefined') return window.location.href
  return FALLBACK_BASE_URL
}

export function resolveRuntimeResource(resource: string, baseHref?: string) {
  return new URL(normalizePath(resource), getRuntimeBaseHref(baseHref)).toString()
}

export async function loadDatasetCatalog(baseHref?: string): Promise<DatasetCatalog> {
  try {
    const response = await fetch(resolveRuntimeResource('data/dataset-catalog.json', baseHref))
    if (!response.ok) throw new Error(`Failed to load dataset catalog: ${response.status}`)
    return normalizeCatalog(await response.json())
  } catch {
    return DEFAULT_DATASET_CATALOG
  }
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
  return value ? `/${normalizePath(value)}` : 'Unavailable'
}
