import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import type { ForecastViewModel } from './forecastTypes.ts'

type ForecastNodeViewTabProps = {
  viewModel: ForecastViewModel
  selectedGridId: string | null
}

export function ForecastNodeViewTab({ viewModel, selectedGridId }: ForecastNodeViewTabProps) {
  const focusedGridId = selectedGridId ?? viewModel.summaryBand.focusGridId
  const focusedLink =
    viewModel.evidence.hotspotNodeLinks.find((link) => link.gridId === focusedGridId) ?? viewModel.evidence.hotspotNodeLinks[0] ?? null

  return (
    <div className="forecast-tab-grid">
      <PlatformStatusSurface
        tone={viewModel.meta.nodeViewReady ? 'loading' : 'deferred'}
        title="Node-level forecast stays staged in this build"
        summary="The page reserves a stable node-view home without pretending the 60-node runtime exports already ship."
        detail={viewModel.readiness.nodeViewMessage}
      >
        <article className="forecast-drawer-card">
          <span>Focus grid</span>
          <strong>{focusedGridId ?? '--'}</strong>
          <p>{viewModel.summaryBand.focusRouteId ?? '--'} linked route in the current frame</p>
        </article>
        <article className="forecast-drawer-card">
          <span>Bridge node</span>
          <strong>{focusedLink ? `Node ${focusedLink.nodeId}` : '--'}</strong>
          <p>{focusedLink?.routeId ?? 'No node-route mapping exported for this focus yet.'}</p>
        </article>
      </PlatformStatusSurface>

      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Node bridge</p>
            <h2>Hotspot-to-node mapping kept visible for later paper-mode work</h2>
          </div>
          <span className="panel-code">NODE</span>
        </div>

        <div className="forecast-node-link-grid">
          {viewModel.evidence.hotspotNodeLinks.map((link) => (
            <article key={link.gridId} className="forecast-drawer-card forecast-node-link-card">
              <span>{link.gridId}</span>
              <strong>Node {link.nodeId}</strong>
              <p>{link.routeId ? `${link.routeId} linked corridor` : 'Route mapping not exported yet'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
