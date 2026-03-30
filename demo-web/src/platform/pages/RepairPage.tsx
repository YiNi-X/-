import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import { RepairDetailGrid } from '../repair/RepairDetailGrid.tsx'
import { RepairPrimaryStage } from '../repair/RepairPrimaryStage.tsx'
import { RepairSummaryBand } from '../repair/RepairSummaryBand.tsx'
import { useRepairModule } from '../repair/useRepairModule.ts'

type RepairPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

export function RepairPage({ entry, onNavigate }: RepairPageProps) {
  const repair = useRepairModule(entry)

  return (
    <section className="module-page repair-page" data-deferred-label="Not available in this version">
      {repair.error ? (
        <PlatformStatusSurface
          tone="error"
          title="Repair data unavailable"
          summary="The repair sample files could not be opened."
          detail={repair.error}
          actions={[{ label: 'Return to evaluation', onClick: () => onNavigate('evaluation') }]}
        />
      ) : repair.loading || !repair.viewModel ? (
        <section className="repair-loading-shell">
          <section className="frame module-summary-band repair-summary-band">
            <div>
              <p className="panel-kicker">Trajectory Repair</p>
              <h1>Loading curated repair cockpit</h1>
              <p className="module-takeaway">Preparing sample trajectories, notebook-derived errors, and model ranking evidence.</p>
            </div>
            <div className="module-skeleton-grid repair-summary-skeleton-grid">
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
            </div>
          </section>

          <section className="repair-primary-stage">
            <section className="frame repair-primary-panel">
              <div className="module-skeleton-card repair-stage-skeleton"></div>
            </section>
            <aside className="frame repair-control-rail">
              <div className="module-skeleton-card repair-rail-skeleton"></div>
              <div className="module-skeleton-card repair-rail-skeleton"></div>
              <div className="module-skeleton-card repair-rail-skeleton"></div>
            </aside>
          </section>

          <section className="repair-detail-grid">
            <section className="frame repair-detail-panel">
              <div className="module-skeleton-card repair-detail-skeleton"></div>
            </section>
            <aside className="frame repair-detail-panel repair-ranking-panel">
              <div className="module-skeleton-card repair-detail-skeleton"></div>
            </aside>
          </section>
        </section>
      ) : (
        <>
          <RepairSummaryBand viewModel={repair.viewModel} onNavigateToEvaluation={() => onNavigate('evaluation')} />

          <RepairPrimaryStage
            viewModel={repair.viewModel}
            selectedSampleId={repair.selectedSampleId}
            selectedModelId={repair.selectedModelId}
            selectedErrorMetric={repair.selectedErrorMetric}
            showMissing={repair.showMissing}
            showGroundTruth={repair.showGroundTruth}
            showRepair={repair.showRepair}
            onSelectSample={repair.setSelectedSampleId}
            onSelectModel={repair.setSelectedModelId}
            onSelectErrorMetric={repair.setSelectedErrorMetric}
            onToggleMissing={repair.toggleMissing}
            onToggleGroundTruth={repair.toggleGroundTruth}
            onToggleRepair={repair.toggleRepair}
          />

          <RepairDetailGrid
            viewModel={repair.viewModel}
            selectedModelId={repair.selectedModelId}
            selectedErrorMetric={repair.selectedErrorMetric}
            onSelectModel={repair.setSelectedModelId}
          />
        </>
      )}
    </section>
  )
}
