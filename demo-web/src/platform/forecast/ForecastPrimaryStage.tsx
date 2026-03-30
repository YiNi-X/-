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
  const selectedForecast = viewModel.frame ? viewModel.frame.forecast[selectedHorizon as keyof typeof viewModel.frame.forecast] : null
  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null

  return (
    <section className="forecast-primary-stage">
      <section className="frame forecast-primary-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">主舞台</p>
            <h2>总流量预测时间线</h2>
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
            <p className="panel-kicker">控制侧栏</p>
            <h2>模型、horizon 与帧解释</h2>
          </div>
          <span className="panel-code">RUNTIME</span>
        </div>

        <section className="forecast-control-group">
          <span className="forecast-control-label">已上线模型</span>
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
          </div>
        </section>

        <section className="forecast-control-group">
          <span className="forecast-control-label">预测 horizon</span>
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
          <span>当前帧</span>
          <strong>{viewModel.summaryBand.frameLabel}</strong>
          <small>回放窗口内可见 {viewModel.summaryBand.visibleVessels ?? '--'} 艘船舶</small>
        </section>

        <section className="forecast-rail-card">
          <span>帧摘要</span>
          <strong>
            {formatValue(viewModel.frame?.current.totalFlow)} {'->'} {formatValue(selectedForecast?.totalFlow)}
          </strong>
          <small>
            当前焦点：{viewModel.summaryBand.focusGridId ?? '--'} / {viewModel.summaryBand.focusRouteId ?? '--'}
          </small>
        </section>

        {corridorLeader ? (
          <section className="forecast-rail-card forecast-corridor-rail-card">
            <span>Corridor 上下文</span>
            <strong>
              {viewModel.summaryBand.focusRouteId ?? '--'} 对照 {corridorLeader.corridorId}
            </strong>
            <small>
              {leadingDirection
                ? `${leadingDirection.directionLabel} 以 ${formatSharePercent(leadingDirection.share)} 成为主导 corridor 家族，因此当前航线级预测需要放到这条全站运动主线下解释。`
                : `${corridorLeader.directionLabel} 仍是 clustering runtime 中最强的 corridor 家族。`}
            </small>
          </section>
        ) : null}

        <section className="forecast-rail-copy">
          <span>叙事状态</span>
          <strong>{viewModel.frame?.narrative.status ?? '正在加载帧叙事'}</strong>
          <p>{viewModel.frame?.narrative.summary ?? 'runtime bundle 加载完成后会显示帧级叙事。'}</p>
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
