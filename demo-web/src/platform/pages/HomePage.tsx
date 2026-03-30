import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { DashboardStatusScreen } from '../../dashboard/DashboardStatusScreen'
import {
  buildCalibrationStyle,
  CALIBRATION_LIMITS,
  DEFAULT_MAP_LAYER_CALIBRATION,
  DEFAULT_TRACK_LAYER_CALIBRATION,
  hasCustomLayerCalibration,
  persistMapCalibration,
  readPersistedMapCalibration,
  type MapLayerCalibration,
} from '../../mapCalibration'
import {
  DEFAULT_HOTSPOT_HIGH_THRESHOLD,
  geoToNumericPercent,
  geoToPercent,
  metricNumber,
} from '../../dashboard/dashboardUtils'
import { useDashboardRuntime } from '../../dashboard/useDashboardRuntime'
import { useDashboardScene } from '../../dashboard/useDashboardScene'
import {
  buildCorridorDominanceSummary,
  CLUSTERING_CORRIDOR_RUNTIME_PATH,
  formatSharePercent,
  type CorridorDominanceSummary,
} from '../clustering/corridorDominance.ts'
import { loadPublicJson } from '../../sharedContracts'
import type { MainCorridorTracksFile } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { OverviewSummary } from '../overview/overviewTypes.ts'
import { localizeOverviewSummary, localizeReadinessLabel } from '../zhCopy.ts'

type HomePageProps = {
  selectedDatasetId: string
  onNavigate: (routeId: ShellRouteId) => void
}

type EvaluationMetrics = {
  forecast?: {
    rankings?: Record<string, Record<string, Array<{ model: string; value: number; rank: number }>>>
  }
  repair?: {
    aggregateByModel?: Array<{ modelLabel: string; rmse: number; rankByRmse: number }>
  }
}

type HomePreviewCard = {
  routeId: ShellRouteId
  kicker: string
  title: string
  summary: string
  primaryLabel: string
  primaryValue: string
  secondaryLabel: string
  secondaryValue: string
  actionLabel: string
  stateLabel: string
}

const EMPTY_ROUTE_COUNTS: Record<string, number> = {}

