import type { ForecastViewModel } from './forecastTypes.ts'

type ForecastEvidenceOverviewProps = {
  viewModel: ForecastViewModel
}

export function ForecastEvidenceOverview({ viewModel }: ForecastEvidenceOverviewProps) {
  return (
    <div className="forecast-evidence-overview">
      <section className="forecast-evidence-section">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Runtime provenance</p>
            <h2>Committed evidence behind the cockpit</h2>
          </div>
          <span className="panel-code">RUNTIME</span>
        </div>
        <div className="forecast-evidence-fact-grid">
          {viewModel.evidence.runtimeFacts.map((fact) => (
            <article key={fact.label} className="forecast-drawer-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="forecast-evidence-section">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">STGCN architecture</p>
            <h2>Current model configuration surfaced honestly</h2>
          </div>
          <span className="panel-code">MODEL</span>
        </div>
        <div className="forecast-evidence-fact-grid">
          {viewModel.evidence.architectureFacts.map((fact) => (
            <article key={fact.label} className="forecast-drawer-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="forecast-evidence-section">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Hotspot to node map</p>
            <h2>Bridge between product grids and paper-facing nodes</h2>
          </div>
          <span className="panel-code">MAP</span>
        </div>
        <div className="forecast-node-link-grid">
          {viewModel.evidence.hotspotNodeLinks.map((link) => (
            <article key={link.gridId} className="forecast-drawer-card forecast-node-link-card">
              <span>{link.gridId}</span>
              <strong>Node {link.nodeId}</strong>
              <p>{link.routeId ? `${link.routeId} linked corridor` : 'No route mapping exported'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
