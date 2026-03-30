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
            <p className="panel-kicker">Flow Prediction</p>
            <h1>Archived AIS Forecast Cockpit</h1>
          </div>

          <div className="forecast-chip-row forecast-chip-inline-row">
            <span className="forecast-chip forecast-chip-model">{viewModel.summaryBand.modelLabel}</span>
            <span className="forecast-chip forecast-chip-horizon">{viewModel.summaryBand.horizonLabel}</span>
            <span className="forecast-chip forecast-chip-frame">{viewModel.summaryBand.frameLabel}</span>
          </div>
        </div>

        <p className="module-takeaway">
          {corridorLeader
            ? `Prediction cockpit for archived AIS plus offline-computed forecast bundles, with ${corridorLeader.corridorId} carrying the corridor-dominance spine that now grounds hotspot and route interpretation across the page.`
            : 'Prediction cockpit for archived AIS plus offline-computed forecast bundles, with node-level paper visuals intentionally reserved for later exports.'}
        </p>
      </div>

      <div className="forecast-summary-meta">
        <div className="module-kpi-grid forecast-kpi-grid">
          <article>
            <span>Current total flow</span>
            <strong>{formatNumber(viewModel.summaryBand.currentTotal, 1)}</strong>
            <small>{viewModel.summaryBand.visibleVessels ?? '--'} visible vessels</small>
          </article>
          <article>
            <span>Selected forecast</span>
            <strong>{formatNumber(viewModel.summaryBand.selectedForecastTotal, 1)}</strong>
            <small>{viewModel.summaryBand.horizonLabel} horizon</small>
          </article>
          <article>
            <span>Hotspot count</span>
            <strong>{viewModel.summaryBand.hotspotCount ?? '--'}</strong>
            <small>{viewModel.summaryBand.focusGridId ?? '--'} in focus</small>
          </article>
          <article>
            <span>Focus route</span>
            <strong>{viewModel.summaryBand.focusRouteId ?? '--'}</strong>
            <small>{viewModel.summaryBand.focusGridId ?? '--'} linked hotspot</small>
          </article>
          {corridorLeader ? (
            <article>
              <span>Corridor dominance</span>
              <strong>
                {corridorLeader.corridorId} {formatSharePercent(corridorLeader.share)}
              </strong>
              <small>
                {leadingDirection
                  ? `${leadingDirection.directionLabel} carries ${formatSharePercent(leadingDirection.share)} of runtime corridor traffic.`
                  : `${corridorLeader.directionLabel} remains the strongest corridor family in clustering runtime.`}
              </small>
            </article>
          ) : null}
        </div>
      </div>

      <button type="button" className="module-primary-action forecast-primary-action" onClick={onNavigateToEvaluation}>
        Compare Results
      </button>
    </section>
  )
}
