type ForecastTimelineChartProps = {
  labels: string[]
  actualSeries: number[]
  forecastSeriesByHorizon: Record<string, number[]>
  selectedHorizon: string
  selectedFrameIndex: number
  onSelectFrame: (frameIndex: number) => void
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

function getFrameLabel(labels: string[], frameIndex: number) {
  return labels[frameIndex] ?? '--'
}

export function ForecastTimelineChart({
  labels,
  actualSeries,
  forecastSeriesByHorizon,
  selectedHorizon,
  selectedFrameIndex,
  onSelectFrame,
}: ForecastTimelineChartProps) {
  const width = 880
  const height = 300
  const allSeries = [actualSeries, ...Object.values(forecastSeriesByHorizon)]
  const maxValue = Math.max(...allSeries.flat(), 1)
  const selectedSeries = forecastSeriesByHorizon[selectedHorizon] ?? []
  const markerX = (selectedFrameIndex / Math.max(actualSeries.length - 1, 1)) * width

  return (
    <div className="forecast-timeline-shell">
      <div className="forecast-chart-caption">
        <div>
          <span>Primary timeline</span>
          <strong>Total flow aligned to the replay window</strong>
        </div>
        <div className="forecast-chart-legend" aria-label="chart legend">
          <span className="legend-actual">Actual</span>
          <span className="legend-selected">{selectedHorizon} forecast</span>
          <span className="legend-secondary">Other horizons</span>
        </div>
      </div>

      <div className="forecast-timeline-svg-shell">
        <svg viewBox={`0 0 ${width} ${height}`} className="forecast-timeline-svg" role="img" aria-label="Forecast timeline chart">
          <defs>
            <linearGradient id="forecastActualStroke" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#6fd9c7" />
              <stop offset="100%" stopColor="#16d3ff" />
            </linearGradient>
            <linearGradient id="forecastSelectedStroke" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#ffd27a" />
              <stop offset="100%" stopColor="#ff9f43" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={(height - height * ratio).toFixed(2)}
              x2={String(width)}
              y2={(height - height * ratio).toFixed(2)}
              className="forecast-grid-line"
            />
          ))}

          {Object.entries(forecastSeriesByHorizon)
            .filter(([horizon]) => horizon !== selectedHorizon)
            .map(([horizon, values]) => (
              <path key={horizon} d={toPath(values, width, height, maxValue)} className="forecast-line forecast-line-secondary" />
            ))}

          <path d={toPath(actualSeries, width, height, maxValue)} className="forecast-line forecast-line-actual" />
          <path d={toPath(selectedSeries, width, height, maxValue)} className="forecast-line forecast-line-selected" />
          <line x1={markerX.toFixed(2)} y1="0" x2={markerX.toFixed(2)} y2={String(height)} className="forecast-marker-line" />
        </svg>
      </div>

      <div className="forecast-frame-slider">
        <div className="forecast-frame-label">
          <span>Selected frame</span>
          <strong>{getFrameLabel(labels, selectedFrameIndex)}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(actualSeries.length - 1, 0)}
          value={selectedFrameIndex}
          onChange={(event) => onSelectFrame(Number(event.target.value))}
        />
      </div>
    </div>
  )
}
