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
        title="当前版本仍保留节点级预测占位"
        summary="页面为 node-view 保留了稳定入口，但不会假装 60 节点 runtime 导出已经上线。"
        detail={viewModel.readiness.nodeViewMessage}
      >
        <article className="forecast-drawer-card">
          <span>焦点网格</span>
          <strong>{focusedGridId ?? '--'}</strong>
          <p>{viewModel.summaryBand.focusRouteId ?? '--'} 是当前帧对应的关联航线</p>
        </article>
        <article className="forecast-drawer-card">
          <span>桥接节点</span>
          <strong>{focusedLink ? `Node ${focusedLink.nodeId}` : '--'}</strong>
          <p>{focusedLink?.routeId ?? '当前焦点还没有导出的 node-route 映射。'}</p>
        </article>
      </PlatformStatusSurface>

      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">节点桥接</p>
            <h2>热点到节点的映射会继续保留，供后续论文模式使用</h2>
          </div>
          <span className="panel-code">NODE</span>
        </div>

        <div className="forecast-node-link-grid">
          {viewModel.evidence.hotspotNodeLinks.map((link) => (
            <article key={link.gridId} className="forecast-drawer-card forecast-node-link-card">
              <span>{link.gridId}</span>
              <strong>Node {link.nodeId}</strong>
              <p>{link.routeId ? `${link.routeId} 对应 corridor` : 'route 映射尚未导出'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
