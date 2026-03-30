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
      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">节点桥接概览</p>
            <h2>热点与节点的对应索引</h2>
          </div>
          <span className="panel-code">NODE</span>
        </div>

        <p className="forecast-panel-note">{viewModel.readiness.nodeViewMessage}</p>

        <div className="forecast-drawer-grid">
          <article className="forecast-drawer-card">
            <span>焦点网格</span>
            <strong>{focusedGridId ?? '--'}</strong>
            <p>{viewModel.summaryBand.focusRouteId ?? '--'} 是当前帧对应的关联航线</p>
          </article>
          <article className="forecast-drawer-card">
            <span>桥接节点</span>
            <strong>{focusedLink ? `Node ${focusedLink.nodeId}` : '--'}</strong>
            <p>{focusedLink?.routeId ?? '当前映射以节点索引为主，可继续回到热点视图定位航路。'}</p>
          </article>
        </div>
      </section>

      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">节点桥接</p>
            <h2>热点到节点的映射目录</h2>
          </div>
          <span className="panel-code">NODE</span>
        </div>

        <div className="forecast-node-link-grid">
          {viewModel.evidence.hotspotNodeLinks.map((link) => (
            <article key={link.gridId} className="forecast-drawer-card forecast-node-link-card">
              <span>{link.gridId}</span>
              <strong>Node {link.nodeId}</strong>
              <p>{link.routeId ? `${link.routeId} 对应 corridor` : '当前以节点映射为主，可结合热点视图继续查看。'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
