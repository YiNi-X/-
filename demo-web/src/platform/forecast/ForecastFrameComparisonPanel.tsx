import { formatSharePercent, type CorridorDominanceSummary } from '../clustering/corridorDominance.ts'
import type { ForecastFrameComparisonRow } from './forecastTypes.ts'

type ForecastFrameComparisonPanelProps = {
  rows: ForecastFrameComparisonRow[]
  corridorDominance: CorridorDominanceSummary | null
  selectedHorizon: string
  selectedGridId: string | null
  onSelectGrid: (gridId: string) => void
}

function widthRatio(value: number, maxValue: number) {
  if (maxValue <= 0) return '0%'
  return `${Math.max(8, (value / maxValue) * 100).toFixed(1)}%`
}

export function ForecastFrameComparisonPanel({
  rows,
  corridorDominance,
  selectedHorizon,
  selectedGridId,
  onSelectGrid,
}: ForecastFrameComparisonPanelProps) {
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.current, row.forecast]))
  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">Frame comparison</p>
          <h2>Current versus {selectedHorizon} forecast</h2>
        </div>
        <span className="panel-code">FRAME</span>
      </div>

      {corridorLeader ? (
        <div className="forecast-context-note">
          <span>Corridor-linked route comparison</span>
          <strong>
            {corridorLeader.corridorId} anchors the route story at {formatSharePercent(corridorLeader.share)}
          </strong>
          <small>
            {leadingDirection
              ? `Read route deltas against the ${leadingDirection.directionLabel} corridor family, which carries ${formatSharePercent(leadingDirection.share)} of runtime corridor traffic.`
              : `Read route deltas against the ${corridorLeader.directionLabel} corridor family from clustering runtime.`}
          </small>
        </div>
      ) : null}

      <div className="forecast-compare-list">
        {rows.map((row) => (
          <button
            key={row.gridId}
            type="button"
            className={`forecast-compare-card${selectedGridId === row.gridId ? ' is-selected' : ''}`}
            onClick={() => onSelectGrid(row.gridId)}
          >
            <div className="forecast-compare-card-header">
              <div>
                <span>{row.gridId}</span>
                <small>{row.routeId ?? '--'}</small>
              </div>
              <strong>
                {row.delta >= 0 ? '+' : ''}
                {row.delta.toFixed(1)}
              </strong>
            </div>

            <div className="forecast-compare-bars">
              <div className="forecast-compare-bar-row">
                <label>Now</label>
                <div className="forecast-compare-track">
                  <i className="is-current" style={{ width: widthRatio(row.current, maxValue) }} />
                </div>
                <span>{row.current.toFixed(1)}</span>
              </div>
              <div className="forecast-compare-bar-row">
                <label>{selectedHorizon}</label>
                <div className="forecast-compare-track">
                  <i className="is-forecast" style={{ width: widthRatio(row.forecast, maxValue) }} />
                </div>
                <span>{row.forecast.toFixed(1)}</span>
              </div>
            </div>

            <p className="forecast-compare-card-note">
              {row.alertLevel ?? row.hotspotLevel ?? 'normal'} {row.isFocus ? ' / focus grid' : ''}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}
