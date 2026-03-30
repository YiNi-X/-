import type { AlertLevel, FlowForecastData, GeoPoint, PlaybackFrame, StudyBounds, TimelineMoment } from '../sharedContracts'

export type Hotspot = {
  id: string
  point: GeoPoint
  intensity: number
  level: AlertLevel
}

export type HeaderBlock = {
  label: string
  value: string
  note: string
}

export type GeoViewport = {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export const STUDY_BOUNDS = {
  minLon: 113.558356434,
  maxLon: 113.95835643400001,
  minLat: 22.155739805,
  maxLat: 22.635739805,
}

const MAP_VIEWBOX = { width: 1920, height: 1080 }
export const CHART_WIDTH = 560
export const CHART_HEIGHT = 248
export const CHART_PAD_X = 22
export const CHART_PAD_Y = 18
export const DEFAULT_HOTSPOT_HIGH_THRESHOLD = 0.65
export const SHARED_GEOMETRY_PATH = 'data/shared-geometry.json'
export const DEFAULT_ROUTE_COUNTS: Record<string, number> = {
  C16: 6,
  C12: 17,
  C08: 17,
  C03: 5,
  C14: 13,
  C17: 1,
}
export const DEFAULT_ROUTE_IDS = Object.keys(DEFAULT_ROUTE_COUNTS)
export const PLAYBACK_SPEEDS = [
  { label: '慢速', value: 5000 },
  { label: '标准', value: 3000 },
  { label: '快速', value: 1800 },
] as const
export const TITLE_TAGS = ['轨迹修复', '主航路识别', '流量预测', '协同管控']

export const EMPTY_PLAYBACK_FRAMES: PlaybackFrame[] = []
export const EMPTY_FORECAST_TIMELINE: FlowForecastData['timeline'] = []

const METERS_PER_DEGREE = 111_000

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

export function geoToPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const xRatio = (point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)
  const yRatio = (bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)
  const x = ((viewport.offsetX + xRatio * viewport.width) / MAP_VIEWBOX.width) * 100
  const y = ((viewport.offsetY + yRatio * viewport.height) / MAP_VIEWBOX.height) * 100
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` }
}

export function geoToNumericPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const value = geoToPercent(point, bounds, viewport)
  return { x: Number.parseFloat(value.x), y: Number.parseFloat(value.y) }
}

export function geoDistanceMeters(a: GeoPoint, b: GeoPoint) {
  const meanLat = (a.lat + b.lat) / 2
  const dy = (b.lat - a.lat) * 111_000
  const dx = (b.lon - a.lon) * Math.cos((meanLat * Math.PI) / 180) * 111_000
  return Math.hypot(dx, dy)
}

function lineMetrics(a: { x: number; y: number }, b: { x: number; y: number }) {
  const lengthX = b.x - a.x
  const lengthY = b.y - a.y
  return { length: Math.sqrt(lengthX ** 2 + lengthY ** 2), angle: Math.atan2(lengthY, lengthX) }
}

function controlPoint(current: { x: number; y: number }, previous?: { x: number; y: number }, next?: { x: number; y: number }, reverse = false) {
  const p = previous ?? current
  const n = next ?? current
  const smoothing = 0.16
  const { length, angle } = lineMetrics(p, n)
  const adjustedAngle = angle + (reverse ? Math.PI : 0)
  const controlLength = length * smoothing
  return {
    x: current.x + Math.cos(adjustedAngle) * controlLength,
    y: current.y + Math.sin(adjustedAngle) * controlLength,
  }
}

function createSmoothPercentPath(points: Array<{ x: number; y: number }>) {
  return points.reduce((path, point, index, array) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    const previous = array[index - 1]
    const previousPrevious = array[index - 2]
    const next = array[index + 1]
    const startControl = controlPoint(previous, previousPrevious, point)
    const endControl = controlPoint(point, previous, next, true)
    return `${path} C ${startControl.x.toFixed(2)} ${startControl.y.toFixed(2)} ${endControl.x.toFixed(2)} ${endControl.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')
}

export function createSmoothGeoPath(points: GeoPoint[], bounds: StudyBounds, viewport: GeoViewport = buildGeoViewport(bounds)) {
  return createSmoothPercentPath(points.map((point) => geoToNumericPercent(point, bounds, viewport)))
}

export function createLinePath(values: number[], min: number, max: number) {
  const step = (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1)
  return values
    .map((value, index) => {
      const x = CHART_PAD_X + step * index
      const ratio = (value - min) / (max - min)
      const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function createAreaPath(values: number[], min: number, max: number) {
  const step = (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1)
  const points = values.map((value, index) => {
    const x = CHART_PAD_X + step * index
    const ratio = (value - min) / (max - min)
    const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M ${CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} L ${points.join(' L ')} L ${CHART_WIDTH - CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} Z`
}

export function metricNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function levelText(level: AlertLevel) {
  if (level === 'high') return '高风险'
  if (level === 'medium') return '中风险'
  return '监视'
}

export function feedRiskText(level: AlertLevel) {
  if (level === 'high') return '高风险'
  if (level === 'medium') return '中风险'
  return '监视'
}

export function classifyLevel(score: number, highThreshold: number): AlertLevel {
  const highScore = highThreshold * 100
  const mediumScore = Math.max((highThreshold - 0.2) * 100, 20)
  if (score >= highScore) return 'high'
  if (score >= mediumScore) return 'medium'
  return 'watch'
}

export function clampCount(value: number) {
  return Math.min(64, Math.max(0, value))
}

export function buildTimelineMoments(frames: PlaybackFrame[], bucketMinutes: number, markMinutes = 240): TimelineMoment[] {
  if (!frames.length) return []
  const marks = new Map<number, PlaybackFrame>()
  const step = Math.max(1, Math.round(markMinutes / Math.max(bucketMinutes, 1)))

  for (let index = 0; index < frames.length; index += step) {
    marks.set(index, frames[index])
  }

  marks.set(frames.length - 1, frames[frames.length - 1])

  return Array.from(marks.entries()).map(([frameIndex, frame]) => ({
    id: frame.sceneId,
    frameIndex,
    time: frame.displayLabel,
    date: frame.bucketTime.slice(5, 10),
  }))
}

export function formatTimelineStamp(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}
