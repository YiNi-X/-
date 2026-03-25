import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type ClusteringPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type ClusteringSummary = {
  stageCounts: {
    rawAisRows: number
    segmentedTracks: number
    compressedTracks: number
    corridorRuntimeCorridors: number
    corridorRuntimeTracks: number
  }
  layerOrder: string[]
  reviewStatus: {
    corridorPromotion: string
    runtimeCorridorPath: string
    reviewCorridorPath: string
  }
  deferred?: Array<{ artifactId: string; reason: string }>
}

export function ClusteringPage({ entry, onNavigate }: ClusteringPageProps) {
  const [summary, setSummary] = useState<ClusteringSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void loadPublicJson<ClusteringSummary>(`/${entry.entryFiles.summary}`)
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load clustering summary.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.summary])

  return (
    <section className="module-page">
      <section className="frame module-summary-band">
        <div>
          <p className="panel-kicker">Trajectory Clustering</p>
          <h1>Raw to segmented to compressed to corridor-ready layers</h1>
          <p className="module-takeaway">
            {summary
              ? 'The baseline clustering page keeps the exported corridor story ready while isolating the notebook-only noise re-clustering path for a later update.'
              : 'Loading clustering stage counts and review metadata from the module bundle.'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Raw AIS rows</span>
            <strong>{summary?.stageCounts.rawAisRows ?? '--'}</strong>
          </article>
          <article>
            <span>Compressed tracks</span>
            <strong>{summary?.stageCounts.compressedTracks ?? '--'}</strong>
          </article>
          <article>
            <span>Runtime corridors</span>
            <strong>{summary?.stageCounts.corridorRuntimeCorridors ?? '--'}</strong>
          </article>
        </div>
        <button type="button" className="module-primary-action" onClick={() => onNavigate('overview')}>
          View Details
        </button>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Pipeline Layers</p>
              <h2>Baseline stage progression</h2>
            </div>
            <span className="panel-code">CLUS</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Clustering data unavailable" summary="The clustering summary file could not be opened." detail={error} />
          ) : summary ? (
            <div className="module-flow-list">
              {summary.layerOrder.map((layer, index) => (
                <article key={layer} className="module-flow-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{layer}</strong>
                  <p>
                    {layer === 'raw'
                      ? `${summary.stageCounts.rawAisRows} raw AIS rows`
                      : layer === 'segmented'
                        ? `${summary.stageCounts.segmentedTracks} segmented tracks`
                        : layer === 'compressed'
                          ? `${summary.stageCounts.compressedTracks} compressed tracks`
                          : `${summary.stageCounts.corridorRuntimeTracks} runtime corridor tracks`}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="module-skeleton-grid">
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
              <div className="module-skeleton-card"></div>
            </div>
          )}
        </section>

        <aside className="frame module-side-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Review Status</p>
              <h2>Promotion boundary</h2>
            </div>
            <span className="panel-code">REVIEW</span>
          </div>

          <div className="module-side-list">
            <article>
              <span>Promotion state</span>
              <strong>{summary?.reviewStatus.corridorPromotion ?? 'Loading'}</strong>
            </article>
            <article>
              <span>Runtime corridor file</span>
              <strong>{summary?.reviewStatus.runtimeCorridorPath ?? entry.entryFiles.corridorRuntime}</strong>
            </article>
            <article>
              <span>Review corridor file</span>
              <strong>{summary?.reviewStatus.reviewCorridorPath ?? entry.entryFiles.corridorReview}</strong>
            </article>
          </div>

          <div className="module-deferred-note">
            <span>Later update</span>
            <strong>Not available in this version</strong>
            <p>{summary?.deferred?.[0]?.reason ?? entry.deferredItems[0]?.reason ?? 'Noise re-clustering remains deferred.'}</p>
          </div>
        </aside>
      </section>
    </section>
  )
}
