export type AlertLevel = 'high' | 'medium' | 'watch'
export type HorizonKey = '1h' | '2h' | '3h'
export type ResultTab = 'benefit' | 'model'
export type ModelName = 'STGCN' | 'LSTM' | 'BiLSTM'

export type GeoPoint = {
  lon: number
  lat: number
}

export type StudyBounds = {
  minLon: number
  maxLon: number
  minLat: number
  maxLat: number
}

export type Recommendation = {
  target: string
  action: string
  reason: string
  effect: string
}

export type BenefitMetric = {
  label: string
  before: string
  after: string
  unit?: string
}

export type RouteGeometry = {
  id: string
  labelPoint: GeoPoint
  marker: {
    baseDurationSeconds: number
    radius: number
  }
  points: GeoPoint[]
}

export type HotspotGeometry = {
  id: string
  routeId: string
  point: GeoPoint
}

export type MainCorridorTrackPoint = GeoPoint & {
  time: string
  cog: number | null
}

export type MainCorridorTrackEntry = {
  id: string
  trackId: number
  corridorId: string
  corridorRank: number | null
  directionBin: number
  directionLabel: string
  pointCount: number
  labelPoint: GeoPoint
  points: MainCorridorTrackPoint[]
}

export type MainCorridorSummaryEntry = {
  corridorId: string
  trackCount: number
  directionLabel: string
  labelPoint: GeoPoint
}

export type MainCorridorTracksFile = {
  source: string
  summarySource: string
  clusterMode: string
  requestedClusterMode: string
  trackCount: number
  corridorCount: number
  studyArea: StudyBounds
  corridors: MainCorridorSummaryEntry[]
  tracks: MainCorridorTrackEntry[]
}

export type GeometryConfig = {
  meta: {
    version: number
    studyArea: StudyBounds
    routeOrder: string[]
    hotspotOrder: string[]
  }
  routes: RouteGeometry[]
  hotspots: HotspotGeometry[]
  routeFocusMap: Record<string, string>
}

export type PlaybackTrackPoint = GeoPoint & {
  time: string
  sceneId: string
}

export type PlaybackTrack = {
  mmsi: string
  routeId: string
  isFocusArea: boolean
  points: PlaybackTrackPoint[]
  path: string
}

export type PlaybackVessel = {
  mmsi: string
  type: string
  time: string
  lon: number
  lat: number
  sog: number
  cog: number
  head: number | null
  heading: number
  routeId: string
  routeDistance?: number
  isFocusArea: boolean
  trail?: GeoPoint[]
  routeProgress?: number
  nextRouteProgress?: number
  from?: GeoPoint & { time: string }
  to?: GeoPoint & { time: string }
  targetHint?: GeoPoint & { routeId: string }
  motion?: {
    durationMs: number
    p0: GeoPoint
    p1: GeoPoint
    p2: GeoPoint
    p3: GeoPoint
  }
}

export type PlaybackFrame = {
  id: string
  sceneId: string
  bucketTime: string
  displayLabel: string
  activeVesselCount: number
  vessels: PlaybackVessel[]
}

export type AisPlaybackData = {
  meta: {
    source: string
    windowStart: string
    windowEnd: string
    coordinateMode: string
    bucketMinutes: number
    samplingMode: string
    studyArea: StudyBounds
    routeIds: string[]
  }
  frames: PlaybackFrame[]
}

export type ForecastAlert = {
  grid: string
  level: AlertLevel
  current: number
  future: number
  note: string
}

export type ForecastNarrative = {
  phase: string
  status: string
  summary: string
  logs: string[]
  strategy: {
    headline: string
    summary: string
  }
  recommendations: Recommendation[]
  benefits: BenefitMetric[]
  appliedState: {
    status: string
    summary: string
    hotspotScale: number
    focusGrid: string
    focusRoute: string
    alerts: ForecastAlert[]
  }
}

export type ForecastTimelineEntry = {
  sceneId: string
  time: string
  current: {
    totalFlow: number
    visibleVessels: number
    keyGrids: Record<string, number>
  }
  forecast: Record<HorizonKey, { totalFlow: number; keyGrids: Record<string, number> }>
  derived: {
    focusGrid: string
    focusRoute: string
    hotspotCount: number
    hotspots: Array<{ id: string; intensity: number; level: AlertLevel }>
    alerts: ForecastAlert[]
  }
  narrative: ForecastNarrative
}

export type FlowForecastData = {
  meta: {
    source: string
    model: string
    modelConfigPath: string
    weightSource: string
    weightSha256: string
    historyWindowHours: number
    horizons: HorizonKey[]
    hotspotIds: string[]
    routeFocusMap: Record<string, string>
    forecastMode: string
    inferenceResolutionMinutes: number
    playbackResolutionMinutes: number
    interpolationMode: string
    windowStart: string
    windowEnd: string
    narrativeMode: string
    notice: string
  }
  series: {
    totalFlow: number[]
    forecastTotals: Record<HorizonKey, number[]>
    hotspots: Record<string, number[]>
  }
  timeline: ForecastTimelineEntry[]
}

export type RouteLabel = {
  id: string
  x: string
  y: string
}

export type MapTag = {
  id: string
  label: string
  x: string
  y: string
  focusGrid?: string
}

export type TimelineMoment = {
  id: string
  frameIndex: number
  time: string
  date: string
}

export async function loadPublicJson<T>(resource: string): Promise<T> {
  const response = await fetch(resource)
  if (!response.ok) {
    throw new Error(`Failed to load ${resource}: ${response.status}`)
  }
  return response.json() as Promise<T>
}
