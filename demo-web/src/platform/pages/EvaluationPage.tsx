import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { MainCorridorTracksFile, ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import {
  buildCorridorDominanceSummary,
  CLUSTERING_CORRIDOR_RUNTIME_PATH,
  formatSharePercent,
  type CorridorDominanceSummary,
} from '../clustering/corridorDominance.ts'
import type { ClusteringNoiseFallback } from '../clustering/clusteringTypes.ts'
import { buildEvaluationViewModel } from '../evaluation/evaluationViewModel.ts'
import type {
  EvaluationForecastMetricKey,
  EvaluationMetricsFile,
  EvaluationOptimizationFile,
  EvaluationRepairMetricKey,
} from '../evaluation/evaluationTypes.ts'

type EvaluationPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

const CLUSTERING_NOISE_FALLBACK_PATH = '/data/modules/clustering/clustering-noise-fallback.json'
const EVALUATION_OPTIMIZATION_PATH = '/data/modules/evaluation/evaluation-optimization.json'
const HISTORY_CHART_WIDTH = 320
const HISTORY_CHART_HEIGHT = 160
const HISTORY_CHART_PADDING_X = 18
const HISTORY_CHART_PADDING_Y = 18

function formatMetricValue(metric: string, value: number) {
  if (!Number.isFinite(value)) return '--'
  if (metric === 'r2' || metric === 'dtwSimilarity') return value.toFixed(3)
  if (value !== 0 && Math.abs(value) < 0.01) return value.toExponential(3)
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(3)
}

function formatOptimizationValue(value: number) {
  if (!Number.isFinite(value)) return '--'
  return value.toExponential(3)
}

function getHistoryChartPoint(trial: number, value: number, maxTrial: number, minValue: number, maxValue: number) {
  const safeMaxTrial = maxTrial > 0 ? maxTrial : 1
  const valueSpan = maxValue > minValue ? maxValue - minValue : 1
  const chartWidth = HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING_X * 2
  const chartHeight = HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING_Y * 2
  const x = HISTORY_CHART_PADDING_X + (trial / safeMaxTrial) * chartWidth
  const y = HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING_Y - ((value - minValue) / valueSpan) * chartHeight
  return { x, y }
}

function buildHistoryPolyline(points: Array<{ trial: number; value: number }>, maxTrial: number, minValue: number, maxValue: number) {
  return points
    .map((point) => {
      const chartPoint = getHistoryChartPoint(point.trial, point.value, maxTrial, minValue, maxValue)
      return `${chartPoint.x.toFixed(1)},${chartPoint.y.toFixed(1)}`
    })
    .join(' ')
}

export function EvaluationPage({ entry, onNavigate }: EvaluationPageProps) {
  const [metrics, setMetrics] = useState<EvaluationMetricsFile | null>(null)
  const [optimization, setOptimization] = useState<EvaluationOptimizationFile | null>(null)
  const [corridorDominance, setCorridorDominance] = useState<CorridorDominanceSummary | null>(null)
  const [noiseFallback, setNoiseFallback] = useState<ClusteringNoiseFallback | null>(null)
  const [selectedForecastHorizon, setSelectedForecastHorizon] = useState('')
  const [selectedForecastMetric, setSelectedForecastMetric] = useState<EvaluationForecastMetricKey>('rmse')
  const [selectedRepairScopeId, setSelectedRepairScopeId] = useState('')
  const [selectedRepairMetric, setSelectedRepairMetric] = useState<EvaluationRepairMetricKey>('rmse')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<EvaluationMetricsFile>(`/${entry.entryFiles.metrics}`),
      loadPublicJson<MainCorridorTracksFile>(CLUSTERING_CORRIDOR_RUNTIME_PATH).catch(() => null),
      loadPublicJson<ClusteringNoiseFallback>(CLUSTERING_NOISE_FALLBACK_PATH).catch(() => null),
      loadPublicJson<EvaluationOptimizationFile>(entry.entryFiles.optimization ? `/${entry.entryFiles.optimization}` : EVALUATION_OPTIMIZATION_PATH).catch(
        () => null,
      ),
    ])
      .then(([data, corridorRuntime, fallback, optimizationData]) => {
        if (cancelled) return
        setMetrics(data)
        setOptimization(optimizationData)
        setCorridorDominance(corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null)
        setNoiseFallback(fallback)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setOptimization(null)
        setError(loadError instanceof Error ? loadError.message : 'Failed to load evaluation metrics.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.metrics, entry.entryFiles.optimization])

  const viewModel = metrics
    ? buildEvaluationViewModel(metrics, entry, {
        selectedForecastHorizon,
        selectedForecastMetric,
        selectedRepairScopeId,
        selectedRepairMetric,
      })
    : null

  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null
  const noiseReason = noiseFallback?.dropReasons.find((reason) => reason.id === 'dbscan_noise') ?? null
  const noiseShare = noiseFallback && noiseReason ? (noiseFallback.counts.rawSegments > 0 ? noiseReason.count / noiseFallback.counts.rawSegments : 0) : 0
  const historyCompletedPoints = optimization?.objective.completedPoints ?? []
  const historyBestCurvePoints = optimization?.objective.bestCurvePoints ?? []
  const historyMaxTrial = historyBestCurvePoints[historyBestCurvePoints.length - 1]?.trial ?? historyCompletedPoints[historyCompletedPoints.length - 1]?.trial ?? 1
  const historyValues = [...historyBestCurvePoints, ...historyCompletedPoints].map((point) => point.value)
  const historyMinValue = historyValues.length ? Math.min(...historyValues) : 0
  const historyMaxValue = historyValues.length ? Math.max(...historyValues) : 1
  const historyPolyline = optimization ? buildHistoryPolyline(historyBestCurvePoints, historyMaxTrial, historyMinValue, historyMaxValue) : ''
  const leadingOptimizationParameter = optimization?.importance.parameters[0] ?? null
  const secondaryOptimizationParameter = optimization?.importance.parameters[1] ?? null
  const noiseArtifactStatus =
    noiseFallback?.deferredArtifact.status === 'zero-byte'
      ? `${noiseFallback.deferredArtifact.fileName} is still 0 bytes`
      : noiseFallback?.deferredArtifact.status === 'missing'
        ? `${noiseFallback.deferredArtifact.fileName} is still missing`
        : `${noiseFallback?.deferredArtifact.fileName ?? 'The distance artifact'} is unreadable`

  return (
    <section className="module-page">
      <section className="frame module-summary-band evaluation-summary-band">
        <div>
          <p className="panel-kicker">Evaluation Center</p>
          <h1>Unified metric and tuning evidence across forecast and repair</h1>
          <p className="module-takeaway">
            {viewModel
              ? corridorLeader
                ? `${viewModel.summary.narrative} ${corridorLeader.corridorId} now acts as the dominant runtime corridor, so the center reads model winners against the corridor-led movement spine instead of as detached tables.${optimization ? ' The same route now surfaces the shipped offline tuning study, so parameter search no longer stays trapped in notebook-only evidence.' : ''}`
                : `${viewModel.summary.narrative}${optimization ? ' The same route now surfaces the shipped offline tuning study, so parameter search no longer stays trapped in notebook-only evidence.' : ''}`
              : 'Loading evaluation metrics from the Phase 6 bundle.'}
          </p>
        </div>

        <div className="module-kpi-grid evaluation-kpi-grid">
          <article>
            <span>Forecast horizons</span>
            <strong>{viewModel?.forecast.horizonOptions.length ?? '--'}</strong>
          </article>
          <article>
            <span>Repair scopes</span>
            <strong>{viewModel?.repair.scopeOptions.length ?? '--'}</strong>
          </article>
          <article>
            <span>Traceability links</span>
            <strong>{viewModel?.traceability.totalLinks ?? '--'}</strong>
          </article>
          <article>
            <span>Dominant corridor share</span>
            <strong>{corridorLeader ? formatSharePercent(corridorLeader.share) : viewModel?.forecast.modelCount ?? '--'}</strong>
          </article>
        </div>

        <div className="evaluation-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
            Open Forecast
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('repair')}>
            Open Repair
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('clustering')}>
            Trace Corridor
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Unified Scoreboard</p>
              <h2>One shell for cross-task winners</h2>
            </div>
            <span className="panel-code">11-01</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Evaluation data unavailable" summary="The evaluation metrics file could not be opened." detail={error} />
          ) : viewModel ? (
            <div className="module-inline-section evaluation-score-shell">
              <p className="clustering-link-copy">{viewModel.summary.narrative}</p>

              <div className="module-card-grid evaluation-score-grid">
                {viewModel.summary.cards.map((card) => (
                  <article key={card.label} className={`metric-spotlight-card evaluation-summary-card evaluation-tone-${card.tone}`}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </article>
                ))}
              </div>

              <div className="evaluation-link-row">
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('overview')}>
                  Open Overview
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('forecast')}>
                  Open Forecast
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('repair')}>
                  Open Repair
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('clustering')}>
                  Open Clustering
                </button>
              </div>
            </div>
          ) : (
            <div className="module-skeleton-grid">
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
            </div>
          )}

          {viewModel ? (
            <div className="module-inline-section evaluation-ranking-shell">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Forecast Ranking Table</p>
                  <h2>Rank flow prediction models by horizon and metric</h2>
                </div>
                <span className="panel-code">EVAL-02</span>
              </div>

              <div className="evaluation-filter-shell">
                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">Select horizon</span>
                  <div className="evaluation-filter-row">
                    {viewModel.forecast.horizonOptions.map((horizon) => (
                      <button
                        key={horizon}
                        type="button"
                        className={`evaluation-filter-button${viewModel.forecast.selectedHorizon === horizon ? ' is-selected' : ''}`}
                        onClick={() => setSelectedForecastHorizon(horizon)}
                      >
                        {horizon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">Select metric</span>
                  <div className="evaluation-filter-row">
                    {viewModel.forecast.metricOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`evaluation-filter-button${viewModel.forecast.selectedMetric === option.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedForecastMetric(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="evaluation-filter-caption">
                The forecast table sorts the shipped models by the selected horizon and metric while keeping MAE, RMSE, and R2 visible in the same row.
              </p>

              <div className="module-card-grid">
                {viewModel.forecast.leaderCards.map((ranking) => (
                  <article key={ranking.horizon} className="metric-spotlight-card">
                    <span>{ranking.horizon}</span>
                    <strong>RMSE leader {ranking.rmseLeader?.model ?? '--'}</strong>
                    <small>MAE leader {ranking.maeLeader?.model ?? '--'} | samples {ranking.sampleCount || '--'}</small>
                    <em>R2 leader {ranking.r2Leader?.model ?? '--'}</em>
                  </article>
                ))}
              </div>

              <div className="evaluation-table-shell">
                <table className="data-table evaluation-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Model</th>
                      <th>{viewModel.forecast.metricOptions.find((option) => option.id === viewModel.forecast.selectedMetric)?.label ?? 'Metric'}</th>
                      <th>Samples</th>
                      <th>MAE</th>
                      <th>RMSE</th>
                      <th>R2</th>
                      <th>Leader slots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.forecast.rows.map((row) => (
                      <tr key={row.model}>
                        <td>{row.rank}</td>
                        <td>{row.model}</td>
                        <td className="evaluation-highlight-cell">{formatMetricValue(viewModel.forecast.selectedMetric, row.value)}</td>
                        <td>{row.sampleCount}</td>
                        <td>{formatMetricValue('mae', row.mae)}</td>
                        <td>{formatMetricValue('rmse', row.rmse)}</td>
                        <td>{formatMetricValue('r2', row.r2)}</td>
                        <td>{row.leaderSlots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {viewModel ? (
            <div className="module-inline-section evaluation-ranking-shell">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Repair Ranking Table</p>
                  <h2>Rank repair methods by sample and metric</h2>
                </div>
                <span className="panel-code">EVAL-03</span>
              </div>

              <div className="evaluation-filter-shell">
                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">Select scope</span>
                  <div className="evaluation-filter-row">
                    {viewModel.repair.scopeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`evaluation-filter-button${viewModel.repair.selectedScope.id === option.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedRepairScopeId(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">Select metric</span>
                  <div className="evaluation-filter-row">
                    {viewModel.repair.metricOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`evaluation-filter-button${viewModel.repair.selectedMetric === option.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedRepairMetric(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="evaluation-filter-caption">{viewModel.repair.selectedScope.description}</p>

              <div className="evaluation-table-shell">
                <table className="data-table evaluation-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Model</th>
                      <th>{viewModel.repair.metricOptions.find((option) => option.id === viewModel.repair.selectedMetric)?.label ?? 'Metric'}</th>
                      <th>RMSE</th>
                      <th>MAE</th>
                      <th>DTW</th>
                      <th>ADE</th>
                      <th>R2</th>
                      <th>Hausdorff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.repair.rows.map((row) => (
                      <tr key={`${viewModel.repair.selectedScope.id}-${row.modelId}`}>
                        <td>{row.rank}</td>
                        <td>{row.modelLabel}</td>
                        <td className="evaluation-highlight-cell">{formatMetricValue(viewModel.repair.selectedMetric, row.value)}</td>
                        <td>{formatMetricValue('rmse', row.rmse)}</td>
                        <td>{formatMetricValue('mae', row.mae)}</td>
                        <td>{formatMetricValue('dtwSimilarity', row.dtwSimilarity)}</td>
                        <td>{formatMetricValue('ade', row.ade)}</td>
                        <td>{formatMetricValue('r2', row.r2)}</td>
                        <td>{formatMetricValue('hausdorffDistance', row.hausdorffDistance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {optimization ? (
            <div className="module-inline-section evaluation-optimization-shell">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Optimization Evidence</p>
                  <h2>Expose the shipped offline tuning study inside the evaluation center</h2>
                </div>
                <span className="panel-code">EVAL-04</span>
              </div>

              <p className="evaluation-filter-caption">{optimization.summary}</p>

              <div className="module-card-grid evaluation-optimization-grid">
                <article className="metric-spotlight-card evaluation-summary-card">
                  <span>Trial slots</span>
                  <strong>{optimization.objective.totalTrialSlots}</strong>
                  <small>{optimization.objective.nonCompletedTrialSlots} non-complete slots remain explicit in the exported history.</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card">
                  <span>Completed points</span>
                  <strong>{optimization.objective.completedTrials}</strong>
                  <small>{optimization.objective.metricLabel} points reached a final visible objective value.</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card evaluation-tone-accent">
                  <span>Best checkpoint</span>
                  <strong>
                    Trial {optimization.objective.bestTrial} | {formatOptimizationValue(optimization.objective.bestValue)}
                  </strong>
                  <small>{formatSharePercent(optimization.objective.improvementRatio)} better than the first completed point shown in the export.</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card evaluation-tone-warning">
                  <span>Dominant knobs</span>
                  <strong>
                    {leadingOptimizationParameter?.label ?? '--'}
                    {secondaryOptimizationParameter ? ` + ${secondaryOptimizationParameter.label}` : ''}
                  </strong>
                  <small>{formatSharePercent(optimization.importance.topTwoShare)} of the importance ranking sits in the top two parameters.</small>
                </article>
              </div>

              <div className="evaluation-optimization-columns">
                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">Optimization History</p>
                    <strong>
                      {optimization.studyLabel} | best {formatOptimizationValue(optimization.objective.bestValue)}
                    </strong>
                  </div>

                  <div className="evaluation-history-chart-shell">
                    <svg
                      className="evaluation-history-chart"
                      viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`}
                      role="img"
                      aria-label="Optimization history chart"
                    >
                      <line
                        x1={HISTORY_CHART_PADDING_X}
                        y1={HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING_Y}
                        x2={HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING_X}
                        y2={HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING_Y}
                      />
                      <line
                        x1={HISTORY_CHART_PADDING_X}
                        y1={HISTORY_CHART_PADDING_Y}
                        x2={HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING_X}
                        y2={HISTORY_CHART_PADDING_Y}
                      />
                      <polyline className="evaluation-history-best-line" points={historyPolyline} />
                      {historyCompletedPoints.map((point) => {
                        const chartPoint = getHistoryChartPoint(point.trial, point.value, historyMaxTrial, historyMinValue, historyMaxValue)
                        return (
                          <circle
                            key={point.trial}
                            className="evaluation-history-point"
                            cx={chartPoint.x}
                            cy={chartPoint.y}
                            r={3.2}
                          />
                        )
                      })}
                    </svg>
                    <div className="evaluation-history-axis">
                      <span>Trial 0</span>
                      <span>Trial {historyMaxTrial}</span>
                    </div>
                  </div>

                  <div className="module-card-grid evaluation-checkpoint-grid">
                    {optimization.objective.checkpoints.map((checkpoint, index) => (
                      <article key={checkpoint.trial} className="metric-spotlight-card">
                        <span>{index === 0 ? 'Initial best' : 'New best'}</span>
                        <strong>Trial {checkpoint.trial}</strong>
                        <small>{formatOptimizationValue(checkpoint.value)}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">Parameter Importance</p>
                    <strong>
                      {leadingOptimizationParameter ? `${leadingOptimizationParameter.label} leads` : 'Importance ranking'}
                    </strong>
                  </div>

                  <div className="evaluation-importance-list">
                    {optimization.importance.parameters.map((parameter) => (
                      <div key={parameter.id} className="evaluation-importance-row">
                        <div className="evaluation-importance-meta">
                          <span>
                            {parameter.rank}. {parameter.label}
                          </span>
                          <strong>{formatSharePercent(parameter.importance)}</strong>
                        </div>
                        <div className="evaluation-importance-bar">
                          <span style={{ width: `${Math.max(parameter.importance * 100, 8)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="evaluation-optimization-columns">
                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">Best Parameter Set</p>
                    <strong>Recovered from the best visible completed trial</strong>
                  </div>

                  <div className="module-card-grid evaluation-best-param-grid">
                    {optimization.bestParameters.map((parameter) => (
                      <article key={parameter.id} className="metric-spotlight-card">
                        <span>{parameter.label}</span>
                        <strong>{parameter.displayValue}</strong>
                        <small>
                          Completed-trial range {parameter.observedMinDisplay} - {parameter.observedMaxDisplay}
                          {parameter.scale === 'log10' ? ' | log search' : ''}
                        </small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">Supporting Offline Views</p>
                    <strong>Raw exports stay visible beside the structured summary</strong>
                  </div>

                  <div className="module-side-list">
                    {optimization.supportingViews.map((view) => (
                      <article key={view.id}>
                        <span>{view.label}</span>
                        <strong>{view.path}</strong>
                        <small>{view.detail}</small>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {corridorDominance ? (
            <div className="module-inline-section">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Corridor Dominance Context</p>
                  <h2>Why the rankings need clustering context</h2>
                </div>
                <span className="panel-code">TRACE</span>
              </div>

              <div className="module-card-grid corridor-dominance-grid">
                <article className="metric-spotlight-card">
                  <span>Lead corridor</span>
                  <strong>{corridorLeader ? `${corridorLeader.corridorId} ${formatSharePercent(corridorLeader.share)}` : 'Loading'}</strong>
                  <small>
                    {corridorLeader
                      ? `${corridorLeader.trackCount} runtime tracks flow through the corridor that currently anchors the site-level movement story.`
                      : 'Waiting for clustering runtime context.'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Dominant direction</span>
                  <strong>{leadingDirection ? `${leadingDirection.directionLabel} ${formatSharePercent(leadingDirection.share)}` : 'Loading'}</strong>
                  <small>
                    {leadingDirection
                      ? `${leadingDirection.corridorCount} corridors roll up into the main direction family, led by ${leadingDirection.leadCorridorId}.`
                      : 'Direction-family rollup is unavailable.'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Evaluation focus</span>
                  <strong>{formatSharePercent(corridorDominance.topThreeShare)}</strong>
                  <small>The top three corridors cover this much runtime traffic, so forecast and repair comparisons should stay traceable to dense corridor behavior first.</small>
                </article>
              </div>

              <div className="corridor-chip-row">
                {corridorDominance.topCorridors.slice(0, 3).map((corridor) => (
                  <span key={corridor.corridorId} className="corridor-chip">
                    {corridor.corridorId} {formatSharePercent(corridor.share)}
                  </span>
                ))}
              </div>

              {noiseFallback && noiseReason ? (
                <div className="corridor-story-note">
                  <span>Deferred CLUS-03</span>
                  <strong>Evaluation keeps the same fallback boundary</strong>
                  <p>
                    {noiseReason.count} segments, or {formatSharePercent(noiseShare)} of raw clustering input, still sit in the verified noise pool.
                    Because {noiseArtifactStatus} at {noiseFallback.deferredArtifact.fileBytes} bytes, this page treats CLUS-03 as an explicit deferred
                    context instead of pretending to compare against a recovered reclustering result.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="frame module-side-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Traceability Links</p>
              <h2>Source lineage and requirement coverage</h2>
            </div>
            <span className="panel-code">EVAL-05</span>
          </div>

          {viewModel ? (
            <div className="evaluation-trace-shell">
              <div className="evaluation-trace-group">
                <p className="evaluation-trace-title">Committed artifacts</p>
                <div className="module-side-list">
                  {viewModel.traceability.artifactEntries.map((trace) => (
                    <article key={trace.id}>
                      <span>{trace.label}</span>
                      <strong>{trace.path}</strong>
                      <small>{trace.detail}</small>
                    </article>
                  ))}
                </div>
              </div>

              <div className="evaluation-trace-group">
                <p className="evaluation-trace-title">Source lineage</p>
                <div className="module-side-list">
                  {viewModel.traceability.sourceEntries.map((trace) => (
                    <article key={trace.id}>
                      <span>{trace.label}</span>
                      <strong>{trace.path}</strong>
                      <small>{trace.detail}</small>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="module-side-list">
              <article>
                <span>Traceability</span>
                <strong>Loading</strong>
              </article>
            </div>
          )}

          {viewModel ? (
            <div className="corridor-chip-row">
              {viewModel.traceability.requirementCodes.map((requirementCode) => (
                <span key={requirementCode} className="corridor-chip">
                  {requirementCode}
                </span>
              ))}
            </div>
          ) : null}

          {viewModel ? (
            <div className="corridor-story-note">
              <span>Source lineage</span>
              <strong>Displayed numbers stay tied to committed offline artifacts</strong>
              <p>
                The unified tables above can be walked back to the evaluation bundle, forecast metrics, repair metrics, optimization exports,
                and artifact-index lineage listed here, so this route works as a real evidence center instead of a narrative-only dashboard.
              </p>
            </div>
          ) : null}

          {optimization ? (
            <div className="corridor-story-note">
              <span>Optimization lineage</span>
              <strong>{optimization.studyId} stays tied to committed exports</strong>
              <p>
                The EVAL-04 panel is derived from the structured optimization artifact plus the raw HTML and notebook paths listed here, so
                tuning evidence stays reviewable without pretending the demo reran Optuna in-browser.
              </p>
            </div>
          ) : null}

          {corridorLeader ? (
            <div className="corridor-story-note">
              <span>Cross-link</span>
              <strong>{corridorLeader.corridorId} keeps the scoreboard grounded</strong>
              <p>
                Overview now introduces corridor dominance before this page, and clustering provides the runtime evidence. That way the evaluation shell
                can explain why the best model rankings matter most on the densest corridor family instead of treating every path as equally
                representative.
              </p>
            </div>
          ) : null}

          {noiseFallback && noiseReason ? (
            <div className="corridor-story-note">
              <span>Fallback evidence</span>
              <strong>Noise re-clustering is still intentionally excluded</strong>
              <p>
                Evaluation now repeats the same site-wide reason shown in clustering and overview: only the pre-reclustering noise-pool counts are
                trustworthy today, so CLUS-03 remains a deferred evidence track rather than a hidden or mocked comparison.
              </p>
            </div>
          ) : null}

          {(metrics?.forecast?.deferredModels ?? []).length ? (
            <div className="module-deferred-note">
              <span>Later update</span>
              <strong>Not available in this version</strong>
              <p>{metrics?.forecast?.deferredModels?.[0]?.reason}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
