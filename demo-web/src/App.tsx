import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { BenchmarkEntry, FeedView } from './scenarioPacks'
import { feedViews, mapTagDefinitions, modelBenchmarkMatrix } from './scenarioPacks'
import {
  DEFAULT_DATASET_CATALOG,
  formatDatasetPath,
  loadDatasetCatalog,
  persistDatasetSelection,
  readPreferredDatasetId,
  resolveRuntimeResource,
  selectDatasetEntry,
} from './datasetCatalog'
import type {
  AisPlaybackData,
  AlertLevel,
  FlowForecastData,
  ForecastAlert,
  GeoPoint,
  GeometryConfig,
  HorizonKey,
  MapTag,
  ModelName,
  PlaybackFrame,
  PlaybackTrack,
  PlaybackTrackPoint,
  PlaybackVessel,
  ResultTab,
  RouteLabel,
  StudyBounds,
  TimelineMoment,
} from './sharedContracts'
import { loadPublicJson } from './sharedContracts'
import './App.css'

type Hotspot = {
  id: string
  point: GeoPoint
  intensity: number
  level: AlertLevel
}

type HeaderBlock = {
  label: string
  value: string
  note: string
}

const STUDY_BOUNDS = {
  minLon: 113.558356434,
  maxLon: 113.95835643400001,
  minLat: 22.155739805,
  maxLat: 22.635739805,
}

const CHART_WIDTH = 560
const CHART_HEIGHT = 248
const CHART_PAD_X = 22
const CHART_PAD_Y = 18
const DEFAULT_HOTSPOT_HIGH_THRESHOLD = 0.65
const SHARED_GEOMETRY_PATH = 'data/shared-geometry.json'
const DEFAULT_ROUTE_COUNTS: Record<string, number> = {
  C16: 6,
  C12: 17,
  C08: 17,
  C03: 5,
  C14: 13,
  C17: 1,
}
const DEFAULT_ROUTE_IDS = Object.keys(DEFAULT_ROUTE_COUNTS)
const PLAYBACK_SPEEDS = [
  { label: '慢速', value: 5000 },
  { label: '标准', value: 3000 },
  { label: '快速', value: 1800 },
] as const
const TITLE_TAGS = ['轨迹修复', '主航路识别', '流量预测', '协同管控']

const EMPTY_PLAYBACK_FRAMES: PlaybackFrame[] = []
const EMPTY_FORECAST_TIMELINE: FlowForecastData['timeline'] = []

function geoToPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS) {
  const x = ((point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100
  const y = ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * 100
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` }
}

function geoToNumericPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS) {
  const value = geoToPercent(point, bounds)
  return { x: Number.parseFloat(value.x), y: Number.parseFloat(value.y) }
}

function geoDistanceMeters(a: GeoPoint, b: GeoPoint) {
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

function createSmoothGeoPath(points: GeoPoint[], bounds: StudyBounds) {
  return createSmoothPercentPath(points.map((point) => geoToNumericPercent(point, bounds)))
}

function createLinePath(values: number[], min: number, max: number) {
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

function createAreaPath(values: number[], min: number, max: number) {
  const step = (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1)
  const points = values.map((value, index) => {
    const x = CHART_PAD_X + step * index
    const ratio = (value - min) / (max - min)
    const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M ${CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} L ${points.join(' L ')} L ${CHART_WIDTH - CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} Z`
}

function metricNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function levelText(level: AlertLevel) {
  if (level === 'high') return '高'
  if (level === 'medium') return '中'
  return '监视'
}

function feedRiskText(level: AlertLevel) {
  if (level === 'high') return '高风险'
  if (level === 'medium') return '中风险'
  return '监视'
}

function classifyLevel(score: number, highThreshold: number): AlertLevel {
  const highScore = highThreshold * 100
  const mediumScore = Math.max((highThreshold - 0.2) * 100, 20)
  if (score >= highScore) return 'high'
  if (score >= mediumScore) return 'medium'
  return 'watch'
}

function clampCount(value: number) {
  return Math.min(64, Math.max(0, value))
}

function buildTimelineMoments(frames: PlaybackFrame[], bucketMinutes: number, markMinutes = 240): TimelineMoment[] {
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

function formatTimelineStamp(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function App() {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [planApplied, setPlanApplied] = useState(false)
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('benefit')
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonKey>('1h')
  const [selectedModel, setSelectedModel] = useState<ModelName>('STGCN')
  const [strategyEnabled, setStrategyEnabled] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState(3000)
  const [routeCountsOverride, setRouteCountsOverride] = useState<Record<string, number>>({})
  const [hotspotHighThreshold, setHotspotHighThreshold] = useState(DEFAULT_HOTSPOT_HIGH_THRESHOLD)
  const [isControlDrawerOpen, setIsControlDrawerOpen] = useState(false)
  const [aisPlayback, setAisPlayback] = useState<AisPlaybackData | null>(null)
  const [flowForecast, setFlowForecast] = useState<FlowForecastData | null>(null)
  const [geometryConfig, setGeometryConfig] = useState<GeometryConfig | null>(null)
  const [datasetCatalog, setDatasetCatalog] = useState(DEFAULT_DATASET_CATALOG)
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => readPreferredDatasetId() ?? DEFAULT_DATASET_CATALOG.defaultDatasetId)
  const [datasetLoadError, setDatasetLoadError] = useState('')
  const [geometryLoadError, setGeometryLoadError] = useState('')

  const availableDatasets = useMemo(
    () => datasetCatalog.datasets.filter((item) => item.aisPlaybackPath && item.flowForecastPath),
    [datasetCatalog.datasets],
  )
  const selectedDataset = useMemo(
    () => selectDatasetEntry(datasetCatalog, selectedDatasetId, ['ais', 'forecast']),
    [datasetCatalog, selectedDatasetId],
  )
  const studyArea = geometryConfig?.meta.studyArea ?? aisPlayback?.meta.studyArea ?? STUDY_BOUNDS
  const routeIds = geometryConfig?.meta.routeOrder ?? aisPlayback?.meta.routeIds ?? DEFAULT_ROUTE_IDS
  const mediumHotspotThreshold = Math.max(hotspotHighThreshold - 0.2, 0.1)

  useEffect(() => {
    let cancelled = false

    loadDatasetCatalog().then((catalog) => {
      if (cancelled) return
      setDatasetCatalog(catalog)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadPublicJson<GeometryConfig>(resolveRuntimeResource(SHARED_GEOMETRY_PATH))
      .then((geometryPayload) => {
        if (cancelled) return
        setGeometryConfig(geometryPayload)
        setGeometryLoadError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setGeometryLoadError(error instanceof Error ? error.message : 'Failed to load shared geometry config')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      loadPublicJson<AisPlaybackData>(resolveRuntimeResource(selectedDataset.aisPlaybackPath)),
      loadPublicJson<FlowForecastData>(resolveRuntimeResource(selectedDataset.flowForecastPath ?? 'data/flow-forecast.json')),
    ])
      .then(([playbackPayload, forecastPayload]) => {
        if (cancelled) return
        setAisPlayback(playbackPayload)
        setFlowForecast(forecastPayload)
        setDatasetLoadError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDatasetLoadError(error instanceof Error ? error.message : `Failed to load dataset ${selectedDataset.label}`)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDataset])

  const mapTags = useMemo<MapTag[]>(() => mapTagDefinitions.map((tag) => ({ ...tag, ...geoToPercent(tag.point, studyArea) })), [studyArea])
  const routeLabels = useMemo<RouteLabel[]>(
    () => geometryConfig?.routes.map((route) => ({ id: route.id, ...geoToPercent(route.labelPoint, studyArea) })) ?? [],
    [geometryConfig, studyArea],
  )
  const playbackFrames = aisPlayback?.frames ?? EMPTY_PLAYBACK_FRAMES
  const forecastTimeline = flowForecast?.timeline ?? EMPTY_FORECAST_TIMELINE
  const activeScenes = useMemo(
    () =>
      Array.from({ length: Math.max(playbackFrames.length, forecastTimeline.length) }, (_, index) => {
        const playbackFrame = playbackFrames[index]
        const forecastEntry = forecastTimeline[index]
        const time = forecastEntry?.time ?? playbackFrame?.bucketTime ?? ''
        return {
          id: forecastEntry?.sceneId ?? playbackFrame?.sceneId ?? `frame-${index}`,
          label: playbackFrame?.displayLabel ?? time.slice(11, 16) ?? '--:--',
          time,
          totalFlow: forecastEntry?.current.totalFlow ?? 0,
        }
      }),
    [forecastTimeline, playbackFrames],
  )
  const totalSceneCount = activeScenes.length
  const safeSceneIndex = totalSceneCount ? Math.min(sceneIndex, totalSceneCount - 1) : 0
  const sceneTemplateIndex = safeSceneIndex
  const sceneMarker = activeScenes[safeSceneIndex] ?? { id: 'frame-0', label: '--:--', time: '', totalFlow: 0 }
  const forecastEntry = forecastTimeline[safeSceneIndex] ?? forecastTimeline.find((item) => item.sceneId === sceneMarker.id) ?? null
  const playbackFrame = useMemo(
    () => playbackFrames[safeSceneIndex] ?? playbackFrames.find((item) => item.sceneId === sceneMarker.id) ?? null,
    [playbackFrames, safeSceneIndex, sceneMarker.id],
  )
  const scene = useMemo(() => {
    const narrative = forecastEntry?.narrative
    return {
      id: forecastEntry?.sceneId ?? playbackFrame?.sceneId ?? sceneMarker.id,
      time: forecastEntry?.time ?? playbackFrame?.bucketTime ?? sceneMarker.time,
      phase: narrative?.phase ?? '数据加载中',
      status: narrative?.status ?? '等待数据契约',
      totalFlow: forecastEntry?.current.totalFlow ?? 0,
      next1h: forecastEntry?.forecast['1h']?.totalFlow ?? 0,
      hotspotCount: forecastEntry?.derived.hotspotCount ?? 0,
      focusGrid: forecastEntry?.derived.focusGrid ?? geometryConfig?.hotspots[0]?.id ?? '',
      summary: narrative?.summary ?? '页面正在等待离线预测结果。',
      alerts: forecastEntry?.derived.alerts ?? [],
      appliedAlerts: narrative?.appliedState.alerts ?? forecastEntry?.derived.alerts ?? [],
      logs: narrative?.logs ?? ['离线推理数据加载中。'],
      strategyHeadline: narrative?.strategy.headline ?? '离线推理准备中',
      strategySummary: narrative?.strategy.summary ?? '页面将直接使用数据文件里的 narrative 字段，不再回退到静态场景模板。',
      recommendations: narrative?.recommendations ?? [],
      benefits: narrative?.benefits ?? [],
      appliedSummary: narrative?.appliedState.summary ?? narrative?.summary ?? '等待策略应用态数据。',
      appliedStatus: narrative?.appliedState.status ?? narrative?.status ?? '等待策略应用态数据。',
      appliedHotspotScale: narrative?.appliedState.hotspotScale ?? 1,
      appliedFocusGrid: narrative?.appliedState.focusGrid ?? forecastEntry?.derived.focusGrid ?? geometryConfig?.hotspots[0]?.id ?? '',
      appliedFocusRoute: narrative?.appliedState.focusRoute ?? forecastEntry?.derived.focusRoute ?? '',
    }
  }, [forecastEntry, geometryConfig, playbackFrame, sceneMarker.id, sceneMarker.time])
  const timelineMoments = useMemo(
    () =>
      playbackFrames.length
        ? buildTimelineMoments(playbackFrames, aisPlayback?.meta.bucketMinutes ?? 5)
        : activeScenes.map((item, index) => ({
            id: item.id,
            frameIndex: index,
            time: item.time.slice(11, 16),
            date: item.time.slice(5, 10),
          })),
    [activeScenes, aisPlayback?.meta.bucketMinutes, playbackFrames],
  )
  const activeTimelineMomentId =
    timelineMoments.reduce<TimelineMoment | null>((closest, item) => {
      if (!closest) return item
      return Math.abs(item.frameIndex - safeSceneIndex) < Math.abs(closest.frameIndex - safeSceneIndex) ? item : closest
    }, null)?.id ?? ''
  const playbackWindowStart = playbackFrames[0]?.bucketTime ?? activeScenes[0]?.time ?? ''
  const playbackWindowEnd = playbackFrames[playbackFrames.length - 1]?.bucketTime ?? activeScenes[activeScenes.length - 1]?.time ?? ''
  const playbackWindowRangeLabel =
    playbackWindowStart && playbackWindowEnd ? `${formatTimelineStamp(playbackWindowStart)} -> ${formatTimelineStamp(playbackWindowEnd)}` : 'Window unavailable'
  const playbackFrameLabel = playbackFrame ? formatTimelineStamp(playbackFrame.bucketTime) : scene.time
  const playbackFrameMeta = totalSceneCount
    ? `Frame ${Math.min(safeSceneIndex + 1, totalSceneCount)} / ${totalSceneCount} · ${aisPlayback?.meta.bucketMinutes ?? 5} min step`
    : 'No playback frames'

  const visiblePlaybackVessels = useMemo(() => {
    if (!playbackFrame) return [] as PlaybackVessel[]
    const usedByRoute: Record<string, number> = Object.fromEntries(routeIds.map((routeId) => [routeId, 0]))
    return playbackFrame.vessels.filter((vessel) => {
      if ((usedByRoute[vessel.routeId] ?? 0) >= (routeCountsOverride[vessel.routeId] ?? DEFAULT_ROUTE_COUNTS[vessel.routeId] ?? 12)) return false
      usedByRoute[vessel.routeId] += 1
      return true
    })
  }, [playbackFrame, routeCountsOverride, routeIds])

  const playbackTracks = useMemo<PlaybackTrack[]>(() => {
    const groupedTracks = new Map<
      string,
      {
        mmsi: string
        routeId: string
        isFocusArea: boolean
        points: PlaybackTrackPoint[]
      }
    >()

    playbackFrames.forEach((frame) => {
      frame.vessels.forEach((vessel) => {
        const existingTrack = groupedTracks.get(vessel.mmsi) ?? {
          mmsi: vessel.mmsi,
          routeId: vessel.routeId,
          isFocusArea: vessel.isFocusArea,
          points: [],
        }
        const nextPoint = { lon: vessel.lon, lat: vessel.lat, time: frame.bucketTime, sceneId: frame.sceneId }
        const lastPoint = existingTrack.points[existingTrack.points.length - 1]

        existingTrack.routeId = vessel.routeId
        existingTrack.isFocusArea = existingTrack.isFocusArea || vessel.isFocusArea

        if (!lastPoint || geoDistanceMeters(lastPoint, nextPoint) > 12) {
          existingTrack.points.push(nextPoint)
        }

        groupedTracks.set(vessel.mmsi, existingTrack)
      })
    })

    return Array.from(groupedTracks.values())
      .filter((track) => track.points.length >= 2)
      .map((track) => ({
        ...track,
        path: createSmoothGeoPath(track.points, studyArea),
      }))
  }, [playbackFrames, studyArea])

  const displayedTrackIds = useMemo(() => {
    return new Set(
      routeIds.flatMap((routeId) =>
        playbackTracks
          .filter((track) => track.routeId === routeId)
          .sort(
            (a, b) =>
              b.points.length - a.points.length ||
              Number(b.isFocusArea) - Number(a.isFocusArea) ||
              a.points[0].time.localeCompare(b.points[0].time) ||
              a.mmsi.localeCompare(b.mmsi),
          )
          .slice(0, routeCountsOverride[routeId] ?? DEFAULT_ROUTE_COUNTS[routeId] ?? 12)
          .map((track) => track.mmsi),
      ),
    )
  }, [playbackTracks, routeCountsOverride, routeIds])

  const activeTrackIds = useMemo(() => new Set(visiblePlaybackVessels.map((vessel) => vessel.mmsi)), [visiblePlaybackVessels])

  useEffect(() => {
    if (!autoplay || totalSceneCount <= 1) return
    const timer = window.setInterval(() => {
      setSceneIndex((current) => (Math.min(current, totalSceneCount - 1) + 1) % totalSceneCount)
      setPlanApplied(false)
    }, playbackSpeed)
    return () => window.clearInterval(timer)
  }, [autoplay, playbackSpeed, totalSceneCount])

  const hotspots = useMemo<Hotspot[]>(
    () =>
      (geometryConfig?.hotspots ?? []).map((anchor) => ({
        id: anchor.id,
        point: anchor.point,
        intensity: forecastEntry?.derived.hotspots.find((item) => item.id === anchor.id)?.intensity ?? 0,
        level: forecastEntry?.derived.hotspots.find((item) => item.id === anchor.id)?.level ?? 'watch',
      })),
    [forecastEntry, geometryConfig],
  )

  const objectiveFocusGrid = planApplied ? scene.appliedFocusGrid : forecastEntry?.derived.focusGrid ?? scene.focusGrid
  const displayedAlerts = useMemo<ForecastAlert[]>(() => (planApplied ? scene.appliedAlerts : scene.alerts), [planApplied, scene])

  const focusFeed = feedViews.find((item) => item.grid === objectiveFocusGrid) ?? feedViews[0]
  const focusRoute = planApplied ? scene.appliedFocusRoute || focusFeed.route : forecastEntry?.derived.focusRoute ?? focusFeed.route
  const displayedPlaybackTracks = useMemo(
    () =>
      playbackTracks
        .filter((track) => displayedTrackIds.has(track.mmsi))
        .sort((a, b) => {
          const aPriority = Number(a.routeId === focusRoute) * 4 + Number(activeTrackIds.has(a.mmsi)) * 2 + Number(a.isFocusArea)
          const bPriority = Number(b.routeId === focusRoute) * 4 + Number(activeTrackIds.has(b.mmsi)) * 2 + Number(b.isFocusArea)
          if (aPriority !== bPriority) return aPriority - bPriority
          return a.mmsi.localeCompare(b.mmsi)
        }),
    [activeTrackIds, displayedTrackIds, focusRoute, playbackTracks],
  )
  const visibleTrackMarkers = useMemo(
    () =>
      visiblePlaybackVessels
        .filter((vessel) => displayedTrackIds.has(vessel.mmsi))
        .sort((a, b) => {
          const aPriority = Number(a.routeId === focusRoute) * 3 + Number(a.isFocusArea)
          const bPriority = Number(b.routeId === focusRoute) * 3 + Number(b.isFocusArea)
          if (aPriority !== bPriority) return aPriority - bPriority
          return a.mmsi.localeCompare(b.mmsi)
        }),
    [displayedTrackIds, focusRoute, visiblePlaybackVessels],
  )
  const focusAlert =
    displayedAlerts.find((item) => item.grid === objectiveFocusGrid) ??
    displayedAlerts[0] ?? { grid: '--', level: 'watch' as AlertLevel, current: 0, future: 0, note: '' }
  const sceneDate = scene.time.slice(0, 10)
  const sceneClock = scene.time.slice(11)
  const totalFlowSeries = flowForecast?.series.totalFlow?.length ? flowForecast.series.totalFlow : activeScenes.map((item) => item.totalFlow)
  const safeFlowSeries = totalFlowSeries.length >= 2 ? totalFlowSeries : [0, 0]
  const flowMin = Math.min(...safeFlowSeries) - 80
  const flowMax = Math.max(...safeFlowSeries) + 80
  const flowPath = createLinePath(safeFlowSeries, flowMin, flowMax)
  const flowArea = createAreaPath(safeFlowSeries, flowMin, flowMax)
  const objectiveTotalFlow = forecastEntry?.current.totalFlow ?? scene.totalFlow
  const objectiveNext1h = forecastEntry?.forecast['1h'].totalFlow ?? scene.next1h
  const currentVisibleVessels = visibleTrackMarkers.length > 0 ? visibleTrackMarkers.length : displayedPlaybackTracks.length
  const displayedHotspotCount = displayedAlerts.filter((item) => classifyLevel(item.future, hotspotHighThreshold) !== 'watch').length
  const displayedStatus = !strategyEnabled ? '策略关闭' : planApplied ? scene.appliedStatus ?? '协同已应用' : scene.status
  const hotspotScale = planApplied ? scene.appliedHotspotScale ?? 0.02 : 1
  const liveDisplayTime = playbackFrame?.displayLabel ?? sceneClock
  const liveDisplayDate = playbackFrame?.bucketTime.slice(0, 10) ?? sceneDate
  const playbackWindowMinutes = aisPlayback?.meta.bucketMinutes ?? 5
  const runtimeLoadError = geometryLoadError || datasetLoadError
  const studyAreaLongitudeLabel = `${studyArea.minLon.toFixed(4)}E - ${studyArea.maxLon.toFixed(4)}E`
  const studyAreaLatitudeLabel = `${studyArea.minLat.toFixed(4)}N - ${studyArea.maxLat.toFixed(4)}N`

  const flowTicks = useMemo(() => {
    const values = [flowMin, (flowMin + flowMax) / 2, flowMax]
      .map((value) => Math.round(value / 50) * 50)
      .filter((value, index, array) => array.indexOf(value) === index)
    return values
  }, [flowMax, flowMin])

  const headerLeftBlocks: HeaderBlock[] = [
    { label: '系统状态', value: 'ONLINE', note: `AIS / ${flowForecast?.meta.model ?? 'STGCN'} / OFFLINE` },
    { label: '数据时段', value: '连续时序', note: `${playbackWindowMinutes} 分钟滚动窗口` },
    { label: '焦点航路', value: focusRoute, note: `焦点网格 ${objectiveFocusGrid}` },
  ]

  const headerRightBlocks: HeaderBlock[] = [
    { label: '当前时刻', value: liveDisplayTime, note: liveDisplayDate },
    { label: '运行阶段', value: scene.phase, note: displayedStatus },
    { label: '地图模式', value: '聚类 / 网格', note: '主航路与热点监测' },
  ]

  const dialCards = [
    { label: '当前流量', value: objectiveTotalFlow, percent: Math.min(objectiveTotalFlow / 2200, 1) },
    { label: 'Next Window', value: objectiveNext1h, percent: Math.min(objectiveNext1h / 2200, 1) },
    { label: '热点网格', value: displayedHotspotCount, percent: Math.min(displayedHotspotCount / 5, 1) },
    { label: '展示船舶', value: currentVisibleVessels, percent: Math.min(currentVisibleVessels / 28, 1) },
  ]

  const currentBenchmark = modelBenchmarkMatrix[selectedHorizon][selectedModel]
  const comparisonBenchmarks = (Object.entries(modelBenchmarkMatrix[selectedHorizon]) as [ModelName, BenchmarkEntry][])
    .filter(([model]) => model !== selectedModel)
  const strategyAvailable = strategyEnabled && !planApplied

  function handleApplyPlan() {
    if (!strategyEnabled || planApplied) return
    setPlanApplied(true)
    setAutoplay(false)
  }

  function handleAutoplayToggle() {
    if (autoplay) {
      setAutoplay(false)
      return
    }
    setPlanApplied(false)
    setAutoplay(true)
  }

  function handleSceneSelect(index: number) {
    setSceneIndex(totalSceneCount ? Math.min(Math.max(index, 0), totalSceneCount - 1) : 0)
    setPlanApplied(false)
    setAutoplay(false)
  }

  function handleRouteCountChange(routeId: string, delta: number) {
    const currentValue = routeCountsOverride[routeId] ?? DEFAULT_ROUTE_COUNTS[routeId] ?? 12
    setRouteCountsOverride((current) => ({ ...current, [routeId]: clampCount(currentValue + delta) }))
  }

  function handleStrategyToggle() {
    setStrategyEnabled((current) => {
      const next = !current
      if (!next) setPlanApplied(false)
      return next
    })
  }

  function handleDatasetChange(nextDatasetId: string) {
    setSelectedDatasetId(nextDatasetId)
    persistDatasetSelection(nextDatasetId)
    setSceneIndex(0)
    setPlanApplied(false)
    setAutoplay(false)
  }

  function resetControls() {
    setSceneIndex(0)
    setPlanApplied(false)
    setAutoplay(false)
    setRouteCountsOverride({})
    setPlaybackSpeed(3000)
    setHotspotHighThreshold(DEFAULT_HOTSPOT_HIGH_THRESHOLD)
    setStrategyEnabled(true)
    setActiveResultTab('benefit')
    setSelectedHorizon('1h')
    setSelectedModel('STGCN')
  }

  return (
    <main className="platform">
      <header className="header-bar frame">
        <div className="header-side header-side-left">
          <div className="header-side-label">PORT CONTROL</div>
          <div className="header-block-grid">
            {headerLeftBlocks.map((block) => (
              <article key={block.label} className="header-block">
                <span>{block.label}</span>
                <strong>{block.value}</strong>
                <small>{block.note}</small>
              </article>
            ))}
          </div>

          <p className="source-note">
            {flowForecast?.meta.notice ??
              '船舶轨迹来自历史 AIS，预测来自离线模型推理，本页面仍是演示版而非生产业务系统。'}
          </p>
        </div>

        <div className="header-title-shell">
          <div className="header-title-plaque">
            <span className="header-title-code">PEARL RIVER ESTUARY PORT TRAFFIC MONITOR</span>
            <h1>港口智慧管理平台</h1>
            <p>珠江口船舶交通监测与协同决策控制台</p>
          </div>

          <div className="header-title-tags">
            {TITLE_TAGS.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="header-live-bar">
            <div className="live-summary-copy">
              <span>当前态势说明</span>
              <strong>{planApplied ? scene.appliedSummary : scene.summary}</strong>
            </div>
            <button type="button" className="parameter-trigger" onClick={() => setIsControlDrawerOpen((current) => !current)}>
              {isControlDrawerOpen ? '关闭控制台' : '参数控制台'}
            </button>
          </div>
        </div>

        <div className="header-side header-side-right">
          <div className="header-side-label">LIVE CONTROL</div>
          <div className="header-block-grid header-block-grid-right">
            {headerRightBlocks.map((block) => (
              <article key={block.label} className="header-block">
                <span>{block.label}</span>
                <strong>{block.value}</strong>
                <small>{block.note}</small>
              </article>
            ))}

            <button type="button" className="header-control" onClick={handleAutoplayToggle}>
              <span>轮播控制</span>
              <strong>{autoplay ? '自动回放中' : '已暂停'}</strong>
              <small>{autoplay ? '点击停止轮播' : '点击恢复轮播'}</small>
            </button>
          </div>
        </div>
      </header>

      <aside className={isControlDrawerOpen ? 'frame control-drawer open' : 'frame control-drawer'}>
        <div className="control-drawer-head">
          <div>
            <p className="panel-kicker">Parameter Console</p>
            <h2>参数控制台</h2>
          </div>
          <button type="button" className="drawer-close" onClick={() => setIsControlDrawerOpen(false)}>
            关闭
          </button>
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>Data Source</strong>
            <span>{selectedDataset.label}</span>
          </div>
          <label className="drawer-field">
            <span>Dataset</span>
            <select value={selectedDataset.id} onChange={(event) => handleDatasetChange(event.target.value)}>
              {availableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="control-note">{selectedDataset.description || 'Switch datasets from the shared catalog or open the page with ?dataset=<id>.'}</p>
          <p className="control-paths">
            AIS {formatDatasetPath(selectedDataset.aisPlaybackPath)}
            <br />
            Forecast {formatDatasetPath(selectedDataset.flowForecastPath)}
          </p>
          {runtimeLoadError ? <p className="control-warning">{runtimeLoadError}</p> : null}
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>船舶数量</strong>
            <span>分航线调节</span>
          </div>
          <div className="route-count-grid">
            {routeIds.map((routeId) => (
              <div key={routeId} className="route-count-row">
                <span>{routeId}</span>
                <div className="route-stepper">
                  <button type="button" onClick={() => handleRouteCountChange(routeId, -1)}>
                    -
                  </button>
                  <strong>{routeCountsOverride[routeId] ?? DEFAULT_ROUTE_COUNTS[routeId] ?? 12}</strong>
                  <button type="button" onClick={() => handleRouteCountChange(routeId, 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>热点阈值</strong>
            <span>高压 ≥ {(hotspotHighThreshold * 100).toFixed(0)} / 中压 ≥ {(mediumHotspotThreshold * 100).toFixed(0)}</span>
          </div>
          <input className="threshold-slider" type="range" min="0.45" max="0.85" step="0.05" value={hotspotHighThreshold} onChange={(event) => setHotspotHighThreshold(Number(event.target.value))} />
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>回放速度</strong>
            <span>{playbackSpeed}ms / 节点</span>
          </div>
          <div className="segmented-group">
            {PLAYBACK_SPEEDS.map((item) => (
              <button key={item.label} type="button" className={item.value === playbackSpeed ? 'segmented-button active' : 'segmented-button'} onClick={() => setPlaybackSpeed(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>协同策略</strong>
            <span>{strategyEnabled ? '已启用' : '已关闭'}</span>
          </div>
          <button type="button" className={strategyEnabled ? 'strategy-toggle active' : 'strategy-toggle'} onClick={handleStrategyToggle}>
            {strategyEnabled ? '启用协同策略' : '重新启用策略'}
          </button>
        </div>

        <div className="control-actions">
          <button type="button" className="drawer-reset" onClick={resetControls}>
            恢复默认参数
          </button>
          <button type="button" className="drawer-close secondary" onClick={() => setIsControlDrawerOpen(false)}>
            关闭面板
          </button>
        </div>
      </aside>

      <section className="console-layout">
        <aside className="left-rail">
          <section className="frame panel-block metrics-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">System Overview</p>
                <h2>运行态势</h2>
              </div>
              <span className="panel-code">LIVE</span>
            </div>

            <div className="dial-grid">
              {dialCards.map((dial) => {
                const style = { backgroundImage: `conic-gradient(#18bfd4 ${dial.percent * 360}deg, rgba(255,255,255,0.08) 0deg)` } satisfies CSSProperties
                return (
                  <article key={dial.label} className="dial-card">
                    <div className="dial-ring" style={style}>
                      <div className="dial-core">
                        <strong>{metricNumber(dial.value)}</strong>
                      </div>
                    </div>
                    <span>{dial.label}</span>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="frame panel-block grid-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Hot Grid Table</p>
                <h2>重点网格</h2>
              </div>
              <span className="panel-code">{objectiveFocusGrid}</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>网格</th>
                  <th>等级</th>
                  <th>当前</th>
                  <th>预测</th>
                </tr>
              </thead>
              <tbody>
                {displayedAlerts.map((alert) => (
                  <tr key={`${scene.id}-${alert.grid}`}>
                    <td>{alert.grid}</td>
                    <td>{levelText(alert.level)}</td>
                    <td>{alert.current}</td>
                    <td>{alert.future}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="frame panel-block log-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">System Log</p>
                <h2>运行日志</h2>
              </div>
              <span className="panel-code">LOG</span>
            </div>

            <ul className="log-list">
              {scene.logs.map((log) => (
                <li key={log}>{log}</li>
              ))}
            </ul>
          </section>

          <section className="frame panel-block chart-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Forecast Curve</p>
                <h2>流量曲线</h2>
              </div>
              <span className="panel-code">NEXT</span>
            </div>

            <div className="chart-area compact-chart-area">
              <svg className="flow-chart compact" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="总流量趋势图">
                <defs>
                  <linearGradient id="flow-area-compact" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(24, 195, 214, 0.34)" />
                    <stop offset="100%" stopColor="rgba(24, 195, 214, 0.02)" />
                  </linearGradient>
                </defs>

                {flowTicks.map((tick) => {
                  const ratio = (tick - flowMin) / (flowMax - flowMin)
                  const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
                  return (
                    <g key={`tick-${tick}`}>
                      <line x1={CHART_PAD_X} x2={CHART_WIDTH - CHART_PAD_X} y1={y} y2={y} className="chart-grid-line" />
                      <text x="2" y={y + 4} className="chart-axis">
                        {tick}
                      </text>
                    </g>
                  )
                })}

                <path d={flowArea} fill="url(#flow-area-compact)" />
                <path d={flowPath} className="chart-line" />

                {totalFlowSeries.map((value, index) => {
                  const x = CHART_PAD_X + ((CHART_WIDTH - CHART_PAD_X * 2) / (totalFlowSeries.length - 1)) * index
                  const ratio = (value - flowMin) / (flowMax - flowMin)
                  const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
                  return (
                    <g key={`point-${index}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r={index === sceneTemplateIndex ? 5 : 3.5}
                        className={index === sceneTemplateIndex ? 'chart-point active' : 'chart-point'}
                      />
                      <text x={x} y={CHART_HEIGHT - 8} className={index === sceneTemplateIndex ? 'chart-label active' : 'chart-label'}>
                        {activeScenes[index]?.label ?? `T${index + 1}`}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="chart-footer">
              <span>当前 {metricNumber(objectiveTotalFlow)}</span>
              <span>Next {metricNumber(objectiveNext1h)}</span>
              <span>{scene.phase}</span>
            </div>
          </section>
        </aside>

        <section className="map-column">
          <section className="frame map-frame">
            <div className="map-stage">
              <img src="/static-port-map.jpg" alt="珠江口静态卫星底图" className="map-image" />
              <div className="map-grid"></div>

              <div className="map-panel-title">
                <div>
                  <p className="panel-kicker">Spatial Monitor</p>
                  <h2>珠江口主航道与热点分析</h2>
                </div>
                <span className="panel-code">AREA 60 GRID</span>
              </div>

              <div className="map-hud map-hud-left">
                <span>研究区域</span>
                <strong>{studyAreaLongitudeLabel}</strong>
                <strong>{studyAreaLatitudeLabel}</strong>
              </div>

              <div className="map-right-rail">
                <div className="map-hud focus-card">
                  <div className="focus-card-head">
                    <span className="focus-card-label">焦点对象</span>
                    <span className={!strategyEnabled ? 'focus-card-state disabled' : planApplied ? 'focus-card-state applied' : 'focus-card-state'}>
                      {!strategyEnabled ? '策略关闭' : planApplied ? '已应用' : '待推演'}
                    </span>
                  </div>
                  <div className="focus-card-tags">
                    <strong>{objectiveFocusGrid}</strong>
                    <strong>{focusRoute}</strong>
                    <strong>{focusFeed.tag}</strong>
                  </div>
                  <div className="focus-card-metric">
                    <small>当前值</small>
                    <strong>
                      {focusAlert.current} <span>→</span> {focusAlert.future}
                    </strong>
                  </div>
                  <p className="focus-card-summary">
                    {!strategyEnabled ? '当前协同策略已关闭，可在参数控制台中重新启用。' : planApplied ? scene.appliedSummary : scene.strategySummary}
                  </p>
                  <button type="button" className={planApplied ? 'focus-card-action applied' : 'focus-card-action'} onClick={handleApplyPlan} disabled={!strategyAvailable}>
                    {!strategyEnabled ? '策略已关闭' : planApplied ? '已应用方案' : '应用方案'}
                  </button>
                </div>

                <div className="map-control-stack">
                  <div className="map-control-card">
                    <span>当前状态</span>
                    <strong>{displayedStatus}</strong>
                    <small>{scene.phase}</small>
                  </div>
                  <div className="map-control-card">
                    <span>Next Window</span>
                    <strong>{metricNumber(objectiveNext1h)}</strong>
                    <small>
                      较当前{objectiveNext1h - objectiveTotalFlow > 0 ? '+' : ''}
                      {objectiveNext1h - objectiveTotalFlow}
                    </small>
                  </div>
                  <div className="map-button-grid">
                    <button type="button">主航路</button>
                    <button type="button">热点网格</button>
                    <button type="button" onClick={() => setActiveResultTab('model')}>
                      模型结果
                    </button>
                    <button type="button" onClick={() => setIsControlDrawerOpen(true)}>
                      参数控制
                    </button>
                  </div>
                </div>
              </div>

              <div className="vessel-route-layer" aria-hidden="true">
                <svg className="vessel-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {displayedPlaybackTracks.map((track) => {
                    const startPoint = track.points[0]
                    const startPosition = geoToNumericPercent(startPoint, studyArea)
                    const pathClassName = [
                      'vessel-route-path',
                      track.routeId === focusRoute ? 'focus' : '',
                      activeTrackIds.has(track.mmsi) ? 'active' : '',
                      track.isFocusArea ? 'focus-area' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    const pointClassName = [
                      'vessel-route-point',
                      track.routeId === focusRoute ? 'focus' : '',
                      activeTrackIds.has(track.mmsi) ? 'active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    const startClassName = [
                      'vessel-route-start',
                      track.routeId === focusRoute ? 'focus' : '',
                      activeTrackIds.has(track.mmsi) ? 'active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <g key={track.mmsi}>
                        <path d={track.path} className={pathClassName} />
                        <circle cx={startPosition.x} cy={startPosition.y} r={track.routeId === focusRoute ? 0.58 : 0.46} className={startClassName} />
                        {track.points.slice(1).map((point) => {
                          const pointPosition = geoToNumericPercent(point, studyArea)
                          return (
                            <circle
                              key={`${track.mmsi}-${point.sceneId}`}
                              cx={pointPosition.x}
                              cy={pointPosition.y}
                              r={track.routeId === focusRoute ? 0.34 : 0.28}
                              className={pointClassName}
                            />
                          )
                        })}
                      </g>
                    )
                  })}
                </svg>

                {visibleTrackMarkers.map((vessel) => {
                  const vesselPosition = geoToPercent({ lon: vessel.lon, lat: vessel.lat }, studyArea)
                  return (
                    <div
                      key={`${scene.id}-${vessel.mmsi}`}
                      className={vessel.routeId === focusRoute ? 'vessel-current focus' : vessel.isFocusArea ? 'vessel-current active' : 'vessel-current'}
                      style={{
                        left: vesselPosition.x,
                        top: vesselPosition.y,
                        transform: `translate(-50%, -50%) rotate(${vessel.heading}deg)`,
                      }}
                    >
                      <span className="vessel-current-icon"></span>
                    </div>
                  )
                })}
              </div>

              {routeLabels.map((route) => (
                <div key={route.id} className={route.id === focusRoute ? 'route-tag active' : 'route-tag'} style={{ left: route.x, top: route.y }}>
                  {route.id}
                </div>
              ))}

              {mapTags.map((tag) => (
                <div key={tag.id} className={tag.focusGrid === objectiveFocusGrid ? 'map-tag active' : 'map-tag'} style={{ left: tag.x, top: tag.y }}>
                  <strong>{tag.id}</strong>
                  <span>{tag.label}</span>
                </div>
              ))}

              {hotspots.map((hotspot) => {
                const hotspotPosition = geoToPercent(hotspot.point, studyArea)
                const size = (22 + hotspot.intensity * 42) * hotspotScale
                const style = {
                  left: hotspotPosition.x,
                  top: hotspotPosition.y,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity: (0.25 + hotspot.intensity * 0.75) * (planApplied ? 0 : 1),
                } satisfies CSSProperties
                const className = hotspot.level === 'high' ? 'hotspot high' : hotspot.level === 'medium' ? 'hotspot medium' : 'hotspot'

                return (
                  <div key={hotspot.id} className={`${className}${planApplied ? ' suppressed' : ''}`} style={style}>
                    <span>{hotspot.id}</span>
                  </div>
                )
              })}

              <div className="map-bottom-strip">
                <div className="map-bottom-summary">
                  <span>当前态势说明</span>
                  <strong>{planApplied ? scene.appliedSummary : scene.summary}</strong>
                </div>

                <div className="map-bottom-focus">
                  <span>{focusFeed.tag}</span>
                  <span>{focusRoute}</span>
                  <span>
                    {objectiveFocusGrid} {focusAlert.current}
                  </span>
                </div>

                <div className="map-bottom-timeline">
                  <div className="map-bottom-timeline-head">
                    <div>
                      <span>Observed Window</span>
                      <strong>{playbackWindowRangeLabel}</strong>
                    </div>
                    <div>
                      <span>Current Frame</span>
                      <strong>{playbackFrameLabel}</strong>
                    </div>
                  </div>

                  <div className="map-bottom-timeline-marks">
                    {timelineMoments.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === activeTimelineMomentId ? 'map-timeline-node active' : 'map-timeline-node'}
                        onClick={() => handleSceneSelect(item.frameIndex)}
                      >
                        <strong>{item.time}</strong>
                        <small>{item.date}</small>
                      </button>
                    ))}
                  </div>

                  <input
                    className="map-bottom-slider"
                    type="range"
                    min="0"
                    max={Math.max(totalSceneCount - 1, 0)}
                    step="1"
                    value={Math.min(sceneIndex, Math.max(totalSceneCount - 1, 0))}
                    onChange={(event) => handleSceneSelect(Number(event.target.value))}
                    disabled={!totalSceneCount}
                  />

                  <div className="map-bottom-timeline-meta">
                    <span>{playbackFrameMeta}</span>
                    <span>{playbackFrame?.activeVesselCount ?? 0} visible ships</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="right-rail">
          <section className="frame panel-block strategy-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Collaborative Strategy</p>
                <h2>协同管控建议</h2>
              </div>
              <span className="panel-code">{!strategyEnabled ? 'OFF' : planApplied ? 'APPLIED' : 'PENDING'}</span>
            </div>

            <div className="strategy-hero">
              <strong>{scene.strategyHeadline}</strong>
              <p>{!strategyEnabled ? '当前协同策略已关闭，建议项保留为决策推演参考。' : scene.strategySummary}</p>
            </div>

            <div className="strategy-list">
              {scene.recommendations.map((item) => (
                <article key={`${scene.id}-${item.target}`} className={planApplied ? 'strategy-item applied' : 'strategy-item'}>
                  <div className="strategy-item-head">
                    <strong>{item.target}</strong>
                    <span>{!strategyEnabled ? '已关闭' : planApplied ? '已执行' : '待执行'}</span>
                  </div>
                  <p>{item.action}</p>
                  <small>{item.reason}</small>
                  <em>{item.effect}</em>
                </article>
              ))}
            </div>

            <div className="strategy-footer">
              <span>{!strategyEnabled ? '策略关闭时仅展示静态推演建议。' : '基于研究成果的协同策略推演。'}</span>
              <button type="button" className={planApplied ? 'panel-action applied' : 'panel-action'} onClick={handleApplyPlan} disabled={!strategyAvailable}>
                {!strategyEnabled ? '策略已关闭' : planApplied ? '已应用方案' : '应用方案'}
              </button>
            </div>
          </section>

          <section className="frame panel-block feed-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Observation Feeds</p>
                <h2>监测终端</h2>
              </div>
              <span className="panel-code">CAM</span>
            </div>

            <div className="feed-stack">
              {feedViews.map((feed: FeedView) => {
                const alert = displayedAlerts.find((item) => item.grid === feed.grid)
                const style = { backgroundPosition: feed.position } satisfies CSSProperties
                const state = !strategyEnabled ? 'MANUAL' : planApplied && feed.grid === objectiveFocusGrid ? 'ADJUSTED' : feed.grid === objectiveFocusGrid ? 'TRACK' : 'SCAN'
                const subtitle = !strategyEnabled ? `${feed.subtitle} 协同策略当前关闭。` : planApplied && feed.grid === objectiveFocusGrid ? scene.appliedSummary : alert?.note ?? feed.subtitle

                return (
                  <article key={feed.tag} className={planApplied && feed.grid === objectiveFocusGrid ? 'feed-card active resolved' : feed.grid === objectiveFocusGrid ? 'feed-card active' : 'feed-card'} style={style}>
                    <div className="feed-overlay"></div>
                    <div className="feed-head">
                      <div className="feed-ident">
                        <span className="feed-tag">{feed.tag}</span>
                        <strong>{feed.title}</strong>
                      </div>
                      <span className={planApplied && feed.grid === objectiveFocusGrid ? 'feed-state applied' : 'feed-state'}>{state}</span>
                    </div>

                    <div className="feed-meta">
                      <span>{feed.area}</span>
                      <span>{feed.route}</span>
                      <span>{feed.grid}</span>
                    </div>

                    <p className="feed-subtitle">{subtitle}</p>

                    <div className="feed-foot">
                      <div className="feed-bars">
                        <i></i>
                        <i></i>
                        <i></i>
                      </div>
                      <small>{alert ? `${!strategyEnabled ? '静态' : feedRiskText(alert.level)}  ${alert.current} → ${alert.future}` : '持续监测中'}</small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="frame panel-block benefit-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">{activeResultTab === 'benefit' ? 'Benefit Comparison' : 'Model Benchmark'}</p>
                <h2>{activeResultTab === 'benefit' ? '方案收益对比' : '模型结果对比'}</h2>
              </div>
              <span className="panel-code">{activeResultTab === 'benefit' ? (planApplied ? 'APPLIED' : 'PREVIEW') : `${selectedModel} ${selectedHorizon}`}</span>
            </div>

            <div className="result-tabs">
              <button type="button" className={activeResultTab === 'benefit' ? 'result-tab active' : 'result-tab'} onClick={() => setActiveResultTab('benefit')}>
                收益对比
              </button>
              <button type="button" className={activeResultTab === 'model' ? 'result-tab active' : 'result-tab'} onClick={() => setActiveResultTab('model')}>
                模型结果
              </button>
            </div>

            {activeResultTab === 'benefit' ? (
              <>
                <div className="benefit-intro">
                  <strong>{!strategyEnabled ? '协同策略当前已关闭' : planApplied ? '协同策略已生效' : '等待应用协同方案'}</strong>
                  <p>{!strategyEnabled ? '当前收益卡显示静态推演口径，需重新启用策略后才能执行应用。' : '以下结果为基于研究成果的协同决策结果，用于展示应用方案后的收益变化。'}</p>
                </div>

                <div className="benefit-grid">
                  {scene.benefits.map((item) => (
                    <article key={`${scene.id}-${item.label}`} className={planApplied ? 'benefit-card applied' : 'benefit-card'}>
                      <span>{item.label}</span>
                      <div className="benefit-values">
                        <div className="benefit-value before">
                          <small>Before</small>
                          <strong>
                            {item.before}
                            {item.unit ? <em>{item.unit}</em> : null}
                          </strong>
                        </div>
                        <div className="benefit-arrow">→</div>
                        <div className="benefit-value after">
                          <small>After</small>
                          <strong>
                            {item.after}
                            {item.unit ? <em>{item.unit}</em> : null}
                          </strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="model-panel">
                <div className="model-toolbar">
                  <div className="segmented-group compact">
                    {(['1h', '2h', '3h'] as HorizonKey[]).map((horizon) => (
                      <button key={horizon} type="button" className={horizon === selectedHorizon ? 'segmented-button active' : 'segmented-button'} onClick={() => setSelectedHorizon(horizon)}>
                        {horizon}
                      </button>
                    ))}
                  </div>
                  <div className="segmented-group compact">
                    {(['STGCN', 'LSTM', 'BiLSTM'] as ModelName[]).map((model) => (
                      <button key={model} type="button" className={model === selectedModel ? 'segmented-button active' : 'segmented-button'} onClick={() => setSelectedModel(model)}>
                        {model}
                      </button>
                    ))}
                  </div>
                </div>

                <article className="model-hero">
                  <div className="model-hero-head">
                    <strong>{selectedModel}</strong>
                    <span>{selectedHorizon}</span>
                  </div>
                  <p>{currentBenchmark.summary}</p>
                </article>

                <div className="model-metric-grid">
                  <article className="model-metric-card">
                    <span>MAE</span>
                    <strong>{currentBenchmark.mae.toFixed(3)}</strong>
                  </article>
                  <article className="model-metric-card">
                    <span>RMSE</span>
                    <strong>{currentBenchmark.rmse.toFixed(3)}</strong>
                  </article>
                  <article className="model-metric-card">
                    <span>R²</span>
                    <strong>{currentBenchmark.r2.toFixed(3)}</strong>
                  </article>
                </div>

                <div className="model-compare-list">
                  {comparisonBenchmarks.map(([model, benchmark]) => (
                    <article key={`${selectedHorizon}-${model}`} className="model-compare-item">
                      <div className="model-compare-head">
                        <strong>{model}</strong>
                        <span>{selectedHorizon}</span>
                      </div>
                      <small>MAE {benchmark.mae.toFixed(3)} / RMSE {benchmark.rmse.toFixed(3)} / R² {benchmark.r2.toFixed(3)}</small>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
