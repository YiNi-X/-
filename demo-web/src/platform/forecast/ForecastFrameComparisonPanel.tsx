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
          <p className="panel-kicker">帧对比</p>
          <h2>当前值与 {selectedHorizon} 预测对比</h2>
        </div>
        <span className="panel-code">FRAME</span>
      </div>

      {corridorLeader ? (
        <div className="forecast-context-note">
          <span>Corridor 联动航线对比</span>
          <strong>
            {corridorLeader.corridorId} 以 {formatSharePercent(corridorLeader.share)} 锚定当前航线叙事
          </strong>
          <small>
            {leadingDirection
              ? `请把航线差值放到 ${leadingDirection.directionLabel} 这一主导 corridor 家族中解读，它承载了 ${formatSharePercent(leadingDirection.share)} 的 runtime corridor 流量。`
              : `请把航线差值放到 clustering runtime 中的 ${corridorLeader.directionLabel} corridor 家族中解读。`}
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
                <label>当前</label>
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
              {row.alertLevel ?? row.hotspotLevel ?? '正常'} {row.isFocus ? ' / 焦点网格' : ''}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}
