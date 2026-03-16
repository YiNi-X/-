import type { GeoPoint, PlaybackFrame } from './sharedContracts'

export type CorridorClusterMode = 'auto' | 'global' | 'directional'

export type ObservedTrackPoint = {
  sceneId: string
  time: string
  lon: number
  lat: number
}

export type ObservedTrack = {
  mmsi: string
  routeId: string
  isFocusArea: boolean
  points: ObservedTrackPoint[]
}

type CorridorRecord = {
  mmsi: string
  routeId: string
  pointCount: number
  lengthM: number
  displacementM: number
  bearingDeg: number
  principalAxisDeg: number
  directionBin: number
  directionLabel: string
  pointsXY: Array<[number, number]>
  resampledXY: Array<[number, number]>
  resampledGeo: Array<[number, number]>
  keep: boolean
  corridorClusterLabel: number | null
  corridorRank: number | null
  corridorId: string | null
  corridorSize: number
  dropReason: string | null
}

export type CorridorQuality = {
  corridorId: string
  trackCount: number
  representativeLengthM: number
  representativeDisplacementM: number
  medianTrackLengthM: number
  medianTrackDisplacementM: number
  medianWidthM: number
  p90WidthM: number
  representativeLengthRatio: number
  widthRatio: number
  circularSpread: number
  passesQuality: boolean
  rejectionReason: string
}

type CorridorDetails = {
  clusterMode: Exclude<CorridorClusterMode, 'auto'>
  requestedClusterMode?: CorridorClusterMode
  corridorQuality: CorridorQuality[]
  qualityFilter: {
    minRepresentativeLengthRatio: number
    maxCorridorWidthRatio: number
    maxWidthRatio: number
    maxCircularSpread: number
    rejectedCorridors: string[]
  }
  globalClustering?: {
    eps: number
    minSamples: number
    angleScale: number
    clusters: Array<{ clusterLabel: number; trackCount: number }>
    keptClusters: number[]
  }
  directionSummaries?: Array<{
    directionBin: number
    directionLabel: string
    trackCount: number
    epsKm: number
    minSamples: number
    clusters: Array<{ clusterLabel: number; trackCount: number }>
    keptClusters: number[]
  }>
  candidateModes?: Array<{
    clusterMode: Exclude<CorridorClusterMode, 'auto'>
    keptSegments: number
    keptCorridors: number
    qualityScore: [number, number, number, number]
    rejectedCorridors: string[]
  }>
}

type ResolvedCorridorSolution = {
  records: CorridorRecord[]
  keptRecords: CorridorRecord[]
  details: CorridorDetails
}

export type MainCorridorSelectionSummary = {
  rawTracks: number
  candidateTracks: number
  keptTracks: number
  removedTracks: number
  requestedClusterMode: CorridorClusterMode
  clusterMode: Exclude<CorridorClusterMode, 'auto'>
  dropReasons: Record<string, number>
  qualityFilter: CorridorDetails['qualityFilter']
  corridorQuality: CorridorQuality[]
  candidateModes: NonNullable<CorridorDetails['candidateModes']>
}

export type MainCorridorDisplay = {
  corridorId: string
  trackCount: number
  dominantRouteId: string
  routeCounts: Record<string, number>
  representativePoints: GeoPoint[]
  quality: CorridorQuality | null
}

export type MainCorridorSelectionResult = {
  keptTrackIds: Set<string>
  corridors: MainCorridorDisplay[]
  summary: MainCorridorSelectionSummary
}

type SelectionOptions = {
  clusterMode?: CorridorClusterMode
  directionBinCount?: number
  topKPerDirection?: number
  minClusterSize?: number
  minPoints?: number
  minDisplacementMeters?: number
  signaturePoints?: number
  globalAngleScale?: number
  minRepresentativeLengthRatio?: number
  maxCorridorWidthRatio?: number
  maxCircularSpread?: number
}

