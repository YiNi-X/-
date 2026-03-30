import type { RepairErrorMetricKey, RepairViewModel } from './repairTypes.ts'
import { RepairTrajectoryPlot } from './RepairTrajectoryPlot.tsx'

type RepairPrimaryStageProps = {
  viewModel: RepairViewModel
  selectedSampleId: string
  selectedModelId: string
  selectedErrorMetric: RepairErrorMetricKey
  showMissing: boolean
  showGroundTruth: boolean
  showRepair: boolean
  onSelectSample: (sampleId: string) => void
  onSelectModel: (modelId: string) => void
  onSelectErrorMetric: (metric: RepairErrorMetricKey) => void
  onToggleMissing: () => void
  onToggleGroundTruth: () => void
  onToggleRepair: () => void
}

const ERROR_OPTIONS: Array<{ id: RepairErrorMetricKey; label: string }> = [
  { id: 'euclideanDistance', label: 'Euclidean' },
  { id: 'lonDifference', label: 'Lon diff' },
  { id: 'latDifference', label: 'Lat diff' },
]

function metricLabel(metric: RepairErrorMetricKey) {
  return ERROR_OPTIONS.find((item) => item.id === metric)?.label ?? metric
}

export function RepairPrimaryStage({
  viewModel,
  selectedSampleId,
  selectedModelId,
  selectedErrorMetric,
  showMissing,
  showGroundTruth,
  showRepair,
  onSelectSample,
  onSelectModel,
  onSelectErrorMetric,
  onToggleMissing,
  onToggleGroundTruth,
  onToggleRepair,
}: RepairPrimaryStageProps) {
  const selectedMetrics = viewModel.metrics.selectedModel

  return (
    <section className="repair-primary-stage">
      <section className="frame repair-primary-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Primary Stage</p>
            <h2>Trajectory reconstruction comparison</h2>
          </div>
          <span className="panel-code">{viewModel.summaryBand.selectedModelLabel}</span>
        </div>

        <RepairTrajectoryPlot
          missing={viewModel.trajectoryStage.missing}
          groundTruth={viewModel.trajectoryStage.groundTruth}
          repair={viewModel.trajectoryStage.repair}
          showMissing={showMissing}
          showGroundTruth={showGroundTruth}
          showRepair={showRepair}
          selectedModelLabel={viewModel.summaryBand.selectedModelLabel}
        />

        <p className="repair-panel-note">{viewModel.readiness.trajectoryMessage}</p>
      </section>

      <aside className="frame repair-control-rail">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Control Rail</p>
            <h2>Sample, model, and layer interpretation</h2>
          </div>
          <span className="panel-code">REPAIR</span>
        </div>

        <section className="repair-control-group">
          <span className="repair-control-label">Sample</span>
          <div className="repair-segmented-row">
            {viewModel.sampleSelector.items.map((sample) => (
              <button
                key={sample.sampleId}
                type="button"
                className={`segmented-button${selectedSampleId === sample.sampleId ? ' active' : ''}`}
                onClick={() => onSelectSample(sample.sampleId)}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </section>

        <section className="repair-control-group">
          <span className="repair-control-label">Model</span>
          <div className="repair-segmented-row">
            {viewModel.modelSelector.items.map((model) => (
              <button
                key={model.modelId}
                type="button"
                className={`segmented-button${selectedModelId === model.modelId ? ' active' : ''}`}
                onClick={() => onSelectModel(model.modelId)}
              >
                {model.modelLabel}
              </button>
            ))}
          </div>
        </section>

        <section className="repair-control-group">
          <span className="repair-control-label">Visible layers</span>
          <div className="repair-layer-toggle-grid">
            <button type="button" className={`segmented-button${showMissing ? ' active' : ''}`} onClick={onToggleMissing}>Missing</button>
            <button type="button" className={`segmented-button${showGroundTruth ? ' active' : ''}`} onClick={onToggleGroundTruth}>Truth</button>
            <button type="button" className={`segmented-button${showRepair ? ' active' : ''}`} onClick={onToggleRepair}>Repair</button>
          </div>
        </section>

        <section className="repair-control-group">
          <span className="repair-control-label">Error focus</span>
          <div className="repair-segmented-row">
            {ERROR_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`segmented-button${selectedErrorMetric === option.id ? ' active' : ''}`}
                onClick={() => onSelectErrorMetric(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="repair-rail-card">
          <span>Current reading</span>
          <strong>{viewModel.summaryBand.selectedModelLabel}</strong>
          <small>{metricLabel(selectedErrorMetric)} highlighted below by point index</small>
        </section>

        {selectedMetrics ? (
          <section className="repair-metric-spotlight-grid">
            <article className="repair-rail-card">
              <span>RMSE / MAE</span>
              <strong>{selectedMetrics.rmse.toExponential(3)}</strong>
              <small>MAE {selectedMetrics.mae.toExponential(3)}</small>
            </article>
            <article className="repair-rail-card">
              <span>DTW / Hausdorff</span>
              <strong>{selectedMetrics.dtwSimilarity.toFixed(3)}</strong>
              <small>Hausdorff {selectedMetrics.hausdorffDistance.toExponential(3)}</small>
            </article>
            <article className="repair-rail-card">
              <span>R-squared / ADE</span>
              <strong>{selectedMetrics.r2.toFixed(6)}</strong>
              <small>ADE {selectedMetrics.ade.toExponential(3)}</small>
            </article>
            <article className="repair-rail-card">
              <span>Lon / Lat mean</span>
              <strong>{selectedMetrics.lonDifferenceMean.toExponential(3)}</strong>
              <small>Lat {selectedMetrics.latDifferenceMean.toExponential(3)}</small>
            </article>
          </section>
        ) : null}
      </aside>
    </section>
  )
}
