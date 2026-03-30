import { useMemo } from 'react'
import { feedViews, mapTagDefinitions } from '../scenarioPacks'
import type { FlowForecastData, GeometryConfig, MapTag, PlaybackTrack, PlaybackTrackPoint, PlaybackVessel, RouteLabel } from '../sharedContracts'
import type { AisPlaybackData, ForecastAlert } from '../sharedContracts'
import {
  buildTimelineMoments,
  classifyLevel,
  createAreaPath,
  createLinePath,
  createSmoothGeoPath,
  DEFAULT_ROUTE_COUNTS,
  DEFAULT_ROUTE_IDS,
  EMPTY_FORECAST_TIMELINE,
  EMPTY_PLAYBACK_FRAMES,
  formatTimelineStamp,
  geoDistanceMeters,
  geoToPercent,
  type HeaderBlock,
  type Hotspot,
  STUDY_BOUNDS,
} from './dashboardUtils'

type UseDashboardSceneArgs = {
  aisPlayback: AisPlaybackData | null
  flowForecast: FlowForecastData | null
  geometryConfig: GeometryConfig | null
  sceneIndex: number
  planApplied: boolean
  strategyEnabled: boolean
  routeCountsOverride: Record<string, number>
  hotspotHighThreshold: number
}

export function useDashboardScene({
  aisPlayback,
  flowForecast,
  geometryConfig,
  sceneIndex,
  planApplied,
  strategyEnabled,
  routeCountsOverride,
  hotspotHighThreshold,
}: UseDashboardSceneArgs) {
  const studyArea = geometryConfig?.meta.studyArea ?? aisPlayback?.meta.studyArea ?? STUDY_BOUNDS
  const routeIds = geometryConfig?.meta.routeOrder ?? aisPlayback?.meta.routeIds ?? DEFAULT_ROUTE_IDS

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
    timelineMoments.reduce<typeof timelineMoments[number] | null>((closest, item) => {
      if (!closest) return item
      return Math.abs(item.frameIndex - safeSceneIndex) < Math.abs(closest.frameIndex - safeSceneIndex) ? item : closest
    }, null)?.id ?? ''

  const playbackWindowStart = playbackFrames[0]?.bucketTime ?? activeScenes[0]?.time ?? ''
  const playbackWindowEnd = playbackFrames[playbackFrames.length - 1]?.bucketTime ?? activeScenes[activeScenes.length - 1]?.time ?? ''
  const playbackWindowRangeLabel =
    playbackWindowStart && playbackWindowEnd ? `${formatTimelineStamp(playbackWindowStart)} -> ${formatTimelineStamp(playbackWindowEnd)}` : '观测窗口不可用'
  const playbackFrameLabel = playbackFrame ? formatTimelineStamp(playbackFrame.bucketTime) : scene.time
  const playbackFrameMeta = totalSceneCount
    ? `第 ${Math.min(safeSceneIndex + 1, totalSceneCount)} / ${totalSceneCount} 帧，每步 ${aisPlayback?.meta.bucketMinutes ?? 5} 分钟`
    : '暂无回放帧'

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
    displayedAlerts[0] ?? { grid: '--', level: 'watch' as const, current: 0, future: 0, note: '' }

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
    { label: '下一窗口', value: objectiveNext1h, percent: Math.min(objectiveNext1h / 2200, 1) },
    { label: '热点网格', value: displayedHotspotCount, percent: Math.min(displayedHotspotCount / 5, 1) },
    { label: '展示船舶', value: currentVisibleVessels, percent: Math.min(currentVisibleVessels / 28, 1) },
  ]

  const strategyAvailable = strategyEnabled && !planApplied

  return {
    studyArea,
    routeIds,
    mapTags,
    routeLabels,
    activeScenes,
    totalSceneCount,
    sceneTemplateIndex,
    scene,
    playbackFrame,
    timelineMoments,
    activeTimelineMomentId,
    playbackWindowRangeLabel,
    playbackFrameLabel,
    playbackFrameMeta,
    displayedPlaybackTracks,
    visibleTrackMarkers,
    activeTrackIds,
    hotspots,
    objectiveFocusGrid,
    displayedAlerts,
    focusFeed,
    focusRoute,
    focusAlert,
    totalFlowSeries,
    flowTicks,
    flowMin,
    flowMax,
    flowPath,
    flowArea,
    objectiveTotalFlow,
    objectiveNext1h,
    displayedHotspotCount,
    displayedStatus,
    hotspotScale,
    liveDisplayTime,
    liveDisplayDate,
    playbackWindowMinutes,
    studyAreaLongitudeLabel,
    studyAreaLatitudeLabel,
    headerLeftBlocks,
    headerRightBlocks,
    dialCards,
    strategyAvailable,
  }
}