const DIRECTION_LABELS = ['East', 'NorthEast', 'North', 'NorthWest', 'West', 'SouthWest', 'South', 'SouthEast']
const METERS_PER_DEGREE = 111_000
const DEFAULT_OPTIONS: Required<SelectionOptions> = {
  clusterMode: 'auto',
  directionBinCount: 8,
  topKPerDirection: 2,
  minClusterSize: 12,
  minPoints: 4,
  minDisplacementMeters: 4_000,
  signaturePoints: 9,
  globalAngleScale: 0.08,
  minRepresentativeLengthRatio: 0.35,
  maxCorridorWidthRatio: 0.85,
  maxCircularSpread: 0.18,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  const weight = position - lower
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight
}

function median(values: number[]) {
  return quantile(values, 0.5)
}

function percentile(values: number[], p: number) {
  return quantile(values, p / 100)
}

function euclideanDistance(a: number[], b: number[]) {
  let sum = 0
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toLocalXY(latitudes: number[], longitudes: number[], meanLat: number) {
  const lonScale = Math.cos((meanLat * Math.PI) / 180) * METERS_PER_DEGREE
  return latitudes.map<[number, number]>((lat, index) => [longitudes[index] * lonScale, lat * METERS_PER_DEGREE])
}

function geoDistanceMeters(a: Pick<ObservedTrackPoint, 'lat' | 'lon'>, b: Pick<ObservedTrackPoint, 'lat' | 'lon'>) {
  const meanLat = (a.lat + b.lat) / 2
  const dy = (b.lat - a.lat) * METERS_PER_DEGREE
  const dx = (b.lon - a.lon) * Math.cos((meanLat * Math.PI) / 180) * METERS_PER_DEGREE
  return Math.hypot(dx, dy)
}

function polylineLength(points: Array<[number, number]>) {
  if (points.length < 2) return 0
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1])
  }
  return total
}

function resamplePolyline(
  points: Array<[number, number]>,
  sampleCount: number,
  interpolationPoints: Array<[number, number]> = points,
) {
  if (!points.length) return [] as Array<[number, number]>
  const outputPoints = interpolationPoints.length === points.length ? interpolationPoints : points
  if (points.length === 1) return Array.from({ length: sampleCount }, () => [...outputPoints[0]] as [number, number])

  const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]))
  const cumulative = [0]
  segmentLengths.forEach((length) => cumulative.push(cumulative[cumulative.length - 1] + length))
  const totalLength = cumulative[cumulative.length - 1]
  if (!totalLength) return Array.from({ length: sampleCount }, () => [...outputPoints[0]] as [number, number])

  return Array.from({ length: sampleCount }, (_, index) => {
    const target = (index / Math.max(sampleCount - 1, 1)) * totalLength
    let segmentIndex = 0
    while (segmentIndex < cumulative.length - 2 && cumulative[segmentIndex + 1] < target) segmentIndex += 1
    const span = cumulative[segmentIndex + 1] - cumulative[segmentIndex]
    const weight = span === 0 ? 0 : (target - cumulative[segmentIndex]) / span
    return [
      outputPoints[segmentIndex][0] + (outputPoints[segmentIndex + 1][0] - outputPoints[segmentIndex][0]) * weight,
      outputPoints[segmentIndex][1] + (outputPoints[segmentIndex + 1][1] - outputPoints[segmentIndex][1]) * weight,
    ] as [number, number]
  })
}

