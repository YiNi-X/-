import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type OverviewPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type OverviewSummary = {
  framing: string
  businessLoop: Array<{ step: string; description: string }>
  dataScale?: {
    forecast?: { timelineFrames: number; availableModels: string[] }
    repair?: { sampleCount: number; availableModels: string[] }
    clustering?: { compressedTracks: number; corridorRuntimeCorridors: number }
  }
  deferredModules?: Array<{ module: string; reason: string }>
}

export function OverviewPage({ entry, onNavigate }: OverviewPageProps) {
  const [summary, setSummary] = useState<OverviewSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void loadPublicJson<OverviewSummary>(`/${entry.entryFiles.summary}`)
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load overview summary.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.summary])

  return (
    <section className="module-page">
      <section className="frame module-summary-band">
        <div>
          <p className="panel-kicker">Overview</p>
          <h1>Business loop and module readiness</h1>
          <p className="module-takeaway">{summary?.framing ?? 'Loading the overview framing from the Phase 6 summary bundle.'}</p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Loop steps</span>
            <strong>{summary?.businessLoop.length ?? '--'}</strong>
          </article>
          <article>
            <span>Forecast frames</span>
            <strong>{summary?.dataScale?.forecast?.timelineFrames ?? '--'}</strong>
          </article>
          <article>
            <span>Repair samples</span>
            <strong>{summary?.dataScale?.repair?.sampleCount ?? '--'}</strong>
          </article>
        </div>
        <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
          View Details
        </button>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Business Loop</p>
              <h2>How the modules connect</h2>
            </div>
            <span className="panel-code">READY</span>
          </div>

          {summary ? (
            <div className="module-flow-list">
              {summary.businessLoop.map((step, index) => (
                <article key={step.step} className="module-flow-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{step.step}</strong>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          ) : error ? (
            <PlatformStatusSurface tone="error" title="Overview data unavailable" summary="The overview summary file could not be opened." detail={error} />
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
              <p className="panel-kicker">Scale Summary</p>
              <h2>Current data scale</h2>
            </div>
            <span className="panel-code">TRACE</span>
          </div>

          <div className="module-side-list">
            <article>
              <span>Available forecast models</span>
              <strong>{summary?.dataScale?.forecast?.availableModels?.join(', ') ?? 'Loading'}</strong>
            </article>
            <article>
              <span>Repair model count</span>
              <strong>{summary?.dataScale?.repair?.availableModels?.length ?? '--'}</strong>
            </article>
            <article>
              <span>Compressed clustering tracks</span>
              <strong>{summary?.dataScale?.clustering?.compressedTracks ?? '--'}</strong>
            </article>
            <article>
              <span>Runtime corridors</span>
              <strong>{summary?.dataScale?.clustering?.corridorRuntimeCorridors ?? '--'}</strong>
            </article>
          </div>

          {summary?.deferredModules?.length ? (
            <div className="module-deferred-note">
              <span>Later update</span>
              <strong>{summary.deferredModules[0].module}</strong>
              <p>{summary.deferredModules[0].reason}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
