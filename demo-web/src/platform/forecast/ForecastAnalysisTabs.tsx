import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import type { CorridorDominanceSummary } from '../clustering/corridorDominance.ts'
import { ForecastAlertTable } from './ForecastAlertTable.tsx'
import { ForecastEvidenceTab } from './ForecastEvidenceTab.tsx'
import { ForecastFrameComparisonPanel } from './ForecastFrameComparisonPanel.tsx'
import { ForecastFocusMapCard } from './ForecastFocusMapCard.tsx'
import { ForecastHotspotSmallMultiples } from './ForecastHotspotSmallMultiples.tsx'
import { ForecastMetricDegradationPanel } from './ForecastMetricDegradationPanel.tsx'
import { ForecastNodeViewTab } from './ForecastNodeViewTab.tsx'
import type { ForecastAnalysisTabId, ForecastViewModel } from './forecastTypes.ts'

type ForecastAnalysisTabsProps = {
  viewModel: ForecastViewModel
  corridorDominance: CorridorDominanceSummary | null
  selectedTab: ForecastAnalysisTabId
  selectedHorizon: string
  selectedGridId: string | null
  open: boolean
  onToggleOpen: () => void
  onSelectTab: (tab: ForecastAnalysisTabId) => void
  onSelectGrid: (gridId: string) => void
  onOpenEvidenceDrawer: () => void
}

const TAB_OPTIONS: Array<{ id: ForecastAnalysisTabId; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'grid-focus', label: '网格焦点' },
  { id: 'node-view', label: '节点视图' },
  { id: 'evidence', label: '证据' },
]

function renderOverview(viewModel: ForecastViewModel) {
  return (
    <div className="forecast-tab-grid">
      <ForecastMetricDegradationPanel rows={viewModel.metrics.degradationRows} metricBasis={viewModel.meta.metricBasis} />

      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">叙事证据</p>
            <h2>当前帧解释</h2>
          </div>
          <span className="panel-code">TEXT</span>
        </div>
        <div className="forecast-narrative-shell">
          <article className="forecast-narrative-card">
            <span>摘要</span>
            <strong>{viewModel.frame?.narrative.strategy?.headline ?? '等待策略文案'}</strong>
            <p>{viewModel.frame?.narrative.strategy?.summary ?? viewModel.frame?.narrative.summary}</p>
          </article>
          <div className="forecast-log-list">
            {(viewModel.frame?.narrative.logs ?? []).slice(0, 3).map((logLine) => (
              <article key={logLine}>
                <span>回放日志</span>
                <small>{logLine}</small>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function renderGridFocus(
  viewModel: ForecastViewModel,
  corridorDominance: CorridorDominanceSummary | null,
  selectedHorizon: string,
  selectedGridId: string | null,
  onSelectGrid: (gridId: string) => void,
) {
  const alerts = viewModel.frame?.derived.alerts ?? []

  return (
    <div className="forecast-tab-grid">
      <ForecastHotspotSmallMultiples
        gridIds={viewModel.hotspotSeries.gridIds}
        byGrid={viewModel.hotspotSeries.byGrid}
        comparisonRows={viewModel.frameComparison.rows}
        selectedHorizon={selectedHorizon}
        selectedFrameIndex={viewModel.timeline.selectedFrameIndex}
        selectedGridId={selectedGridId}
        onSelectGrid={onSelectGrid}
      />

      <div className="forecast-selected-grid-shell">
        {viewModel.frameComparison.rows.length ? (
          <ForecastFrameComparisonPanel
            rows={viewModel.frameComparison.rows}
            corridorDominance={corridorDominance}
            selectedHorizon={selectedHorizon}
            selectedGridId={selectedGridId}
            onSelectGrid={onSelectGrid}
          />
        ) : (
          <PlatformStatusSurface
            tone="unavailable"
            title="网格焦点不可用"
            summary="当前帧没有提供热点对比数据。"
            detail="请在主时间线上选择另一帧继续查看。"
          />
        )}

        <ForecastAlertTable alerts={alerts} corridorDominance={corridorDominance} selectedGridId={selectedGridId} onSelectGrid={onSelectGrid} />
        <ForecastFocusMapCard viewModel={viewModel} selectedGridId={selectedGridId} />
      </div>
    </div>
  )
}

function getToolbarNote(selectedTab: ForecastAnalysisTabId, selectedHorizon: string, viewModel: ForecastViewModel) {
  switch (selectedTab) {
    case 'overview':
      return '查看当前模型在不同 horizon 上的质量表现，以及当前帧的叙事解释。'
    case 'grid-focus':
      return `围绕 ${viewModel.summaryBand.focusGridId ?? '当前焦点网格'}，查看 ${selectedHorizon} 的网格级对比。`
    case 'node-view':
      return '节点级桥接视图被明确保留，用来说明当前仍缺少 60 节点 runtime 导出。'
    case 'evidence':
      return '证据摘要留在页内，完整证据抽屉保持一键可达。'
  }
}

export function ForecastAnalysisTabs({
  viewModel,
  corridorDominance,
  selectedTab,
  selectedHorizon,
  selectedGridId,
  open,
  onToggleOpen,
  onSelectTab,
  onSelectGrid,
  onOpenEvidenceDrawer,
}: ForecastAnalysisTabsProps) {
  return (
    <section className={`frame forecast-analysis-shell${open ? ' is-open' : ''}`}>
      <div className="forecast-analysis-header">
        <div className="forecast-analysis-copy">
          <p className="panel-kicker">详细分析</p>
          <h2>指标证据、网格压力与分阶段研究视图</h2>
          <p>
            当你需要解释当前帧为什么重要时，再展开这一层。主驾驶舱负责核心叙事，这里负责证据与细节。
          </p>
        </div>

        <div className="forecast-analysis-actions">
          <button type="button" className="segmented-button" onClick={onOpenEvidenceDrawer}>
            证据抽屉
          </button>
          <button type="button" className={`segmented-button${open ? ' active' : ''}`} onClick={onToggleOpen}>
            {open ? '收起详情' : '展开详情'}
          </button>
        </div>
      </div>

      {!open ? (
        <div className="forecast-analysis-collapsed-note">
          <span>默认收起</span>
          <strong>当评审者需要更深的指标、网格、节点或证据上下文时，再展开这一层。</strong>
          <small>节点级论文视图仍保留给后续导出版本，页面会明确说明，而不是悄悄隐藏。</small>
        </div>
      ) : (
        <>
          <div className="forecast-analysis-toolbar">
            <div className="forecast-analysis-tab-row" role="tablist" aria-label="预测分析标签页">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === tab.id}
                  className={`segmented-button forecast-analysis-tab${selectedTab === tab.id ? ' active' : ''}`}
                  onClick={() => onSelectTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="forecast-analysis-toolbar-note">{getToolbarNote(selectedTab, selectedHorizon, viewModel)}</p>
          </div>

          {selectedTab === 'overview' ? renderOverview(viewModel) : null}
          {selectedTab === 'grid-focus' ? renderGridFocus(viewModel, corridorDominance, selectedHorizon, selectedGridId, onSelectGrid) : null}
          {selectedTab === 'node-view' ? <ForecastNodeViewTab viewModel={viewModel} selectedGridId={selectedGridId} /> : null}
          {selectedTab === 'evidence' ? <ForecastEvidenceTab viewModel={viewModel} onOpenEvidenceDrawer={onOpenEvidenceDrawer} /> : null}
        </>
      )}
    </section>
  )
}
