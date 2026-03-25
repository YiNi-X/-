import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { BenchmarkEntry, FeedView } from './scenarioPacks'
import { feedViews, modelBenchmarkMatrix } from './scenarioPacks'
import { formatDatasetPath } from './datasetCatalog'
import { DashboardStatusScreen } from './dashboard/DashboardStatusScreen'
import {
  CHART_HEIGHT,
  CHART_PAD_X,
  CHART_PAD_Y,
  CHART_WIDTH,
  clampCount,
  DEFAULT_HOTSPOT_HIGH_THRESHOLD,
  DEFAULT_ROUTE_COUNTS,
  feedRiskText,
  geoToNumericPercent,
  geoToPercent,
  levelText,
  metricNumber,
  PLAYBACK_SPEEDS,
  TITLE_TAGS,
} from './dashboard/dashboardUtils'
import { useDashboardRuntime } from './dashboard/useDashboardRuntime'
import { useDashboardScene } from './dashboard/useDashboardScene'
import type { HorizonKey, ModelName, ResultTab } from './sharedContracts'
import './App.css'

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

  const {
    aisPlayback,
    flowForecast,
    geometryConfig,
    datasetCatalog,
    selectedDataset,
    selectedDatasetLabel,
    availableDatasets,
    runtimeLoadError,
    dashboardUnavailableReason,
    dashboardLoading,
    selectDataset,
  } = useDashboardRuntime()

  const mediumHotspotThreshold = Math.max(hotspotHighThreshold - 0.2, 0.1)

  const {
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
    displayedStatus,
    hotspotScale,
    studyAreaLongitudeLabel,
    studyAreaLatitudeLabel,
    headerLeftBlocks,
    headerRightBlocks,
    dialCards,
    strategyAvailable,
  } = useDashboardScene({
    aisPlayback,
    flowForecast,
    geometryConfig,
    sceneIndex,
    planApplied,
    strategyEnabled,
    routeCountsOverride,
    hotspotHighThreshold,
  })

  useEffect(() => {
    if (!autoplay || totalSceneCount <= 1) return
    const timer = window.setInterval(() => {
      setSceneIndex((current) => (Math.min(current, totalSceneCount - 1) + 1) % totalSceneCount)
      setPlanApplied(false)
    }, playbackSpeed)
    return () => window.clearInterval(timer)
  }, [autoplay, playbackSpeed, totalSceneCount])

  const currentBenchmark = modelBenchmarkMatrix[selectedHorizon][selectedModel]
  const comparisonBenchmarks = (Object.entries(modelBenchmarkMatrix[selectedHorizon]) as [ModelName, BenchmarkEntry][]).filter(
    ([model]) => model !== selectedModel,
  )

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
    selectDataset(nextDatasetId)
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
              'Vessel tracks come from archived AIS playback, and forecast panels come from offline model output. This page remains a presentation workspace rather than a live operations system.'}
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
            <span>{selectedDatasetLabel}</span>
          </div>
          <label className="drawer-field">
            <span>Dataset</span>
            <select value={selectedDataset?.id ?? ''} onChange={(event) => handleDatasetChange(event.target.value)}>
              {availableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="control-note">{selectedDataset?.description || 'Switch datasets from the shared catalog or open the page with ?dataset=<id>.'}</p>
          <p className="control-paths">
            AIS {formatDatasetPath(selectedDataset?.aisPlaybackPath)}
            <br />
            Forecast {formatDatasetPath(selectedDataset?.flowForecastPath)}
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
            <span>高压 &gt;= {(hotspotHighThreshold * 100).toFixed(0)} / 中压 &gt;= {(mediumHotspotThreshold * 100).toFixed(0)}</span>
          </div>
          <input className="threshold-slider" type="range" min="0.45" max="0.85" step="0.05" value={hotspotHighThreshold} onChange={(event) => setHotspotHighThreshold(Number(event.target.value))} />
        </div>

        <div className="control-section">
          <div className="control-section-head">
            <strong>鍥炴斁閫熷害</strong>
            <span>{playbackSpeed}ms / 鑺傜偣</span>
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
            {strategyEnabled ? '鍚敤鍗忓悓绛栫暐' : '閲嶆柊鍚敤绛栫暐'}
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
                <h2>杩愯鎬佸娍</h2>
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
                <h2>閲嶇偣缃戞牸</h2>
              </div>
              <span className="panel-code">{objectiveFocusGrid}</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>缃戞牸</th>
                  <th>绛夌骇</th>
                  <th>褰撳墠</th>
                  <th>棰勬祴</th>
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
                <h2>杩愯鏃ュ織</h2>
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
                <h2>娴侀噺鏇茬嚎</h2>
              </div>
              <span className="panel-code">NEXT</span>
            </div>

            <div className="chart-area compact-chart-area">
              <svg className="flow-chart compact" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="鎬绘祦閲忚秼鍔垮浘">
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
              <span>褰撳墠 {metricNumber(objectiveTotalFlow)}</span>
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
                <span>鐮旂┒鍖哄煙</span>
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
                      {focusAlert.current} <span>-&gt;</span> {focusAlert.future}
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
                      Compared to current {objectiveNext1h - objectiveTotalFlow > 0 ? '+' : ''}
                      {objectiveNext1h - objectiveTotalFlow}
                    </small>
                  </div>
                  <div className="map-button-grid">
                    <button type="button">主航路</button>
                    <button type="button">鐑偣缃戞牸</button>
                    <button type="button" onClick={() => setActiveResultTab('model')}>
                      妯″瀷缁撴灉
                    </button>
                    <button type="button" onClick={() => setIsControlDrawerOpen(true)}>
                      鍙傛暟鎺у埗
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
                  <span>褰撳墠鎬佸娍璇存槑</span>
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
                <h2>鍗忓悓绠℃帶寤鸿</h2>
              </div>
              <span className="panel-code">{!strategyEnabled ? 'OFF' : planApplied ? 'APPLIED' : 'PENDING'}</span>
            </div>

            <div className="strategy-hero">
              <strong>{scene.strategyHeadline}</strong>
              <p>{!strategyEnabled ? '当前协同策略已关闭，建议保留为决策推演参考。' : scene.strategySummary}</p>
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
                <h2>鐩戞祴缁堢</h2>
              </div>
              <span className="panel-code">CAM</span>
            </div>

            <div className="feed-stack">
              {feedViews.map((feed: FeedView) => {
                const alert = displayedAlerts.find((item) => item.grid === feed.grid)
                const style = { backgroundPosition: feed.position } satisfies CSSProperties
                const state = !strategyEnabled ? 'MANUAL' : planApplied && feed.grid === objectiveFocusGrid ? 'ADJUSTED' : feed.grid === objectiveFocusGrid ? 'TRACK' : 'SCAN'
                const subtitle = !strategyEnabled ? `${feed.subtitle} Strategy is currently disabled.` : planApplied && feed.grid === objectiveFocusGrid ? scene.appliedSummary : alert?.note ?? feed.subtitle

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
                      <small>{alert ? `${!strategyEnabled ? 'Static' : feedRiskText(alert.level)}  ${alert.current} -> ${alert.future}` : 'Continuous monitoring'}</small>
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
                <h2>{activeResultTab === 'benefit' ? '鏂规鏀剁泭瀵规瘮' : '妯″瀷缁撴灉瀵规瘮'}</h2>
              </div>
              <span className="panel-code">{activeResultTab === 'benefit' ? (planApplied ? 'APPLIED' : 'PREVIEW') : `${selectedModel} ${selectedHorizon}`}</span>
            </div>

            <div className="result-tabs">
              <button type="button" className={activeResultTab === 'benefit' ? 'result-tab active' : 'result-tab'} onClick={() => setActiveResultTab('benefit')}>
                鏀剁泭瀵规瘮
              </button>
              <button type="button" className={activeResultTab === 'model' ? 'result-tab active' : 'result-tab'} onClick={() => setActiveResultTab('model')}>
                妯″瀷缁撴灉
              </button>
            </div>

            {activeResultTab === 'benefit' ? (
              <>
                <div className="benefit-intro">
                  <strong>{!strategyEnabled ? '协同策略当前已关闭' : planApplied ? '协同策略已生效' : '等待应用协同方案'}</strong>
                  <p>{!strategyEnabled ? '当前收益卡仅显示静态推演口径，重新启用策略后才会执行应用。' : '以下结果用于展示协同决策方案应用后的收益变化。'}</p>
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
                        <div className="benefit-arrow">-&gt;</div>
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
                    <span>R虏</span>
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
                      <small>MAE {benchmark.mae.toFixed(3)} / RMSE {benchmark.rmse.toFixed(3)} / R虏 {benchmark.r2.toFixed(3)}</small>
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
