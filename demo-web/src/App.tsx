import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type {
  AlertLevel,
  BenchmarkEntry,
  FeedView,
  GeoPoint,
  HorizonKey,
  HotspotId,
  ModelName,
  ResultTab,
  RouteId,
  ScenarioId,
} from './scenarioPacks'
import {
  defaultScenarioId,
  feedViews,
  hotspotAnchors,
  mapTagDefinitions,
  modelBenchmarkMatrix,
  routeBlueprints,
  routeIds,
  scenarioPacks,
} from './scenarioPacks'
import './App.css'

type RouteLine = {
  id: RouteId
  d: string
  x: string
  y: string
  markers: { id: string; dur: number; begin: number; radius: number }[]
}

type MapTag = {
  id: string
  label: string
  x: string
  y: string
  focusGrid?: HotspotId
}

type Hotspot = {
  id: HotspotId
  x: number
  y: number
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

const MAP_VIEWBOX = { width: 1920, height: 1080 }
const CHART_WIDTH = 560
const CHART_HEIGHT = 248
const CHART_PAD_X = 22
const CHART_PAD_Y = 18
const DEFAULT_HOTSPOT_HIGH_THRESHOLD = 0.65
const PLAYBACK_SPEEDS = [
  { label: '慢速', value: 5000 },
  { label: '标准', value: 3000 },
  { label: '快速', value: 1800 },
] as const
const DEFAULT_SCENARIO = scenarioPacks.find((item) => item.id === defaultScenarioId) ?? scenarioPacks[0]
const TITLE_TAGS = ['轨迹修复', '主航路识别', '流量预测', '协同管控']

function geoToPercent(point: GeoPoint) {
  const x = ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * 100
  const y = ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * 100
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` }
}

function geoToNumericPercent(point: GeoPoint) {
  const value = geoToPercent(point)
  return { x: Number.parseFloat(value.x), y: Number.parseFloat(value.y) }
}

function geoToSvg(point: GeoPoint) {
  return {
    x: ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * MAP_VIEWBOX.width,
    y: ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * MAP_VIEWBOX.height,
  }
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

function createSmoothPath(points: GeoPoint[]) {
  const svgPoints = points.map(geoToSvg)
  return svgPoints.reduce((path, point, index, array) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    const previous = array[index - 1]
    const previousPrevious = array[index - 2]
    const next = array[index + 1]
    const startControl = controlPoint(previous, previousPrevious, point)
    const endControl = controlPoint(point, previous, next, true)
    return `${path} C ${startControl.x.toFixed(1)} ${startControl.y.toFixed(1)} ${endControl.x.toFixed(1)} ${endControl.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }, '')
}

function createMarkers(baseDur: number, count: number, radius: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    dur: Number((baseDur + index * 1.15).toFixed(1)),
    begin: Number((-(baseDur / Math.max(count, 1)) * index).toFixed(1)),
    radius: Number((radius - (index % 2) * 0.4).toFixed(1)),
  }))
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

function classifyHotspot(intensity: number, highThreshold: number): AlertLevel {
  const mediumThreshold = Math.max(highThreshold - 0.2, 0.1)
  if (intensity >= highThreshold) return 'high'
  if (intensity >= mediumThreshold) return 'medium'
  return 'watch'
}

function clampCount(value: number) {
  return Math.min(8, Math.max(0, value))
}

