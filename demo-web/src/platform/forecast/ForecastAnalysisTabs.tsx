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
  { id: 'overview', label: 'Overview' },
  { id: 'grid-focus', label: 'Grid Focus' },
  { id: 'node-view', label: 'Node View' },
  { id: 'evidence', label: 'Evidence' },
]

function renderOverview(viewModel: ForecastViewModel) {
  return (
    <div className="forecast-tab-grid">
      <ForecastMetricDegradationPanel rows={viewModel.metrics.degradationRows} metricBasis={viewModel.meta.metricBasis} />

      <section className="forecast-tab-panel">
        <div className="panel-title">
          <div>
            <p className="panel-kicker">Narrative evidence</p>
            <h2>Current frame explanation</h2>
          </div>
          <span className="panel-code">TEXT</span>
        </div>
        <div className="forecast-narrative-shell">
          <article className="forecast-narrative-card">
            <span>Summary</span>
            <strong>{viewModel.frame?.narrative.strategy?.headline ?? 'Awaiting strategy copy'}</strong>
            <p>{viewModel.frame?.narrative.strategy?.summary ?? viewModel.frame?.narrative.summary}</p>
          </article>
          <div className="forecast-log-list">
            {(viewModel.frame?.narrative.logs ?? []).slice(0, 3).map((logLine) => (
              <article key={logLine}>
                <span>Replay log</span>
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
            title="Grid focus unavailable"
            summary="The selected frame does not expose hotspot comparison data."
            detail="Choose another frame from the main timeline to continue."
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
      return 'Horizon-level quality and frame narrative for the current model.'
    case 'grid-focus':
      return `Grid-level comparison for ${selectedHorizon} around ${viewModel.summaryBand.focusGridId ?? 'the current focus grid'}.`
    case 'node-view':
      return 'Reserved node-level bridge that stays explicit about missing 60-node runtime exports.'
    case 'evidence':
      return 'Evidence summaries stay inside the page, while the full drawer remains one click away.'
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
          <p className="panel-kicker">Detailed Analysis</p>
          <h2>Metric evidence, grid pressure, and staged research surfaces</h2>
          <p>
            Open this layer when you want to explain why the selected frame matters. Keep the main cockpit for the core story, and use this area for proof.
          </p>
        </div>

        <div className="forecast-analysis-actions">
          <button type="button" className="segmented-button" onClick={onOpenEvidenceDrawer}>
            Evidence Drawer
          </button>
          <button type="button" className={`segmented-button${open ? ' active' : ''}`} onClick={onToggleOpen}>
            {open ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {!open ? (
        <div className="forecast-analysis-collapsed-note">
          <span>Collapsed by default</span>
          <strong>Use this when the reviewer asks for deeper metric, grid, node, or evidence context.</strong>
          <small>Node-level paper views remain staged for later exports and are intentionally kept explicit instead of hidden.</small>
        </div>
      ) : (
        <>
          <div className="forecast-analysis-toolbar">
            <div className="forecast-analysis-tab-row" role="tablist" aria-label="Forecast analysis tabs">
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
