import type { ForecastViewModel } from './forecastTypes.ts'

type ForecastEvidenceTabProps = {
  viewModel: ForecastViewModel
  onOpenEvidenceDrawer: () => void
}

export function ForecastEvidenceTab({ viewModel, onOpenEvidenceDrawer }: ForecastEvidenceTabProps) {
  return (
    <div className="forecast-tab-grid">
      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Evidence assets</p>
            <h2>Paper-facing support kept behind the cockpit</h2>
          </div>
          <span className="panel-code">EVID</span>
        </div>

        <div className="forecast-drawer-grid">
          {viewModel.evidenceAssets.map((asset) => (
            <article key={asset.id} className="forecast-drawer-card">
              <span>{asset.label}</span>
              <strong>{asset.readiness === 'ready' ? 'Ready in current shell' : 'Planned asset'}</strong>
              <p>{asset.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="forecast-tab-panel forecast-evidence-cta">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Evidence drawer</p>
            <h2>Open the deeper research view only when the reviewer asks for proof</h2>
          </div>
          <span className="panel-code">{viewModel.meta.evidenceReady ? 'READY' : 'STAGED'}</span>
        </div>

        <div className="forecast-selected-grid-shell">
          <article className="forecast-selected-grid-card">
            <span>Runtime facts</span>
            <strong>{viewModel.evidence.runtimeFacts.length}</strong>
            <p>Committed provenance fields already available in the current module package.</p>
          </article>
          <article className="forecast-selected-grid-card">
            <span>Deferred models</span>
            <strong>{viewModel.meta.deferredModels.length}</strong>
            <p>{viewModel.meta.deferredModels[0]?.reason ?? 'No deferred model notice is needed for this module.'}</p>
          </article>
        </div>

        <p className="forecast-panel-note">{viewModel.readiness.evidenceMessage}</p>

        <button type="button" className="module-primary-action forecast-inline-action" onClick={onOpenEvidenceDrawer}>
          Open Evidence Drawer
        </button>
      </section>
    </div>
  )
}
