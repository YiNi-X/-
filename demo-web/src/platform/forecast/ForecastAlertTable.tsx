import type { ForecastAlert } from '../../sharedContracts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import { formatSharePercent, type CorridorDominanceSummary } from '../clustering/corridorDominance.ts'

type ForecastAlertTableProps = {
  alerts: ForecastAlert[]
  corridorDominance: CorridorDominanceSummary | null
  selectedGridId: string | null
  onSelectGrid: (gridId: string) => void
}

function formatDelta(alert: ForecastAlert) {
  const delta = alert.future - alert.current
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`
}

export function ForecastAlertTable({ alerts, corridorDominance, selectedGridId, onSelectGrid }: ForecastAlertTableProps) {
  if (!alerts.length) {
    return (
      <PlatformStatusSurface
        tone="deferred"
        title="No alert rows for this frame"
        summary="The selected replay frame does not publish forecast alert rows."
        detail="Move the timeline marker to a higher-pressure moment to see grid-level alert evidence."
      />
    )
  }

  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">Alert table</p>
          <h2>Grid-level alert evidence for the current frame</h2>
        </div>
        <span className="panel-code">ALERT</span>
      </div>

      {corridorLeader ? (
        <div className="forecast-context-note forecast-alert-context-note">
          <span>Corridor-linked hotspot context</span>
          <strong>
            Alert escalation stays tied to {corridorLeader.corridorId} at {formatSharePercent(corridorLeader.share)}
          </strong>
          <small>
            {leadingDirection
              ? `${leadingDirection.directionLabel} remains the dominant corridor family, so hotspot pressure should be narrated as part of that larger movement regime.`
              : `${corridorLeader.directionLabel} remains the strongest corridor family in clustering runtime.`}
          </small>
        </div>
      ) : null}

      <div className="forecast-alert-table">
        {alerts.map((alert) => (
          <button
            key={`${alert.grid}-${alert.level}`}
            type="button"
            className={`forecast-alert-button${selectedGridId === alert.grid ? ' is-selected' : ''}`}
            onClick={() => onSelectGrid(alert.grid)}
          >
            <div className="forecast-alert-button-head">
              <div>
                <span>{alert.grid}</span>
                <strong>{alert.level.toUpperCase()}</strong>
              </div>
              <em>{formatDelta(alert)}</em>
            </div>
            <p>{alert.note}</p>
            <small>
              {alert.current.toFixed(1)} now {'->'} {alert.future.toFixed(1)} forecast
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
