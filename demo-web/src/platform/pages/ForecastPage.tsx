import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type ForecastPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type ForecastMetrics = {
  models: Record<string, { horizons: Record<string, { mae: number; rmse: number; r2: number }> }>
  deferredModels?: Array<{ model: string; reason: string }>
}

type ForecastRuntime = {
  meta: { model: string; horizons: string[] }
  series: { totalFlow: number[]; forecastTotals: Record<string, number[]> }
}

export function ForecastPage({ entry, onNavigate }: ForecastPageProps) {
  const [metrics, setMetrics] = useState<ForecastMetrics | null>(null)
  const [runtime, setRuntime] = useState<ForecastRuntime | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<ForecastMetrics>(`/${entry.entryFiles.metrics}`),
      loadPublicJson<ForecastRuntime>(`/${entry.entryFiles.runtime}`),
    ])
      .then(([metricsData, runtimeData]) => {
        if (cancelled) return
        setMetrics(metricsData)
        setRuntime(runtimeData)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load forecast page data.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.metrics, entry.entryFiles.runtime])

  const stgcnHorizons = metrics?.models?.STGCN?.horizons ?? {}
  const horizonCards = Object.entries(stgcnHorizons)
  const currentTotal = runtime?.series?.totalFlow?.[0] ?? null
  const future1h = runtime?.series?.forecastTotals?.['1h']?.[0] ?? null
  const bestR2 = horizonCards.reduce((best, [horizon, values]) => (values.r2 > best.value ? { horizon, value: values.r2 } : best), {
    horizon: '--',
    value: -Infinity,
  })

  return (
    <section className="module-page">
      <section className="frame module-summary-band">
        <div>
          <p className="panel-kicker">Flow Prediction</p>
          <h1>Offline STGCN runtime aligned to the replay timeline</h1>
          <p className="module-takeaway">
            {runtime
              ? `${runtime.meta.model} is the authoritative runtime in this version, and deferred models stay documented without pretending they are connected.`
              : 'Loading forecast bundle details from the Phase 6 package.'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Current total flow</span>
            <strong>{currentTotal ?? '--'}</strong>
          </article>
          <article>
            <span>Next 1h forecast</span>
            <strong>{future1h ?? '--'}</strong>
          </article>
          <article>
            <span>Best R2 horizon</span>
            <strong>{bestR2.value >= 0 ? `${bestR2.horizon} / ${bestR2.value.toFixed(3)}` : '--'}</strong>
          </article>
        </div>
        <button type="button" className="module-primary-action" onClick={() => onNavigate('evaluation')}>
          Compare Results
        </button>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Horizon Breakdown</p>
              <h2>1h / 2h / 3h forecast quality</h2>
            </div>
            <span className="panel-code">STGCN</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Forecast data unavailable" summary="The forecast runtime files could not be opened." detail={error} />
          ) : horizonCards.length ? (
            <div className="module-card-grid">
              {horizonCards.map(([horizon, values]) => (
                <article key={horizon} className="metric-spotlight-card">
                  <span>{horizon}</span>
                  <strong>RMSE {values.rmse.toFixed(3)}</strong>
                  <small>MAE {values.mae.toFixed(3)}</small>
                  <em>R2 {values.r2.toFixed(3)}</em>
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
              <p className="panel-kicker">Deferred Models</p>
              <h2>Later update scope</h2>
            </div>
            <span className="panel-code">SHELL</span>
          </div>

          <div className="module-side-list">
            {(metrics?.deferredModels ?? []).map((model) => (
              <article key={model.model}>
                <span>{model.model}</span>
                <strong>Not available in this version</strong>
                <small>{model.reason}</small>
              </article>
            ))}
            {!metrics?.deferredModels?.length ? (
              <article>
                <span>Deferred models</span>
                <strong>Loading</strong>
              </article>
            ) : null}
          </div>

          <div className="module-deferred-note">
            <span>Bundle files</span>
            <strong>{Object.keys(entry.entryFiles).join(', ')}</strong>
            <p>The shell keeps model readiness honest at the section level and points full benchmark comparison toward the evaluation center.</p>
          </div>
        </aside>
      </section>
    </section>
  )
}
