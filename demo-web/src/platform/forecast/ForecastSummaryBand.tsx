import { formatSharePercent, type CorridorDominanceSummary } from '../clustering/corridorDominance.ts'
import type { ForecastViewModel } from './forecastTypes.ts'

type ForecastSummaryBandProps = {
  viewModel: ForecastViewModel
  corridorDominance: CorridorDominanceSummary | null
  onNavigateToEvaluation: () => void
}

function formatNumber(value: number | null, digits = 1) {
  return typeof value === 'number' ? value.toFixed(digits) : '--'
}

export function ForecastSummaryBand({ viewModel, corridorDominance, onNavigateToEvaluation }: ForecastSummaryBandProps) {
  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="frame module-summary-band forecast-summary-band">
      <div className="forecast-summary-copy">
        <div className="forecast-summary-heading-row">
          <div className="forecast-summary-heading">
            <p className="panel-kicker">流量预测</p>
            <h1>归档 AIS 预测驾驶舱</h1>
          </div>

          <div className="forecast-chip-row forecast-chip-inline-row">
            <span className="forecast-chip forecast-chip-model">{viewModel.summaryBand.modelLabel}</span>
            <span className="forecast-chip forecast-chip-horizon">{viewModel.summaryBand.horizonLabel}</span>
            <span className="forecast-chip forecast-chip-frame">{viewModel.summaryBand.frameLabel}</span>
          </div>
        </div>

        <p className="module-takeaway">
          {corridorLeader
            ? `本页围绕归档 AIS 与离线预测结果组织叙事，${corridorLeader.corridorId} 作为 corridor dominance 主线，会显式进入热点与航线解释。`
            : '本页围绕归档 AIS 与离线预测结果组织叙事，并将热点、航线与节点映射收进同一驾驶舱。'}
        </p>
      </div>

      <div className="forecast-summary-meta">
        <div className="module-kpi-grid forecast-kpi-grid">
          <article>
            <span>当前总流量</span>
            <strong>{formatNumber(viewModel.summaryBand.currentTotal, 1)}</strong>
            <small>{viewModel.summaryBand.visibleVessels ?? '--'} 艘可见船舶</small>
          </article>
          <article>
            <span>当前预测值</span>
            <strong>{formatNumber(viewModel.summaryBand.selectedForecastTotal, 1)}</strong>
            <small>{viewModel.summaryBand.horizonLabel} horizon</small>
          </article>
          <article>
            <span>热点数量</span>
            <strong>{viewModel.summaryBand.hotspotCount ?? '--'}</strong>
            <small>{viewModel.summaryBand.focusGridId ?? '--'} 为当前焦点</small>
          </article>
          <article>
            <span>焦点航线</span>
            <strong>{viewModel.summaryBand.focusRouteId ?? '--'}</strong>
            <small>{viewModel.summaryBand.focusGridId ?? '--'} 对应热点</small>
          </article>
          {corridorLeader ? (
            <article>
              <span>Corridor dominance</span>
              <strong>
                {corridorLeader.corridorId} {formatSharePercent(corridorLeader.share)}
              </strong>
              <small>
                {leadingDirection
                  ? `${leadingDirection.directionLabel} 方向家族承载了 ${formatSharePercent(leadingDirection.share)} 的 runtime corridor 流量。`
                  : `${corridorLeader.directionLabel} 仍是 clustering runtime 中最强的 corridor 家族。`}
              </small>
            </article>
          ) : null}
        </div>
      </div>

      <button type="button" className="module-primary-action forecast-primary-action" onClick={onNavigateToEvaluation}>
        查看评估
      </button>
    </section>
  )
}
