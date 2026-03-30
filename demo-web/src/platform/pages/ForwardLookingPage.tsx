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

function formatStatusLabel(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : 'Unknown'
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
      .then(([summaryData, scenarioData, geometryData]) => {
        if (cancelled) return
        setSummary(summaryData)
        setCatalog(scenarioData)
        setGeometry(geometryData)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load forward-looking analysis.')
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
  const deferredItems = summary?.deferred ?? []

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
  const activeStateTitle = comparisonMode === 'before' ? 'Before strategy' : 'Applied-state preview'
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
      ? `Reads directly from the shipped ${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon} forecast frame before any rule-driven intervention is applied.`
      : `Reads from the curated rule-driven applied-state preview for the same ${selectedScenario.focusGrid} / ${selectedScenario.focusRoute} scenario frame.`
    : ''
  const activeExplanation = selectedScenario
    ? comparisonMode === 'before'
      ? `Explanation linkage: baseline pressure and alerts come from the selected ${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon} runtime frame, which stays grounded in evaluation-backed ranking authority.`
      : `Explanation linkage: the after-state keeps the same evaluation authority and corridor context, but the values shown here come from the curated offline applied-state preview instead of a live optimizer.`
    : ''

  return (
    <section className="module-page">
      <section className="frame module-summary-band forward-looking-summary-band">
        <div>
          <p className="panel-kicker">Forward-Looking Analysis</p>
          <h1>Rule-driven collaborative decision over shipped forecast and corridor evidence</h1>
          <p className="module-takeaway">
            {summary?.summary ?? 'Loading the Phase 12 curated decision contract from the module bundle.'}
          </p>
        </div>
        <div className="module-kpi-grid forward-looking-kpi-grid">
          <article>
            <span>Curated scenarios</span>
            <strong>{summary?.scenarioCount ?? '--'}</strong>
          </article>
          <article>
            <span>Authority model</span>
            <strong>{summary ? `${summary.selectedModel} ${summary.selectedHorizon}` : '--'}</strong>
          </article>
          <article>
            <span>Lead corridor</span>
            <strong>{summary?.corridorContext.leadingCorridorId ?? '--'}</strong>
          </article>
          <article>
            <span>Noise status</span>
            <strong>{summary ? formatStatusLabel(summary.noiseContext.status) : '--'}</strong>
          </article>
        </div>
        <div className="overview-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
            View Forecast
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('evaluation')}>
            Open Evaluation
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('overview')}>
            Open Overview
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          {!summary || !catalog ? (
            error ? (
              <PlatformStatusSurface
                tone="error"
                title="Forward-looking data unavailable"
                summary="The forward-looking bundle could not be opened."
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
                    <p className="panel-kicker">Curated Scenarios</p>
                    <h2>Select one rule-driven decision frame</h2>
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
                        <span className="corridor-chip">{`drop ${formatDecimal(scenario.focusPressureDrop)}`}</span>
                        <span className="corridor-chip">{`${scenario.alertCountBefore} -> ${scenario.alertCountAfter} hotspots`}</span>
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
                        <p className="panel-kicker">Focus Surface</p>
                        <h2>Interactive route and grid context grounded in shipped geometry</h2>
                      </div>
                      <span className="panel-code">12-02</span>
                    </div>

                    <div className="module-card-grid forward-looking-context-grid">
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>Evaluation anchor</span>
                        <strong>{`${selectedScenario.selectedModel} ranks #${selectedScenario.evaluationContext.rank}`}</strong>
                        <small>{selectedScenario.evaluationContext.summary}</small>
                      </article>
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>Corridor dominance spine</span>
                        <strong>{summary.corridorContext.leadingCorridorId}</strong>
                        <small>{selectedScenario.corridorContext.detail}</small>
                      </article>
                      <article className="metric-spotlight-card forward-looking-context-card">
                        <span>Delivery boundary</span>
                        <strong>No fake optimizer or fake re-clustering</strong>
                        <small>The before/after toggle now updates one shared state surface, but every value still comes from committed offline evidence rather than a live control loop.</small>
                      </article>
                    </div>

                    <div className="forward-looking-toggle-shell">
                      <div className="forward-looking-toggle-group" role="tablist" aria-label="Strategy state toggle">
                        {comparisonModes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            role="tab"
                            aria-selected={comparisonMode === mode}
                            className={`forward-looking-toggle-button${comparisonMode === mode ? ' is-active' : ''}`}
                            onClick={() => setComparisonMode(mode)}
                          >
                            {mode === 'before' ? 'Before strategy' : 'Applied-state preview'}
                          </button>
                        ))}
                      </div>

                      <article className="metric-spotlight-card forward-looking-state-summary-card">
                        <span>State Summary</span>
                        <strong>{`${activeStateTitle} | ${selectedScenario.focusGrid} / ${selectedScenario.focusRoute}`}</strong>
                        <small>{activeStateSummary}</small>
                        <div className="corridor-chip-row">
                          <span className="corridor-chip">{`${formatDecimal(activeFocusPressure)} focus pressure`}</span>
                          <span className="corridor-chip">{`${activeAlertCount} hotspot alerts`}</span>
                          <span className="corridor-chip">{`${selectedScenario.selectedModel} ${selectedScenario.selectedHorizon}`}</span>
                        </div>
                        <p className="forward-looking-state-summary-note">{activeExplanation}</p>
                      </article>
                    </div>

                    <div className="forward-looking-focus-shell">
                      <article className="metric-spotlight-card forward-looking-map-card">
                        <span>Route and Grid Context</span>
                        <strong>{selectedGridBridge ? `${selectedGridBridge.gridId} -> ${selectedRouteId ?? '--'}` : '--'}</strong>
                        <small>Interactive focus route/grid panel grounded in shared geometry.</small>

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
                          <article className="module-deferred-note">
                            <span>Geometry fallback</span>
                            <strong>Shared geometry did not load for the focus surface</strong>
                            <p>The decision layer still renders from scenario evidence, but the route/grid surface becomes fully interactive only when shared geometry is available.</p>
                          </article>
                        )}
                      </article>

                      <div className="forward-looking-focus-stack">
                        <article className="metric-spotlight-card forward-looking-pressure-card">
                          <span>Focus Grid Pressure</span>
                          <strong>{selectedGridBridge ? `${selectedGridBridge.gridId} / ${selectedRouteId ?? '--'} | ${activeStateTitle}` : '--'}</strong>
                          <small>
                            {comparisonMode === 'before'
                              ? selectedGridBridge?.isFocus
                                ? selectedScenario.emphasis
                                : `Pinned secondary hotspot from the same scenario frame at ${formatMomentLabel(selectedScenario.time)}.`
                              : `Applied-state preview stays tied to ${selectedScenario.strategyHeadline} and does not imply a live optimization pass.`}
                          </small>

                          {selectedGridBridge ? (
                            <div className="forward-looking-pressure-stack">
                              <div className={`forward-looking-pressure-row${comparisonMode === 'before' ? ' is-active' : ''}`}>
                                <label>Forecast before</label>
                                <div className="forward-looking-pressure-track">
                                  <i className="is-before" style={{ width: widthRatio(selectedGridBridge.beforeAlert?.future ?? 0, maxPressure) }} />
                                </div>
                                <span>{formatDecimal(selectedGridBridge.beforeAlert?.future ?? 0)}</span>
                              </div>
                              <div className={`forward-looking-pressure-row${comparisonMode === 'after' ? ' is-active' : ''}`}>
                                <label>Applied preview</label>
                                <div className="forward-looking-pressure-track">
                                  <i className="is-after" style={{ width: widthRatio(selectedGridBridge.afterAlert?.future ?? 0, maxPressure) }} />
                                </div>
                                <span>{formatDecimal(selectedGridBridge.afterAlert?.future ?? 0)}</span>
                              </div>
                            </div>
                          ) : null}

                          <div className="corridor-chip-row">
                            <span className="corridor-chip">{`${activeAlertCount} active hotspot alerts`}</span>
                            <span className="corridor-chip">{`${formatDecimal(selectedScenario.currentTotalFlow)} -> ${formatDecimal(selectedScenario.forecastTotalFlow)} total flow`}</span>
                            {activeGridAlert ? <span className="corridor-chip">{`${activeGridAlert.level} active state`}</span> : null}
                          </div>

                          {selectedGridBridge && activeGridAlert ? (
                            <em>
                              {comparisonMode === 'before'
                                ? `Switch to applied-state preview to inspect ${formatSignedDecimal((selectedGridBridge.afterAlert?.future ?? 0) - (selectedGridBridge.beforeAlert?.future ?? 0))} pressure change for the selected grid.`
                                : `Applied-state preview currently lands at ${formatDecimal(activeGridAlert.future ?? 0)} versus ${formatDecimal(inactiveGridAlert?.future ?? 0)} in the baseline frame.`}
                            </em>
                          ) : null}
                        </article>

                        <article className="corridor-story-note forward-looking-strategy-card">
                          <span>Strategy Summary</span>
                          <strong>{selectedScenario.strategyHeadline}</strong>
                          <p>{comparisonMode === 'before' ? selectedScenario.strategySummary : activeExplanation}</p>
                        </article>
                      </div>
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">Strategy Recommendations</p>
                        <h2>Recommendation Stack tied to explicit forecast evidence</h2>
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
                            <span>{`Step ${index + 1}`}</span>
                            <strong>{recommendation.action}</strong>
                            <small>{recommendation.reason}</small>
                            <em>{recommendation.effect}</em>
                            <div className="corridor-chip-row">
                              <span className="corridor-chip">{recommendation.target}</span>
                              {linkedBridge ? <span className="corridor-chip">{`${linkedBridge.gridId} focus bridge`}</span> : null}
                            </div>
                            {linkedBridge ? (
                              <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => setSelectedGridId(linkedBridge.gridId)}>
                                Pin on focus surface
                              </button>
                            ) : recommendation.target === 'Evidence drawer' ? (
                              <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => onNavigate('evaluation')}>
                                Open Evaluation
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
                        <p className="panel-kicker">Scenario Route Comparison</p>
                        <h2>Corridor dominance enters the route stack without inventing reclustering facts</h2>
                      </div>
                      <span className="panel-code">cross-link</span>
                    </div>

                    <article className="forward-looking-route-note">
                      <span>Corridor-linked route comparison</span>
                      <strong>{`${summary.corridorContext.leadingCorridorId} remains the site-wide movement spine`}</strong>
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
                                <strong>{linkedBridge ? linkedBridge.gridId : 'Context only'}</strong>
                              </div>
                              <em>{routeId === selectedScenario.focusRoute ? 'Focus route' : recommendation ? 'Recommended watch' : 'Context route'}</em>
                            </div>

                            <small>
                              {linkedBridge
                                ? recommendation?.reason ?? `Shared geometry links ${linkedBridge.gridId} to ${routeId}, so this route can inherit hotspot pressure without inventing a new clustering pass.`
                                : 'No shipped hotspot node is mapped to this route, so it stays in corridor context only.'}
                            </small>

                            {linkedBridge ? (
                              <div className="forward-looking-pressure-stack">
                                <div className={`forward-looking-pressure-row${comparisonMode === 'before' ? ' is-active' : ''}`}>
                                  <label>Before</label>
                                  <div className="forward-looking-pressure-track">
                                    <i className="is-before" style={{ width: widthRatio(linkedBridge.beforeAlert?.future ?? 0, maxPressure) }} />
                                  </div>
                                  <span>{formatDecimal(linkedBridge.beforeAlert?.future ?? 0)}</span>
                                </div>
                                <div className={`forward-looking-pressure-row${comparisonMode === 'after' ? ' is-active' : ''}`}>
                                  <label>After</label>
                                  <div className="forward-looking-pressure-track">
                                    <i className="is-after" style={{ width: widthRatio(linkedBridge.afterAlert?.future ?? 0, maxPressure) }} />
                                  </div>
                                  <span>{formatDecimal(linkedBridge.afterAlert?.future ?? 0)}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="forward-looking-route-fallback">
                                Corridor dominance can shape narration here, but the page does not fabricate a route-level hotspot value where shipped geometry has none.
                              </p>
                            )}

                            <div className="corridor-chip-row">
                              {delta !== null ? <span className="corridor-chip">{`${formatSignedDecimal(delta)} delta`}</span> : null}
                              {recommendation ? <span className="corridor-chip">{recommendation.target}</span> : null}
                              {!linkedBridge ? <span className="corridor-chip">geometry only</span> : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">Benefit Switching</p>
                        <h2>One shared toggle now drives benefit cards and state summaries</h2>
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
                            <small>{comparisonMode === 'before' ? 'Baseline before strategy' : 'Applied-state preview after strategy'}</small>
                            <em>{`Compare ${benefit.before}${benefit.unit ?? ''} -> ${benefit.after}${benefit.unit ?? ''}`}</em>
                            <div className="corridor-chip-row">
                              <span className="corridor-chip">{activeStateTitle}</span>
                              <span className="corridor-chip">{`other state ${inactiveValue}${benefit.unit ?? ''}`}</span>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>

                  <div className="module-inline-section">
                    <div className="panel-title">
                      <div>
                        <p className="panel-kicker">Alert Comparison</p>
                        <h2>Hotspot alerts and explanation copy now follow the same state toggle</h2>
                      </div>
                      <span className="panel-code">DECI-03 / DECI-04</span>
                    </div>

                    <div className="module-card-grid forward-looking-alert-grid">
                      <article className="metric-spotlight-card forward-looking-alert-state-card">
                        <span>{activeStateTitle}</span>
                        <strong>{`${activeAlertCount} elevated hotspots`}</strong>
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
                        <span>Explanation linkage</span>
                        <strong>{`${selectedScenario.alertCountBefore} -> ${selectedScenario.alertCountAfter} elevated hotspots`}</strong>
                        <small>{activeExplanation}</small>
                        <div className="corridor-chip-row">
                          <span className="corridor-chip">{`${formatDecimal(selectedScenario.focusPressureBefore)} -> ${formatDecimal(selectedScenario.focusPressureAfter)} focus pressure`}</span>
                          <span className="corridor-chip">{`${selectedScenario.focusGrid} / ${selectedScenario.focusRoute}`}</span>
                          <span className="corridor-chip">{summary.corridorContext.leadingCorridorId}</span>
                        </div>
                        <p className="forward-looking-route-fallback">
                          The toggle switches between the shipped forecast baseline and the curated applied-state preview for the same frame. It does not invent new clustering evidence or imply a live optimizer.
                        </p>
                      </article>
                    </div>

                    <article className="module-deferred-note">
                      <span>Honest boundary</span>
                      <strong>No live optimizer is implied here</strong>
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
                <p className="evaluation-trace-title">Evidence Authority</p>
                <div className="module-side-list">
                  <article>
                    <span>Selected model</span>
                    <strong>{`${summary.evidenceAuthority.selectedModel} ${summary.evidenceAuthority.selectedHorizon}`}</strong>
                    <small>{summary.evidenceAuthority.rationale}</small>
                  </article>
                  <article>
                    <span>Ranking value</span>
                    <strong>{formatDecimal(summary.evidenceAuthority.rankingValue)}</strong>
                    <small>{summary.evidenceAuthority.rankingLabel}</small>
                  </article>
                  <article>
                    <span>Compared models</span>
                    <strong>{summary.evidenceAuthority.comparedModels.map((item) => item.model).join(' / ')}</strong>
                    <small>The decision layer inherits authority from the shipped 1h RMSE ordering in evaluation.</small>
                  </article>
                </div>
              </div>

              <div className="module-inline-section">
                <p className="evaluation-trace-title">Corridor Dominance</p>
                <div className="module-side-list">
                  <article>
                    <span>Lead corridor</span>
                    <strong>{summary.corridorContext.leadingCorridorId}</strong>
                    <small>{summary.corridorContext.narrative}</small>
                  </article>
                  <article>
                    <span>Lead direction</span>
                    <strong>{summary.corridorContext.leadingDirection}</strong>
                    <small>{`${formatPercent(summary.corridorContext.leadingShare)} lead share | ${formatPercent(summary.corridorContext.topThreeShare)} top-three coverage`}</small>
                  </article>
                  <article>
                    <span>Route mapping claim</span>
                    <strong>{summary.corridorContext.routeMappingClaim}</strong>
                    <small>Corridor dominance enters as context only, not as an invented route-level reclustering fact.</small>
                  </article>
                </div>
              </div>

              <div className="module-inline-section">
                <p className="evaluation-trace-title">Deferred CLUS-03</p>
                <div className="module-side-list">
                  <article>
                    <span>{summary.noiseContext.fileName}</span>
                    <strong>{`${formatStatusLabel(summary.noiseContext.status)} | ${summary.noiseContext.fileBytes} bytes`}</strong>
                    <small>{summary.noiseContext.reason}</small>
                  </article>
                </div>
              </div>

              {selectedScenario ? (
                <div className="module-inline-section">
                  <p className="evaluation-trace-title">Scenario Lineage</p>
                  <div className="module-side-list">
                    {selectedScenario.evidenceLineage.map((item) => (
                      <article key={`${selectedScenario.id}-${item.artifactId}`}>
                        <span>{item.label}</span>
                        <strong>{item.artifactId}</strong>
                        <small>{item.detail}</small>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {crossLinks.length ? (
                <div className="module-inline-section">
                  <p className="evaluation-trace-title">Cross-links</p>
                  <div className="module-side-list">
                    {crossLinks.map((link) => (
                      <article key={link.routeId}>
                        <span>{link.label}</span>
                        <strong>{link.routeId}</strong>
                        <small>{link.summary}</small>
                        <button type="button" className="panel-action subtle forward-looking-link-button" onClick={() => onNavigate(link.routeId)}>
                          Open {link.label}
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {deferredItems.length ? (
                <div className="module-inline-section">
                  <p className="evaluation-trace-title">Deferred Next Steps</p>
                  <div className="module-side-list">
                    {deferredItems.map((item) => (
                      <article key={item.id}>
                        <span>{item.id}</span>
                        <strong>{item.label}</strong>
                        <small>{item.summary}</small>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : error ? (
            <PlatformStatusSurface
              tone="error"
              title="Forward-looking analysis unavailable"
              summary="The forward-looking bundle could not be opened."
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
