import type { ForecastMetricTrendRow } from './forecastTypes.ts'

type ForecastMetricDegradationPanelProps = {
  rows: ForecastMetricTrendRow[]
  metricBasis: string
}

function widthRatio(value: number, maxValue: number) {
  if (maxValue <= 0) return '0%'
  return `${Math.max(10, (value / maxValue) * 100).toFixed(1)}%`
}

export function ForecastMetricDegradationPanel({ rows, metricBasis }: ForecastMetricDegradationPanelProps) {
  if (!rows.length) {
    return (
      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Metric degradation</p>
            <h2>Per-horizon quality is not available</h2>
          </div>
          <span className="panel-code">N/A</span>
        </div>
        <p className="module-takeaway">The current runtime does not expose horizon-level metrics for the selected model yet.</p>
      </section>
    )
  }

  const maxRmse = Math.max(...rows.map((row) => row.rmse), 1)
  const maxMae = Math.max(...rows.map((row) => row.mae), 1)

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">Metric degradation</p>
          <h2>Per-horizon quality for the selected model</h2>
        </div>
        <span className="panel-code">RMSE / MAE / R²</span>
      </div>

      <div className="forecast-metric-grid">
        {rows.map((row) => (
          <article key={row.horizon} className="metric-spotlight-card forecast-metric-card">
            <div className="forecast-metric-card-header">
              <span>{row.horizon}</span>
              <strong>{row.sampleCount} samples</strong>
            </div>

            <div className="forecast-metric-lines">
              <div className="forecast-metric-line">
                <label>RMSE</label>
                <div className="forecast-metric-track"><i style={{ width: widthRatio(row.rmse, maxRmse) }} /></div>
                <strong>{row.rmse.toFixed(3)}</strong>
              </div>
              <div className="forecast-metric-line">
                <label>MAE</label>
                <div className="forecast-metric-track forecast-metric-track-secondary"><i style={{ width: widthRatio(row.mae, maxMae) }} /></div>
                <strong>{row.mae.toFixed(3)}</strong>
              </div>
              <div className="forecast-metric-line">
                <label>R²</label>
                <div className="forecast-metric-track forecast-metric-track-positive"><i style={{ width: `${Math.max(12, row.r2 * 100).toFixed(1)}%` }} /></div>
                <strong>{row.r2.toFixed(3)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="forecast-panel-note">{metricBasis}</p>
    </section>
  )
}