function computeBearingDeg(points: Array<[number, number]>) {
  if (points.length < 2) return 0
  const dx = points[points.length - 1][0] - points[0][0]
  const dy = points[points.length - 1][1] - points[0][1]
  return (((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360
}

function computePrincipalAxisDeg(points: Array<[number, number]>) {
  if (points.length < 2) return 0
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length
  let xx = 0
  let yy = 0
  let xy = 0
  const denominator = Math.max(points.length - 1, 1)

  points.forEach((point) => {
    const dx = point[0] - meanX
    const dy = point[1] - meanY
    xx += dx * dx
    yy += dy * dy
    xy += dx * dy
  })

  xx /= denominator
  yy /= denominator
  xy /= denominator

  const trace = xx + yy
  const determinant = xx * yy - xy * xy
  const lambda = trace / 2 + Math.sqrt(Math.max((trace * trace) / 4 - determinant, 0))
  const vector = Math.abs(xy) > 1e-9 ? [lambda - yy, xy] : xx >= yy ? [1, 0] : [0, 1]
  return (((Math.atan2(vector[1], vector[0]) * 180) / Math.PI) + 180) % 180
}

function estimateEps(features: number[][]) {
  if (features.length <= 1) return 0.5
  const neighborCount = Math.min(Math.max(6, Math.floor(features.length / 25)), features.length)
  const distances = features.map((feature) => {
    const sorted = features.map((candidate) => euclideanDistance(feature, candidate)).sort((a, b) => a - b)
    return sorted[neighborCount - 1] ?? sorted[sorted.length - 1] ?? 0.5
  })
  return clamp(percentile(distances, 70), 0.25, 2.5)
}

function dbscan(features: number[][], eps: number, minSamples: number) {
  const labels = Array.from({ length: features.length }, () => Number.NaN)
  let clusterId = 0

  function regionQuery(index: number) {
    const neighbors: number[] = []
    features.forEach((candidate, candidateIndex) => {
      if (euclideanDistance(features[index], candidate) <= eps) neighbors.push(candidateIndex)
    })
    return neighbors
  }

  for (let index = 0; index < features.length; index += 1) {
    if (!Number.isNaN(labels[index])) continue
    const neighbors = regionQuery(index)
    if (neighbors.length < minSamples) {
      labels[index] = -1
      continue
    }

    labels[index] = clusterId
    const queue = [...neighbors]
    while (queue.length) {
      const neighborIndex = queue.shift()!
      if (labels[neighborIndex] === -1) labels[neighborIndex] = clusterId
      if (!Number.isNaN(labels[neighborIndex])) continue
      labels[neighborIndex] = clusterId
      const expanded = regionQuery(neighborIndex)
      if (expanded.length >= minSamples) queue.push(...expanded)
    }
    clusterId += 1
  }

  return labels
}

function computeCircularSpread(bearingsDeg: number[]) {
  if (!bearingsDeg.length) return 1
  const cosMean = bearingsDeg.reduce((sum, value) => sum + Math.cos((value * Math.PI) / 180), 0) / bearingsDeg.length
  const sinMean = bearingsDeg.reduce((sum, value) => sum + Math.sin((value * Math.PI) / 180), 0) / bearingsDeg.length
  return 1 - Math.hypot(cosMean, sinMean)
}

function dotAlong(points: Array<[number, number]>, vector: [number, number]) {
  return points.map((point) => point[0] * vector[0] + point[1] * vector[1])
}

function buildObservedTrackRecords(
  tracks: ObservedTrack[],
  directionBinCount: number,
  minPoints: number,
  minDisplacementMeters: number,
  signaturePoints: number,
) {
  const latitudes = tracks.flatMap((track) => track.points.map((point) => point.lat))
  const meanLat = latitudes.length ? latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length : 0
  const binSize = 360 / directionBinCount

  return tracks.map<CorridorRecord>((track) => {
    const trackLatitudes = track.points.map((point) => point.lat)
    const trackLongitudes = track.points.map((point) => point.lon)
    const pointsXY = toLocalXY(trackLatitudes, trackLongitudes, meanLat)
    const pointsGeo = track.points.map((point) => [point.lon, point.lat] as [number, number])
    const pointCount = track.points.length
    const lengthM = polylineLength(pointsXY)
    const displacementM =
      pointCount >= 2 ? Math.hypot(pointsXY[pointsXY.length - 1][0] - pointsXY[0][0], pointsXY[pointsXY.length - 1][1] - pointsXY[0][1]) : 0
    const bearingDeg = computeBearingDeg(pointsXY)
    const directionBin = Math.min(directionBinCount - 1, Math.floor(bearingDeg / binSize))
    const record: CorridorRecord = {
      mmsi: track.mmsi,
      routeId: track.routeId,
      pointCount,
      lengthM,
      displacementM,
      bearingDeg,
      principalAxisDeg: computePrincipalAxisDeg(pointsXY),
      directionBin,
      directionLabel: DIRECTION_LABELS[directionBin % DIRECTION_LABELS.length],
      pointsXY,
      resampledXY: resamplePolyline(pointsXY, signaturePoints),
      resampledGeo: resamplePolyline(pointsXY, signaturePoints, pointsGeo),
      keep: false,
      corridorClusterLabel: null,
      corridorRank: null,
      corridorId: null,
      corridorSize: 0,
      dropReason: null,
    }

    if (pointCount < minPoints) record.dropReason = 'too_few_points'
    else if (displacementM < minDisplacementMeters) record.dropReason = 'too_short'

    return record
  })
}

function cloneRecords(records: CorridorRecord[]) {
  return records.map<CorridorRecord>((record) => ({
    ...record,
    pointsXY: record.pointsXY.map((point) => [...point] as [number, number]),
    resampledXY: record.resampledXY.map((point) => [...point] as [number, number]),
    resampledGeo: record.resampledGeo.map((point) => [...point] as [number, number]),
  }))
}

function buildCorridorQuality(
  keptRecords: CorridorRecord[],
  minRepresentativeLengthRatio: number,
  maxWidthRatio: number,
  maxCircularSpread: number,
) {
  const grouped = new Map<string, CorridorRecord[]>()
  keptRecords.forEach((record) => {
    if (!record.corridorId) return
    const group = grouped.get(record.corridorId) ?? []
    group.push(record)
    grouped.set(record.corridorId, group)
  })

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map<CorridorQuality>(([corridorId, group]) => {
      const sampleCount = group[0]?.resampledXY.length ?? 0
      const representativeLine = Array.from({ length: sampleCount }, (_, index) => {
        const x = group.reduce((sum, record) => sum + record.resampledXY[index][0], 0) / Math.max(group.length, 1)
        const y = group.reduce((sum, record) => sum + record.resampledXY[index][1], 0) / Math.max(group.length, 1)
        return [x, y] as [number, number]
      })
      const representativeLengthM = polylineLength(representativeLine)
      const representativeDisplacementM =
        representativeLine.length >= 2
          ? Math.hypot(
              representativeLine[representativeLine.length - 1][0] - representativeLine[0][0],
              representativeLine[representativeLine.length - 1][1] - representativeLine[0][1],
            )
          : 0
      const widths = group.flatMap((record) =>
        record.resampledXY.map((point, index) => Math.hypot(point[0] - representativeLine[index][0], point[1] - representativeLine[index][1])),
      )
      const medianTrackLengthM = median(group.map((record) => record.lengthM))
      const medianTrackDisplacementM = median(group.map((record) => record.displacementM))
      const representativeLengthRatio = representativeLengthM / Math.max(medianTrackDisplacementM, 1)
      const widthRatio = percentile(widths, 90) / Math.max(representativeLengthM, 1)
      const circularSpread = computeCircularSpread(group.map((record) => record.bearingDeg))
      const failedRules: string[] = []

      if (representativeLengthRatio < minRepresentativeLengthRatio) failedRules.push('compressed_corridor')
      if (widthRatio > maxWidthRatio) failedRules.push('wide_corridor')
      if (circularSpread > maxCircularSpread) failedRules.push('mixed_directions')

      return {
        corridorId,
        trackCount: group.length,
        representativeLengthM: round(representativeLengthM),
        representativeDisplacementM: round(representativeDisplacementM),
        medianTrackLengthM: round(medianTrackLengthM),
        medianTrackDisplacementM: round(medianTrackDisplacementM),
        medianWidthM: round(median(widths)),
        p90WidthM: round(percentile(widths, 90)),
        representativeLengthRatio: round(representativeLengthRatio, 4),
        widthRatio: round(widthRatio, 4),
        circularSpread: round(circularSpread, 4),
        passesQuality: failedRules.length === 0,
        rejectionReason: failedRules.join('|'),
      }
    })
}

function applyCorridorQualityFilter(records: CorridorRecord[], corridorQuality: CorridorQuality[]) {
  const rejected = new Map(
    corridorQuality
      .filter((item) => !item.passesQuality)
      .map((item) => [item.corridorId, item.rejectionReason || 'poor_corridor_quality'] as const),
  )

  records.forEach((record) => {
    if (!record.keep || !record.corridorId || !rejected.has(record.corridorId)) return
    record.keep = false
    record.dropReason = 'poor_corridor_quality'
  })

  return records.filter((record) => record.keep)
}

function summarizeCorridorSolution(keptRecords: CorridorRecord[], corridorQuality: CorridorQuality[]): [number, number, number, number] {
  const validQuality = corridorQuality.filter((item) => item.passesQuality)
  if (!keptRecords.length || !validQuality.length) return [0, 0, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  const totalWeight = validQuality.reduce((sum, item) => sum + item.trackCount, 0) || 1
  const weightedWidthRatio = validQuality.reduce((sum, item) => sum + item.trackCount * item.widthRatio, 0) / totalWeight
  const weightedCircularSpread = validQuality.reduce((sum, item) => sum + item.trackCount * item.circularSpread, 0) / totalWeight
  return [keptRecords.length, validQuality.length, -weightedWidthRatio, -weightedCircularSpread]
}

function compareScores(a: [number, number, number, number], b: [number, number, number, number]) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] > b[index]) return 1
    if (a[index] < b[index]) return -1
  }
  return 0
}

