import type { ForecastFrameComparisonRow, ForecastGridSeries } from './forecastTypes.ts'

type ForecastHotspotSmallMultiplesProps = {
  gridIds: string[]
  byGrid: Record<string, ForecastGridSeries>
  comparisonRows: ForecastFrameComparisonRow[]
  selectedHorizon: string
  selectedFrameIndex: number
  selectedGridId: string | null
  onSelectGrid: (gridId: string) => void
}

function buildPath(values: number[], width: number, height: number, maxValue: number) {
  if (!values.length || maxValue <= 0) return ''
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - (value / maxValue) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function ForecastHotspotSmallMultiples({
  gridIds,
  byGrid,
  comparisonRows,
  selectedHorizon,
  selectedFrameIndex,
  selectedGridId,
  onSelectGrid,
}: ForecastHotspotSmallMultiplesProps) {
  const comparisonMap = Object.fromEntries(comparisonRows.map((row) => [row.gridId, row]))
  const width = 220
  const height = 70
  const maxValue = Math.max(
    1,
    ...gridIds.flatMap((gridId) => {
      const series = byGrid[gridId]
      return [...(series?.current ?? []), ...(series?.forecastByHorizon[selectedHorizon] ?? [])]
    }),
  )

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">热点小倍图</p>
          <h2>产品化网格焦点视图</h2>
        </div>
        <span className="panel-code">GRID</span>
      </div>

      <div className="forecast-grid-card-grid">
        {gridIds.map((gridId) => {
          const series = byGrid[gridId]
          const comparison = comparisonMap[gridId]
          if (!series || !comparison) return null

          const actualPath = buildPath(series.current, width, height, maxValue)
          const forecastPath = buildPath(series.forecastByHorizon[selectedHorizon] ?? [], width, height, maxValue)
          const markerX = (selectedFrameIndex / Math.max(series.current.length - 1, 1)) * width
          const actualMarkerY = height - ((series.current[selectedFrameIndex] ?? 0) / maxValue) * height
          const forecastMarkerY = height - (((series.forecastByHorizon[selectedHorizon] ?? [])[selectedFrameIndex] ?? 0) / maxValue) * height

          return (
            <button
              key={gridId}
              type="button"
              className={`metric-spotlight-card forecast-grid-card${selectedGridId === gridId ? ' is-selected' : ''}`}
              onClick={() => onSelectGrid(gridId)}
            >
              <div className="forecast-grid-card-header">
                <span>{gridId}</span>
                <small>{comparison.routeId ?? '--'}</small>
              </div>

              <div className="forecast-grid-card-chart">
                <svg viewBox={`0 0 ${width} ${height}`} className="forecast-grid-card-svg" aria-hidden="true">
                  <path d={actualPath} className="forecast-grid-line-actual" />
                  <path d={forecastPath} className="forecast-grid-line-selected" />
                  <line x1={markerX.toFixed(2)} y1="0" x2={markerX.toFixed(2)} y2={String(height)} className="forecast-grid-marker" />
                  <circle cx={markerX.toFixed(2)} cy={actualMarkerY.toFixed(2)} r="3" className="forecast-grid-point-actual" />
                  <circle cx={markerX.toFixed(2)} cy={forecastMarkerY.toFixed(2)} r="3" className="forecast-grid-point-selected" />
                </svg>
              </div>

              <div className="forecast-grid-card-metrics">
                <strong>{comparison.current.toFixed(1)} {'->'} {comparison.forecast.toFixed(1)}</strong>
                <small>{selectedHorizon} 变化 {comparison.delta >= 0 ? '+' : ''}{comparison.delta.toFixed(1)}</small>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

