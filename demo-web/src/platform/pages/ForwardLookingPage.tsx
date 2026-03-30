import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { GeoPoint, GeometryConfig, ShellRouteId, StudyBounds } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import type {
  ForwardLookingScenario,
  ForwardLookingScenarioCatalog,
  ForwardLookingSummary,
} from '../forwardLooking/forwardLookingTypes.ts'
import { localizeForwardLookingCatalog, localizeForwardLookingSummary } from '../zhCopy.ts'

type ForwardLookingPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type ScenarioAlert = ForwardLookingScenario['alertsBefore'][number]

type ScenarioGridBridge = {
  gridId: string
  routeId: string | null
  beforeAlert: ScenarioAlert | null
  afterAlert: ScenarioAlert | null
  isFocus: boolean
}

type ComparisonMode = 'before' | 'after'

function formatMomentLabel(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function formatDecimal(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : '--'
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatSignedDecimal(value: number) {
  return `${value >= 0 ? '+' : ''}${formatDecimal(value)}`
}

function widthRatio(value: number, maxValue: number) {
  if (maxValue <= 0) return '0%'
  return `${Math.max(12, (value / maxValue) * 100).toFixed(1)}%`
}

function geoToPercent(point: GeoPoint, bounds: StudyBounds) {
  const x = ((point.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100
  const y = ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * 100
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` }
}

function geoToNumericPercent(point: GeoPoint, bounds: StudyBounds) {
  const value = geoToPercent(point, bounds)
  return { x: Number.parseFloat(value.x), y: Number.parseFloat(value.y) }
}

function createSmoothPercentPath(points: Array<{ x: number; y: number }>) {
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

function asRouteTarget(value: string) {
  return /^C\d+$/i.test(value) ? value.toUpperCase() : null
}

function getSurfaceTone(level: string | null | undefined) {
  if (level === 'high') return 'is-high'
  if (level === 'medium') return 'is-medium'
  return 'is-watch'
}

export function ForwardLookingPage({ entry, onNavigate }: ForwardLookingPageProps) {
  const [summary, setSummary] = useState<ForwardLookingSummary | null>(null)
  const [catalog, setCatalog] = useState<ForwardLookingScenarioCatalog | null>(null)
  const [geometry, setGeometry] = useState<GeometryConfig | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [selectedGridId, setSelectedGridId] = useState('')
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('before')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<ForwardLookingSummary>(`/${entry.entryFiles.summary}`),
      loadPublicJson<ForwardLookingScenarioCatalog>(`/${entry.entryFiles.scenarios}`),
      loadPublicJson<GeometryConfig>('/data/shared-geometry.json').catch(() => null),
    ])
      .then(([rawSummary, rawScenarioData, geometryData]) => {
        if (cancelled) return
        const summaryData = localizeForwardLookingSummary(rawSummary)
        const scenarioData = localizeForwardLookingCatalog(rawScenarioData, summaryData)
        setSummary(summaryData)
        setCatalog(scenarioData)
        setGeometry(geometryData)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '前瞻分析模块加载失败。')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.scenarios, entry.entryFiles.summary])

  const scenarios = catalog?.scenarios ?? []
  const resolvedSelectedScenarioId = scenarios.some((scenario) => scenario.id === selectedScenarioId)
    ? selectedScenarioId
    : (scenarios[0]?.id ?? '')
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === resolvedSelectedScenarioId) ??
    scenarios[0] ??
    null
  const crossLinks = summary?.crossLinks ?? []

  const availableGridIds = selectedScenario
    ? Array.from(
        new Set([
          selectedScenario.focusGrid,
          ...selectedScenario.alertsBefore.map((alert) => alert.grid),
          ...selectedScenario.alertsAfter.map((alert) => alert.grid),
        ]),
      )
    : []

  const resolvedSelectedGridId = availableGridIds.includes(selectedGridId)
    ? selectedGridId
    : (selectedScenario?.focusGrid ?? availableGridIds[0] ?? '')

  const gridBridges: ScenarioGridBridge[] = selectedScenario
    ? availableGridIds
        .map((gridId) => ({
          gridId,
          routeId: geometry?.routeFocusMap[gridId] ?? (gridId === selectedScenario.focusGrid ? selectedScenario.focusRoute : null),
          beforeAlert: selectedScenario.alertsBefore.find((alert) => alert.grid === gridId) ?? null,
          afterAlert: selectedScenario.alertsAfter.find((alert) => alert.grid === gridId) ?? null,
          isFocus: gridId === selectedScenario.focusGrid,
        }))
        .sort((left, right) => {
          const hotspotOrder = geometry?.meta.hotspotOrder ?? availableGridIds
          return hotspotOrder.indexOf(left.gridId) - hotspotOrder.indexOf(right.gridId)
        })
    : []

  const selectedGridBridge =
    gridBridges.find((item) => item.gridId === resolvedSelectedGridId) ??
    gridBridges[0] ??
    null

  const recommendedRouteIds = new Set(
    (selectedScenario?.recommendations ?? [])
      .map((recommendation) => asRouteTarget(recommendation.target))
      .filter((routeId): routeId is string => Boolean(routeId)),
  )

  const routeOrder = geometry?.meta.routeOrder ?? Array.from(new Set(gridBridges.map((item) => item.routeId).filter((routeId): routeId is string => Boolean(routeId))))
  const selectedRouteId = selectedGridBridge?.routeId ?? selectedScenario?.focusRoute ?? null
  const maxPressure = Math.max(
    1,
    ...gridBridges.flatMap((item) => [item.beforeAlert?.future ?? 0, item.afterAlert?.future ?? 0]),
  )
  const comparisonModes: ComparisonMode[] = ['before', 'after']
  const activeStateTitle = comparisonMode === 'before' ? '策略前' : '应用态预览'
  const activeAlertCount = selectedScenario
    ? comparisonMode === 'before'
      ? selectedScenario.alertCountBefore
      : selectedScenario.alertCountAfter
    : 0
  const activeFocusPressure = selectedScenario
    ? comparisonMode === 'before'
      ? selectedScenario.focusPressureBefore
      : selectedScenario.focusPressureAfter
    : 0
  const activeAlerts = selectedScenario
    ? comparisonMode === 'before'
      ? selectedScenario.alertsBefore
      : selectedScenario.alertsAfter
    : []
  const activeGridAlert = selectedGridBridge
    ? comparisonMode === 'before'
      ? selectedGridBridge.beforeAlert
      : selectedGridBridge.afterAlert
    : null
  const inactiveGridAlert = selectedGridBridge
    ? comparisonMode === 'before'
      ? selectedGridBridge.afterAlert
      : selectedGridBridge.beforeAlert
    : null
  const activeStateSummary = selectedScenario
    ? comparisonMode === 'before'
      ? `直接读取已交付的 ${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon} 预测帧，此时尚未施加任何规则驱动干预。`
      : `读取同一 ${selectedScenario.focusGrid} / ${selectedScenario.focusRoute} 场景帧对应的规则驱动应用态预览。`
    : ''
  const activeExplanation = selectedScenario
    ? comparisonMode === 'before'
      ? `解释链路：基线压力和告警来自选定的 ${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon} runtime 帧，其权威性仍锚定在评估页支持的模型排名上。`
      : `解释链路：后态仍沿用同一套评估依据和 corridor 上下文，用于比较同一场景下的热点压力变化。`
    : ''

  return (
    <section className="module-page">
      <section className="frame module-summary-band forward-looking-summary-band">
        <div>
          <p className="panel-kicker">前瞻分析</p>
          <h1>在已交付预测与 corridor 证据之上进行规则驱动协同决策</h1>
          <p className="module-takeaway">
            {summary?.summary ?? '正在加载精选场景与策略对比摘要。'}
          </p>
        </div>
        <div className="module-kpi-grid forward-looking-kpi-grid">
          <article>
            <span>精选场景数</span>
            <strong>{summary?.scenarioCount ?? '--'}</strong>
          </article>
          <article>
            <span>权威模型</span>
            <strong>{summary ? `${summary.selectedModel} ${summary.selectedHorizon}` : '--'}</strong>
          </article>
          <article>
            <span>主导 corridor</span>
            <strong>{summary?.corridorContext.leadingCorridorId ?? '--'}</strong>
          </article>
          <article>
            <span>回链模块</span>
            <strong>{crossLinks.length || '--'}</strong>
          </article>
        </div>
        <div className="overview-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
            打开预测页
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('evaluation')}>
            打开评估页
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('overview')}>
            打开总览
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          {!summary || !catalog ? (
            error ? (
              <PlatformStatusSurface
                tone="error"
                title="前瞻分析数据不可用"
                summary="前瞻分析数据无法打开。"
                detail={error}
              />
            ) : (
              <div className="module-skeleton-grid">
                <div className="module-skeleton-card"></div>
                <div className="module-skeleton-card"></div>
                <div className="module-skeleton-card"></div>
              </div>
            )
          ) : (
            <>
              <div className="module-inline-section">
                <div className="panel-title">
                  <div>
                    <p className="panel-kicker">精选场景</p>
                    <h2>选择一个规则驱动决策帧</h2>
                  </div>
                  <span className="panel-code">12-01</span>
                </div>

                <div className="module-card-grid forward-looking-scenario-grid">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      className={`metric-spotlight-card forward-looking-scenario-button${selectedScenario?.id === scenario.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedScenarioId(scenario.id)
                        setSelectedGridId(scenario.focusGrid)
                      }}
                    >
                      <span>{scenario.focusRoute}</span>
                      <strong>{scenario.focusGrid}</strong>
                      <small>{scenario.title}</small>
                      <em>{formatMomentLabel(scenario.time)}</em>
                      <div className="corridor-chip-row">
                        <span className="corridor-chip">{`下降 ${formatDecimal(scenario.focusPressureDrop)}`}</span>
                        <span className="corridor-chip">{`${scenario.alertCountBefore} -> ${scenario.alertCountAfter} 个热点`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedScenario ? (
                <>
                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">焦点面板</p>
                        <h2>基于已交付 geometry 的交互式 route 与 grid 语境</h2>
                      </div>
                      <span className="panel-code">12-02</span>
                    </div>

                    <div className="module-card-grid forward-looking-context-grid">
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>评估锚点</span>
                        <strong>{`${selectedScenario.selectedModel} 排名第 ${selectedScenario.evaluationContext.rank}`}</strong>
                        <small>{selectedScenario.evaluationContext.summary}</small>
                      </article>
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>corridor dominance 主线</span>
                        <strong>{summary.corridorContext.leadingCorridorId}</strong>
                        <small>{selectedScenario.corridorContext.detail}</small>
                      </article>
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>决策依据</span>
                        <strong>预测基线与应用态预览共享同一场景锚点</strong>
                        <small>before/after 切换会同步更新状态面板、收益卡片与热点告警，方便在同一场景下比较策略变化。</small>
                      </article>
                    </div>

                    <div className="forward-looking-toggle-shell">
                      <div className="forward-looking-toggle-group" role="tablist" aria-label="策略状态切换">
                        {comparisonModes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            role="tab"
                            aria-selected={comparisonMode === mode}
                            className={`forward-looking-toggle-button${comparisonMode === mode ? ' is-active' : ''}`}
                            onClick={() => setComparisonMode(mode)}
                          >
                            {mode === 'before' ? '策略前' : '应用态预览'}
                          </button>
                        ))}
                      </div>

                      <article className="metric-spotlight-card forward-looking-state-summary-card">
                        <span>状态摘要</span>
                        <strong>{`${activeStateTitle} | ${selectedScenario.focusGrid} / ${selectedScenario.focusRoute}`}</strong>
                        <small>{activeStateSummary}</small>
                        <div className="corridor-chip-row">
                          <span className="corridor-chip">{`${formatDecimal(activeFocusPressure)} 焦点压力`}</span>
                          <span className="corridor-chip">{`${activeAlertCount} 个热点告警`}</span>
                          <span className="corridor-chip">{`${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon}`}</span>
                        </div>
                        <p className="forward-looking-state-summary-note">{activeExplanation}</p>
                      </article>
                    </div>

                    <div className="forward-looking-focus-shell">
                      <article className="metric-spotlight-card forward-looking-map-card">
                        <span>Route 与 Grid 语境</span>
                        <strong>{selectedGridBridge ? `${selectedGridBridge.gridId} -> ${selectedRouteId ?? '--'}` : '--'}</strong>
                        <small>基于共享 geometry 的交互式焦点 route/grid 面板。</small>

                        {geometry ? (
                          <>
                            <div className="forward-looking-map-stage">
                              <svg className="forward-looking-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                {geometry.routes.map((route) => {
                                  const className = [
                                    'forward-looking-route-path',
                                    route.id === selectedScenario.focusRoute ? 'is-focus-route' : '',
                                    route.id === selectedRouteId ? 'is-selected-route' : '',
                                    recommendedRouteIds.has(route.id) ? 'is-support-route' : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')

                                  return (
                                    <path
                                      key={route.id}
                                      d={createSmoothGeoPath(route.points, geometry.meta.studyArea)}
                                      className={className}
                                    />
                                  )
                                })}
                              </svg>

                              {geometry.routes.map((route) => {
                                const position = geoToPercent(route.labelPoint, geometry.meta.studyArea)
                                const className = [
                                  'forward-looking-map-route-tag',
                                  route.id === selectedRouteId ? 'is-selected' : '',
                                  route.id === selectedScenario.focusRoute ? 'is-focus' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')

                                return (
                                  <div key={route.id} className={className} style={{ left: position.x, top: position.y }}>
                                    {route.id}
                                  </div>
                                )
                              })}

                              {gridBridges.map((bridge) => {
                                const hotspot = geometry.hotspots.find((item) => item.id === bridge.gridId)
                                if (!hotspot) return null

                                const position = geoToPercent(hotspot.point, geometry.meta.studyArea)
                                const beforePressure = bridge.beforeAlert?.future ?? bridge.beforeAlert?.current ?? 0
                                const size = 22 + (beforePressure / maxPressure) * 22
                                const className = [
                                  'forward-looking-map-hotspot',
                                  bridge.gridId === resolvedSelectedGridId ? 'is-selected' : '',
                                  bridge.isFocus ? 'is-focus' : '',
                                  getSurfaceTone(bridge.beforeAlert?.level ?? null),
                                ]
                                  .filter(Boolean)
                                  .join(' ')

                                return (
                                  <button
                                    key={bridge.gridId}
                                    type="button"
                                    className={className}
                                    style={{ left: position.x, top: position.y, width: `${size}px`, height: `${size}px` }}
                                    aria-pressed={bridge.gridId === resolvedSelectedGridId}
                                    onClick={() => setSelectedGridId(bridge.gridId)}
                                  >
                                    <strong>{bridge.gridId}</strong>
                                    <span>{bridge.routeId ?? hotspot.routeId}</span>
                                  </button>
                                )
                              })}
                            </div>

                            <div className="forward-looking-surface-chip-row">
                              {gridBridges.map((bridge) => (
                                <button
                                  key={bridge.gridId}
                                  type="button"
                                  className={`forward-looking-surface-chip${bridge.gridId === resolvedSelectedGridId ? ' is-active' : ''}`}
                                  onClick={() => setSelectedGridId(bridge.gridId)}
                                >
                                  {bridge.gridId} / {bridge.routeId ?? '--'}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <article className="metric-spotlight-card forward-looking-context-card">
                            <span>基础航路视图</span>
                            <strong>当前以场景卡片呈现 route 与 grid 关系</strong>
                            <p>场景证据、策略建议与热点变化仍可继续浏览，route 与 grid 会以基础航路视图呈现。</p>
                          </article>
                        )}
                      </article>

                      <div className="forward-looking-focus-stack">
                        <article className="metric-spotlight-card forward-looking-pressure-card">
                          <span>焦点 Grid 压力</span>
                          <strong>{selectedGridBridge ? `${selectedGridBridge.gridId} / ${selectedRouteId ?? '--'} | ${activeStateTitle}` : '--'}</strong>
                          <small>
                            {comparisonMode === 'before'
                              ? selectedGridBridge?.isFocus
                                ? selectedScenario.emphasis
                                : `已钉住同一场景帧 ${formatMomentLabel(selectedScenario.time)} 下的次级热点。`
                              : `应用态预览仍然绑定到 ${selectedScenario.strategyHeadline}，用于展示当前策略下的热点变化。`}
                          </small>

                          {selectedGridBridge ? (
                            <div className="forward-looking-pressure-stack">
                              <div className={`forward-looking-pressure-row${comparisonMode === 'before' ? ' is-active' : ''}`}>
                                <label>预测基线</label>
                                <div className="forward-looking-pressure-track">
                                  <i className="is-before" style={{ width: widthRatio(selectedGridBridge.beforeAlert?.future ?? 0, maxPressure) }} />
                                </div>
                                <span>{formatDecimal(selectedGridBridge.beforeAlert?.future ?? 0)}</span>
                              </div>
                              <div className={`forward-looking-pressure-row${comparisonMode === 'after' ? ' is-active' : ''}`}>
                                <label>应用态预览</label>
                                <div className="forward-looking-pressure-track">
                                  <i className="is-after" style={{ width: widthRatio(selectedGridBridge.afterAlert?.future ?? 0, maxPressure) }} />
                                </div>
                                <span>{formatDecimal(selectedGridBridge.afterAlert?.future ?? 0)}</span>
                              </div>
                            </div>
                          ) : null}

                          <div className="corridor-chip-row">
                            <span className="corridor-chip">{`${activeAlertCount} 条活跃热点告警`}</span>
                            <span className="corridor-chip">{`${formatDecimal(selectedScenario.currentTotalFlow)} -> ${formatDecimal(selectedScenario.forecastTotalFlow)} 总流量`}</span>
                            {activeGridAlert ? <span className="corridor-chip">{`${activeGridAlert.level} 当前状态`}</span> : null}
                          </div>

                          {selectedGridBridge && activeGridAlert ? (
                            <em>
                              {comparisonMode === 'before'
                                ? `切换到应用态预览，即可查看当前 grid 相比基线的 ${formatSignedDecimal((selectedGridBridge.afterAlert?.future ?? 0) - (selectedGridBridge.beforeAlert?.future ?? 0))} 压力变化。`
                                : `当前应用态预览的数值为 ${formatDecimal(activeGridAlert.future ?? 0)}，而基线帧对应值为 ${formatDecimal(inactiveGridAlert?.future ?? 0)}。`}
                            </em>
                          ) : null}
                        </article>

                        <article className="corridor-story-note forward-looking-strategy-card">
                          <span>策略摘要</span>
                          <strong>{selectedScenario.strategyHeadline}</strong>
                          <p>{comparisonMode === 'before' ? selectedScenario.strategySummary : activeExplanation}</p>
                        </article>
                      </div>
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">策略建议</p>
                        <h2>与明确预测证据绑定的建议栈</h2>
                      </div>
                      <span className="panel-code">DECI-02</span>
                    </div>

                    <div className="module-card-grid forward-looking-recommendation-grid">
                      {selectedScenario.recommendations.map((recommendation, index) => {
                        const recommendationRouteId = asRouteTarget(recommendation.target)
                        const linkedBridge =
                          recommendationRouteId
                            ? gridBridges.find((bridge) => bridge.routeId === recommendationRouteId) ?? null
                            : null

                        return (
                          <article key={`${selectedScenario.id}-${recommendation.target}`} className="metric-spotlight-card forward-looking-recommendation-card">
                            <span>{`步骤 ${index + 1}`}</span>
                            <strong>{recommendation.action}</strong>
                            <small>{recommendation.reason}</small>
                            <em>{recommendation.effect}</em>
                            <div className="corridor-chip-row">
                              <span className="corridor-chip">{recommendation.target}</span>
                              {linkedBridge ? <span className="corridor-chip">{`${linkedBridge.gridId} 焦点桥接`}</span> : null}
                            </div>
                            {linkedBridge ? (
                              <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => setSelectedGridId(linkedBridge.gridId)}>
                                固定到焦点面板
                              </button>
                            ) : recommendation.target === 'Evidence drawer' ? (
                              <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => onNavigate('evaluation')}>
                                打开评估页
                              </button>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">场景 route 对比</p>
                        <h2>重点航路变化解读</h2>
                      </div>
                      <span className="panel-code">回链</span>
                    </div>

                    <article className="forward-looking-route-note">
                      <span>corridor 关联的 route 对比</span>
                      <strong>{`${summary.corridorContext.leadingCorridorId} 仍是整站运动主线`}</strong>
                      <p>{selectedScenario.corridorContext.detail}</p>
                    </article>

                    <div className="module-card-grid forward-looking-route-grid">
                      {routeOrder.map((routeId) => {
                        const linkedBridge = gridBridges.find((bridge) => bridge.routeId === routeId) ?? null
                        const recommendation = selectedScenario.recommendations.find((item) => asRouteTarget(item.target) === routeId) ?? null
                        const delta =
                          linkedBridge && linkedBridge.afterAlert && linkedBridge.beforeAlert
                            ? linkedBridge.afterAlert.future - linkedBridge.beforeAlert.future
                            : null

                        return (
                          <button
                            key={`${selectedScenario.id}-${routeId}`}
                            type="button"
                            className={`metric-spotlight-card forward-looking-route-card${routeId === selectedRouteId ? ' is-selected' : ''}${routeId === selectedScenario.focusRoute ? ' is-focus' : ''}`}
                            onClick={() => {
                              if (linkedBridge) setSelectedGridId(linkedBridge.gridId)
                            }}
                          >
                            <div className="forward-looking-route-card-head">
                              <div>
                                <span>{routeId}</span>
                                <strong>{linkedBridge ? linkedBridge.gridId : '仅上下文'}</strong>
                              </div>
                              <em>{routeId === selectedScenario.focusRoute ? '焦点 route' : recommendation ? '建议关注' : '上下文 route'}</em>
                            </div>

                            <small>
                              {linkedBridge
                                ? recommendation?.reason ?? `共享 geometry 会把 ${linkedBridge.gridId} 连接到 ${routeId}，因此该 route 可以继承对应热点压力与建议优先级。`
                                : '当前这条 route 主要承担通道背景说明，可结合上方主导 corridor 判断整体分布。'}
                            </small>

                            {linkedBridge ? (
                              <div className="forward-looking-pressure-stack">
                                <div className={`forward-looking-pressure-row${comparisonMode === 'before' ? ' is-active' : ''}`}>
                                  <label>前态</label>
                                  <div className="forward-looking-pressure-track">
                                    <i className="is-before" style={{ width: widthRatio(linkedBridge.beforeAlert?.future ?? 0, maxPressure) }} />
                                  </div>
                                  <span>{formatDecimal(linkedBridge.beforeAlert?.future ?? 0)}</span>
                                </div>
                                <div className={`forward-looking-pressure-row${comparisonMode === 'after' ? ' is-active' : ''}`}>
                                  <label>后态</label>
                                  <div className="forward-looking-pressure-track">
                                    <i className="is-after" style={{ width: widthRatio(linkedBridge.afterAlert?.future ?? 0, maxPressure) }} />
                                  </div>
                                  <span>{formatDecimal(linkedBridge.afterAlert?.future ?? 0)}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="forward-looking-route-fallback">
                                当前这条 route 主要承担通道背景说明，可结合主导 corridor 判断整体分布。
                              </p>
                            )}

                            <div className="corridor-chip-row">
                              {delta !== null ? <span className="corridor-chip">{`${formatSignedDecimal(delta)} 变化量`}</span> : null}
                              {recommendation ? <span className="corridor-chip">{recommendation.target}</span> : null}
                              {!linkedBridge ? <span className="corridor-chip">仅 geometry 上下文</span> : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">收益切换</p>
                        <h2>同一个切换器同时驱动收益卡片与状态摘要</h2>
                      </div>
                      <span className="panel-code">DECI-03</span>
                    </div>

                    <div className="module-card-grid forward-looking-benefit-grid">
                      {selectedScenario.benefits.map((benefit) => {
                        const activeValue = comparisonMode === 'before' ? benefit.before : benefit.after
                        const inactiveValue = comparisonMode === 'before' ? benefit.after : benefit.before

                        return (
                          <article key={`${selectedScenario.id}-${benefit.label}`} className="metric-spotlight-card forward-looking-benefit-card">
                            <span>{benefit.label}</span>
                            <strong>{`${activeValue}${benefit.unit ?? ''}`}</strong>
                            <small>{comparisonMode === 'before' ? '策略前基线' : '策略后的应用态预览'}</small>
                            <em>{`对比 ${benefit.before}${benefit.unit ?? ''} -> ${benefit.after}${benefit.unit ?? ''}`}</em>
                            <div className="corridor-chip-row">
                              <span className="corridor-chip">{activeStateTitle}</span>
                              <span className="corridor-chip">{`另一状态 ${inactiveValue}${benefit.unit ?? ''}`}</span>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">告警对比</p>
                        <h2>热点告警与解释文案现在跟随同一个状态切换</h2>
                      </div>
                      <span className="panel-code">DECI-03 / DECI-04</span>
                    </div>

                    <div className="module-card-grid forward-looking-alert-grid">
                      <article className="metric-spotlight-card forward-looking-alert-state-card">
                        <span>{activeStateTitle}</span>
                        <strong>{`${activeAlertCount} 个高等级热点`}</strong>
                        <small>{activeStateSummary}</small>
                        <div className="module-side-list">
                          {activeAlerts.map((alert) => (
                            <article key={`${selectedScenario.id}-${comparisonMode}-${alert.grid}`}>
                              <span>{`${alert.grid} | ${alert.level}`}</span>
                              <strong>{`${formatDecimal(alert.current)} -> ${formatDecimal(alert.future)}`}</strong>
                              <small>{alert.note}</small>
                            </article>
                          ))}
                        </div>
                      </article>
                      <article className="metric-spotlight-card forward-looking-alert-state-card">
                        <span>解释链路</span>
                        <strong>{`${selectedScenario.alertCountBefore} -> ${selectedScenario.alertCountAfter} 个高等级热点`}</strong>
                        <small>{activeExplanation}</small>
                        <div className="corridor-chip-row">
                          <span className="corridor-chip">{`${formatDecimal(selectedScenario.focusPressureBefore)} -> ${formatDecimal(selectedScenario.focusPressureAfter)} 焦点压力`}</span>
                          <span className="corridor-chip">{`${selectedScenario.focusGrid} / ${selectedScenario.focusRoute}`}</span>
                          <span className="corridor-chip">{summary.corridorContext.leadingCorridorId}</span>
                        </div>
                        <p className="forward-looking-route-fallback">
                          这个切换器会在同一场景帧下同步切换预测基线与应用态预览，让热点变化、收益卡片与状态摘要保持一致。
                        </p>
                      </article>
                    </div>

                    <article className="corridor-story-note forward-looking-strategy-card">
                      <span>场景说明</span>
                      <strong>应用态预览与策略基线共享同一场景锚点</strong>
                      <p>{selectedScenario.honestBoundary}</p>
                    </article>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>

        <aside className="frame module-side-panel">
          {summary ? (
            <>
              <div className="module-inline-section">
                <p className="evaluation-trace-title">模型依据</p>
                <div className="module-side-list">
                  <article>
                    <span>选定模型</span>
                    <strong>{`${summary.evidenceAuthority.selectedModel} ${summary.evidenceAuthority.selectedHorizon}`}</strong>
                    <small>{summary.evidenceAuthority.rationale}</small>
                  </article>
                  <article>
                    <span>排名值</span>
                    <strong>{formatDecimal(summary.evidenceAuthority.rankingValue)}</strong>
                    <small>{summary.evidenceAuthority.rankingLabel}</small>
                  </article>
                  <article>
                    <span>对比模型</span>
                    <strong>{summary.evidenceAuthority.comparedModels.map((item) => item.model).join(' / ')}</strong>
                    <small>当前场景会在这些模型之间对照 1h 排名表现。</small>
                  </article>
                </div>
              </div>

              <div className="module-inline-section">
                <p className="evaluation-trace-title">Corridor dominance</p>
                <div className="module-side-list">
                  <article>
                    <span>主导 corridor</span>
                    <strong>{summary.corridorContext.leadingCorridorId}</strong>
                    <small>{summary.corridorContext.narrative}</small>
                  </article>
                  <article>
                    <span>主导方向</span>
                    <strong>{summary.corridorContext.leadingDirection}</strong>
                    <small>{`${formatPercent(summary.corridorContext.leadingShare)} 主导占比 | ${formatPercent(summary.corridorContext.topThreeShare)} 前三覆盖率`}</small>
                  </article>
                  <article>
                    <span>route 映射说明</span>
                    <strong>{summary.corridorContext.routeMappingClaim}</strong>
                    <small>corridor dominance 为 route 对比提供全站背景，方便把热点变化放回主导走廊结构中理解。</small>
                  </article>
                </div>
              </div>

              {selectedScenario ? (
                <div className="module-inline-section">
                  <p className="evaluation-trace-title">关联模块</p>
                  <div className="module-side-list">
                    {selectedScenario.evidenceLineage.map((item, index) => (
                      <article key={`${selectedScenario.id}-${item.artifactId}`}>
                        <span>{`来源 ${index + 1}`}</span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {crossLinks.length ? (
                <div className="module-inline-section">
                  <p className="evaluation-trace-title">跨页回链</p>
                  <div className="module-side-list">
                    {crossLinks.map((link) => (
                      <article key={link.routeId}>
                        <span>{link.label}</span>
                        <strong>{`打开${link.label}`}</strong>
                        <small>{link.summary}</small>
                        <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => onNavigate(link.routeId)}>
                          打开{link.label}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

            </>
          ) : error ? (
            <PlatformStatusSurface
              tone="error"
              title="前瞻分析不可用"
              summary="前瞻分析数据无法打开。"
              detail={error}
            />
          ) : (
            <div className="module-skeleton-grid">
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
            </div>
          )}
        </aside>
      </section>
    </section>
  )
}
