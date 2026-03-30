import type { ForecastFrameComparisonRow, ForecastViewModel } from './forecastTypes.ts'

type ForecastFocusMapCardProps = {
  viewModel: ForecastViewModel
  selectedGridId: string | null
}

function getSelectedRow(rows: ForecastFrameComparisonRow[], selectedGridId: string | null) {
  if (selectedGridId) {
    const selected = rows.find((row) => row.gridId === selectedGridId)
    if (selected) return selected
  }
  return rows.find((row) => row.isFocus) ?? rows[0] ?? null
}

export function ForecastFocusMapCard({ viewModel, selectedGridId }: ForecastFocusMapCardProps) {
  const selectedRow = getSelectedRow(viewModel.frameComparison.rows, selectedGridId)

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">Focus bridge</p>
          <h2>Route and hotspot context for the selected grid</h2>
        </div>
        <span className="panel-code">FOCUS</span>
      </div>

      <div className="forecast-selected-grid-shell">
        <article className="forecast-selected-grid-card">
          <span>Active grid</span>
          <strong>{selectedRow?.gridId ?? viewModel.summaryBand.focusGridId ?? '--'}</strong>
          <p>{selectedRow?.routeId ?? viewModel.summaryBand.focusRouteId ?? '--'} linked route context</p>
        </article>

        <article className="forecast-selected-grid-card">
          <span>Current versus forecast</span>
          <strong>{selectedRow ? `${selectedRow.current.toFixed(1)} -> ${selectedRow.forecast.toFixed(1)}` : '--'}</strong>
          <p>
            {selectedRow
              ? `${selectedRow.delta >= 0 ? '+' : ''}${selectedRow.delta.toFixed(1)} change for the selected horizon`
              : 'Frame-level comparison becomes available once a hotspot row is selected.'}
          </p>
        </article>

        <article className="forecast-selected-grid-card">
          <span>Geometry coverage</span>
          <strong>{viewModel.focusMap.routeIds.length} routes / {viewModel.focusMap.hotspotIds.length} hotspots</strong>
          <div className="forecast-chip-row">
            {viewModel.focusMap.hotspotIds.slice(0, 4).map((hotspotId) => (
              <span key={hotspotId} className="forecast-chip forecast-chip-inline">
                {hotspotId}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
