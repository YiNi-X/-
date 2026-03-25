import { ZodError } from 'zod'
import type { DatasetCatalog } from './datasetCatalog'
import type {
  AisPlaybackData,
  FlowForecastData,
  GeometryConfig,
  MainCorridorTracksFile,
  ModuleArtifactIndex,
  ModuleBundleMetadata,
  ModuleManifest,
} from './sharedContracts'
import {
  parseAisPlaybackData,
  parseDatasetCatalog,
  parseFlowForecastData,
  parseGeometryConfig,
  parseMainCorridorTracksFile,
  parseModuleArtifactIndex,
  parseModuleBundleMetadata,
  parseModuleManifest,
} from './runtimeSchemas.ts'

type RuntimeParser<T> = (value: unknown) => T

export type RuntimeResourceKind =
  | 'datasetCatalog'
  | 'sharedGeometry'
  | 'aisPlayback'
  | 'flowForecast'
  | 'mainCorridorTracks'
  | 'moduleArtifactIndex'
  | 'moduleManifest'
  | 'moduleBundle'
export type RuntimeLoadFailureReason = 'network' | 'http' | 'json' | 'contract'

export type RuntimeLoadSuccess<T> = {
  ok: true
  kind: RuntimeResourceKind
  label: string
  path: string
  data: T
}

export type RuntimeLoadFailure = {
  ok: false
  kind: RuntimeResourceKind
  label: string
  path: string
  reason: RuntimeLoadFailureReason
  message: string
  detail: string
}

export type RuntimeLoadResult<T> = RuntimeLoadSuccess<T> | RuntimeLoadFailure

type RuntimeLoadConfig<T> = {
  kind: RuntimeResourceKind
  label: string
  resource: string
  parser: RuntimeParser<T>
  baseHref?: string
}

const FALLBACK_BASE_URL = 'http://localhost/'
const DEFAULT_DATASET_CATALOG_PATH = 'data/dataset-catalog.json'
const DEFAULT_MODULE_ARTIFACT_INDEX_PATH = 'data/modules/artifact-index.json'

export function normalizeRuntimeResourcePath(resource: string) {
  return resource.trim().replace(/^\/+/, '')
}

function isAbsoluteResource(resource: string) {
  return /^[a-z]+:/i.test(resource)
}

function formatRuntimePath(resource: string) {
  return isAbsoluteResource(resource) ? resource.trim() : `/${normalizeRuntimeResourcePath(resource)}`
}

function getRuntimeBaseHref(baseHref?: string) {
  if (baseHref) return baseHref
  if (typeof window !== 'undefined') return window.location.href
  return FALLBACK_BASE_URL
}

export function resolveRuntimeResource(resource: string, baseHref?: string) {
  const trimmed = resource.trim()
  if (isAbsoluteResource(trimmed)) return trimmed
  return new URL(normalizeRuntimeResourcePath(trimmed), getRuntimeBaseHref(baseHref)).toString()
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Unknown runtime data error'
}

function formatContractError(error: ZodError) {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'root'
      return `${path}: ${issue.message}`
    })
    .join(' | ')
}

function buildFailure(
  config: Pick<RuntimeLoadConfig<unknown>, 'kind' | 'label'>,
  path: string,
  reason: RuntimeLoadFailureReason,
  detail: string,
): RuntimeLoadFailure {
  return {
    ok: false,
    kind: config.kind,
    label: config.label,
    path,
    reason,
    message: `${config.label} unavailable.`,
    detail,
  }
}

async function loadValidatedRuntimeJson<T>(config: RuntimeLoadConfig<T>): Promise<RuntimeLoadResult<T>> {
  const path = formatRuntimePath(config.resource)
  const requestUrl = resolveRuntimeResource(config.resource, config.baseHref)

  let response: Response
  try {
    response = await fetch(requestUrl)
  } catch (error) {
    return buildFailure(config, path, 'network', `${path} could not be fetched. ${formatUnknownError(error)}`)
  }

  if (!response.ok) {
    return buildFailure(config, path, 'http', `${path} returned HTTP ${response.status}.`)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return buildFailure(config, path, 'json', `${path} did not contain valid JSON. ${formatUnknownError(error)}`)
  }

  try {
    return {
      ok: true,
      kind: config.kind,
      label: config.label,
      path,
      data: config.parser(payload),
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return buildFailure(config, path, 'contract', `${path} failed runtime contract validation. ${formatContractError(error)}`)
    }
    return buildFailure(config, path, 'contract', `${path} could not be parsed. ${formatUnknownError(error)}`)
  }
}

export function formatRuntimeLoadFailure(failure: RuntimeLoadFailure) {
  return `${failure.message} ${failure.detail}`
}

export function loadDatasetCatalogResource(baseHref?: string) {
  return loadValidatedRuntimeJson<DatasetCatalog>({
    kind: 'datasetCatalog',
    label: 'Dataset catalog',
    resource: DEFAULT_DATASET_CATALOG_PATH,
    parser: parseDatasetCatalog,
    baseHref,
  })
}

export function loadModuleArtifactIndexResource(baseHref?: string) {
  return loadValidatedRuntimeJson<ModuleArtifactIndex>({
    kind: 'moduleArtifactIndex',
    label: 'Module artifact index',
    resource: DEFAULT_MODULE_ARTIFACT_INDEX_PATH,
    parser: parseModuleArtifactIndex,
    baseHref,
  })
}

export function loadModuleManifestResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<ModuleManifest>({
    kind: 'moduleManifest',
    label: 'Module manifest',
    resource,
    parser: parseModuleManifest,
    baseHref,
  })
}

export function loadModuleBundleMetadataResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<ModuleBundleMetadata>({
    kind: 'moduleBundle',
    label: 'Module bundle',
    resource,
    parser: parseModuleBundleMetadata,
    baseHref,
  })
}

export function loadGeometryConfigResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<GeometryConfig>({
    kind: 'sharedGeometry',
    label: 'Shared geometry',
    resource,
    parser: parseGeometryConfig,
    baseHref,
  })
}

export function loadAisPlaybackResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<AisPlaybackData>({
    kind: 'aisPlayback',
    label: 'AIS playback',
    resource,
    parser: parseAisPlaybackData,
    baseHref,
  })
}

export function loadFlowForecastResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<FlowForecastData>({
    kind: 'flowForecast',
    label: 'Flow forecast',
    resource,
    parser: parseFlowForecastData,
    baseHref,
  })
}

export function loadMainCorridorTracksResource(resource: string, baseHref?: string) {
  return loadValidatedRuntimeJson<MainCorridorTracksFile>({
    kind: 'mainCorridorTracks',
    label: 'Main corridor tracks',
    resource,
    parser: parseMainCorridorTracksFile,
    baseHref,
  })
}
