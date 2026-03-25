import type {
  ModuleArtifactIndex,
  ModuleArtifactIndexEntry,
  ModuleArtifactStatus,
  ModuleBundleMetadata,
  ModuleDeferredItem,
  ModuleId,
  ModuleManifest,
  ModulePackageTimeRange,
} from '../sharedContracts'
import { normalizeRuntimeResourcePath } from '../runtimeData.ts'
import type {
  ModuleDeferredDescriptor,
  ModuleDiscoveryDescriptor,
  ModuleReadiness,
  ModuleRegistryEntry,
} from './moduleContracts.ts'
import { cloneArtifactIndexEntry } from './moduleContracts.ts'
import { getModuleRouteDescriptor } from './routeRegistry.ts'

const MODULE_DISCOVERY_ORDER: ModuleId[] = ['overview', 'forecast', 'repair', 'clustering', 'evaluation']
const DEFAULT_DEFERRED_MESSAGE = 'This capability will be connected in a later update.'

function cloneTimeRange(timeRange: ModulePackageTimeRange): ModulePackageTimeRange {
  return { ...timeRange }
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)]
}

function normalizeEntryFiles(entryFiles: Record<string, string>) {
  const normalizedEntries = Object.entries(entryFiles).map(([key, path]) => ({
    key,
    path: normalizeRuntimeResourcePath(path),
  }))

  return {
    entryFiles: Object.fromEntries(normalizedEntries.map((entry) => [entry.key, entry.path])),
    entryFileList: normalizedEntries,
  }
}

function normalizeDeferredItem(item: ModuleDeferredItem): ModuleDeferredDescriptor {
  return {
    artifactId: item.artifactId,
    reason: item.reason,
    dependsOn: [...item.dependsOn],
    message: DEFAULT_DEFERRED_MESSAGE,
  }
}

function mergeDeferredItems(manifestDeferred: ModuleDeferredItem[], bundleDeferred: string[] | undefined) {
  const manifestItems = new Map(manifestDeferred.map((item) => [item.artifactId, normalizeDeferredItem(item)]))
  const orderedIds = dedupeStrings([...manifestDeferred.map((item) => item.artifactId), ...(bundleDeferred ?? [])])

  return orderedIds.map((artifactId) => {
    const manifestItem = manifestItems.get(artifactId)
    if (manifestItem) return manifestItem
    return {
      artifactId,
      reason: DEFAULT_DEFERRED_MESSAGE,
      dependsOn: [],
      message: DEFAULT_DEFERRED_MESSAGE,
    }
  })
}

function resolveModuleReadiness(status: ModuleArtifactStatus, deferredItems: ModuleDeferredDescriptor[]): ModuleReadiness {
  if (status === 'deferred') return 'deferred'
  if (status === 'partial' || deferredItems.length > 0) return 'partial'
  if (status === 'review-first') return 'review-first'
  return 'ready'
}

function assertModuleCoherence(moduleId: ModuleId, discoveryBundlePath: string, manifest: ModuleManifest, bundle: ModuleBundleMetadata) {
  if (manifest.module !== moduleId) {
    throw new Error(`Manifest module mismatch for ${moduleId}: received ${manifest.module}.`)
  }
  if (bundle.module !== moduleId) {
    throw new Error(`Bundle module mismatch for ${moduleId}: received ${bundle.module}.`)
  }

  const normalizedManifestBundlePath = normalizeRuntimeResourcePath(manifest.bundlePath)
  if (normalizedManifestBundlePath !== discoveryBundlePath) {
    throw new Error(`Bundle path mismatch for ${moduleId}: ${normalizedManifestBundlePath} != ${discoveryBundlePath}.`)
  }

  for (const artifact of manifest.artifacts) {
    if (artifact.module !== moduleId) {
      throw new Error(`Manifest artifact ${artifact.artifactId} does not belong to ${moduleId}.`)
    }
  }
}

