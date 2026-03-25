import { useEffect, useMemo, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'

type RepairPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

type RepairSamples = {
  samples: Array<{
    sampleId: string
    label: string
    missingPointCount: number
    groundTruthPointCount: number
    availableModels: string[]
  }>
}

type RepairMetrics = {
  samples: Array<{
    sampleId: string
    metrics: Array<{ modelId: string; modelLabel: string; rmse: number; mae: number; dtwSimilarity: number; hausdorffDistance: number }>
  }>
}

export function RepairPage({ entry, onNavigate }: RepairPageProps) {
  const [samples, setSamples] = useState<RepairSamples | null>(null)
  const [metrics, setMetrics] = useState<RepairMetrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<RepairSamples>(`/${entry.entryFiles.samples}`),
      loadPublicJson<RepairMetrics>(`/${entry.entryFiles.metrics}`),
    ])
      .then(([samplesData, metricsData]) => {
        if (cancelled) return
        setSamples(samplesData)
        setMetrics(metricsData)
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load repair page data.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.metrics, entry.entryFiles.samples])

  const aggregateModels = useMemo(() => {
    if (!metrics) return []
    const aggregate = new Map<string, { label: string; rmseTotal: number; maeTotal: number; count: number }>()
    for (const sample of metrics.samples) {
      for (const metric of sample.metrics) {
        const current = aggregate.get(metric.modelId) ?? { label: metric.modelLabel, rmseTotal: 0, maeTotal: 0, count: 0 }
        aggregate.set(metric.modelId, {
          label: current.label,
          rmseTotal: current.rmseTotal + metric.rmse,
          maeTotal: current.maeTotal + metric.mae,
          count: current.count + 1,
        })
      }
    }

    return [...aggregate.entries()]
      .map(([modelId, value]) => ({
        modelId,
        modelLabel: value.label,
        averageRmse: value.rmseTotal / value.count,
        averageMae: value.maeTotal / value.count,
      }))
      .sort((left, right) => left.averageRmse - right.averageRmse)
  }, [metrics])

  const bestModel = aggregateModels[0]

  return (
    <section className="module-page">
      <section className="frame module-summary-band">
        <div>
          <p className="panel-kicker">Trajectory Repair</p>
          <h1>Curated repair samples with model-level error evidence</h1>
          <p className="module-takeaway">
            {bestModel
              ? `${bestModel.modelLabel} currently leads the average RMSE ranking across the curated samples.`
              : 'Loading repair samples and metric traces from the Phase 6 bundle.'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Samples</span>
            <strong>{samples?.samples.length ?? '--'}</strong>
          </article>
          <article>
            <span>Best model</span>
            <strong>{bestModel?.modelLabel ?? '--'}</strong>
          </article>
          <article>
            <span>Available methods</span>
            <strong>{samples?.samples[0]?.availableModels.length ?? '--'}</strong>
          </article>
        </div>
        <button type="button" className="module-primary-action" onClick={() => onNavigate('home')}>
          View Trajectory
        </button>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Sample Library</p>
              <h2>Curated repair set</h2>
            </div>
            <span className="panel-code">REPAIR</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Repair data unavailable" summary="The repair files could not be opened." detail={error} />
          ) : samples ? (
            <div className="module-card-grid">
              {samples.samples.map((sample) => (
                <article key={sample.sampleId} className="metric-spotlight-card">
                  <span>{sample.label}</span>
                  <strong>{sample.missingPointCount} missing points</strong>
                  <small>{sample.groundTruthPointCount} ground-truth points</small>
                  <em>{sample.availableModels.length} model outputs</em>
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
              <p className="panel-kicker">Model Ranking</p>
              <h2>Average RMSE</h2>
            </div>
            <span className="panel-code">RANK</span>
          </div>

          <div className="module-side-list">
            {aggregateModels.map((model) => (
              <article key={model.modelId}>
                <span>{model.modelLabel}</span>
                <strong>RMSE {model.averageRmse.toExponential(3)}</strong>
                <small>MAE {model.averageMae.toExponential(3)}</small>
              </article>
            ))}
            {!aggregateModels.length ? (
              <article>
                <span>Ranking</span>
                <strong>Loading</strong>
              </article>
            ) : null}
          </div>

          {entry.deferredItems.length ? (
            <div className="module-deferred-note">
              <span>Later update</span>
              <strong>Not available in this version</strong>
              <p>{entry.deferredItems[0].reason}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
