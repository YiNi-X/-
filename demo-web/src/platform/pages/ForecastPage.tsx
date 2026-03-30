import { useState } from 'react'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import { ForecastAnalysisTabs } from '../forecast/ForecastAnalysisTabs.tsx'
import { ForecastEvidenceDrawer } from '../forecast/ForecastEvidenceDrawer.tsx'
import { ForecastPrimaryStage } from '../forecast/ForecastPrimaryStage.tsx'
import { ForecastSummaryBand } from '../forecast/ForecastSummaryBand.tsx'
import { useForecastModule } from '../forecast/useForecastModule.ts'

type ForecastPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

export function ForecastPage({ entry, onNavigate }: ForecastPageProps) {
  const forecast = useForecastModule(entry)
  const [analysisOpen, setAnalysisOpen] = useState(false)

  return (
    <section className="module-page forecast-page" data-deferred-label="Not available in this version">
      {forecast.error ? (
        <PlatformStatusSurface
          tone="error"
          title="Forecast data unavailable"
          summary="The forecast runtime files could not be opened."
          detail={forecast.error}
          actions={[{ label: 'Return to evaluation', onClick: () => onNavigate('evaluation') }]}
        />
      ) : forecast.loading || !forecast.viewModel ? (
        <section className="forecast-loading-shell">
          <section className="frame module-summary-band forecast-summary-band">
            <div>
              <p className="panel-kicker">Flow Prediction</p>
              <h1>Loading forecast cockpit</h1>
              <p className="module-takeaway">Preparing forecast runtime, metrics, model configuration, and geometry references.</p>
            </div>
            <div className="module-skeleton-grid forecast-summary-skeleton-grid">
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
            </div>
          </section>

          <section className="forecast-primary-stage">
            <section className="frame forecast-primary-panel">
              <div className="module-skeleton-card forecast-chart-skeleton"></div>
            </section>
            <aside className="frame forecast-control-rail">
              <div className="module-skeleton-card forecast-rail-skeleton"></div>
              <div className="module-skeleton-card forecast-rail-skeleton"></div>
              <div className="module-skeleton-card forecast-rail-skeleton"></div>
            </aside>
          </section>
        </section>
      ) : (
        <>
          <ForecastSummaryBand
            viewModel={forecast.viewModel}
            corridorDominance={forecast.corridorDominance}
            onNavigateToEvaluation={() => onNavigate('evaluation')}
          />

          <ForecastPrimaryStage
            viewModel={forecast.viewModel}
            corridorDominance={forecast.corridorDominance}
            selectedModel={forecast.selectedModel}
            selectedHorizon={forecast.selectedHorizon}
            selectedFrameIndex={forecast.selectedFrameIndex}
            onSelectModel={forecast.setSelectedModel}
            onSelectHorizon={forecast.setSelectedHorizon}
            onSelectFrame={forecast.setSelectedFrameIndex}
          />

          <ForecastAnalysisTabs
            viewModel={forecast.viewModel}
            corridorDominance={forecast.corridorDominance}
            selectedTab={forecast.selectedTab}
            selectedHorizon={forecast.selectedHorizon}
            selectedGridId={forecast.selectedGridId}
            open={analysisOpen}
            onToggleOpen={() => setAnalysisOpen((current) => !current)}
            onSelectTab={forecast.setSelectedTab}
            onSelectGrid={forecast.setSelectedGridId}
            onOpenEvidenceDrawer={() => forecast.setEvidenceDrawerOpen(true)}
          />

          <ForecastEvidenceDrawer
            viewModel={forecast.viewModel}
            open={forecast.isEvidenceDrawerOpen}
            onClose={() => forecast.setEvidenceDrawerOpen(false)}
          />
        </>
      )}
    </section>
  )
}
