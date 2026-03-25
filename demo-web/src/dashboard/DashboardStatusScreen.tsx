import { formatDatasetPath } from '../datasetCatalog'
import type { DatasetCatalog, DatasetCatalogEntry } from '../datasetCatalog'
import type { AisPlaybackData, FlowForecastData, GeometryConfig } from '../sharedContracts'
import { SHARED_GEOMETRY_PATH } from './dashboardUtils'

type DashboardStatusScreenProps = {
  selectedDatasetLabel: string
  selectedDataset: DatasetCatalogEntry | null
  datasetCatalog: DatasetCatalog | null
  geometryConfig: GeometryConfig | null
  aisPlayback: AisPlaybackData | null
  flowForecast: FlowForecastData | null
  dashboardUnavailableReason: string
}

export function DashboardStatusScreen({
  selectedDatasetLabel,
  selectedDataset,
  datasetCatalog,
  geometryConfig,
  aisPlayback,
  flowForecast,
  dashboardUnavailableReason,
}: DashboardStatusScreenProps) {
  const isUnavailable = Boolean(dashboardUnavailableReason)

  return (
    <main className="platform platform-status">
      <section className="frame platform-status-shell">
        <div className="platform-status-copy">
          <span className="platform-status-eyebrow">{isUnavailable ? 'Runtime Unavailable' : 'Preparing Workspace'}</span>
          <h1>{isUnavailable ? 'Traffic data unavailable' : 'Loading validated traffic data'}</h1>
          <p>
            {isUnavailable
              ? 'The dashboard stopped before rendering live-derived metrics because one or more required offline assets are missing or malformed.'
              : 'The dashboard is checking the committed dataset catalog, shared geometry, AIS playback, and forecast payloads before opening the control surface.'}
          </p>
        </div>

        <div className="platform-status-grid">
          <article className="platform-status-card accent">
            <span>Dataset</span>
            <strong>{selectedDatasetLabel}</strong>
            <small>{selectedDataset?.description || 'The dashboard will continue only after a validated offline dataset is ready.'}</small>
          </article>

          <article className="platform-status-card">
            <span>Catalog</span>
            <strong>{datasetCatalog ? 'Validated' : isUnavailable ? 'Unavailable' : 'Checking'}</strong>
            <small>{formatDatasetPath('data/dataset-catalog.json')}</small>
          </article>

          <article className="platform-status-card">
            <span>Geometry</span>
            <strong>{geometryConfig ? 'Validated' : isUnavailable ? 'Unavailable' : 'Checking'}</strong>
            <small>{formatDatasetPath(SHARED_GEOMETRY_PATH)}</small>
          </article>

          <article className="platform-status-card">
            <span>AIS Playback</span>
            <strong>{aisPlayback ? 'Validated' : isUnavailable ? 'Unavailable' : 'Checking'}</strong>
            <small>{selectedDataset ? formatDatasetPath(selectedDataset.aisPlaybackPath) : 'Waiting for catalog'}</small>
          </article>

          <article className="platform-status-card">
            <span>Flow Forecast</span>
            <strong>{flowForecast ? 'Validated' : isUnavailable ? 'Unavailable' : 'Checking'}</strong>
            <small>{selectedDataset ? formatDatasetPath(selectedDataset.flowForecastPath) : 'Waiting for catalog'}</small>
          </article>
        </div>

        <div className="platform-status-detail">
          <span>{isUnavailable ? 'Contract detail' : 'Status detail'}</span>
          <strong>{dashboardUnavailableReason || `Preparing ${selectedDatasetLabel}. No scene state will render until all required payloads validate successfully.`}</strong>
        </div>
      </section>
    </main>
  )
}
