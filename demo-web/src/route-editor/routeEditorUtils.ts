import type { MainCorridorTrackEntry, GeoPoint, StudyBounds } from '../sharedContracts'

export type SelectedHandle =
  | { kind: 'point'; trackId: string; index: number }
  | { kind: 'label'; trackId: string }

export type CursorState = { lon: number; lat: number; xPercent: number; yPercent: number }
export type LayerTransform = { scale: number; offsetX: number; offsetY: number; opacity: number; brightness: number }
export type FixedLayerDisplay = { opacity: number; brightness: number }
export type TransformLayerTarget = 'map' | 'tracks'
export type StagePanState = { target: TransformLayerTarget; startX: number; startY: number; originX: number; originY: number }
export type GeoViewport = { width: number; height: number; offsetX: number; offsetY: number }
export type BackgroundPreset = { id: string; label: string; src: string }

export const CLEANED_TRACKS_PATH = 'data/main-corridor-tracks.json'
export const STUDY_BOUNDS = { minLon: 113.558356434, maxLon: 113.95835643400001, minLat: 22.155739805, maxLat: 22.635739805 }
export const MAP_VIEWBOX = { width: 1920, height: 1080 }
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'port-map', label: 'Static Port Map', src: 'static-port-map.jpg' },
  { id: 'blank', label: 'No Background', src: '' },
]
export const CORRIDOR_COLORS = ['#3a86ff', '#00bbf9', '#06d6a0', '#80ed99', '#ffd166', '#f4a261', '#ef476f', '#9b5de5', '#4cc9f0', '#f72585']

const METERS_PER_DEGREE = 111_000

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
export const roundCoord = (value: number) => Number(value.toFixed(6))
export const resolvePageAsset = (value: string) => new URL(value.replace(/^\//, ''), window.location.href).toString()

export function cloneTrack(track: MainCorridorTrackEntry): MainCorridorTrackEntry {
  return {
    ...track,
    labelPoint: { ...track.labelPoint },
    points: track.points.map((point) => ({ ...point })),
  }
}

export function buildTrackLookup(tracks: MainCorridorTrackEntry[]) {
  return Object.fromEntries(tracks.map((track) => [track.id, cloneTrack(track)])) as Record<string, MainCorridorTrackEntry>
}

export function buildGeoViewport(bounds: StudyBounds = STUDY_BOUNDS): GeoViewport {
  const meanLat = (bounds.minLat + bounds.maxLat) / 2
  const geoWidth = Math.max((bounds.maxLon - bounds.minLon) * Math.cos((meanLat * Math.PI) / 180) * METERS_PER_DEGREE, 1)
  const geoHeight = Math.max((bounds.maxLat - bounds.minLat) * METERS_PER_DEGREE, 1)
  const geoAspect = geoWidth / geoHeight
  const stageAspect = MAP_VIEWBOX.width / MAP_VIEWBOX.height

  if (geoAspect >= stageAspect) {
    const height = MAP_VIEWBOX.width / geoAspect
    return {
      width: MAP_VIEWBOX.width,
      height,
      offsetX: 0,
      offsetY: (MAP_VIEWBOX.height - height) / 2,
    }
  }

  const width = MAP_VIEWBOX.height * geoAspect
  return {
    width,
    height: MAP_VIEWBOX.height,
    offsetX: (MAP_VIEWBOX.width - width) / 2,
    offsetY: 0,
  }
}

const percentToSvg = (point: { x: number; y: number }) => ({ x: (point.x / 100) * MAP_VIEWBOX.width, y: (point.y / 100) * MAP_VIEWBOX.height })

export function geoToPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const xRatio = clamp((point.lon - bounds.minLon) / Math.max(bounds.maxLon - bounds.minLon, Number.EPSILON), 0, 1)
  const yRatio = clamp((bounds.maxLat - point.lat) / Math.max(bounds.maxLat - bounds.minLat, Number.EPSILON), 0, 1)
  return {
    x: ((viewport.offsetX + xRatio * viewport.width) / MAP_VIEWBOX.width) * 100,
    y: ((viewport.offsetY + yRatio * viewport.height) / MAP_VIEWBOX.height) * 100,
  }
}

const geoToSvg = (point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) =>
  percentToSvg(geoToPercent(point, bounds, viewport))

export function svgToGeo(xRatio: number, yRatio: number, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const svgX = xRatio * MAP_VIEWBOX.width
  const svgY = yRatio * MAP_VIEWBOX.height
  const innerX = clamp((svgX - viewport.offsetX) / Math.max(viewport.width, Number.EPSILON), 0, 1)
  const innerY = clamp((svgY - viewport.offsetY) / Math.max(viewport.height, Number.EPSILON), 0, 1)
  return {
    lon: roundCoord(bounds.minLon + innerX * (bounds.maxLon - bounds.minLon)),
    lat: roundCoord(bounds.maxLat - innerY * (bounds.maxLat - bounds.minLat)),
  }
}

function createLinearSvgPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

export function createGeoPath(points: GeoPoint[], bounds: StudyBounds, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const svgPoints = points.map((point) => geoToSvg(point, bounds, viewport))
  return createLinearSvgPath(svgPoints)
}

export function formatCompactTime(value: string) {
  if (!value) return 'no time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}
