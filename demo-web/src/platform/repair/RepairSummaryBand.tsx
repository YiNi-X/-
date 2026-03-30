import type { RepairViewModel } from './repairTypes.ts'

type RepairSummaryBandProps = {
  viewModel: RepairViewModel
  onNavigateToEvaluation: () => void
}

export function RepairSummaryBand({ viewModel, onNavigateToEvaluation }: RepairSummaryBandProps) {
  return (
    <section className="frame module-summary-band repair-summary-band">
      <div className="repair-summary-copy">
        <p className="panel-kicker">轨迹修复</p>
        <h1>精选修复驾驶舱</h1>
        <p className="module-takeaway">
          修复证据以样本索引轨迹与离线导出的误差曲线呈现，而不是伪装成实时船舶回放。
        </p>
      </div>

      <div className="module-kpi-grid repair-kpi-grid">
        <article>
          <span>当前样本</span>
          <strong>{viewModel.summaryBand.sampleLabel}</strong>
          <small>{viewModel.summaryBand.targetId}</small>
        </article>
        <article>
          <span>当前模型</span>
          <strong>{viewModel.summaryBand.selectedModelLabel}</strong>
          <small>样本内最佳：{viewModel.summaryBand.bestSampleModelLabel}</small>
        </article>
        <article>
          <span>缺失点数</span>
          <strong>{viewModel.summaryBand.missingPointCount}</strong>
          <small>{viewModel.summaryBand.groundTruthPointCount} 个真实轨迹点</small>
        </article>
        <article>
          <span>已就绪方法</span>
          <strong>{viewModel.summaryBand.availableMethodCount}</strong>
          <small>全局最佳：{viewModel.meta.bestOverallModel?.modelLabel ?? '--'}</small>
        </article>
      </div>

      <button type="button" className="module-primary-action repair-primary-action" onClick={onNavigateToEvaluation}>
        查看评估
      </button>
    </section>
  )
}