function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(DEFAULT_SCENARIO.id)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [planApplied, setPlanApplied] = useState(false)
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('benefit')
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonKey>('1h')
  const [selectedModel, setSelectedModel] = useState<ModelName>('STGCN')
  const [strategyEnabled, setStrategyEnabled] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_SCENARIO.baseAutoplayMs)
  const [routeCountsOverride, setRouteCountsOverride] = useState<Record<RouteId, number>>({ ...DEFAULT_SCENARIO.baseRouteCounts })
  const [hotspotHighThreshold, setHotspotHighThreshold] = useState(DEFAULT_HOTSPOT_HIGH_THRESHOLD)
  const [isControlDrawerOpen, setIsControlDrawerOpen] = useState(false)

  const selectedScenario = useMemo(
    () => scenarioPacks.find((item) => item.id === selectedScenarioId) ?? DEFAULT_SCENARIO,
    [selectedScenarioId],
  )
  const activeScenes = selectedScenario.timeSlices
  const scene = activeScenes[sceneIndex] ?? activeScenes[0]
  const mediumHotspotThreshold = Math.max(hotspotHighThreshold - 0.2, 0.1)

  useEffect(() => {
    if (!autoplay) return
    const timer = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % activeScenes.length)
      setPlanApplied(false)
    }, playbackSpeed)
    return () => window.clearInterval(timer)
  }, [activeScenes.length, autoplay, playbackSpeed])

  const mapTags = useMemo<MapTag[]>(() => mapTagDefinitions.map((tag) => ({ ...tag, ...geoToPercent(tag.point) })), [])

  const routeLines = useMemo<RouteLine[]>(
    () =>
      routeBlueprints.map((route) => {
        const label = geoToPercent(route.labelPoint)
        return {
          id: route.id,
          d: createSmoothPath(route.points),
          x: label.x,
          y: label.y,
          markers: createMarkers(route.markerBaseDur, routeCountsOverride[route.id], route.markerRadius),
        }
      }),
    [routeCountsOverride],
  )

  const hotspots = useMemo<Hotspot[]>(
    () =>
      hotspotAnchors.map((anchor) => ({
        id: anchor.id,
        ...geoToNumericPercent(anchor.point),
        intensity: selectedScenario.hotspotSeries[anchor.id][sceneIndex] ?? 0,
        level: classifyHotspot(selectedScenario.hotspotSeries[anchor.id][sceneIndex] ?? 0, hotspotHighThreshold),
      })),
    [hotspotHighThreshold, sceneIndex, selectedScenario],
  )

  const displayedAlerts = useMemo(() => {
    return scene.alerts.map((alert) => {
      if (!planApplied) return { ...alert, level: classifyLevel(alert.future, hotspotHighThreshold) }
      const isFocus = alert.grid === scene.focusGrid
      const current = isFocus ? scene.appliedFocus.current : Math.max(Math.round(alert.current * 0.72), 18)
      const future = isFocus ? scene.appliedFocus.future : Math.max(Math.round(alert.future * 0.7), 22)
      return {
        ...alert,
        current,
        future,
        level: classifyLevel(future, hotspotHighThreshold),
        note: isFocus ? `${scene.strategyHeadline}已执行，焦点压力明显回落。` : '协同放行后，局部热度已出现下降。',
      }
    })
  }, [hotspotHighThreshold, planApplied, scene])

  const focusFeed = feedViews.find((item) => item.grid === scene.focusGrid) ?? feedViews[0]
  const focusRoute = focusFeed.route
  const focusAlert = displayedAlerts.find((item) => item.grid === scene.focusGrid) ?? displayedAlerts[0]
  const sceneDate = scene.time.slice(0, 10)
  const sceneClock = scene.time.slice(11)
  const totalFlowSeries = activeScenes.map((item) => item.totalFlow)
  const flowMin = Math.min(...totalFlowSeries) - 80
  const flowMax = Math.max(...totalFlowSeries) + 80
  const flowPath = createLinePath(totalFlowSeries, flowMin, flowMax)
  const flowArea = createAreaPath(totalFlowSeries, flowMin, flowMax)
  const currentVisibleVessels = Object.values(routeCountsOverride).reduce((sum, value) => sum + value, 0)
  const displayedHotspotCount = planApplied ? 0 : hotspots.filter((item) => item.intensity >= hotspotHighThreshold).length
  const displayedStatus = !strategyEnabled ? '策略关闭' : planApplied ? scene.appliedStatus ?? '协同已应用' : scene.status
  const hotspotScale = planApplied ? scene.appliedHotspotScale ?? 0.02 : 1

  const flowTicks = useMemo(() => {
    const values = [flowMin, (flowMin + flowMax) / 2, flowMax]
      .map((value) => Math.round(value / 50) * 50)
      .filter((value, index, array) => array.indexOf(value) === index)
    return values
  }, [flowMax, flowMin])

  const headerLeftBlocks: HeaderBlock[] = [
    { label: '系统状态', value: 'ONLINE', note: 'AIS / GRID / STGCN' },
    { label: '场景模式', value: selectedScenario.shortLabel, note: `节点 ${sceneIndex + 1}/5` },
    { label: '焦点航路', value: focusRoute, note: `焦点网格 ${scene.focusGrid}` },
  ]

  const headerRightBlocks: HeaderBlock[] = [
    { label: '当前时刻', value: sceneClock, note: sceneDate },
    { label: '运行阶段', value: scene.phase, note: displayedStatus },
    { label: '地图模式', value: '聚类 / 网格', note: selectedScenario.description },
  ]

  const dialCards = [
    { label: '当前流量', value: scene.totalFlow, percent: Math.min(scene.totalFlow / 2200, 1) },
    { label: '1H 预测', value: scene.next1h, percent: Math.min(scene.next1h / 2200, 1) },
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
    setSceneIndex(index)
    setPlanApplied(false)
    setAutoplay(false)
  }

  function handleScenarioChange(id: ScenarioId) {
    const nextScenario = scenarioPacks.find((item) => item.id === id)
    if (!nextScenario) return
    setSelectedScenarioId(id)
    setSceneIndex(0)
    setPlanApplied(false)
    setAutoplay(false)
    setRouteCountsOverride({ ...nextScenario.baseRouteCounts })
  }

  function handleRouteCountChange(routeId: RouteId, delta: number) {
    setRouteCountsOverride((current) => ({ ...current, [routeId]: clampCount(current[routeId] + delta) }))
  }

  function handleStrategyToggle() {
    setStrategyEnabled((current) => {
      const next = !current
      if (!next) setPlanApplied(false)
      return next
    })
  }

  function resetControls() {
    setSceneIndex(0)
    setPlanApplied(false)
    setAutoplay(false)
    setRouteCountsOverride({ ...selectedScenario.baseRouteCounts })
    setPlaybackSpeed(selectedScenario.baseAutoplayMs)
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
        </div>

        <div className="header-title-shell">
          <div className="header-title-plaque">
            <span className="header-title-code">PEARL RIVER ESTUARY PORT TRAFFIC MONITOR</span>
            <h1>港口智慧管理平台</h1>
            <p>珠江口船舶交通监测与协同决策演示界面</p>
          </div>

          <div className="header-title-tags">
            {TITLE_TAGS.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="header-scene-bar">
            <div className="scenario-switcher">
              {scenarioPacks.map((scenarioPack) => (
                <button
                  key={scenarioPack.id}
                  type="button"
                  className={scenarioPack.id === selectedScenarioId ? 'scenario-chip active' : 'scenario-chip'}
                  onClick={() => handleScenarioChange(scenarioPack.id)}
                >
                  {scenarioPack.shortLabel}
                </button>
              ))}
            </div>

            <span className="scene-description">{selectedScenario.description}</span>

            <button type="button" className="parameter-trigger" onClick={() => setIsControlDrawerOpen((current) => !current)}>
              {isControlDrawerOpen ? '关闭控制台' : '参数控制台'}
            </button>
          </div>
        </div>

        <div className="header-side header-side-right">
          <div className="header-side-label">SCENE CONTROL</div>
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
                  <strong>{routeCountsOverride[routeId]}</strong>
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
            恢复当前场景默认值
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
              <span className="panel-code">{scene.focusGrid}</span>
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
              <span className="panel-code">1H</span>
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
                      <circle cx={x} cy={y} r={index === sceneIndex ? 5 : 3.5} className={index === sceneIndex ? 'chart-point active' : 'chart-point'} />
                      <text x={x} y={CHART_HEIGHT - 8} className={index === sceneIndex ? 'chart-label active' : 'chart-label'}>
                        {activeScenes[index].label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="chart-footer">
              <span>当前 {metricNumber(scene.totalFlow)}</span>
              <span>1H {metricNumber(scene.next1h)}</span>
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
                <strong>113.5583E - 113.9583E</strong>
                <strong>22.1557N - 22.6357N</strong>
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
                    <strong>{scene.focusGrid}</strong>
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
                    <span>1H 预测</span>
                    <strong>{metricNumber(scene.next1h)}</strong>
                    <small>
                      较当前{scene.next1h - scene.totalFlow > 0 ? '+' : ''}
                      {scene.next1h - scene.totalFlow}
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

              <svg className="route-overlay" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
                {routeLines.map((route) => (
                  <g key={route.id}>
                    <path id={`route-${route.id}`} d={route.d} className={route.id === focusRoute ? 'route-line route-base focus' : 'route-line route-base'} />
                    <path d={route.d} className={route.id === focusRoute ? 'route-line route-flow focus' : 'route-line route-flow'} style={{ animationDuration: `${route.id === focusRoute ? 5.8 : 8.6}s` }} />
                  </g>
                ))}

                {routeLines.flatMap((route) =>
                  route.markers.map((marker) => (
                    <g key={`${route.id}-${marker.id}`} className={route.id === focusRoute ? 'traffic-ship focus' : 'traffic-ship'}>
                      <path d={`M ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${(-(marker.radius * 1.68) * 0.74).toFixed(1)} L ${((marker.radius * 1.68) + 4).toFixed(1)} 0 L ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${((marker.radius * 1.68) * 0.74).toFixed(1)} L ${(-(marker.radius * 1.68) * 0.18).toFixed(1)} 0 Z`} />
                      <animateMotion dur={`${marker.dur}s`} begin={`${marker.begin}s`} repeatCount="indefinite" rotate="auto" path={route.d} />
                    </g>
                  )),
                )}
              </svg>

              {routeLines.map((route) => (
                <div key={route.id} className={route.id === focusRoute ? 'route-tag active' : 'route-tag'} style={{ left: route.x, top: route.y }}>
                  {route.id}
                </div>
              ))}

              {mapTags.map((tag) => (
                <div key={tag.id} className={tag.focusGrid === scene.focusGrid ? 'map-tag active' : 'map-tag'} style={{ left: tag.x, top: tag.y }}>
                  <strong>{tag.id}</strong>
                  <span>{tag.label}</span>
                </div>
              ))}

              {hotspots.map((hotspot) => {
                const size = (22 + hotspot.intensity * 42) * hotspotScale
                const style = {
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
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
                  <span>场景摘要</span>
                  <strong>{planApplied ? scene.appliedSummary : scene.summary}</strong>
                </div>

                <div className="map-bottom-focus">
                  <span>{focusFeed.tag}</span>
                  <span>{focusRoute}</span>
                  <span>
                    {scene.focusGrid} {focusAlert.current}
                  </span>
                </div>

                <div className="map-bottom-timeline">
                  {activeScenes.map((item, index) => (
                    <button key={item.id} type="button" className={index === sceneIndex ? 'map-timeline-node active' : 'map-timeline-node'} onClick={() => handleSceneSelect(index)}>
                      <strong>{item.label}</strong>
                      <small>{item.phase}</small>
                    </button>
                  ))}
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
              <p>{!strategyEnabled ? '当前协同策略已关闭，建议项保留为场景推演参考。' : scene.strategySummary}</p>
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
                const state = !strategyEnabled ? 'MANUAL' : planApplied && feed.grid === scene.focusGrid ? 'ADJUSTED' : feed.grid === scene.focusGrid ? 'TRACK' : 'SCAN'
                const subtitle = !strategyEnabled ? `${feed.subtitle} 协同策略当前关闭。` : planApplied && feed.grid === scene.focusGrid ? scene.appliedSummary : alert?.note ?? feed.subtitle

                return (
                  <article key={feed.tag} className={planApplied && feed.grid === scene.focusGrid ? 'feed-card active resolved' : feed.grid === scene.focusGrid ? 'feed-card active' : 'feed-card'} style={style}>
                    <div className="feed-overlay"></div>
                    <div className="feed-head">
                      <div className="feed-ident">
                        <span className="feed-tag">{feed.tag}</span>
                        <strong>{feed.title}</strong>
                      </div>
                      <span className={planApplied && feed.grid === scene.focusGrid ? 'feed-state applied' : 'feed-state'}>{state}</span>
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
                  <p>{!strategyEnabled ? '当前收益卡显示静态推演口径，需重新启用策略后才能执行应用。' : '以下结果为基于研究成果的场景化决策结果，用于展示协同后的收益变化。'}</p>
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
