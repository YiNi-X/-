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
            <p className="panel-kicker">运行时来源</p>
            <h2>驾驶舱背后的已提交证据</h2>
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
            <p className="panel-kicker">模型结构</p>
            <h2>当前模型配置的诚实呈现</h2>
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
            <p className="panel-kicker">热点到节点映射</p>
            <h2>连接产品网格与论文节点的桥梁</h2>
          </div>
          <span className="panel-code">MAP</span>
        </div>
        <div className="forecast-node-link-grid">
          {viewModel.evidence.hotspotNodeLinks.map((link) => (
            <article key={link.gridId} className="forecast-drawer-card forecast-node-link-card">
              <span>{link.gridId}</span>
              <strong>Node {link.nodeId}</strong>
              <p>{link.routeId ? `${link.routeId} 对应 corridor` : '尚未导出 route 映射'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
