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
          <p className="panel-kicker">焦点桥接</p>
          <h2>所选网格的航线与热点上下文</h2>
        </div>
        <span className="panel-code">FOCUS</span>
      </div>

      <div className="forecast-selected-grid-shell">
        <article className="forecast-selected-grid-card">
          <span>当前网格</span>
          <strong>{selectedRow?.gridId ?? viewModel.summaryBand.focusGridId ?? '--'}</strong>
          <p>{selectedRow?.routeId ?? viewModel.summaryBand.focusRouteId ?? '--'} 对应航线上下文</p>
        </article>

        <article className="forecast-selected-grid-card">
          <span>当前值与预测值</span>
          <strong>{selectedRow ? `${selectedRow.current.toFixed(1)} -> ${selectedRow.forecast.toFixed(1)}` : '--'}</strong>
          <p>
            {selectedRow
              ? `所选 horizon 变化 ${selectedRow.delta >= 0 ? '+' : ''}${selectedRow.delta.toFixed(1)}`
              : '选择一个热点行后即可查看帧级对比。'}
          </p>
        </article>

        <article className="forecast-selected-grid-card">
          <span>Geometry 覆盖</span>
          <strong>{viewModel.focusMap.routeIds.length} 条航线 / {viewModel.focusMap.hotspotIds.length} 个热点</strong>
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
