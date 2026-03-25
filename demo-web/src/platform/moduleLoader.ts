import type { ModuleArtifactIndex, ModuleBundleMetadata, ModuleId, ModuleManifest } from '../sharedContracts'
import {
  loadModuleArtifactIndexResource,
  loadModuleBundleMetadataResource,
  loadModuleManifestResource,
} from '../runtimeData.ts'
import type { RuntimeLoadResult } from '../runtimeData.ts'
import type { ModuleDiscoveryDescriptor, ModuleRegistryEntry } from './moduleContracts.ts'
import { buildModuleDiscoveryRegistry, createModuleRegistryEntry } from './moduleRegistry.ts'

type ArtifactIndexLoader = (baseHref?: string) => Promise<RuntimeLoadResult<ModuleArtifactIndex>>
type ManifestLoader = (resource: string, baseHref?: string) => Promise<RuntimeLoadResult<ModuleManifest>>
type BundleLoader = (resource: string, baseHref?: string) => Promise<RuntimeLoadResult<ModuleBundleMetadata>>

export type ModuleLoaderDependencies = {
  loadArtifactIndex?: ArtifactIndexLoader
  loadManifest?: ManifestLoader
  loadBundle?: BundleLoader
}

export type ModuleDiscoveryLoadResult =
  | {
      ok: true
      entries: ModuleDiscoveryDescriptor[]
      source: 'network' | 'cache'
    }
  | {
      ok: false
      stage: 'artifact-index' | 'contract'
      message: string
      detail: string
    }

export type ModulePackageLoadResult =
  | {
      ok: true
      discovery: ModuleDiscoveryDescriptor
      entry: ModuleRegistryEntry
      source: 'network' | 'cache'
    }
  | {
      ok: false
      moduleId: ModuleId
      stage: 'artifact-index' | 'manifest' | 'bundle' | 'module' | 'contract'
      message: string
      detail: string
    }

export type ModuleLoader = {
  loadDiscovery: (baseHref?: string) => Promise<ModuleDiscoveryLoadResult>
  loadModule: (moduleId: ModuleId, baseHref?: string) => Promise<ModulePackageLoadResult>
  peekDiscovery: () => ModuleDiscoveryDescriptor[] | null
  peekModule: (moduleId: ModuleId) => ModuleRegistryEntry | null
  listCachedModuleIds: () => ModuleId[]
  clearCache: (moduleId?: ModuleId) => void
}

function cloneDiscoveryEntry(entry: ModuleDiscoveryDescriptor): ModuleDiscoveryDescriptor {
  return {
    ...entry,
    timeRange: { ...entry.timeRange },
    authoritativeFor: [...entry.authoritativeFor],
  }
}

function cloneModuleRegistryEntry(entry: ModuleRegistryEntry): ModuleRegistryEntry {
  return {
    ...entry,
    timeRange: { ...entry.timeRange },
    authoritativeFor: [...entry.authoritativeFor],
    entryFiles: { ...entry.entryFiles },
    entryFileList: entry.entryFileList.map((item) => ({ ...item })),
    artifacts: entry.artifacts.map((artifact) => ({
      ...artifact,
      timeRange: { ...artifact.timeRange },
      derivedFrom: [...artifact.derivedFrom],
      authoritativeFor: [...artifact.authoritativeFor],
    })),
    reviewFiles: [...entry.reviewFiles],
    sources: { ...entry.sources },
    deferredItems: entry.deferredItems.map((item) => ({ ...item, dependsOn: [...item.dependsOn] })),
  }
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Unknown module loader error'
}

function createDiscoverySuccess(
  entries: ModuleDiscoveryDescriptor[],
  source: 'network' | 'cache',
): ModuleDiscoveryLoadResult {
  return {
    ok: true,
    entries,
    source,
  }
}

function createDiscoveryFailure(
  stage: 'artifact-index' | 'contract',
  message: string,
  detail: string,
): ModuleDiscoveryLoadResult {
  return {
    ok: false,
    stage,
    message,
    detail,
  }
}

function createModuleSuccess(
  discovery: ModuleDiscoveryDescriptor,
  entry: ModuleRegistryEntry,
  source: 'network' | 'cache',
): ModulePackageLoadResult {
  return {
    ok: true,
    discovery,
    entry,
    source,
  }
}

function createModuleFailure(
  moduleId: ModuleId,
  stage: 'artifact-index' | 'manifest' | 'bundle' | 'module' | 'contract',
  message: string,
  detail: string,
): ModulePackageLoadResult {
  return {
    ok: false,
    moduleId,
    stage,
    message,
    detail,
  }
}