export function HomePage({ selectedDatasetId, onNavigate }: HomePageProps) {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [planApplied, setPlanApplied] = useState(false)
  const [overviewSummary, setOverviewSummary] = useState<OverviewSummary | null>(null)
  const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null)
  const [corridorDominance, setCorridorDominance] = useState<CorridorDominanceSummary | null>(null)
  const [previewRoute, setPreviewRoute] = useState<ShellRouteId | null>(null)
  const [calibrationExpanded, setCalibrationExpanded] = useState(false)
  const [mapCalibration, setMapCalibration] = useState<MapLayerCalibration>(() => readPersistedMapCalibration().map)
  const [trackCalibration, setTrackCalibration] = useState<MapLayerCalibration>(() => readPersistedMapCalibration().tracks)

  const strategyEnabled = true

  const {
    aisPlayback,
    flowForecast,
    geometryConfig,
    datasetCatalog,
    selectedDataset,
    selectedDatasetLabel,
    dashboardUnavailableReason,
    dashboardLoading,
  } = useDashboardRuntime(selectedDatasetId)

  const {
    studyArea,
    mapTags,
    routeLabels,
    totalSceneCount,
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
    objectiveTotalFlow,
    objectiveNext1h,
    displayedStatus,
    hotspotScale,
    dialCards,
    strategyAvailable,
  } = useDashboardScene({
    aisPlayback,
    flowForecast,
    geometryConfig,
    sceneIndex,
    planApplied,
    strategyEnabled,
    routeCountsOverride: EMPTY_ROUTE_COUNTS,
    hotspotHighThreshold: DEFAULT_HOTSPOT_HIGH_THRESHOLD,
  })

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<OverviewSummary>('/data/modules/overview/overview-summary.json').catch(() => null),
      loadPublicJson<EvaluationMetrics>('/data/modules/evaluation/evaluation-metrics.json').catch(() => null),
      loadPublicJson<MainCorridorTracksFile>(CLUSTERING_CORRIDOR_RUNTIME_PATH).catch(() => null),
    ])
      .then(([overviewData, evaluationData, corridorRuntime]) => {
        if (cancelled) return
        setOverviewSummary(overviewData ? localizeOverviewSummary(overviewData) : null)
        setEvaluationMetrics(evaluationData)
        setCorridorDominance(corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!autoplay || totalSceneCount <= 1) return
    const timer = window.setInterval(() => {
      setSceneIndex((current) => (Math.min(current, totalSceneCount - 1) + 1) % totalSceneCount)
      setPlanApplied(false)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [autoplay, totalSceneCount])

  useEffect(() => {
    persistMapCalibration({ map: mapCalibration, tracks: trackCalibration })
  }, [mapCalibration, trackCalibration])

  const repairLeader = evaluationMetrics?.repair?.aggregateByModel?.slice().sort((left, right) => left.rankByRmse - right.rankByRmse)[0]
  const forecastLeader = evaluationMetrics?.forecast?.rankings?.['1h']?.rmse?.[0]
  const overviewBusinessLoop = overviewSummary?.businessLoop ?? []
  const overviewModuleEntryPoints = overviewSummary?.moduleEntryPoints ?? []
  const overviewScenarioEntryPoints = overviewSummary?.scenarioEntryPoints ?? []
  const overviewFramingPillars = overviewSummary?.framingPillars ?? []
  const forecastFrames = overviewSummary?.dataScale?.forecast?.timelineFrames ?? 0
  const repairSamples = overviewSummary?.dataScale?.repair?.sampleCount ?? 0
  const compressedTracks = overviewSummary?.dataScale?.clustering?.compressedTracks ?? 0
  const overviewSteps = overviewBusinessLoop.length || 5
  const readyOverviewEntries = overviewModuleEntryPoints.filter((item) => item.status === 'ready').length
  const forecastModelCount = overviewSummary?.dataScale?.forecast?.availableModels?.length ?? 1
  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null
  const forwardLookingEntry = overviewModuleEntryPoints.find((item) => item.routeId === 'forward-looking') ?? null
  const homeScenarioHighlights = overviewScenarioEntryPoints.filter((item) => item.routeId !== 'home').slice(0, 3)
  const framingLead = overviewFramingPillars[0] ?? null
  const framingSupport = overviewFramingPillars[2] ?? overviewFramingPillars[1] ?? null

  const previewCards: HomePreviewCard[] = [
    {
      routeId: 'overview',
      kicker: '项目总览',
      title: '总览',
      summary: overviewSummary?.framing ?? '归档 AIS 回放与离线推理共同构成一个连贯的演示闭环。',
      primaryLabel: '闭环步骤',
      primaryValue: String(overviewSteps),
      secondaryLabel: '已就绪模块',
      secondaryValue: String(readyOverviewEntries || 0),
      actionLabel: '查看详情',
      stateLabel: localizeReadinessLabel('ready'),
    },
    {
      routeId: 'forecast',
      kicker: '流量预测',
      title: '流量预测',
      summary: `当前场景有 ${displayedAlerts.length} 条热点告警生效，下一窗口预计总流量为 ${metricNumber(objectiveNext1h)}。`,
      primaryLabel: '当前总流量',
      primaryValue: metricNumber(objectiveTotalFlow),
      secondaryLabel: '可用模型数',
      secondaryValue: String(forecastModelCount),
      actionLabel: '查看详情',
      stateLabel: localizeReadinessLabel('ready'),
    },
    {
      routeId: 'repair',
      kicker: '轨迹修复',
      title: '轨迹修复',
      summary: `当前已上线 ${repairSamples} 个精选样本，${repairLeader?.modelLabel ?? 'ATT-BILSTM'} 暂时是 RMSE 最优模型。`,
      primaryLabel: '精选样本数',
      primaryValue: String(repairSamples),
      secondaryLabel: '最佳模型',
      secondaryValue: repairLeader?.modelLabel ?? 'ATT-BILSTM',
      actionLabel: '查看轨迹',
      stateLabel: localizeReadinessLabel('ready'),
    },
    {
      routeId: 'clustering',
      kicker: '轨迹聚类',
      title: '轨迹聚类',
      summary: corridorLeader
        ? `${corridorLeader.corridorId}（${corridorLeader.directionLabel}）已经成为重点通道结论，并会同步到总览与评估页。`
        : '聚类页展示从原始 AIS 到分段、压缩与重点通道提取的完整过程。',
      primaryLabel: '压缩轨迹数',
      primaryValue: String(compressedTracks),
      secondaryLabel: '主导 corridor',
      secondaryValue: corridorLeader?.corridorId ?? '--',
      actionLabel: '查看流水线',
      stateLabel: localizeReadinessLabel('ready'),
    },
    {
      routeId: 'evaluation',
      kicker: '评估中心',
      title: '评估中心',
      summary: corridorLeader
        ? `${forecastLeader?.model ?? 'STGCN'} 当前在 1h 预测排名中领先，${repairLeader?.modelLabel ?? 'ATT-BILSTM'} 在修复 RMSE 中领先，而 ${corridorLeader.corridorId} 提供了共享的 runtime 背景。`
        : `${forecastLeader?.model ?? 'STGCN'} 当前在 1h 预测排名中领先，${repairLeader?.modelLabel ?? 'ATT-BILSTM'} 在修复 RMSE 中领先。`,
      primaryLabel: '时间线帧数',
      primaryValue: String(forecastFrames),
      secondaryLabel: '预测领先模型',
      secondaryValue: forecastLeader?.model ?? 'STGCN',
      actionLabel: '对比结果',
      stateLabel: localizeReadinessLabel('ready'),
    },
    {
      routeId: 'forward-looking',
      kicker: '前瞻分析',
      title: '前瞻分析',
      summary:
        forwardLookingEntry?.summary ??
        '协同决策模块展示精选场景、策略建议与重点航路变化。',
      primaryLabel: forwardLookingEntry?.primaryMetric.label ?? '状态',
      primaryValue: forwardLookingEntry?.primaryMetric.value ?? '精选场景',
      secondaryLabel: forwardLookingEntry?.secondaryMetric.label ?? '当前阶段',
      secondaryValue: forwardLookingEntry?.secondaryMetric.value ?? '策略分析',
      actionLabel: forwardLookingEntry ? '打开分析' : '查看状态',
      stateLabel: forwardLookingEntry ? localizeReadinessLabel(forwardLookingEntry.status) : '精选场景',
    },
  ]

  const hoveredPreview = previewCards.find((card) => card.routeId === previewRoute) ?? null
  const overviewCard = previewCards[0]
  const leftCards = previewCards.slice(1, 3)
  const rightCards = previewCards.slice(3)
  const mapLayerStyle = buildCalibrationStyle(mapCalibration, 0.92)
  const geoLayerStyle = buildCalibrationStyle(trackCalibration)
  const mapCalibrationActive = hasCustomLayerCalibration(mapCalibration, DEFAULT_MAP_LAYER_CALIBRATION)
  const trackCalibrationActive = hasCustomLayerCalibration(trackCalibration, DEFAULT_TRACK_LAYER_CALIBRATION)
  const calibrationStateLabel = mapCalibrationActive || trackCalibrationActive ? '已微调' : '默认'

  function updateCalibrationLayer(
    target: 'map' | 'tracks',
    field: keyof MapLayerCalibration,
    value: number,
  ) {
    if (target === 'map') {
      setMapCalibration((current) => ({ ...current, [field]: value }))
      return
    }
    setTrackCalibration((current) => ({ ...current, [field]: value }))
  }

  function resetCalibrationLayer(target: 'map' | 'tracks') {
    if (target === 'map') {
      setMapCalibration({ ...DEFAULT_MAP_LAYER_CALIBRATION })
      return
    }
    setTrackCalibration({ ...DEFAULT_TRACK_LAYER_CALIBRATION })
  }

  function resetAllCalibration() {
    setMapCalibration({ ...DEFAULT_MAP_LAYER_CALIBRATION })
    setTrackCalibration({ ...DEFAULT_TRACK_LAYER_CALIBRATION })
  }

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

  if (dashboardUnavailableReason || dashboardLoading) {
    return (
      <DashboardStatusScreen
        selectedDatasetLabel={selectedDatasetLabel}
        selectedDataset={selectedDataset}
        datasetCatalog={datasetCatalog}
        geometryConfig={geometryConfig}
        aisPlayback={aisPlayback}
        flowForecast={flowForecast}
        dashboardUnavailableReason={dashboardUnavailableReason}
      />
    )
  }

  return (
    <section className="console-layout home-console-layout">
      <aside className="left-rail home-module-rail home-left-rail">
        <section
          className={previewRoute === overviewCard.routeId ? 'frame panel-block home-module-card home-feature-card active' : 'frame panel-block home-module-card home-feature-card'}
          onMouseEnter={() => setPreviewRoute(overviewCard.routeId)}
          onMouseLeave={() => setPreviewRoute(null)}
        >
          <div className="panel-title">
            <div>
              <p className="panel-kicker">{overviewCard.kicker}</p>
              <h2>{overviewCard.title}</h2>
            </div>
            <span className="panel-code">{overviewCard.stateLabel}</span>
          </div>

          <p className="home-module-summary">{overviewCard.summary}</p>

          <div className="home-module-metrics">
            <article>
              <span>{overviewCard.primaryLabel}</span>
              <strong>{overviewCard.primaryValue}</strong>
            </article>
            <article>
              <span>{overviewCard.secondaryLabel}</span>
              <strong>{overviewCard.secondaryValue}</strong>
            </article>
          </div>

          <div className="home-feature-actions">
            <button type="button" className="panel-action" onClick={() => onNavigate(overviewCard.routeId)}>
              {overviewCard.actionLabel}
            </button>
            <button type="button" className="panel-action subtle" onClick={() => setCalibrationExpanded((current) => !current)}>
              {calibrationExpanded ? '收起校准' : '打开校准'}
            </button>
          </div>
        </section>

        <div className="home-secondary-stack">
          {leftCards.map((card) => (
            <section
              key={card.routeId}
              className={previewRoute === card.routeId ? 'frame panel-block home-module-card compact active' : 'frame panel-block home-module-card compact'}
              onMouseEnter={() => setPreviewRoute(card.routeId)}
              onMouseLeave={() => setPreviewRoute(null)}
            >
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">{card.kicker}</p>
                  <h2>{card.title}</h2>
                </div>
                <span className="panel-code">{card.stateLabel}</span>
              </div>

              <p className="home-module-summary">{card.summary}</p>

              <div className="home-module-metrics">
                <article>
                  <span>{card.primaryLabel}</span>
                  <strong>{card.primaryValue}</strong>
                </article>
                <article>
                  <span>{card.secondaryLabel}</span>
                  <strong>{card.secondaryValue}</strong>
                </article>
              </div>

              <button type="button" className="panel-action" onClick={() => onNavigate(card.routeId)}>
                {card.actionLabel}
              </button>
            </section>
          ))}
        </div>

        <section className="frame panel-block home-calibration-card">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">轨迹 / 底图校准</p>
              <h2>直接调整首页主图叠图</h2>
            </div>
            <span className="panel-code">{calibrationStateLabel}</span>
          </div>

          <p className="home-module-summary">
            如果轨迹和背景图没有贴齐，可以直接在这里调整底图层与轨迹层。参数会保存在当前浏览器，并被 RouteEditor 继续复用。
          </p>

          <div className="home-calibration-badges">
            <span className={mapCalibrationActive ? 'home-calibration-badge active' : 'home-calibration-badge'}>底图 {mapCalibration.scale.toFixed(2)}x</span>
            <span className={trackCalibrationActive ? 'home-calibration-badge active' : 'home-calibration-badge'}>轨迹 {trackCalibration.scale.toFixed(2)}x</span>
          </div>

          <div className="home-calibration-actions">
            <button type="button" className="panel-action" onClick={() => setCalibrationExpanded((current) => !current)}>
              {calibrationExpanded ? '收起校准面板' : '打开校准面板'}
            </button>
            <a className="panel-action subtle home-calibration-link" href="/route-editor.html" target="_blank" rel="noreferrer">
              打开 RouteEditor
            </a>
          </div>

          {calibrationExpanded ? (
            <>
              <div className="home-calibration-grid">
                <label className="home-calibration-field">
                  <span>底图缩放</span>
                  <strong>{mapCalibration.scale.toFixed(2)}x</strong>
                  <input type="range" min={CALIBRATION_LIMITS.scale.min} max={CALIBRATION_LIMITS.scale.max} step={CALIBRATION_LIMITS.scale.step} value={mapCalibration.scale} onChange={(event) => updateCalibrationLayer('map', 'scale', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>底图透明度</span>
                  <strong>{Math.round(mapCalibration.opacity * 100)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.opacity.min} max={CALIBRATION_LIMITS.opacity.max} step={CALIBRATION_LIMITS.opacity.step} value={mapCalibration.opacity} onChange={(event) => updateCalibrationLayer('map', 'opacity', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>底图 X 偏移</span>
                  <strong>{mapCalibration.offsetX.toFixed(1)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.offset.min} max={CALIBRATION_LIMITS.offset.max} step={CALIBRATION_LIMITS.offset.step} value={mapCalibration.offsetX} onChange={(event) => updateCalibrationLayer('map', 'offsetX', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>底图 Y 偏移</span>
                  <strong>{mapCalibration.offsetY.toFixed(1)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.offset.min} max={CALIBRATION_LIMITS.offset.max} step={CALIBRATION_LIMITS.offset.step} value={mapCalibration.offsetY} onChange={(event) => updateCalibrationLayer('map', 'offsetY', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>底图亮度</span>
                  <strong>{mapCalibration.brightness.toFixed(2)}</strong>
                  <input type="range" min={CALIBRATION_LIMITS.brightness.min} max={CALIBRATION_LIMITS.brightness.max} step={CALIBRATION_LIMITS.brightness.step} value={mapCalibration.brightness} onChange={(event) => updateCalibrationLayer('map', 'brightness', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>轨迹缩放</span>
                  <strong>{trackCalibration.scale.toFixed(2)}x</strong>
                  <input type="range" min={CALIBRATION_LIMITS.scale.min} max={CALIBRATION_LIMITS.scale.max} step={CALIBRATION_LIMITS.scale.step} value={trackCalibration.scale} onChange={(event) => updateCalibrationLayer('tracks', 'scale', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>轨迹透明度</span>
                  <strong>{Math.round(trackCalibration.opacity * 100)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.opacity.min} max={CALIBRATION_LIMITS.opacity.max} step={CALIBRATION_LIMITS.opacity.step} value={trackCalibration.opacity} onChange={(event) => updateCalibrationLayer('tracks', 'opacity', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>轨迹 X 偏移</span>
                  <strong>{trackCalibration.offsetX.toFixed(1)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.offset.min} max={CALIBRATION_LIMITS.offset.max} step={CALIBRATION_LIMITS.offset.step} value={trackCalibration.offsetX} onChange={(event) => updateCalibrationLayer('tracks', 'offsetX', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>轨迹 Y 偏移</span>
                  <strong>{trackCalibration.offsetY.toFixed(1)}%</strong>
                  <input type="range" min={CALIBRATION_LIMITS.offset.min} max={CALIBRATION_LIMITS.offset.max} step={CALIBRATION_LIMITS.offset.step} value={trackCalibration.offsetY} onChange={(event) => updateCalibrationLayer('tracks', 'offsetY', Number(event.target.value))} />
                </label>
                <label className="home-calibration-field">
                  <span>轨迹亮度</span>
                  <strong>{trackCalibration.brightness.toFixed(2)}</strong>
                  <input type="range" min={CALIBRATION_LIMITS.brightness.min} max={CALIBRATION_LIMITS.brightness.max} step={CALIBRATION_LIMITS.brightness.step} value={trackCalibration.brightness} onChange={(event) => updateCalibrationLayer('tracks', 'brightness', Number(event.target.value))} />
                </label>
              </div>

              <div className="home-calibration-footer">
                <button type="button" className="panel-action subtle" onClick={() => resetCalibrationLayer('map')}>
                  重置底图
                </button>
                <button type="button" className="panel-action subtle" onClick={() => resetCalibrationLayer('tracks')}>
                  重置轨迹
                </button>
                <button type="button" className="panel-action subtle" onClick={resetAllCalibration}>
                  全部重置
                </button>
              </div>
            </>
          ) : null}
        </section>
      </aside>

      <section className="map-column">
        <section className="frame map-frame">
          <div className="map-stage home-map-stage">
            <div className="home-map-layer" style={mapLayerStyle}>
              <img src="/static-port-map.jpg" alt="静态港口底图" className="map-image" />
            </div>
            <div className="map-grid"></div>

            <div className="map-panel-title">
              <div>
                <p className="panel-kicker">指挥中枢</p>
                <h2>归档 AIS 交通场景与模块入口舞台</h2>
              </div>
              <span className="panel-code">{hoveredPreview?.title ?? scene.phase}</span>
            </div>

            <div className="map-hud map-hud-left">
              <span>场景焦点</span>
              <strong>{selectedDatasetLabel}</strong>
              <strong>{hoveredPreview?.summary ?? (planApplied ? scene.appliedSummary : scene.summary)}</strong>
            </div>

            <div className="map-right-rail">
              <div className="map-hud focus-card">
                <div className="focus-card-head">
                  <span className="focus-card-label">当前焦点</span>
                  <span className={!strategyEnabled ? 'focus-card-state disabled' : planApplied ? 'focus-card-state applied' : 'focus-card-state'}>
                    {!strategyEnabled ? '策略关闭' : planApplied ? '已应用' : '预览'}
                  </span>
                </div>
                <div className="focus-card-tags">
                  <strong>{objectiveFocusGrid}</strong>
                  <strong>{focusRoute}</strong>
                  <strong>{focusFeed.tag}</strong>
                </div>
                <div className="focus-card-metric">
                  <small>当前到下一步</small>
                  <strong>
                    {focusAlert.current} <span>-&gt;</span> {focusAlert.future}
                  </strong>
                </div>
                <p className="focus-card-summary">{planApplied ? scene.appliedSummary : scene.strategySummary}</p>
                <button type="button" className={planApplied ? 'focus-card-action applied' : 'focus-card-action'} onClick={handleApplyPlan} disabled={!strategyAvailable}>
                  {planApplied ? '方案已应用' : '应用方案'}
                </button>
              </div>

              <div className="map-control-stack">
                <div className="map-control-card">
                  <span>当前状态</span>
                  <strong>{displayedStatus}</strong>
                  <small>{scene.phase}</small>
                </div>
                <div className="map-control-card">
                  <span>1h 预测</span>
                  <strong>{metricNumber(objectiveNext1h)}</strong>
                  <small>
                    变化 {objectiveNext1h - objectiveTotalFlow > 0 ? '+' : ''}
                    {objectiveNext1h - objectiveTotalFlow}
                  </small>
                </div>
                <div className="map-control-card corridor-dominance-card">
                  <span>Corridor dominance</span>
                  <strong>{corridorLeader ? `${corridorLeader.corridorId} ${formatSharePercent(corridorLeader.share)}` : '加载中'}</strong>
                  <small>
                    {corridorLeader && leadingDirection
                      ? `${leadingDirection.directionLabel} 方向流量承载了 ${formatSharePercent(leadingDirection.share)} 的 runtime 轨迹，前三条 corridor 合计覆盖 ${formatSharePercent(corridorDominance?.topThreeShare ?? 0)}。`
                        : '正在加载聚类 runtime 主线，以支撑跨模块叙事。'}
                  </small>
                </div>
                <div className="map-control-card home-storyline-card">
                  <span>离线展示 framing</span>
                  <strong>{framingLead?.title ?? '归档回放就是场景时钟'}</strong>
                  <small>{framingSupport?.detail ?? overviewSummary?.framing ?? '网站呈现的是归档 AIS 回放与离线计算证据，而不是实时 AIS 后端。'}</small>
                  {homeScenarioHighlights.length ? (
                    <div className="home-entry-chip-row">
                      {homeScenarioHighlights.map((item) => (
                        <button key={item.id} type="button" className="home-entry-chip" onClick={() => onNavigate(item.routeId)}>
                          {item.signal}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="map-button-grid home-map-actions">
                  <button type="button" onClick={() => onNavigate('overview')}>
                    总览
                  </button>
                  <button type="button" onClick={() => onNavigate('forecast')}>
                    预测
                  </button>
                  <button type="button" onClick={() => onNavigate('repair')}>
                    修复
                  </button>
                  <button type="button" onClick={() => onNavigate('evaluation')}>
                    评估
                  </button>
                </div>
              </div>
            </div>

            <div className="home-geo-layer" style={geoLayerStyle}>
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
            </div>

            <div className="map-bottom-strip">
              <div className="map-bottom-summary">
                <span>预览摘要</span>
                <strong>{hoveredPreview?.summary ?? (planApplied ? scene.appliedSummary : scene.summary)}</strong>
              </div>

              <div className="map-bottom-focus">
                <span>{focusFeed.tag}</span>
                <span>{focusRoute}</span>
                <span>
                  {objectiveFocusGrid} {focusAlert.current}
                </span>
                <button type="button" className="panel-action subtle" onClick={handleAutoplayToggle}>
                  {autoplay ? '暂停回放' : '继续回放'}
                </button>
              </div>

              <div className="map-bottom-timeline">
                <div className="map-bottom-timeline-head">
                  <div>
                    <span>观测窗口</span>
                    <strong>{playbackWindowRangeLabel}</strong>
                  </div>
                  <div>
                    <span>当前帧</span>
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
                  <span>{playbackFrame?.activeVesselCount ?? 0} 艘可见船舶</span>
                  <span>{metricNumber(dialCards[0]?.value ?? objectiveTotalFlow)} 当前流量</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <aside className="right-rail home-module-rail home-right-rail">
        {rightCards.map((card) => (
          <section
            key={card.routeId}
            className={previewRoute === card.routeId ? 'frame panel-block home-module-card active' : 'frame panel-block home-module-card'}
            onMouseEnter={() => setPreviewRoute(card.routeId)}
            onMouseLeave={() => setPreviewRoute(null)}
          >
            <div className="panel-title">
              <div>
                <p className="panel-kicker">{card.kicker}</p>
                <h2>{card.title}</h2>
              </div>
              <span className="panel-code">{card.stateLabel}</span>
            </div>

            <p className="home-module-summary">{card.summary}</p>

            <div className="home-module-metrics">
              <article>
                <span>{card.primaryLabel}</span>
                <strong>{card.primaryValue}</strong>
              </article>
              <article>
                <span>{card.secondaryLabel}</span>
                <strong>{card.secondaryValue}</strong>
              </article>
            </div>

            <button type="button" className="panel-action" onClick={() => onNavigate(card.routeId)}>
              {card.actionLabel}
            </button>
          </section>
        ))}
      </aside>
    </section>
  )
}
