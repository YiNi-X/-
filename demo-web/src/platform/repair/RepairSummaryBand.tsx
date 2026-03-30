import type { RepairViewModel } from './repairTypes.ts'

type RepairSummaryBandProps = {
  viewModel: RepairViewModel
  onNavigateToEvaluation: () => void
}

export function RepairSummaryBand({ viewModel, onNavigateToEvaluation }: RepairSummaryBandProps) {
  return (
    <section className="frame module-summary-band repair-summary-band">
      <div className="repair-summary-copy">
        <p className="panel-kicker">Trajectory Repair</p>
        <h1>Curated Repair Cockpit</h1>
        <p className="module-takeaway">
          Repair evidence is shown as sample-indexed trajectories and error curves from offline exports, not a simulated live vessel replay.
        </p>
      </div>

      <div className="module-kpi-grid repair-kpi-grid">
        <article>
          <span>Selected sample</span>
          <strong>{viewModel.summaryBand.sampleLabel}</strong>
          <small>{viewModel.summaryBand.targetId}</small>
        </article>
        <article>
          <span>Selected model</span>
          <strong>{viewModel.summaryBand.selectedModelLabel}</strong>
          <small>Best in sample: {viewModel.summaryBand.bestSampleModelLabel}</small>
        </article>
        <article>
          <span>Missing points</span>
          <strong>{viewModel.summaryBand.missingPointCount}</strong>
          <small>{viewModel.summaryBand.groundTruthPointCount} ground truth points</small>
        </article>
        <article>
          <span>Methods ready</span>
          <strong>{viewModel.summaryBand.availableMethodCount}</strong>
          <small>Overall best: {viewModel.meta.bestOverallModel?.modelLabel ?? '--'}</small>
        </article>
      </div>

      <button type="button" className="module-primary-action repair-primary-action" onClick={onNavigateToEvaluation}>
        Compare Metrics
      </button>
    </section>
  )
}
