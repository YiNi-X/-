import { ForecastEvidenceOverview } from './ForecastEvidenceOverview.tsx'
import type { ForecastViewModel } from './forecastTypes.ts'

type ForecastEvidenceDrawerProps = {
  viewModel: ForecastViewModel
  open: boolean
  onClose: () => void
}

export function ForecastEvidenceDrawer({ viewModel, open, onClose }: ForecastEvidenceDrawerProps) {
  if (!open) return null

  return (
    <section className="frame forecast-evidence-drawer">
      <div className="panel-title">
        <div>
          <p className="panel-kicker">Evidence Drawer</p>
          <h2>Research-facing support without breaking the cockpit flow</h2>
        </div>
        <button type="button" className="drawer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <ForecastEvidenceOverview viewModel={viewModel} />

      <p className="forecast-panel-note">{viewModel.readiness.evidenceMessage}</p>

      <div className="forecast-drawer-grid">
        {viewModel.evidenceAssets.map((asset) => (
          <article key={asset.id} className="forecast-drawer-card">
            <span>{asset.label}</span>
            <strong>{asset.readiness === 'ready' ? 'Ready in current shell' : 'Planned evidence asset'}</strong>
            <p>{asset.description}</p>
          </article>
        ))}

        {!!viewModel.meta.deferredModels.length && (
          <article className="forecast-drawer-card forecast-drawer-card-warning">
            <span>Deferred model scope</span>
            <strong>{viewModel.meta.deferredModels.map((item) => item.model).join(', ')}</strong>
            <p>{viewModel.meta.deferredModels[0]?.reason}</p>
          </article>
        )}
      </div>
    </section>
  )
}
