import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type EvaluationPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type EvaluationMetrics = {
  forecast?: {
    deferredModels?: Array<{ model: string; reason: string }>
    rankings?: Record<string, Record<string, Array<{ model: string; value: number; rank: number }>>>
  }
  repair?: {
    aggregateByModel?: Array<{ modelLabel: string; rmse: number; mae: number; rankByRmse: number }>
  }
}

export function EvaluationPage({ entry, onNavigate }: EvaluationPageProps) {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void loadPublicJson<EvaluationMetrics>(`/${entry.entryFiles.metrics}`)
      .then((data) => {
        if (cancelled) return
        setMetrics(data)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load evaluation metrics.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.metrics])

  const horizonRankings = metrics?.forecast?.rankings ?? {}
  const repairRankings = metrics?.repair?.aggregateByModel ?? []

  return (
    <section className="module-page">
      <section className="frame module-summary-band">
        <div>
          <p className="panel-kicker">Evaluation Center</p>
          <h1>Unified metric evidence across forecast and repair</h1>
          <p className="module-takeaway">
            {metrics
              ? 'This page keeps model evidence in one place so the shell can point deeper module pages back to a shared scoreboard instead of duplicating rankings.'
              : 'Loading evaluation metrics from the Phase 6 bundle.'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Forecast horizons</span>
            <strong>{Object.keys(horizonRankings).length || '--'}</strong>
          </article>
          <article>
            <span>Repair models ranked</span>
            <strong>{repairRankings.length || '--'}</strong>
          </article>
          <article>
            <span>Deferred forecast models</span>
            <strong>{metrics?.forecast?.deferredModels?.length ?? '--'}</strong>
          </article>
        </div>
        <button type="button" className="module-primary-action" onClick={() => onNavigate('forecast')}>
          Compare Results
        </button>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Forecast Rankings</p>
              <h2>Per-horizon leaders</h2>
            </div>
            <span className="panel-code">EVAL</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Evaluation data unavailable" summary="The evaluation metrics file could not be opened." detail={error} />
          ) : Object.keys(horizonRankings).length ? (
            <div className="module-card-grid">
              {Object.entries(horizonRankings).map(([horizon, rankingSet]) => {
                const rmseLeader = rankingSet.rmse?.[0]
                const maeLeader = rankingSet.mae?.[0]
                const r2Leader = rankingSet.r2?.[0]
                return (
                  <article key={horizon} className="metric-spotlight-card">
                    <span>{horizon}</span>
                    <strong>RMSE leader {rmseLeader?.model ?? '--'}</strong>
                    <small>MAE leader {maeLeader?.model ?? '--'}</small>
                    <em>R2 leader {r2Leader?.model ?? '--'}</em>
                  </article>
                )
              })}
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
              <p className="panel-kicker">Repair Rankings</p>
              <h2>Average RMSE table</h2>
            </div>
            <span className="panel-code">RMSE</span>
          </div>

          <div className="module-side-list">
            {repairRankings.map((model) => (
              <article key={model.modelLabel}>
                <span>{model.modelLabel}</span>
                <strong>RMSE {model.rmse.toExponential(3)}</strong>
                <small>MAE {model.mae.toExponential(3)}</small>
              </article>
            ))}
            {!repairRankings.length ? (
              <article>
                <span>Repair ranking</span>
                <strong>Loading</strong>
              </article>
            ) : null}
          </div>

          {(metrics?.forecast?.deferredModels ?? []).length ? (
            <div className="module-deferred-note">
              <span>Later update</span>
              <strong>Not available in this version</strong>
              <p>{metrics?.forecast?.deferredModels?.[0]?.reason}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
