import type { HorizonKey } from '../../sharedContracts'
import { formatSharePercent, type CorridorDominanceSummary } from '../clustering/corridorDominance.ts'
import type { ForecastViewModel } from './forecastTypes.ts'
import { ForecastTimelineChart } from './ForecastTimelineChart.tsx'

type ForecastPrimaryStageProps = {
  viewModel: ForecastViewModel
  corridorDominance: CorridorDominanceSummary | null
  selectedModel: string
  selectedHorizon: HorizonKey
  selectedFrameIndex: number
  onSelectModel: (model: string) => void
  onSelectHorizon: (horizon: HorizonKey) => void
  onSelectFrame: (frameIndex: number) => void
}

function formatValue(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : '--'
}

export function ForecastPrimaryStage({
  viewModel,
  corridorDominance,
  selectedModel,
  selectedHorizon,
  selectedFrameIndex,
  onSelectModel,
  onSelectHorizon,
  onSelectFrame,
}: ForecastPrimaryStageProps) {
  const availableModels = viewModel.meta.availableModels
  const deferredModels = viewModel.meta.deferredModels
  const selectedForecast = viewModel.frame ? viewModel.frame.forecast[selectedHorizon as keyof typeof viewModel.frame.forecast] : null
  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="forecast-primary-stage">
      <section className="frame forecast-primary-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Primary Stage</p>
            <h2>Total flow forecast timeline</h2>
          </div>
          <span className="panel-code">{selectedModel}</span>
        </div>

        <ForecastTimelineChart
          labels={viewModel.timeline.labels}
          actualSeries={viewModel.timeline.totalFlow}
          forecastSeriesByHorizon={viewModel.timeline.forecastTotalsByHorizon}
          selectedHorizon={selectedHorizon}
          selectedFrameIndex={selectedFrameIndex}
          onSelectFrame={onSelectFrame}
        />
      </section>

      <aside className="frame forecast-control-rail">
        <div className="panel-title forecast-control-rail-header">
          <div>
            <p className="panel-kicker">Control Rail</p>
            <h2>Model, horizon, and frame interpretation</h2>
          </div>
          <span className="panel-code">LIVE</span>
        </div>

        <section className="forecast-control-group">
          <span className="forecast-control-label">Model readiness</span>
          <div className="forecast-segmented-row">
            {availableModels.map((model) => (
              <button
                key={model}
                type="button"
                className={`segmented-button${selectedModel === model ? ' active' : ''}`}
                onClick={() => onSelectModel(model)}
              >
                {model}
              </button>
            ))}
            {deferredModels.map((model) => (
              <button key={model.model} type="button" className="segmented-button forecast-segmented-disabled" disabled title={model.reason}>
                {model.model}
              </button>
            ))}
          </div>
        </section>

        {deferredModels.length ? (
          <section className="forecast-rail-card">
            <span>Deferred models</span>
            <strong>{deferredModels.map((model) => model.model).join(' / ')}</strong>
            <small>{deferredModels[0]?.reason}</small>
          </section>
        ) : null}

        <section className="forecast-control-group">
          <span className="forecast-control-label">Horizon</span>
          <div className="forecast-segmented-row">
            {viewModel.meta.availableHorizons.map((horizon) => (
              <button
                key={horizon}
                type="button"
                className={`segmented-button${selectedHorizon === horizon ? ' active' : ''}`}
                onClick={() => onSelectHorizon(horizon as HorizonKey)}
              >
                {horizon}
              </button>
            ))}
          </div>
        </section>

        <section className="forecast-rail-card">
          <span>Selected frame</span>
          <strong>{viewModel.summaryBand.frameLabel}</strong>
          <small>{viewModel.summaryBand.visibleVessels ?? '--'} vessels visible in the replay window</small>
        </section>

        <section className="forecast-rail-card">
          <span>Frame summary</span>
          <strong>
            {formatValue(viewModel.frame?.current.totalFlow)} {'->'} {formatValue(selectedForecast?.totalFlow)}
          </strong>
          <small>
            {viewModel.summaryBand.focusGridId ?? '--'} / {viewModel.summaryBand.focusRouteId ?? '--'} in focus
          </small>
        </section>

        {corridorLeader ? (
          <section className="forecast-rail-card forecast-corridor-rail-card">
            <span>Corridor context</span>
            <strong>
              {viewModel.summaryBand.focusRouteId ?? '--'} against {corridorLeader.corridorId}
            </strong>
            <small>
              {leadingDirection
                ? `${leadingDirection.directionLabel} is the dominant corridor family at ${formatSharePercent(leadingDirection.share)}, so this route-level forecast should be read against that site-wide movement spine.`
                : `${corridorLeader.directionLabel} remains the strongest corridor family in clustering runtime.`}
            </small>
          </section>
        ) : null}

        <section className="forecast-rail-copy">
          <span>Narrative status</span>
          <strong>{viewModel.frame?.narrative.status ?? 'Loading frame narrative'}</strong>
          <p>{viewModel.frame?.narrative.summary ?? 'Frame-level narrative will appear once the runtime bundle is loaded.'}</p>
        </section>

        {viewModel.frame?.narrative.recommendations?.length ? (
          <section className="forecast-rail-list">
            {viewModel.frame.narrative.recommendations.slice(0, 2).map((recommendation) => (
              <article key={recommendation.target}>
                <span>{recommendation.target}</span>
                <strong>{recommendation.action}</strong>
                <small>{recommendation.reason}</small>
              </article>
            ))}
          </section>
        ) : null}
      </aside>
    </section>
  )
}
