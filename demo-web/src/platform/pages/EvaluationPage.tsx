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
import { localizeClusteringNoiseFallback, localizeEvaluationOptimization } from '../zhCopy.ts'

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
        setOptimization(optimizationData ? localizeEvaluationOptimization(optimizationData) : null)
        setCorridorDominance(corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null)
        setNoiseFallback(fallback ? localizeClusteringNoiseFallback(fallback) : null)
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
      ? `${noiseFallback.deferredArtifact.fileName} 仍是 0 字节`
      : noiseFallback?.deferredArtifact.status === 'missing'
        ? `${noiseFallback.deferredArtifact.fileName} 仍然缺失`
        : `${noiseFallback?.deferredArtifact.fileName ?? '距离产物'} 无法读取`

  return (
    <section className="module-page">
      <section className="frame module-summary-band evaluation-summary-band">
        <div>
          <p className="panel-kicker">评估中心</p>
          <h1>统一汇总预测与修复的指标和调参证据</h1>
          <p className="module-takeaway">
            {viewModel
              ? corridorLeader
                ? `${viewModel.summary.narrative} ${corridorLeader.corridorId} 现在充当主导 runtime corridor，因此这里会沿着 corridor-led 运动主线来理解模型优胜者，而不是把它们看成孤立表格。${optimization ? ' 同一路径现在也把已交付的离线调参研究带进页面，因此参数搜索不再被困在 notebook 私有证据里。' : ''}`
                : `${viewModel.summary.narrative}${optimization ? ' 同一路径现在也把已交付的离线调参研究带进页面，因此参数搜索不再被困在 notebook 私有证据里。' : ''}`
              : '正在从 Phase 6 bundle 加载评估指标。'}
          </p>
        </div>

        <div className="module-kpi-grid evaluation-kpi-grid">
          <article>
            <span>预测 horizon 数</span>
            <strong>{viewModel?.forecast.horizonOptions.length ?? '--'}</strong>
          </article>
          <article>
            <span>修复 scope 数</span>
            <strong>{viewModel?.repair.scopeOptions.length ?? '--'}</strong>
          </article>
          <article>
            <span>可追溯链接</span>
            <strong>{viewModel?.traceability.totalLinks ?? '--'}</strong>
          </article>
          <article>
            <span>主导 corridor 占比</span>
            <strong>{corridorLeader ? formatSharePercent(corridorLeader.share) : viewModel?.forecast.modelCount ?? '--'}</strong>
          </article>
        </div>

        <div className="evaluation-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
            打开预测页
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('repair')}>
            打开修复页
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('clustering')}>
            追踪 corridor
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">统一记分板</p>
              <h2>跨任务优胜者的统一外壳</h2>
            </div>
            <span className="panel-code">11-01</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="评估数据不可用" summary="评估指标文件无法打开。" detail={error} />
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
                  打开总览
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('forecast')}>
                  打开预测页
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('repair')}>
                  打开修复页
                </button>
                <button type="button" className="panel-action subtle" onClick={() => onNavigate('clustering')}>
                  打开聚类页
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
                  <p className="panel-kicker">预测排名表</p>
                  <h2>按 horizon 与指标对流量预测模型排序</h2>
                </div>
                <span className="panel-code">EVAL-02</span>
              </div>

              <div className="evaluation-filter-shell">
                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">选择 horizon</span>
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
                  <span className="evaluation-filter-label">选择指标</span>
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
                预测表会按照选定的 horizon 和指标对已交付模型进行排序，同时在同一行保留 MAE、RMSE 与 R2。
              </p>

              <div className="module-card-grid">
                {viewModel.forecast.leaderCards.map((ranking) => (
                  <article key={ranking.horizon} className="metric-spotlight-card">
                    <span>{ranking.horizon}</span>
                    <strong>RMSE 领先模型 {ranking.rmseLeader?.model ?? '--'}</strong>
                    <small>MAE 领先模型 {ranking.maeLeader?.model ?? '--'} | 样本数 {ranking.sampleCount || '--'}</small>
                    <em>R2 领先模型 {ranking.r2Leader?.model ?? '--'}</em>
                  </article>
                ))}
              </div>

              <div className="evaluation-table-shell">
                <table className="data-table evaluation-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>模型</th>
                      <th>{viewModel.forecast.metricOptions.find((option) => option.id === viewModel.forecast.selectedMetric)?.label ?? '指标'}</th>
                      <th>样本数</th>
                      <th>MAE</th>
                      <th>RMSE</th>
                      <th>R2</th>
                      <th>领先项数</th>
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
                  <p className="panel-kicker">修复排名表</p>
                  <h2>按样本和指标对修复方法排序</h2>
                </div>
                <span className="panel-code">EVAL-03</span>
              </div>

              <div className="evaluation-filter-shell">
                <div className="evaluation-filter-group">
                  <span className="evaluation-filter-label">选择 scope</span>
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
                  <span className="evaluation-filter-label">选择指标</span>
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
                      <th>排名</th>
                      <th>模型</th>
                      <th>{viewModel.repair.metricOptions.find((option) => option.id === viewModel.repair.selectedMetric)?.label ?? '指标'}</th>
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
                  <p className="panel-kicker">调参证据</p>
                  <h2>把已交付的离线调参研究纳入评估中心</h2>
                </div>
                <span className="panel-code">EVAL-04</span>
              </div>

              <p className="evaluation-filter-caption">{optimization.summary}</p>

              <div className="module-card-grid evaluation-optimization-grid">
                <article className="metric-spotlight-card evaluation-summary-card">
                  <span>Trial 槽位</span>
                  <strong>{optimization.objective.totalTrialSlots}</strong>
                  <small>导出历史中仍明确保留了 {optimization.objective.nonCompletedTrialSlots} 个未完成槽位。</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card">
                  <span>完成点位</span>
                  <strong>{optimization.objective.completedTrials}</strong>
                  <small>{optimization.objective.metricLabel} 的这些点位已经到达最终可见目标值。</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card evaluation-tone-accent">
                  <span>最佳检查点</span>
                  <strong>
                    Trial {optimization.objective.bestTrial} | {formatOptimizationValue(optimization.objective.bestValue)}
                  </strong>
                  <small>比导出中展示的第一个已完成点提升了 {formatSharePercent(optimization.objective.improvementRatio)}。</small>
                </article>
                <article className="metric-spotlight-card evaluation-summary-card evaluation-tone-warning">
                  <span>主导参数</span>
                  <strong>
                    {leadingOptimizationParameter?.label ?? '--'}
                    {secondaryOptimizationParameter ? ` + ${secondaryOptimizationParameter.label}` : ''}
                  </strong>
                  <small>参数重要性中有 {formatSharePercent(optimization.importance.topTwoShare)} 集中在前两个参数上。</small>
                </article>
              </div>

              <div className="evaluation-optimization-columns">
                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">调参历史</p>
                    <strong>
                      {optimization.studyLabel} | 最优值 {formatOptimizationValue(optimization.objective.bestValue)}
                    </strong>
                  </div>

                  <div className="evaluation-history-chart-shell">
                    <svg
                      className="evaluation-history-chart"
                      viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`}
                      role="img"
                      aria-label="调参历史图"
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
                        <span>{index === 0 ? '初始最优' : '新的最优'}</span>
                        <strong>Trial {checkpoint.trial}</strong>
                        <small>{formatOptimizationValue(checkpoint.value)}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">参数重要性</p>
                    <strong>
                      {leadingOptimizationParameter ? `${leadingOptimizationParameter.label} 领先` : '重要性排序'}
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
                    <p className="evaluation-trace-title">最佳参数组合</p>
                    <strong>从当前可见的最佳已完成 Trial 中恢复</strong>
                  </div>

                  <div className="module-card-grid evaluation-best-param-grid">
                    {optimization.bestParameters.map((parameter) => (
                      <article key={parameter.id} className="metric-spotlight-card">
                        <span>{parameter.label}</span>
                        <strong>{parameter.displayValue}</strong>
                        <small>
                          已完成 Trial 范围 {parameter.observedMinDisplay} - {parameter.observedMaxDisplay}
                          {parameter.scale === 'log10' ? ' | log 搜索' : ''}
                        </small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="evaluation-optimization-panel">
                  <div className="evaluation-panel-heading">
                    <p className="evaluation-trace-title">辅助离线视图</p>
                    <strong>结构化摘要旁边保留原始导出结果</strong>
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
                  <p className="panel-kicker">Corridor dominance 上下文</p>
                  <h2>为什么排名需要聚类语境</h2>
                </div>
                <span className="panel-code">TRACE</span>
              </div>

              <div className="module-card-grid corridor-dominance-grid">
                <article className="metric-spotlight-card">
                  <span>主导 corridor</span>
                  <strong>{corridorLeader ? `${corridorLeader.corridorId} ${formatSharePercent(corridorLeader.share)}` : '加载中'}</strong>
                  <small>
                    {corridorLeader
                      ? `当前有 ${corridorLeader.trackCount} 条 runtime 轨迹流经这条 corridor，它正在锚定整站的运动叙事。`
                      : '正在等待 clustering runtime 上下文。'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>主导方向</span>
                  <strong>{leadingDirection ? `${leadingDirection.directionLabel} ${formatSharePercent(leadingDirection.share)}` : '加载中'}</strong>
                  <small>
                    {leadingDirection
                      ? `${leadingDirection.corridorCount} 条 corridor 汇入该方向家族，由 ${leadingDirection.leadCorridorId} 领头。`
                      : '方向家族汇总暂不可用。'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>评估焦点</span>
                  <strong>{formatSharePercent(corridorDominance.topThreeShare)}</strong>
                  <small>前三条 corridor 覆盖了这些 runtime 流量，因此预测与修复对比应优先回链到高密度 corridor 行为。</small>
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
                  <strong>评估页沿用同一条 fallback 边界</strong>
                  <p>
                    {noiseReason.count} 条分段，也就是原始聚类输入的 {formatSharePercent(noiseShare)}，仍停留在经过验证的噪声池里。由于 {noiseArtifactStatus}，且当前大小为 {noiseFallback.deferredArtifact.fileBytes} 字节，这个页面会把 CLUS-03 作为明确的 deferred 上下文，而不是假装自己正在对比一个已恢复的重聚类结果。
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="frame module-side-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">追溯链接</p>
              <h2>来源 lineage 与需求覆盖</h2>
            </div>
            <span className="panel-code">EVAL-05</span>
          </div>

          {viewModel ? (
            <div className="evaluation-trace-shell">
              <div className="evaluation-trace-group">
                <p className="evaluation-trace-title">已提交产物</p>
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
                <p className="evaluation-trace-title">来源 lineage</p>
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
                <span>可追溯性</span>
                <strong>加载中</strong>
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
              <span>来源 lineage</span>
              <strong>页面数字始终绑定到已提交的离线产物</strong>
              <p>
                上面的统一表格可以一路回溯到 evaluation bundle、forecast metrics、repair metrics、optimization 导出结果，以及这里列出的 artifact-index lineage，因此这条路线是一个真正的证据中心，而不是只讲故事的 dashboard。
              </p>
            </div>
          ) : null}

          {optimization ? (
            <div className="corridor-story-note">
              <span>调参 lineage</span>
              <strong>{optimization.studyId} 始终绑定到已提交导出结果</strong>
              <p>
                EVAL-04 面板来自结构化 optimization 产物以及这里列出的原始 HTML 与 notebook 路径，因此调参证据保持可审阅，而不会假装 demo 在浏览器里重新跑了一遍 Optuna。
              </p>
            </div>
          ) : null}

          {corridorLeader ? (
            <div className="corridor-story-note">
              <span>跨页回链</span>
              <strong>{corridorLeader.corridorId} 让记分板保持落地</strong>
              <p>
                总览页现在会在进入本页前先介绍 corridor dominance，而 clustering 则提供 runtime 证据。这样评估壳层就能解释为什么最佳模型排名首先要在最密集的 corridor 家族上成立，而不是把所有路径都视为同等代表性。
              </p>
            </div>
          ) : null}

          {noiseFallback && noiseReason ? (
            <div className="corridor-story-note">
              <span>fallback 证据</span>
              <strong>noise 重聚类仍被有意识地排除在外</strong>
              <p>
                评估页现在复用 clustering 和 overview 已经说明的整站原因：今天只有重聚类前的噪声池统计可信，因此 CLUS-03 仍然是一条 deferred 证据线，而不是一个被隐藏或被伪造的对比结果。
              </p>
            </div>
          ) : null}

          {(metrics?.forecast?.deferredModels ?? []).length ? (
            <div className="module-deferred-note">
              <span>后续更新</span>
              <strong>当前版本暂未提供</strong>
              <p>{metrics?.forecast?.deferredModels?.[0]?.reason}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