export function createModuleDiscoveryDescriptor(entry: ModuleArtifactIndexEntry): ModuleDiscoveryDescriptor {
  const route = getModuleRouteDescriptor(entry.module)
  if (route.kind !== 'module' || route.moduleId !== entry.module) {
    throw new Error(`No module route descriptor is registered for ${entry.module}.`)
  }

  const clonedEntry = cloneArtifactIndexEntry(entry)

  return {
    moduleId: clonedEntry.module,
    routeId: clonedEntry.module,
    label: route.label,
    navLabel: route.navLabel,
    shortLabel: route.navLabel,
    description: route.description,
    shellOrder: route.shellOrder,
    navVisible: route.navVisible,
    entryActionLabel: route.entryActionLabel,
    status: clonedEntry.status,
    manifestPath: normalizeRuntimeResourcePath(clonedEntry.manifestPath),
    bundlePath: normalizeRuntimeResourcePath(clonedEntry.bundlePath),
    scenarioId: clonedEntry.scenarioId,
    timeRange: cloneTimeRange(clonedEntry.timeRange),
    authoritativeFor: [...clonedEntry.authoritativeFor],
  }
}

export function buildModuleDiscoveryRegistry(index: ModuleArtifactIndex): ModuleDiscoveryDescriptor[] {
  const moduleEntries = new Map(index.modules.map((entry) => [entry.module, entry]))

  return MODULE_DISCOVERY_ORDER.map((moduleId) => {
    const indexEntry = moduleEntries.get(moduleId)
    if (!indexEntry) {
      throw new Error(`artifact-index.json is missing a module entry for ${moduleId}.`)
    }
    return createModuleDiscoveryDescriptor(indexEntry)
  })
}

export function createModuleRegistryEntry(
  discovery: ModuleDiscoveryDescriptor,
  manifest: ModuleManifest,
  bundle: ModuleBundleMetadata,
): ModuleRegistryEntry {
  assertModuleCoherence(discovery.moduleId, discovery.bundlePath, manifest, bundle)

  const normalizedArtifacts = manifest.artifacts.map((artifact) => ({
    ...artifact,
    timeRange: cloneTimeRange(artifact.timeRange),
    derivedFrom: [...artifact.derivedFrom],
    authoritativeFor: [...artifact.authoritativeFor],
    path: normalizeRuntimeResourcePath(artifact.path),
  }))
  const normalizedDeferredItems = mergeDeferredItems(manifest.deferred, bundle.deferred)
  const normalizedEntryFiles = normalizeEntryFiles(bundle.entryFiles)

  return {
    ...discovery,
    artifactId: manifest.artifactId,
    generatedAt: bundle.generatedAt,
    sourceStage: manifest.sourceStage,
    readiness: resolveModuleReadiness(discovery.status, normalizedDeferredItems),
    entryFiles: normalizedEntryFiles.entryFiles,
    entryFileList: normalizedEntryFiles.entryFileList,
    artifacts: normalizedArtifacts,
    reviewFiles: [...(manifest.reviewFiles ?? [])],
    sources: { ...manifest.sources },
    deferredItems: normalizedDeferredItems,
    hasDeferredSections: normalizedDeferredItems.length > 0,
    hasReviewArtifacts: normalizedArtifacts.some((artifact) => artifact.status === 'review-first'),
    authoritativeFor: dedupeStrings([...discovery.authoritativeFor, ...manifest.authoritativeFor]),
    timeRange: cloneTimeRange(discovery.timeRange),
  }
}

export function buildModuleRegistryEntries(
  index: ModuleArtifactIndex,
  manifests: Partial<Record<ModuleId, ModuleManifest>>,
  bundles: Partial<Record<ModuleId, ModuleBundleMetadata>>,
): ModuleRegistryEntry[] {
  return buildModuleDiscoveryRegistry(index).map((discovery) => {
    const manifest = manifests[discovery.moduleId]
    const bundle = bundles[discovery.moduleId]
    if (!manifest || !bundle) {
      throw new Error(`Missing manifest or bundle metadata for ${discovery.moduleId}.`)
    }
    return createModuleRegistryEntry(discovery, manifest, bundle)
  })
}
