import type { ForecastAlert } from '../../sharedContracts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import { formatSharePercent, type CorridorDominanceSummary } from '../clustering/corridorDominance.ts'
import { localizeAlertLevelLabel } from '../zhCopy.ts'

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
        tone="unavailable"
        title="当前帧告警较低"
        summary="所选回放帧没有触发网格级高压告警。"
        detail="把时间线移动到更繁忙的时段，可以查看网格级告警变化。"
      />
    )
  }

  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="forecast-tab-panel">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">告警表</p>
          <h2>当前帧的网格级告警证据</h2>
        </div>
        <span className="panel-code">ALERT</span>
      </div>

      {corridorLeader ? (
        <div className="forecast-context-note forecast-alert-context-note">
          <span>Corridor 联动热点上下文</span>
          <strong>
            告警升级仍需回到 {corridorLeader.corridorId} 这条主导 corridor 来解释，占比 {formatSharePercent(corridorLeader.share)}
          </strong>
          <small>
            {leadingDirection
              ? `${leadingDirection.directionLabel} 仍是主导 corridor 家族，因此热点压力需要放到更大的运动结构里叙述。`
              : `${corridorLeader.directionLabel} 仍是 clustering runtime 中最强的 corridor 家族。`}
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
                <strong>{localizeAlertLevelLabel(alert.level)}</strong>
              </div>
              <em>{formatDelta(alert)}</em>
            </div>
            <p>{alert.note}</p>
            <small>
              当前 {alert.current.toFixed(1)} {'->'} 预测 {alert.future.toFixed(1)}
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