export function createModuleLoader(dependencies: ModuleLoaderDependencies = {}): ModuleLoader {
  const loadArtifactIndex = dependencies.loadArtifactIndex ?? loadModuleArtifactIndexResource
  const loadManifest = dependencies.loadManifest ?? loadModuleManifestResource
  const loadBundle = dependencies.loadBundle ?? loadModuleBundleMetadataResource

  let discoveryCache: ModuleDiscoveryDescriptor[] | null = null
  let discoveryPromise: Promise<ModuleDiscoveryLoadResult> | null = null
  const moduleCache = new Map<ModuleId, ModuleRegistryEntry>()
  const modulePromises = new Map<ModuleId, Promise<ModulePackageLoadResult>>()

  async function loadDiscovery(baseHref?: string): Promise<ModuleDiscoveryLoadResult> {
    if (discoveryCache) {
      return createDiscoverySuccess(discoveryCache.map((entry) => cloneDiscoveryEntry(entry)), 'cache')
    }

    if (discoveryPromise) return discoveryPromise

    discoveryPromise = (async () => {
      const artifactIndexResult = await loadArtifactIndex(baseHref)
      if (!artifactIndexResult.ok) {
        return createDiscoveryFailure('artifact-index', artifactIndexResult.message, artifactIndexResult.detail)
      }

      try {
        discoveryCache = buildModuleDiscoveryRegistry(artifactIndexResult.data)
        return createDiscoverySuccess(discoveryCache.map((entry) => cloneDiscoveryEntry(entry)), 'network')
      } catch (error) {
        return createDiscoveryFailure('contract', 'Module artifact index unavailable.', formatUnknownError(error))
      }
    })()

    try {
      return await discoveryPromise
    } finally {
      discoveryPromise = null
    }
  }

  async function loadModule(moduleId: ModuleId, baseHref?: string): Promise<ModulePackageLoadResult> {
    const cachedEntry = moduleCache.get(moduleId)
    if (cachedEntry) {
      const discovery = discoveryCache?.find((entry) => entry.moduleId === moduleId)
      if (discovery) {
        return createModuleSuccess(cloneDiscoveryEntry(discovery), cloneModuleRegistryEntry(cachedEntry), 'cache')
      }
    }

    const inFlight = modulePromises.get(moduleId)
    if (inFlight) return inFlight

    const loadPromise = (async () => {
      const discoveryResult = await loadDiscovery(baseHref)
      if (!discoveryResult.ok) {
        return createModuleFailure(moduleId, discoveryResult.stage, discoveryResult.message, discoveryResult.detail)
      }

      const discovery = discoveryResult.entries.find((entry) => entry.moduleId === moduleId)
      if (!discovery) {
        return createModuleFailure(moduleId, 'module', `${moduleId} unavailable.`, 'The requested module is not present in artifact-index.json.')
      }

      const [manifestResult, bundleResult] = await Promise.all([
        loadManifest(discovery.manifestPath, baseHref),
        loadBundle(discovery.bundlePath, baseHref),
      ])

      if (!manifestResult.ok) {
        return createModuleFailure(moduleId, 'manifest', manifestResult.message, manifestResult.detail)
      }

      if (!bundleResult.ok) {
        return createModuleFailure(moduleId, 'bundle', bundleResult.message, bundleResult.detail)
      }

      try {
        const registryEntry = createModuleRegistryEntry(discovery, manifestResult.data, bundleResult.data)
        moduleCache.set(moduleId, registryEntry)
        return createModuleSuccess(cloneDiscoveryEntry(discovery), cloneModuleRegistryEntry(registryEntry), 'network')
      } catch (error) {
        return createModuleFailure(moduleId, 'contract', `${discovery.label} unavailable.`, formatUnknownError(error))
      }
    })()

    modulePromises.set(moduleId, loadPromise)
    try {
      return await loadPromise
    } finally {
      modulePromises.delete(moduleId)
    }
  }

  function peekDiscovery() {
    return discoveryCache ? discoveryCache.map((entry) => cloneDiscoveryEntry(entry)) : null
  }

  function peekModule(moduleId: ModuleId) {
    const cachedEntry = moduleCache.get(moduleId)
    return cachedEntry ? cloneModuleRegistryEntry(cachedEntry) : null
  }

  function listCachedModuleIds() {
    return [...moduleCache.keys()]
  }

  function clearCache(moduleId?: ModuleId) {
    if (moduleId) {
      moduleCache.delete(moduleId)
      modulePromises.delete(moduleId)
      return
    }

    discoveryCache = null
    discoveryPromise = null
    moduleCache.clear()
    modulePromises.clear()
  }

  return {
    loadDiscovery,
    loadModule,
    peekDiscovery,
    peekModule,
    listCachedModuleIds,
    clearCache,
  }
}


export function formatModuleLoaderFailure(result: Exclude<ModulePackageLoadResult, { ok: true }>) {
  return `${result.message} ${result.detail}`
}

export function formatModuleDiscoveryFailure(result: Exclude<ModuleDiscoveryLoadResult, { ok: true }>) {
  return `${result.message} ${result.detail}`
}
