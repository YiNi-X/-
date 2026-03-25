import type {
  ModuleArtifactIndexEntry,
  ModuleArtifactStatus,
  ModuleBundleEntryFiles,
  ModuleDeferredItem,
  ModuleId,
  ModuleManifestArtifact,
  ModulePackageTimeRange,
  ModuleSourceStage,
  ShellRouteId,
} from '../sharedContracts'

export type ModuleReadiness = 'ready' | 'partial' | 'review-first' | 'deferred'
export type ShellRouteKind = 'home' | 'module' | 'placeholder'

export type ShellRouteDescriptor = {
  id: ShellRouteId
  kind: ShellRouteKind
  moduleId?: ModuleId
  label: string
  navLabel: string
  description: string
  shellOrder: number
  navVisible: boolean
  entryActionLabel: string
  status: 'ready' | 'deferred'
  notice?: string
}

export type ModuleDiscoveryDescriptor = {
  moduleId: ModuleId
  routeId: Extract<ShellRouteId, ModuleId>
  label: string
  navLabel: string
  shortLabel: string
  description: string
  shellOrder: number
  navVisible: boolean
  entryActionLabel: string
  status: ModuleArtifactStatus
  manifestPath: string
  bundlePath: string
  scenarioId: string
  timeRange: ModulePackageTimeRange
  authoritativeFor: string[]
}

export type ModuleEntryFileDescriptor = {
  key: string
  path: string
}

export type ModuleDeferredDescriptor = ModuleDeferredItem & {
  message: string
}

export type ModuleRegistryEntry = ModuleDiscoveryDescriptor & {
  artifactId: string
  generatedAt: string
  sourceStage: ModuleSourceStage
  readiness: ModuleReadiness
  entryFiles: ModuleBundleEntryFiles
  entryFileList: ModuleEntryFileDescriptor[]
  artifacts: ModuleManifestArtifact[]
  reviewFiles: string[]
  sources: Record<string, string>
  deferredItems: ModuleDeferredDescriptor[]
  hasDeferredSections: boolean
  hasReviewArtifacts: boolean
}

export function cloneArtifactIndexEntry(entry: ModuleArtifactIndexEntry): ModuleArtifactIndexEntry {
  return {
    ...entry,
    timeRange: { ...entry.timeRange },
    authoritativeFor: [...entry.authoritativeFor],
  }
}
