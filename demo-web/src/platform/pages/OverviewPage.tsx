import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { MainCorridorTracksFile } from '../../sharedContracts'
import type { ShellRouteId } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import {
  buildCorridorDominanceSummary,
  CLUSTERING_CORRIDOR_RUNTIME_PATH,
  formatSharePercent,
  type CorridorDominanceSummary,
} from '../clustering/corridorDominance.ts'
import type { ClusteringNoiseFallback } from '../clustering/clusteringTypes.ts'
import { getShellRouteDescriptor } from '../routeRegistry.ts'
import type { OverviewSummary } from '../overview/overviewTypes.ts'

type OverviewPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

const CLUSTERING_NOISE_FALLBACK_PATH = '/data/modules/clustering/clustering-noise-fallback.json'

function getOverviewStatusClassName(status: 'ready' | 'partial' | 'deferred') {
  if (status === 'deferred') return 'overview-status-pill is-deferred'
  if (status === 'partial') return 'overview-status-pill is-partial'
  return 'overview-status-pill'
}

export function OverviewPage({ entry, onNavigate }: OverviewPageProps) {
  const [summary, setSummary] = useState<OverviewSummary | null>(null)
  const [corridorDominance, setCorridorDominance] = useState<CorridorDominanceSummary | null>(null)
  const [noiseFallback, setNoiseFallback] = useState<ClusteringNoiseFallback | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<OverviewSummary>(`/${entry.entryFiles.summary}`),
      loadPublicJson<MainCorridorTracksFile>(CLUSTERING_CORRIDOR_RUNTIME_PATH).catch(() => null),
      loadPublicJson<ClusteringNoiseFallback>(CLUSTERING_NOISE_FALLBACK_PATH).catch(() => null),
    ])
      .then(([data, corridorRuntime, fallback]) => {
        if (cancelled) return
        setSummary(data)
        setCorridorDominance(corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null)
        setNoiseFallback(fallback)
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

  const corridorLeader = corridorDominance?.leadingCorridor ?? null
  const leadingDirection = corridorDominance?.leadingDirection ?? null
  const noiseReason = noiseFallback?.dropReasons.find((reason) => reason.id === 'dbscan_noise') ?? null
  const noiseShare = noiseFallback && noiseReason ? noiseFallback.counts.rawSegments > 0 ? noiseReason.count / noiseFallback.counts.rawSegments : 0 : 0
  const noiseArtifactStatus =
    noiseFallback?.deferredArtifact.status === 'zero-byte'
      ? `${noiseFallback.deferredArtifact.fileName} exists in the workspace but is still 0 bytes`
      : noiseFallback?.deferredArtifact.status === 'missing'
        ? `${noiseFallback.deferredArtifact.fileName} is still missing from the workspace`
        : `${noiseFallback?.deferredArtifact.fileName ?? 'The distance artifact'} is still unreadable`
  const businessLoop = summary?.businessLoop ?? []
  const moduleEntryPoints = summary?.moduleEntryPoints ?? []
  const scenarioEntryPoints = summary?.scenarioEntryPoints ?? []
  const framingPillars = summary?.framingPillars ?? []
  const deferredModules = summary?.deferredModules ?? []
  const readyModuleCount = moduleEntryPoints.filter((item) => item.status === 'ready').length
  const scenarioEntryCount = scenarioEntryPoints.length
  const sourceEntries = Object.entries(entry.sources)
  const topScenarioEntries = scenarioEntryPoints

  function getEntryActionLabel(routeId: ShellRouteId) {
    return routeId === 'home' ? 'Open Home' : getShellRouteDescriptor(routeId).entryActionLabel
  }

  return (
    <section className="module-page">
      <section className="frame module-summary-band overview-summary-band">
        <div>
          <p className="panel-kicker">Overview</p>
          <h1>Business loop, module entry points, and evidence framing</h1>
          <p className="module-takeaway">{summary?.framing ?? 'Loading the overview framing from the Phase 6 summary bundle.'}</p>
        </div>
        <div className="module-kpi-grid overview-kpi-grid">
          <article>
            <span>Loop steps</span>
            <strong>{summary ? businessLoop.length : '--'}</strong>
          </article>
          <article>
            <span>Entry modules</span>
            <strong>{summary ? readyModuleCount : '--'}</strong>
          </article>
          <article>
            <span>Scenario entries</span>
            <strong>{summary ? scenarioEntryCount : '--'}</strong>
          </article>
          <article>
            <span>Forecast frames</span>
            <strong>{summary?.dataScale?.forecast?.timelineFrames ?? '--'}</strong>
          </article>
        </div>
        <div className="overview-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('home')}>
            Open Home
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('forecast')}>
            View Forecast
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('evaluation')}>
            Open Evaluation
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Business Loop</p>
              <h2>How archived playback turns into evidence-ready modules</h2>
            </div>
            <span className="panel-code">OVER-01</span>
          </div>

          {summary ? (
            <div className="module-flow-list overview-loop-grid">
              {businessLoop.map((step, index) => (
                <article key={step.step} className="module-flow-card overview-loop-card">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{step.step}</strong>
                  <p>{step.description}</p>
                  <div className="corridor-chip-row">
                    {step.sourceArtifacts.map((artifactId) => (
                      <span key={artifactId} className="corridor-chip">
                        {artifactId}
                      </span>
                    ))}
                  </div>
                  <div className="overview-entry-actions">
                    <span className={getOverviewStatusClassName(step.status)}>{step.status}</span>
                    <button type="button" className="panel-action subtle" onClick={() => onNavigate(step.routeId)}>
                      {getEntryActionLabel(step.routeId)}
                    </button>
                  </div>
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

          {summary ? (
            <div className="module-inline-section">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Module Entry Points</p>
                  <h2>Jump straight from the loop into each algorithm surface</h2>
                </div>
                <span className="panel-code">OVER-02</span>
              </div>

              <div className="module-card-grid overview-entry-grid">
                {moduleEntryPoints.map((moduleEntry) => (
                  <article key={moduleEntry.routeId} className="metric-spotlight-card overview-entry-card">
                    <div className="overview-entry-head">
                      <span>{moduleEntry.label}</span>
                      <em className={getOverviewStatusClassName(moduleEntry.status)}>{moduleEntry.status}</em>
                    </div>
                    <strong>{moduleEntry.summary}</strong>
                    <div className="home-module-metrics">
                      <article>
                        <span>{moduleEntry.primaryMetric.label}</span>
                        <strong>{moduleEntry.primaryMetric.value}</strong>
                      </article>
                      <article>
                        <span>{moduleEntry.secondaryMetric.label}</span>
                        <strong>{moduleEntry.secondaryMetric.value}</strong>
                      </article>
                    </div>
                    <div className="corridor-chip-row">
                      {moduleEntry.requirementCodes.slice(0, 4).map((requirementCode) => (
                        <span key={requirementCode} className="corridor-chip">
                          {requirementCode}
                        </span>
                      ))}
                    </div>
                    <div className="overview-entry-actions">
                      <small>{moduleEntry.evidence.join(' | ')}</small>
                      <button type="button" className="panel-action subtle" onClick={() => onNavigate(moduleEntry.routeId)}>
                        {getShellRouteDescriptor(moduleEntry.routeId).entryActionLabel}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="module-inline-section">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Scenario Entry Points</p>
                  <h2>Replace generic logs with concrete ways into the archived showcase</h2>
                </div>
                <span className="panel-code">ENTRY</span>
              </div>

              <div className="module-card-grid overview-scenario-grid">
                {topScenarioEntries.map((scenarioEntry) => (
                  <article key={scenarioEntry.id} className="metric-spotlight-card overview-scenario-card">
                    <span>{scenarioEntry.label}</span>
                    <strong>{scenarioEntry.signal}</strong>
                    <small>{scenarioEntry.summary}</small>
                    <p className="home-module-summary">{scenarioEntry.detail}</p>
                    <button type="button" className="panel-action subtle" onClick={() => onNavigate(scenarioEntry.routeId)}>
                      {getEntryActionLabel(scenarioEntry.routeId)}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {summary && corridorDominance ? (
            <div className="module-inline-section">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Corridor Dominance</p>
                  <h2>How clustering enters the site narrative</h2>
                </div>
                <span className="panel-code">XLINK</span>
              </div>

              <div className="module-card-grid corridor-dominance-grid">
                <article className="metric-spotlight-card">
                  <span>Lead corridor</span>
                  <strong>{corridorLeader ? `${corridorLeader.corridorId} ${formatSharePercent(corridorLeader.share)}` : 'Loading'}</strong>
                  <small>
                    {corridorLeader
                      ? `${corridorLeader.directionLabel} traffic contributes ${corridorLeader.trackCount} of ${corridorDominance.totalTracks} runtime tracks.`
                      : 'Waiting for clustering runtime context.'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Top-three coverage</span>
                  <strong>{formatSharePercent(corridorDominance.topThreeShare)}</strong>
                  <small>The top three runtime corridors become the movement spine used to summarize the whole archived harbor loop.</small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Dominant direction</span>
                  <strong>{leadingDirection ? `${leadingDirection.directionLabel} ${formatSharePercent(leadingDirection.share)}` : 'Loading'}</strong>
                  <small>
                    {leadingDirection
                      ? `${leadingDirection.corridorCount} corridors roll up into this direction family, led by ${leadingDirection.leadCorridorId}.`
                      : 'Direction family analysis is unavailable.'}
                  </small>
                </article>
              </div>

              <div className="corridor-chip-row">
                {corridorDominance.topCorridors.slice(0, 3).map((corridor) => (
                  <span key={corridor.corridorId} className="corridor-chip">
                    {corridor.corridorId} {formatSharePercent(corridor.share)}
                  </span>
                ))}
              </div>

              <div className="corridor-story-note">
                <span>Cross-link</span>
                <strong>Corridor dominance is now a site-wide bridge</strong>
                <p>
                  Overview now treats corridor dominance as the bridge from clustering into forecast, repair, and evaluation, so downstream pages
                  read model evidence against the same runtime movement spine instead of as isolated module snapshots.
                </p>
              </div>

              {noiseFallback && noiseReason ? (
                <div className="module-inline-section">
                  <div className="panel-title">
                    <div>
                      <p className="panel-kicker">Deferred CLUS-03</p>
                      <h2>Why noise re-clustering is still paused</h2>
                    </div>
                    <span className="panel-code">DEFER</span>
                  </div>

                  <div className="module-card-grid corridor-dominance-grid">
                    <article className="metric-spotlight-card">
                      <span>Noise pool</span>
                      <strong>{noiseReason.count}</strong>
                      <small>{formatSharePercent(noiseShare)} of raw segments still sit in the honest `dbscan_noise` pool.</small>
                    </article>
                    <article className="metric-spotlight-card">
                      <span>Blocked artifact</span>
                      <strong>{noiseFallback.deferredArtifact.fileBytes} bytes</strong>
                      <small>{noiseArtifactStatus}, so CLUS-03 cannot reopen truthfully yet.</small>
                    </article>
                    <article className="metric-spotlight-card">
                      <span>Current boundary</span>
                      <strong>Pre-reclustering only</strong>
                      <small>Overview links to verified fallback statistics rather than inventing post-noise corridor geometry.</small>
                    </article>
                  </div>

                  <div className="corridor-story-note">
                    <span>Cross-link</span>
                    <strong>Deferred CLUS-03 now uses one site-wide explanation</strong>
                    <p>
                      The clustering page owns the fallback evidence, and overview now repeats the same reason: the distance artifact is present
                      but unusable, so only pre-reclustering noise-pool statistics are safe to carry into the broader product story.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="frame module-side-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Framing Pillars</p>
              <h2>Why this site reads as archived playback plus offline inference</h2>
            </div>
            <span className="panel-code">OVER-03</span>
          </div>

          {summary ? (
            <div className="module-card-grid overview-framing-grid">
              {framingPillars.map((pillar) => (
                <article key={pillar.id} className="metric-spotlight-card overview-framing-card">
                  <span>{pillar.kicker}</span>
                  <strong>{pillar.title}</strong>
                  <small>{pillar.detail}</small>
                </article>
              ))}
            </div>
          ) : null}

          <div className="panel-title">
            <div>
              <p className="panel-kicker">Scale Summary</p>
              <h2>Current data scale and source lineage</h2>
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
              <span>Raw AIS rows</span>
              <strong>{summary?.dataScale?.clustering?.rawAisRows ?? '--'}</strong>
            </article>
            <article>
              <span>Compressed clustering tracks</span>
              <strong>{summary?.dataScale?.clustering?.compressedTracks ?? '--'}</strong>
            </article>
            <article>
              <span>Runtime corridors</span>
              <strong>{summary?.dataScale?.clustering?.corridorRuntimeCorridors ?? '--'}</strong>
            </article>
            <article>
              <span>Runtime corridor tracks</span>
              <strong>{summary?.dataScale?.clustering?.corridorRuntimeTracks ?? '--'}</strong>
            </article>
            <article>
              <span>Lead corridor</span>
              <strong>{corridorLeader ? corridorLeader.corridorId : 'Loading'}</strong>
              <small>{corridorLeader ? `${corridorLeader.trackCount} tracks | ${formatSharePercent(corridorLeader.share)}` : 'Waiting for runtime corridor data.'}</small>
            </article>
            <article>
              <span>Dominant direction</span>
              <strong>{leadingDirection ? leadingDirection.directionLabel : 'Loading'}</strong>
              <small>
                {leadingDirection
                  ? `${leadingDirection.corridorCount} corridors | ${formatSharePercent(leadingDirection.share)} of runtime traffic`
                  : 'Direction-family rollup loads from clustering runtime.'}
              </small>
            </article>
          </div>

          {entry.artifacts.length ? (
            <div className="module-inline-section overview-source-shell">
              <p className="evaluation-trace-title">Committed artifacts</p>
              <div className="module-side-list">
                {entry.artifacts.map((artifact) => (
                  <article key={artifact.artifactId}>
                    <span>{artifact.artifactId}</span>
                    <strong>{artifact.path}</strong>
                    <small>{artifact.description}</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {sourceEntries.length ? (
            <div className="module-inline-section overview-source-shell">
              <p className="evaluation-trace-title">Source lineage</p>
              <div className="module-side-list">
                {sourceEntries.map(([sourceId, path]) => (
                  <article key={sourceId}>
                    <span>{sourceId}</span>
                    <strong>{path}</strong>
                    <small>Overview keeps the business loop tied to committed bundle and manifest sources.</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {deferredModules.length ? (
            <div className="module-inline-section">
              {deferredModules.map((item) => (
                <div key={`${item.module}-${item.status}`} className="module-deferred-note">
                  <span>{item.status}</span>
                  <strong>{item.module}</strong>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
