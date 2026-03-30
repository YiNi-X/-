import type { RepairErrorMetricKey, RepairViewModel } from './repairTypes.ts'

type RepairDetailGridProps = {
  viewModel: RepairViewModel
  selectedModelId: string
  selectedErrorMetric: RepairErrorMetricKey
  onSelectModel: (modelId: string) => void
}

function toPath(values: number[], width: number, height: number, maxValue: number) {
  if (!values.length || maxValue <= 0) return ''
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - (value / maxValue) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function metricLabel(metric: RepairErrorMetricKey) {
  switch (metric) {
    case 'lonDifference':
      return 'Longitude difference'
    case 'latDifference':
      return 'Latitude difference'
    default:
      return 'Euclidean distance'
  }
}

export function RepairDetailGrid({ viewModel, selectedModelId, selectedErrorMetric, onSelectModel }: RepairDetailGridProps) {
  const width = 720
  const height = 220
  const maxValue = Math.max(1e-9, ...viewModel.errors.selectedSeriesByModel.flatMap((item) => item.values))
  const selectedMetrics = viewModel.metrics.selectedModel

  return (
    <section className="repair-detail-grid">
      <section className="frame repair-detail-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Error Stage</p>
            <h2>{metricLabel(selectedErrorMetric)} by repaired point index</h2>
          </div>
          <span className="panel-code">ERROR</span>
        </div>

        {selectedMetrics ? (
          <div className="repair-selected-metric-grid">
            <article className="repair-selected-metric-card">
              <span>RMSE</span>
              <strong>{selectedMetrics.rmse.toExponential(3)}</strong>
            </article>
            <article className="repair-selected-metric-card">
              <span>MAE</span>
              <strong>{selectedMetrics.mae.toExponential(3)}</strong>
            </article>
            <article className="repair-selected-metric-card">
              <span>DTW</span>
              <strong>{selectedMetrics.dtwSimilarity.toFixed(3)}</strong>
            </article>
            <article className="repair-selected-metric-card">
              <span>R-squared</span>
              <strong>{selectedMetrics.r2.toFixed(6)}</strong>
            </article>
            <article className="repair-selected-metric-card">
              <span>Hausdorff</span>
              <strong>{selectedMetrics.hausdorffDistance.toExponential(3)}</strong>
            </article>
            <article className="repair-selected-metric-card">
              <span>ADE</span>
              <strong>{selectedMetrics.ade.toExponential(3)}</strong>
            </article>
          </div>
        ) : null}

        <div className="repair-error-shell">
          <div className="repair-error-legend">
            {viewModel.errors.selectedSeriesByModel.map((series) => (
              <span key={series.modelId} className={series.highlighted ? 'is-selected' : ''}>
                {series.modelLabel}
              </span>
            ))}
          </div>
          <div className="repair-error-canvas">
            <svg viewBox={`0 0 ${width} ${height}`} className="repair-error-svg" role="img" aria-label="Repair error chart">
              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  y1={(height - height * ratio).toFixed(2)}
                  x2={String(width)}
                  y2={(height - height * ratio).toFixed(2)}
                  className="repair-grid-line"
                />
              ))}
              {viewModel.errors.selectedSeriesByModel.map((series) => (
                <path
                  key={series.modelId}
                  d={toPath(series.values, width, height, maxValue)}
                  className={`repair-error-line${series.highlighted ? ' is-highlighted' : ''}`}
                />
              ))}
            </svg>
          </div>
          <p className="repair-panel-note">{viewModel.readiness.errorMessage}</p>
        </div>
      </section>

      <aside className="frame repair-detail-panel repair-ranking-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Sample Ranking</p>
            <h2>Model comparison for the selected sample</h2>
          </div>
          <span className="panel-code">RANK</span>
        </div>

        <div className="repair-ranking-list">
          {viewModel.metrics.sampleRanking.map((model) => (
            <button
              key={model.modelId}
              type="button"
              className={`repair-ranking-card${selectedModelId === model.modelId ? ' is-selected' : ''}`}
              onClick={() => onSelectModel(model.modelId)}
            >
              <div className="repair-ranking-head">
                <span>{model.modelLabel}</span>
                <strong>RMSE {model.rmse.toExponential(3)}</strong>
              </div>
              <div className="repair-ranking-metrics">
                <small>MAE {model.mae.toExponential(3)}</small>
                <small>DTW {model.dtwSimilarity.toFixed(3)}</small>
                <small>R-squared {model.r2.toFixed(6)}</small>
                <small>ADE {model.ade.toExponential(3)}</small>
                <small>Hausdorff {model.hausdorffDistance.toExponential(3)}</small>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </section>
  )
}
