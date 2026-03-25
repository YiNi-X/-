import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { DashboardStatusScreen } from '../../dashboard/DashboardStatusScreen'
import {
  DEFAULT_HOTSPOT_HIGH_THRESHOLD,
  geoToNumericPercent,
  geoToPercent,
  metricNumber,
} from '../../dashboard/dashboardUtils'
import { useDashboardRuntime } from '../../dashboard/useDashboardRuntime'
import { useDashboardScene } from '../../dashboard/useDashboardScene'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'

type HomePageProps = {
  selectedDatasetId: string
  onNavigate: (routeId: ShellRouteId) => void
}

type OverviewSummary = {
  framing: string
  businessLoop: Array<{ step: string; description: string }>
  dataScale?: {
    forecast?: {
      timelineFrames: number
      availableModels: string[]
      deferredModels: string[]
      horizons: string[]
    }
    repair?: {
      sampleCount: number
      availableModels: string[]
    }
    clustering?: {
      compressedTracks: number
      corridorRuntimeCorridors: number
      rawAisRows: number
    }
  }
  deferredModules?: Array<{ module: string; reason: string }>
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
  const [previewRoute, setPreviewRoute] = useState<ShellRouteId | null>(null)

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
      loadPublicJson<OverviewSummary>('/data/modules/overview/overview-summary.json'),
      loadPublicJson<EvaluationMetrics>('/data/modules/evaluation/evaluation-metrics.json'),
    ])
      .then(([overviewData, evaluationData]) => {
        if (cancelled) return
        setOverviewSummary(overviewData)
        setEvaluationMetrics(evaluationData)
      })
      .catch(() => {
        if (cancelled) return
        setOverviewSummary(null)
        setEvaluationMetrics(null)
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

  const repairLeader = evaluationMetrics?.repair?.aggregateByModel?.slice().sort((left, right) => left.rankByRmse - right.rankByRmse)[0]
  const forecastLeader = evaluationMetrics?.forecast?.rankings?.['1h']?.rmse?.[0]
  const deferredForwardLooking = overviewSummary?.deferredModules?.[0]
  const forecastFrames = overviewSummary?.dataScale?.forecast?.timelineFrames ?? 0
  const repairSamples = overviewSummary?.dataScale?.repair?.sampleCount ?? 0
  const compressedTracks = overviewSummary?.dataScale?.clustering?.compressedTracks ?? 0
  const corridorCount = overviewSummary?.dataScale?.clustering?.corridorRuntimeCorridors ?? 0
  const overviewSteps = overviewSummary?.businessLoop.length ?? 5
  const forecastDeferred = overviewSummary?.dataScale?.forecast?.deferredModels?.length ?? 2

  const previewCards: HomePreviewCard[] = [
    {
      routeId: 'overview',
      kicker: 'Project Overview',
      title: 'Overview',
      summary: overviewSummary?.framing ?? 'Archived AIS playback and offline inference form one coherent demo loop.',
      primaryLabel: 'Loop steps',
      primaryValue: String(overviewSteps),
      secondaryLabel: 'Data-ready modules',
      secondaryValue: String(overviewSummary?.businessLoop ? 4 : 0),
      actionLabel: 'View Details',
      stateLabel: 'Ready',
    },
    {
      routeId: 'forecast',
      kicker: 'Flow Prediction',
      title: 'Flow Prediction',
      summary: `${displayedAlerts.length} hotspot alerts are active in the current scene and the next window projects ${metricNumber(objectiveNext1h)} total flow.`,
      primaryLabel: 'Current total flow',
      primaryValue: metricNumber(objectiveTotalFlow),
      secondaryLabel: 'Deferred models',
      secondaryValue: String(forecastDeferred),
      actionLabel: 'View Details',
      stateLabel: 'Ready',
    },
    {
      routeId: 'repair',
      kicker: 'Trajectory Repair',
      title: 'Trajectory Repair',
      summary: `${repairSamples} curated samples are available and ${repairLeader?.modelLabel ?? 'ATT-BILSTM'} is currently the best RMSE performer.`,
      primaryLabel: 'Curated samples',
      primaryValue: String(repairSamples),
      secondaryLabel: 'Best model',
      secondaryValue: repairLeader?.modelLabel ?? 'ATT-BILSTM',
      actionLabel: 'View Trajectory',
      stateLabel: 'Ready',
    },
    {
      routeId: 'clustering',
      kicker: 'Trajectory Clustering',
      title: 'Trajectory Clustering',
      summary: 'The clustering story moves from raw AIS to segmented, compressed, and corridor-ready layers without forcing the research-only noise stage.',
      primaryLabel: 'Compressed tracks',
      primaryValue: String(compressedTracks),
      secondaryLabel: 'Runtime corridors',
      secondaryValue: String(corridorCount),
      actionLabel: 'View Pipeline',
      stateLabel: 'Ready',
    },
    {
      routeId: 'evaluation',
      kicker: 'Evaluation Center',
      title: 'Evaluation Center',
      summary: `${forecastLeader?.model ?? 'STGCN'} leads the 1h forecast ranking while ${repairLeader?.modelLabel ?? 'ATT-BILSTM'} leads repair RMSE.`,
      primaryLabel: 'Timeline frames',
      primaryValue: String(forecastFrames),
      secondaryLabel: 'Top forecast model',
      secondaryValue: forecastLeader?.model ?? 'STGCN',
      actionLabel: 'Compare Results',
      stateLabel: 'Ready',
    },
    {
      routeId: 'forward-looking',
      kicker: 'Forward-Looking Analysis',
      title: 'Forward-Looking Analysis',
      summary: deferredForwardLooking?.reason ?? 'Collaborative decision evidence remains intentionally deferred until a later update.',
      primaryLabel: 'Status',
      primaryValue: 'Later update',
      secondaryLabel: 'Current phase',
      secondaryValue: 'Reserved',
      actionLabel: 'See Status',
      stateLabel: 'Deferred',
    },
  ]

  const hoveredPreview = previewCards.find((card) => card.routeId === previewRoute) ?? null
  const leftCards = previewCards.slice(0, 3)
  const rightCards = previewCards.slice(3)

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
      <aside className="left-rail home-module-rail">
        {leftCards.map((card) => (
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

      <section className="map-column">
        <section className="frame map-frame">
          <div className="map-stage">
            <img src="/static-port-map.jpg" alt="Static estuary basemap" className="map-image" />
            <div className="map-grid"></div>

            <div className="map-panel-title">
              <div>
                <p className="panel-kicker">Command Center</p>
                <h2>Archived AIS traffic scene and module entry stage</h2>
              </div>
              <span className="panel-code">{hoveredPreview?.title ?? scene.phase}</span>
            </div>

            <div className="map-hud map-hud-left">
              <span>Scene Focus</span>
              <strong>{selectedDatasetLabel}</strong>
              <strong>{hoveredPreview?.summary ?? (planApplied ? scene.appliedSummary : scene.summary)}</strong>
            </div>

            <div className="map-right-rail">
              <div className="map-hud focus-card">
                <div className="focus-card-head">
                  <span className="focus-card-label">Current focus</span>
                  <span className={!strategyEnabled ? 'focus-card-state disabled' : planApplied ? 'focus-card-state applied' : 'focus-card-state'}>
                    {!strategyEnabled ? 'strategy off' : planApplied ? 'applied' : 'preview'}
                  </span>
                </div>
                <div className="focus-card-tags">
                  <strong>{objectiveFocusGrid}</strong>
                  <strong>{focusRoute}</strong>
                  <strong>{focusFeed.tag}</strong>
                </div>
                <div className="focus-card-metric">
                  <small>Current to next</small>
                  <strong>
                    {focusAlert.current} <span>-&gt;</span> {focusAlert.future}
                  </strong>
                </div>
                <p className="focus-card-summary">{planApplied ? scene.appliedSummary : scene.strategySummary}</p>
                <button type="button" className={planApplied ? 'focus-card-action applied' : 'focus-card-action'} onClick={handleApplyPlan} disabled={!strategyAvailable}>
                  {planApplied ? 'Plan applied' : 'Apply plan'}
                </button>
              </div>

              <div className="map-control-stack">
                <div className="map-control-card">
                  <span>Current status</span>
                  <strong>{displayedStatus}</strong>
                  <small>{scene.phase}</small>
                </div>
                <div className="map-control-card">
                  <span>1h projection</span>
                  <strong>{metricNumber(objectiveNext1h)}</strong>
                  <small>
                    Delta {objectiveNext1h - objectiveTotalFlow > 0 ? '+' : ''}
                    {objectiveNext1h - objectiveTotalFlow}
                  </small>
                </div>
                <div className="map-button-grid home-map-actions">
                  <button type="button" onClick={() => onNavigate('overview')}>
                    Overview
                  </button>
                  <button type="button" onClick={() => onNavigate('forecast')}>
                    Forecast
                  </button>
                  <button type="button" onClick={() => onNavigate('repair')}>
                    Repair
                  </button>
                  <button type="button" onClick={() => onNavigate('evaluation')}>
                    Evaluation
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
                <span>Preview summary</span>
                <strong>{hoveredPreview?.summary ?? (planApplied ? scene.appliedSummary : scene.summary)}</strong>
              </div>

              <div className="map-bottom-focus">
                <span>{focusFeed.tag}</span>
                <span>{focusRoute}</span>
                <span>
                  {objectiveFocusGrid} {focusAlert.current}
                </span>
                <button type="button" className="panel-action subtle" onClick={handleAutoplayToggle}>
                  {autoplay ? 'Pause replay' : 'Resume replay'}
                </button>
              </div>

              <div className="map-bottom-timeline">
                <div className="map-bottom-timeline-head">
                  <div>
                    <span>Observed window</span>
                    <strong>{playbackWindowRangeLabel}</strong>
                  </div>
                  <div>
                    <span>Current frame</span>
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
                  <span>{metricNumber(dialCards[0]?.value ?? objectiveTotalFlow)} current flow</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <aside className="right-rail home-module-rail">
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
