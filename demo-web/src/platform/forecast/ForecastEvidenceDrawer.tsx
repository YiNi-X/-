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
          <p className="panel-kicker">证据抽屉</p>
          <h2>在不打断驾驶舱节奏的前提下补充研究证据</h2>
        </div>
        <button type="button" className="drawer-close" onClick={onClose}>
          关闭
        </button>
      </div>

      <ForecastEvidenceOverview viewModel={viewModel} />

      <p className="forecast-panel-note">{viewModel.readiness.evidenceMessage}</p>

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
  )
}