function assignMainCorridorsDirectional(
  records: CorridorRecord[],
  directionBinCount: number,
  topKPerDirection: number,
  minClusterSize: number,
) {
  const candidateRecords = records.filter((record) => record.dropReason === null)
  const grouped = new Map<number, CorridorRecord[]>()
  candidateRecords.forEach((record) => {
    const group = grouped.get(record.directionBin) ?? []
    group.push(record)
    grouped.set(record.directionBin, group)
  })

  const binSize = 360 / directionBinCount
  const directionSummaries: NonNullable<CorridorDetails['directionSummaries']> = []

  for (let directionBin = 0; directionBin < directionBinCount; directionBin += 1) {
    const group = grouped.get(directionBin) ?? []
    if (!group.length) continue

    const centerAngle = ((directionBin * binSize + binSize / 2) * Math.PI) / 180
    const normalVector: [number, number] = [-Math.sin(centerAngle), Math.cos(centerAngle)]
    const features = group.map((record) => {
      const projected = dotAlong(record.resampledXY, normalVector)
      return [quantile(projected, 0.2) / 1000, quantile(projected, 0.5) / 1000, quantile(projected, 0.8) / 1000]
    })
    const eps = estimateEps(features)
    const minSamples = Math.max(8, Math.floor(group.length / 25))
    const labels = dbscan(features, eps, minSamples)
    const clusterSizeMap = new Map<number, number>()
    labels.forEach((label) => {
      if (label === -1) return
      clusterSizeMap.set(label, (clusterSizeMap.get(label) ?? 0) + 1)
    })
    const rankedClusters = [...clusterSizeMap.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
    const keptClusters = rankedClusters.slice(0, topKPerDirection).filter(([, size]) => size >= minClusterSize).map(([label]) => label)
    const corridorRankMap = new Map(rankedClusters.map(([label], index) => [label, index + 1]))

    group.forEach((record, index) => {
      const label = labels[index]
      if (label === -1) {
        record.dropReason = 'dbscan_noise'
        return
      }

      record.corridorClusterLabel = label
      record.corridorSize = clusterSizeMap.get(label) ?? 0
      record.corridorRank = corridorRankMap.get(label) ?? null
      record.corridorId = `D${pad2(directionBin)}-C${pad2(record.corridorRank ?? 0)}`

      if (keptClusters.includes(label)) {
        record.keep = true
        record.dropReason = null
      } else {
        record.dropReason = 'non_top_corridor'
      }
    })

    directionSummaries.push({
      directionBin,
      directionLabel: DIRECTION_LABELS[directionBin % DIRECTION_LABELS.length],
      trackCount: group.length,
      epsKm: round(eps, 3),
      minSamples,
      clusters: rankedClusters.map(([label, trackCount]) => ({ clusterLabel: label, trackCount })),
      keptClusters,
    })
  }

  return {
    keptRecords: records.filter((record) => record.keep),
    details: { clusterMode: 'directional' as const, directionSummaries },
  }
}

function assignMainCorridorsGlobal(records: CorridorRecord[], minClusterSize: number, angleScale: number) {
  const candidateRecords = records.filter((record) => record.dropReason === null)
  if (!candidateRecords.length) {
    return {
      keptRecords: [] as CorridorRecord[],
      details: {
        clusterMode: 'global' as const,
        globalClustering: { eps: 0, minSamples: 0, angleScale, clusters: [], keptClusters: [] },
      },
    }
  }

  const centers = candidateRecords.map((record) => {
    const x = record.pointsXY.reduce((sum, point) => sum + point[0], 0) / Math.max(record.pointsXY.length, 1)
    const y = record.pointsXY.reduce((sum, point) => sum + point[1], 0) / Math.max(record.pointsXY.length, 1)
    return [x, y]
  })
  const meanCenter: [number, number] = [
    centers.reduce((sum, point) => sum + point[0], 0) / Math.max(centers.length, 1),
    centers.reduce((sum, point) => sum + point[1], 0) / Math.max(centers.length, 1),
  ]
  const features = candidateRecords.map((record, index) => [
    (centers[index][0] - meanCenter[0]) / 1000,
    (centers[index][1] - meanCenter[1]) / 1000,
    record.principalAxisDeg * angleScale,
  ])

  const neighborCount = Math.min(Math.max(6, Math.floor(features.length / 30)), features.length)
  const neighborDistances = features.map((feature) => {
    const sorted = features.map((candidate) => euclideanDistance(feature, candidate)).sort((a, b) => a - b)
    return sorted[neighborCount - 1] ?? sorted[sorted.length - 1] ?? 0.3
  })
  const eps = clamp(percentile(neighborDistances, 55), 0.3, 3.5)
  const minSamples = Math.max(8, Math.floor(features.length / 50))
  const labels = dbscan(features, eps, minSamples)
  const clusterSizeMap = new Map<number, number>()
  labels.forEach((label) => {
    if (label === -1) return
    clusterSizeMap.set(label, (clusterSizeMap.get(label) ?? 0) + 1)
  })
  const rankedClusters = [...clusterSizeMap.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
  const keptClusters = rankedClusters.filter(([, size]) => size >= minClusterSize).map(([label]) => label)
  const corridorRankMap = new Map(rankedClusters.map(([label], index) => [label, index + 1]))

  candidateRecords.forEach((record, index) => {
    const label = labels[index]
    if (label === -1) {
      record.dropReason = 'dbscan_noise'
      return
    }

    record.corridorClusterLabel = label
    record.corridorSize = clusterSizeMap.get(label) ?? 0
    record.corridorRank = corridorRankMap.get(label) ?? null
    record.corridorId = `G${pad2(record.corridorRank ?? 0)}`

    if (keptClusters.includes(label)) {
      record.keep = true
      record.dropReason = null
    } else {
      record.dropReason = 'small_corridor_cluster'
    }
  })

  return {
    keptRecords: records.filter((record) => record.keep),
    details: {
      clusterMode: 'global' as const,
      globalClustering: {
        eps: round(eps, 3),
        minSamples,
        angleScale,
        clusters: rankedClusters.map(([clusterLabel, trackCount]) => ({ clusterLabel, trackCount })),
        keptClusters,
      },
    },
  }
}

function assignMainCorridors(
  records: CorridorRecord[],
  clusterMode: Exclude<CorridorClusterMode, 'auto'>,
  directionBinCount: number,
  topKPerDirection: number,
  minClusterSize: number,
  globalAngleScale: number,
) {
  return clusterMode === 'global'
    ? assignMainCorridorsGlobal(records, minClusterSize, globalAngleScale)
    : assignMainCorridorsDirectional(records, directionBinCount, topKPerDirection, minClusterSize)
}

function runCorridorMode(
  records: CorridorRecord[],
  options: Required<SelectionOptions>,
  clusterMode: Exclude<CorridorClusterMode, 'auto'>,
): ResolvedCorridorSolution {
  const workingRecords = cloneRecords(records)
  const { keptRecords, details } = assignMainCorridors(
    workingRecords,
    clusterMode,
    options.directionBinCount,
    options.topKPerDirection,
    options.minClusterSize,
    options.globalAngleScale,
  )
  const corridorQuality = buildCorridorQuality(
    keptRecords,
    options.minRepresentativeLengthRatio,
    options.maxCorridorWidthRatio,
    options.maxCircularSpread,
  )
  const qualityFiltered = applyCorridorQualityFilter(workingRecords, corridorQuality)

  return {
    records: workingRecords,
    keptRecords: qualityFiltered,
    details: {
      ...details,
      clusterMode,
      corridorQuality,
      qualityFilter: {
        minRepresentativeLengthRatio: options.minRepresentativeLengthRatio,
        maxCorridorWidthRatio: options.maxCorridorWidthRatio,
        maxWidthRatio: options.maxCorridorWidthRatio,
        maxCircularSpread: options.maxCircularSpread,
        rejectedCorridors: corridorQuality.filter((item) => !item.passesQuality).map((item) => item.corridorId),
      },
    } satisfies CorridorDetails,
  }
}

function resolveCorridorSolution(records: CorridorRecord[], options: Required<SelectionOptions>): ResolvedCorridorSolution {
  if (options.clusterMode !== 'auto') {
    const result = runCorridorMode(records, options, options.clusterMode)
    return {
      ...result,
      details: {
        ...result.details,
        requestedClusterMode: options.clusterMode,
      },
    }
  }

  const candidates: Array<{
    score: [number, number, number, number]
    records: CorridorRecord[]
    keptRecords: CorridorRecord[]
    details: CorridorDetails
  }> = []

  const candidateModes: NonNullable<CorridorDetails['candidateModes']> = []
  ;(['global', 'directional'] as const).forEach((clusterMode) => {
    const result = runCorridorMode(records, options, clusterMode)
    const score = summarizeCorridorSolution(result.keptRecords, result.details.corridorQuality)
    candidateModes.push({
      clusterMode,
      keptSegments: result.keptRecords.length,
      keptCorridors: result.details.corridorQuality.filter((item) => item.passesQuality).length,
      qualityScore: score,
      rejectedCorridors: result.details.qualityFilter.rejectedCorridors,
    })
    candidates.push({ score, ...result })
  })

  const best = candidates.reduce((currentBest, candidate) => (compareScores(candidate.score, currentBest.score) > 0 ? candidate : currentBest))
  return {
    ...best,
    details: {
      ...best.details,
      requestedClusterMode: options.clusterMode,
      candidateModes,
    },
  }
}

function countByReason(records: CorridorRecord[]) {
  return records.reduce<Record<string, number>>((counts, record) => {
    if (record.keep) return counts
    const key = record.dropReason ?? 'removed'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function buildCorridorDisplays(keptRecords: CorridorRecord[], corridorQuality: CorridorQuality[]): MainCorridorDisplay[] {
  const grouped = new Map<string, CorridorRecord[]>()
  keptRecords.forEach((record) => {
    if (!record.corridorId) return
    const group = grouped.get(record.corridorId) ?? []
    group.push(record)
    grouped.set(record.corridorId, group)
  })

  const qualityByCorridor = new Map(corridorQuality.map((item) => [item.corridorId, item] as const))

  return [...grouped.entries()]
    .map<MainCorridorDisplay>(([corridorId, group]) => {
      const routeCounts = group.reduce<Record<string, number>>((counts, record) => {
        counts[record.routeId] = (counts[record.routeId] ?? 0) + 1
        return counts
      }, {})
      const dominantRouteId =
        Object.entries(routeCounts).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))[0]?.[0] ?? group[0]?.routeId ?? 'unknown'
      const sampleCount = group[0]?.resampledGeo.length ?? 0
      const representativePoints = Array.from({ length: sampleCount }, (_, index) => {
        const lon = group.reduce((sum, record) => sum + record.resampledGeo[index][0], 0) / Math.max(group.length, 1)
        const lat = group.reduce((sum, record) => sum + record.resampledGeo[index][1], 0) / Math.max(group.length, 1)
        return { lon: round(lon, 6), lat: round(lat, 6) }
      })

      return {
        corridorId,
        trackCount: group.length,
        dominantRouteId,
        routeCounts,
        representativePoints,
        quality: qualityByCorridor.get(corridorId) ?? null,
      }
    })
    .sort((a, b) => (b.trackCount - a.trackCount) || a.corridorId.localeCompare(b.corridorId))
}

export function buildObservedTracks(frames: PlaybackFrame[]) {
  const grouped = new Map<string, ObservedTrack>()

  frames.forEach((frame) => {
    frame.vessels.forEach((vessel) => {
      const track = grouped.get(vessel.mmsi) ?? {
        mmsi: vessel.mmsi,
        routeId: vessel.routeId,
        isFocusArea: Boolean(vessel.isFocusArea),
        points: [],
      }
      const lastPoint = track.points[track.points.length - 1]
      const nextPoint: ObservedTrackPoint = {
        sceneId: frame.sceneId,
        time: frame.bucketTime,
        lon: vessel.lon,
        lat: vessel.lat,
      }

      track.routeId = vessel.routeId
      track.isFocusArea = track.isFocusArea || Boolean(vessel.isFocusArea)

      if (!lastPoint || geoDistanceMeters(lastPoint, nextPoint) > 12) {
        track.points.push(nextPoint)
      }

      grouped.set(vessel.mmsi, track)
    })
  })

  return [...grouped.values()].filter((track) => track.points.length >= 2)
}

export function selectMainCorridorTracks(tracks: ObservedTrack[], overrides: SelectionOptions = {}): MainCorridorSelectionResult {
  const options: Required<SelectionOptions> = {
    clusterMode: overrides.clusterMode ?? DEFAULT_OPTIONS.clusterMode,
    directionBinCount: overrides.directionBinCount ?? DEFAULT_OPTIONS.directionBinCount,
    topKPerDirection: overrides.topKPerDirection ?? DEFAULT_OPTIONS.topKPerDirection,
    minClusterSize: overrides.minClusterSize ?? DEFAULT_OPTIONS.minClusterSize,
    minPoints: overrides.minPoints ?? DEFAULT_OPTIONS.minPoints,
    minDisplacementMeters: overrides.minDisplacementMeters ?? DEFAULT_OPTIONS.minDisplacementMeters,
    signaturePoints: overrides.signaturePoints ?? DEFAULT_OPTIONS.signaturePoints,
    globalAngleScale: overrides.globalAngleScale ?? DEFAULT_OPTIONS.globalAngleScale,
    minRepresentativeLengthRatio: overrides.minRepresentativeLengthRatio ?? DEFAULT_OPTIONS.minRepresentativeLengthRatio,
    maxCorridorWidthRatio: overrides.maxCorridorWidthRatio ?? DEFAULT_OPTIONS.maxCorridorWidthRatio,
    maxCircularSpread: overrides.maxCircularSpread ?? DEFAULT_OPTIONS.maxCircularSpread,
  }
  const records = buildObservedTrackRecords(
    tracks,
    options.directionBinCount,
    options.minPoints,
    options.minDisplacementMeters,
    options.signaturePoints,
  )
  const { records: resolvedRecords, keptRecords, details } = resolveCorridorSolution(records, options)

  return {
    keptTrackIds: new Set(keptRecords.map((record) => record.mmsi)),
    corridors: buildCorridorDisplays(keptRecords, details.corridorQuality),
    summary: {
      rawTracks: resolvedRecords.length,
      candidateTracks: resolvedRecords.filter((record) => record.pointCount >= options.minPoints && record.displacementM >= options.minDisplacementMeters).length,
      keptTracks: keptRecords.length,
      removedTracks: resolvedRecords.length - keptRecords.length,
      requestedClusterMode: details.requestedClusterMode ?? options.clusterMode,
      clusterMode: details.clusterMode,
      dropReasons: countByReason(resolvedRecords),
      qualityFilter: details.qualityFilter,
      corridorQuality: details.corridorQuality,
      candidateModes: details.candidateModes ?? [],
    },
  }
}
