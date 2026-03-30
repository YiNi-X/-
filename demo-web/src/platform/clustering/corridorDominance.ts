import type { MainCorridorTracksFile } from '../../sharedContracts.ts'

export const CLUSTERING_CORRIDOR_RUNTIME_PATH = '/data/modules/clustering/clustering-corridor-runtime.json'

export type CorridorDominanceEntry = {
  corridorId: string
  directionLabel: string
  trackCount: number
  share: number
  rank: number
}

export type CorridorDirectionDominanceEntry = {
  directionLabel: string
  trackCount: number
  corridorCount: number
  share: number
  leadCorridorId: string
  rank: number
}

export type CorridorDominanceSummary = {
  totalTracks: number
  corridorCount: number
  topCorridors: CorridorDominanceEntry[]
  leadingCorridor: CorridorDominanceEntry | null
  topThreeShare: number
  directionLeaders: CorridorDirectionDominanceEntry[]
  leadingDirection: CorridorDirectionDominanceEntry | null
}

export function formatSharePercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function buildCorridorDominanceSummary(runtime: MainCorridorTracksFile): CorridorDominanceSummary {
  const totalTracks = runtime.trackCount
  const sortedCorridors = runtime.corridors
    .slice()
    .sort((left, right) => right.trackCount - left.trackCount || left.corridorId.localeCompare(right.corridorId))

  const topCorridors = sortedCorridors.map((corridor, index) => ({
    corridorId: corridor.corridorId,
    directionLabel: corridor.directionLabel,
    trackCount: corridor.trackCount,
    share: totalTracks > 0 ? corridor.trackCount / totalTracks : 0,
    rank: index + 1,
  }))

  const directionMap = new Map<
    string,
    {
      directionLabel: string
      trackCount: number
      corridorCount: number
      leadCorridorId: string
      leadCorridorTrackCount: number
    }
  >()

  for (const corridor of topCorridors) {
    const existing = directionMap.get(corridor.directionLabel)
    if (!existing) {
      directionMap.set(corridor.directionLabel, {
        directionLabel: corridor.directionLabel,
        trackCount: corridor.trackCount,
        corridorCount: 1,
        leadCorridorId: corridor.corridorId,
        leadCorridorTrackCount: corridor.trackCount,
      })
      continue
    }

    existing.trackCount += corridor.trackCount
    existing.corridorCount += 1
    if (
      corridor.trackCount > existing.leadCorridorTrackCount ||
      (corridor.trackCount === existing.leadCorridorTrackCount && corridor.corridorId.localeCompare(existing.leadCorridorId) < 0)
    ) {
      existing.leadCorridorId = corridor.corridorId
      existing.leadCorridorTrackCount = corridor.trackCount
    }
  }

  const directionLeaders = Array.from(directionMap.values())
    .sort((left, right) => right.trackCount - left.trackCount || left.directionLabel.localeCompare(right.directionLabel))
    .map((direction, index) => ({
      directionLabel: direction.directionLabel,
      trackCount: direction.trackCount,
      corridorCount: direction.corridorCount,
      share: totalTracks > 0 ? direction.trackCount / totalTracks : 0,
      leadCorridorId: direction.leadCorridorId,
      rank: index + 1,
    }))

  return {
    totalTracks,
    corridorCount: runtime.corridorCount,
    topCorridors,
    leadingCorridor: topCorridors[0] ?? null,
    topThreeShare: totalTracks > 0 ? topCorridors.slice(0, 3).reduce((sum, corridor) => sum + corridor.trackCount, 0) / totalTracks : 0,
    directionLeaders,
    leadingDirection: directionLeaders[0] ?? null,
  }
}
