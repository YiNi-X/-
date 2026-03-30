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
            <p className="panel-kicker">证据资源</p>
            <h2>面向论文的支持视图保留在驾驶舱后方</h2>
          </div>
          <span className="panel-code">EVID</span>
        </div>

        <div className="forecast-drawer-grid">
          {viewModel.evidenceAssets.map((asset) => (
            <article key={asset.id} className="forecast-drawer-card">
              <span>{asset.label}</span>
              <strong>{asset.readiness === 'ready' ? '当前可查看' : '补充视图'}</strong>
              <p>{asset.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="forecast-tab-panel forecast-evidence-cta">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">证据抽屉</p>
            <h2>只在评审需要证据时再打开更深一层研究视图</h2>
          </div>
          <span className="panel-code">{viewModel.meta.evidenceReady ? 'READY' : 'STAGED'}</span>
        </div>

        <div className="forecast-selected-grid-shell">
          <article className="forecast-selected-grid-card">
            <span>Runtime 事实</span>
            <strong>{viewModel.evidence.runtimeFacts.length}</strong>
            <p>当前模块包中已经可见的运行时摘要条目。</p>
          </article>
          <article className="forecast-selected-grid-card">
            <span>已上线模型</span>
            <strong>{viewModel.meta.availableModels.join(' / ')}</strong>
            <p>{viewModel.meta.availableModels.length} 个模型已纳入当前预测驾驶舱。</p>
          </article>
        </div>

        <p className="forecast-panel-note">{viewModel.readiness.evidenceMessage}</p>

        <button type="button" className="module-primary-action forecast-inline-action" onClick={onOpenEvidenceDrawer}>
          打开证据抽屉
        </button>
      </section>
    </div>
  )
}
