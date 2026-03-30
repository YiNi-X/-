import { useEffect, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { MainCorridorTracksFile, ShellRouteId, StudyBounds } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { PlatformStatusSurface } from '../PlatformStatusSurface.tsx'
import { buildClusteringViewModel, getDefaultClusteringLayer } from '../clustering/clusteringViewModel.ts'
import type {
  ClusteringBundle,
  ClusteringLayerKey,
  ClusteringNoiseFallback,
  ClusteringPreviewPoint,
  ClusteringStagePreviews,
  ClusteringSummary,
} from '../clustering/clusteringTypes.ts'

type ClusteringPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

const TRACK_PREVIEW_COLORS = ['#67e8f9', '#fbbf24', '#34d399', '#f472b6', '#c084fc', '#f87171']
const CLUSTERING_NOISE_FALLBACK_PATH = '/data/modules/clustering/clustering-noise-fallback.json'

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function normalizePoint(point: ClusteringPreviewPoint, bounds: StudyBounds) {
  const width = bounds.maxLon - bounds.minLon || 1
  const height = bounds.maxLat - bounds.minLat || 1
  const x = ((point.lon - bounds.minLon) / width) * 1000
  const y = 640 - ((point.lat - bounds.minLat) / height) * 640
  return `${x.toFixed(2)},${y.toFixed(2)}`
}

function buildPolyline(points: ClusteringPreviewPoint[], bounds: StudyBounds) {
  return points.map((point) => normalizePoint(point, bounds)).join(' ')
}

function resolveTrackColor(corridorId: string | undefined, index: number) {
  if (!corridorId) return TRACK_PREVIEW_COLORS[index % TRACK_PREVIEW_COLORS.length]

  const numericSeed = corridorId.split('').reduce((seed, value) => seed + value.charCodeAt(0), 0)
  return TRACK_PREVIEW_COLORS[numericSeed % TRACK_PREVIEW_COLORS.length]
}

function formatStatValue(value: number | string) {
  return typeof value === 'number' ? formatNumber(value) : value
}

function describeDeferredArtifact(artifact: ClusteringNoiseFallback['deferredArtifact']) {
  if (artifact.status === 'zero-byte') {
    return {
      headline: `${artifact.fileName} exists but is still 0 bytes`,
      detail: 'The fallback stops at pre-reclustering evidence because the distance matrix file has no usable payload yet.',
    }
  }

  if (artifact.status === 'missing') {
    return {
      headline: `${artifact.fileName} is still missing`,
      detail: 'The fallback stops at pre-reclustering evidence because the distance matrix file is not available in the workspace.',
    }
  }

  if (artifact.status === 'present') {
    return {
      headline: `${artifact.fileName} has returned but the export is still deferred`,
      detail: 'The fallback remains active until a website-facing reclustering bundle is regenerated and validated.',
    }
  }

  return {
    headline: `${artifact.fileName} is still unreadable`,
    detail: 'The fallback stops at pre-reclustering evidence because the distance matrix file cannot be loaded reliably yet.',
  }
}

export function ClusteringPage({ entry, onNavigate }: ClusteringPageProps) {
  const [bundle, setBundle] = useState<ClusteringBundle | null>(null)
  const [noiseFallback, setNoiseFallback] = useState<ClusteringNoiseFallback | null>(null)
  const [selectedLayer, setSelectedLayer] = useState<ClusteringLayerKey>('raw')
  const [selectedCorridorId, setSelectedCorridorId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const noiseFallbackPath = entry.entryFiles.noiseFallback ? `/${entry.entryFiles.noiseFallback}` : CLUSTERING_NOISE_FALLBACK_PATH

    void Promise.all([
      loadPublicJson<ClusteringSummary>(`/${entry.entryFiles.summary}`),
      loadPublicJson<ClusteringStagePreviews>(`/${entry.entryFiles.stagePreviews}`),
      loadPublicJson<MainCorridorTracksFile>(`/${entry.entryFiles.corridorRuntime}`),
      loadPublicJson<MainCorridorTracksFile>(`/${entry.entryFiles.corridorReview}`),
      loadPublicJson<ClusteringNoiseFallback>(noiseFallbackPath).catch(() => null),
    ])
      .then(([summary, stagePreviews, corridorRuntime, corridorReview, fallback]) => {
        if (cancelled) return
        setBundle({
          summary,
          stagePreviews,
          corridorRuntime,
          corridorReview,
        })
        setNoiseFallback(fallback)
        setSelectedLayer(getDefaultClusteringLayer(summary))
        setSelectedCorridorId(corridorRuntime.corridors[0]?.corridorId ?? '')
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load clustering module.')
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entry.entryFiles.corridorReview, entry.entryFiles.corridorRuntime, entry.entryFiles.noiseFallback, entry.entryFiles.stagePreviews, entry.entryFiles.summary])

  const viewModel = bundle ? buildClusteringViewModel(bundle, selectedLayer, selectedCorridorId) : null
  const stageBounds = bundle?.corridorRuntime.studyArea
  const selectedCorridor = viewModel?.stats.selectedCorridor
  const corridorLeaderboard = viewModel?.corridorLeaderboard ?? []
  const previewTracks = viewModel?.selectedLayer.previewTracks ?? []
  const noiseCounts = noiseFallback?.counts ?? null
  const noiseArtifact = noiseFallback?.deferredArtifact ?? null
  const noiseArtifactCopy = noiseArtifact ? describeDeferredArtifact(noiseArtifact) : null
  const dbscanNoise = noiseFallback?.dropReasons.find((reason) => reason.id === 'dbscan_noise') ?? null
  const candidateShare = noiseCounts ? noiseCounts.rawSegments > 0 ? noiseCounts.candidateSegments / noiseCounts.rawSegments : 0 : 0
  const keptShare = noiseCounts ? noiseCounts.rawSegments > 0 ? noiseCounts.keptSegments / noiseCounts.rawSegments : 0 : 0
  const dbscanNoiseShare = noiseCounts && dbscanNoise ? noiseCounts.rawSegments > 0 ? dbscanNoise.count / noiseCounts.rawSegments : 0 : 0

  return (
    <section className="module-page">
      <section className="frame module-summary-band clustering-summary-band">
        <div>
          <p className="panel-kicker">Trajectory Clustering</p>
          <h1>Raw to segmented to compressed to corridor extraction</h1>
          <p className="module-takeaway">
            {viewModel
              ? 'The Phase 10 clustering module now switches across provenance layers, exposes corridor statistics, and keeps the review-first promotion boundary visible without pretending the deferred noise path is already ready.'
              : 'Loading clustering stage previews, corridor runtime data, and review metadata from the module bundle.'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>Exposed layers</span>
            <strong>{viewModel?.meta.availableLayers.length ?? '--'}</strong>
            <small>{viewModel?.meta.availableLayers.map((layer) => layer.shortLabel).join(' / ') ?? 'Loading layer registry'}</small>
          </article>
          <article>
            <span>Cluster count</span>
            <strong>{viewModel ? formatNumber(viewModel.stats.totalCorridors) : '--'}</strong>
            <small>
              {viewModel
                ? `${formatNumber(viewModel.stats.totalRuntimeTracks)} runtime tracks across directional corridor groups`
                : 'Loading corridor count'}
            </small>
          </article>
          <article>
            <span>Review delta</span>
            <strong>{viewModel ? formatNumber(viewModel.reviewComparison.trackDelta) : '--'}</strong>
            <small>{viewModel?.reviewComparison.status ?? 'Loading runtime versus review comparison'}</small>
          </article>
        </div>
        <div className="clustering-summary-actions">
          <a className="module-primary-action" href={viewModel?.routeEditorLink ?? '/route-editor.html'}>
            Open RouteEditor runtime
          </a>
          <button type="button" className="module-primary-action clustering-secondary-action" onClick={() => onNavigate('overview')}>
            Open overview
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">Layer Switcher</p>
              <h2>{viewModel?.selectedLayer.descriptor.label ?? 'Clustering stage progression'}</h2>
            </div>
            <span className="panel-code">{viewModel?.selectedLayer.descriptor.stageCode ?? 'CLUS'}</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="Clustering data unavailable" summary="The clustering module files could not be opened." detail={error} />
          ) : viewModel && stageBounds ? (
            <>
              <div className="clustering-layer-buttons" aria-label="Layer Switcher">
                {viewModel.meta.availableLayers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    className={layer.id === viewModel.meta.selectedLayer ? 'segmented-button active' : 'segmented-button'}
                    onClick={() => setSelectedLayer(layer.id)}
                  >
                    {layer.shortLabel}
                  </button>
                ))}
              </div>

              <p className="clustering-layer-caption">{viewModel.selectedLayer.summary}</p>

              <div className="module-card-grid clustering-stat-grid">
                {viewModel.selectedLayer.stats.map((stat) => (
                  <article key={stat.label} className="metric-spotlight-card clustering-stat-card">
                    <span>{stat.label}</span>
                    <strong>{formatStatValue(stat.value)}</strong>
                    <small>{stat.detail}</small>
                  </article>
                ))}
              </div>

              <section className="clustering-story-shell">
                <div className="panel-title">
                  <div>
                    <p className="panel-kicker">Pipeline Story</p>
                    <h2>How the corridor result is formed</h2>
                  </div>
                  <span className="panel-code">TRACE</span>
                </div>

                <div className="module-card-grid clustering-story-grid">
                  {viewModel.pipelineStory.steps.map((step) => (
                    <article key={step.id} className="module-flow-card clustering-story-card">
                      <span>{step.stageCode}</span>
                      <strong>{step.label}</strong>
                      <p>{step.detail}</p>
                      <small>{step.value}</small>
                    </article>
                  ))}
                </div>

                <div className="module-card-grid clustering-story-grid">
                  <article className="metric-spotlight-card">
                    <span>Compression ratio</span>
                    <strong>{viewModel.pipelineStory.compressionRatio}</strong>
                    <small>Share of segmented points that remain after compression while preserving corridor shape.</small>
                  </article>
                  <article className="metric-spotlight-card">
                    <span>Corridor yield</span>
                    <strong>{viewModel.pipelineStory.corridorYield}</strong>
                    <small>Share of compressed tracks that appear in the website-facing runtime corridor package.</small>
                  </article>
                </div>
              </section>

              <section className="clustering-stage-shell">
                <div className="panel-title">
                  <div>
                    <p className="panel-kicker">Stage Preview</p>
                    <h2>{viewModel.selectedLayer.descriptor.label}</h2>
                  </div>
                  <span className="panel-code">{previewTracks.length} traces</span>
                </div>

                <div className="clustering-stage-grid">
                  <div className="clustering-stage-map">
                    <svg viewBox="0 0 1000 640" role="img" aria-label={`${viewModel.selectedLayer.descriptor.label} map preview`}>
                      <rect x="0" y="0" width="1000" height="640" rx="18" />
                      {previewTracks.map((track, index) => (
                        <polyline
                          key={track.id}
                          fill="none"
                          stroke={resolveTrackColor(track.corridorId, index)}
                          strokeWidth={track.corridorId === selectedCorridor?.corridorId ? 4 : 2.4}
                          points={buildPolyline(track.points, stageBounds)}
                        />
                      ))}
                    </svg>
                    <div className="clustering-stage-overlay">
                      <span>Sampling mode</span>
                      <strong>{viewModel.selectedLayer.samplingMode}</strong>
                      <small>{previewTracks.length} preview traces shown on the stage</small>
                    </div>
                  </div>

                  <div className="clustering-track-list">
                    {previewTracks.map((track) => (
                      <article key={track.id} className="module-flow-card clustering-track-card">
                        <span>{track.corridorId ?? viewModel.selectedLayer.descriptor.shortLabel}</span>
                        <strong>{track.label}</strong>
                        <p>{track.directionLabel ?? 'Trajectory preview track'}</p>
                        <small>
                          {formatNumber(track.pointCount)} points
                          {track.startTime && track.endTime ? ` | ${track.startTime} to ${track.endTime}` : ''}
                        </small>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </>
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
              <p className="panel-kicker">Cluster Statistics</p>
              <h2>Corridor counts and selection</h2>
            </div>
            <span className="panel-code">STATS</span>
          </div>

          <div className="module-side-list">
            <article>
              <span>Cluster count</span>
              <strong>{viewModel ? formatNumber(viewModel.stats.totalCorridors) : 'Loading'}</strong>
              <small>Directional corridor groups now stand in for the shipped clustering result set.</small>
            </article>
            <article>
              <span>Average tracks per cluster</span>
              <strong>{viewModel ? formatNumber(viewModel.stats.averageTracksPerCorridor) : '--'}</strong>
              <small>{viewModel ? `${formatNumber(viewModel.stats.totalRuntimeTracks)} runtime tracks in total` : 'Loading corridor density'}</small>
            </article>
            <article>
              <span>Selected corridor</span>
              <strong>{selectedCorridor?.corridorId ?? 'Loading'}</strong>
              <small>
                {selectedCorridor
                  ? `${selectedCorridor.directionLabel} | rank ${selectedCorridor.rank} | ${formatNumber(selectedCorridor.runtimeTrackCount)} runtime tracks | ${formatPercent(selectedCorridor.shareOfRuntimeTracks)} of runtime`
                  : 'Loading selected corridor'}
              </small>
            </article>
            <article>
              <span>Noise re-clustering</span>
              <strong>{viewModel?.meta.noiseReclusterReady ? 'Ready' : 'Deferred'}</strong>
              <small>{viewModel?.stats.noiseStatusMessage ?? 'Loading deferred artifact status'}</small>
            </article>
          </div>

          {selectedCorridor ? (
            <section className="clustering-profile-shell">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Selected Corridor Profile</p>
                  <h2>{selectedCorridor.corridorId}</h2>
                </div>
                <span className="panel-code">FOCUS</span>
              </div>

              <div className="module-side-list">
                <article>
                  <span>Direction family</span>
                  <strong>{selectedCorridor.directionLabel}</strong>
                  <small>{viewModel?.stats.directionFamilyLabel}</small>
                </article>
                <article>
                  <span>Share of runtime</span>
                  <strong>{formatPercent(selectedCorridor.shareOfRuntimeTracks)}</strong>
                  <small>{formatNumber(selectedCorridor.runtimeTrackCount)} runtime tracks and {formatNumber(selectedCorridor.reviewTrackCount)} review tracks.</small>
                </article>
                <article>
                  <span>Label point</span>
                  <strong>{selectedCorridor.labelPoint.lon.toFixed(4)}, {selectedCorridor.labelPoint.lat.toFixed(4)}</strong>
                  <small>This point anchors the corridor entity that is shared with RouteEditor.</small>
                </article>
              </div>
            </section>
          ) : null}

          {corridorLeaderboard.length ? (
            <section className="clustering-corridor-picker">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Corridor Leaderboard</p>
                  <h2>Dominant route families</h2>
                </div>
                <span className="panel-code">LINK</span>
              </div>

              <div className="clustering-leaderboard">
                {corridorLeaderboard.slice(0, 8).map((corridor) => (
                  <button
                    key={corridor.corridorId}
                    type="button"
                    className={corridor.corridorId === selectedCorridorId ? 'clustering-leaderboard-row active' : 'clustering-leaderboard-row'}
                    onClick={() => setSelectedCorridorId(corridor.corridorId)}
                  >
                    <span>{String(corridor.rank).padStart(2, '0')}</span>
                    <strong>{corridor.corridorId}</strong>
                    <small>{corridor.directionLabel}</small>
                    <em>{formatPercent(corridor.runtimeShare)} of runtime</em>
                  </button>
                ))}
              </div>

              <p className="clustering-link-copy">
                The selected corridor can be traced back to the shared <code>main-corridor-tracks.json</code> runtime used by RouteEditor, so the leaderboard doubles as a product-facing corridor entity selector.
              </p>
            </section>
          ) : null}

          <section className="clustering-review-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Runtime vs Review</p>
                <h2>Promotion boundary</h2>
              </div>
              <span className="panel-code">REVIEW</span>
            </div>

            <div className="module-card-grid clustering-review-grid">
              <article className="metric-spotlight-card">
                <span>Promotion state</span>
                <strong>{bundle?.summary.reviewStatus.corridorPromotion ?? 'Loading'}</strong>
                <small>{viewModel?.reviewComparison.status ?? 'Loading review status'}</small>
              </article>
              <article className="metric-spotlight-card">
                <span>Corridor delta</span>
                <strong>{viewModel ? formatNumber(viewModel.reviewComparison.corridorDelta) : '--'}</strong>
                <small>{viewModel ? `Track delta ${formatNumber(viewModel.reviewComparison.trackDelta)}` : 'Loading contract delta'}</small>
              </article>
              <article className="metric-spotlight-card">
                <span>Selected corridor match</span>
                <strong>{viewModel?.reviewComparison.selectedCorridorMatches ? 'Yes' : 'Review-first'}</strong>
                <small>
                  {selectedCorridor
                    ? `${selectedCorridor.corridorId} review tracks ${formatNumber(selectedCorridor.reviewTrackCount)}`
                    : 'Select a corridor to compare runtime and review counts'}
                </small>
              </article>
            </div>
          </section>

          {noiseFallback ? (
            <section className="clustering-noise-panel">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">Noise Pool / Deferred CLUS-03</p>
                  <h2>Honest fallback instead of fake re-clustering</h2>
                </div>
                <span className="panel-code">FALLBACK</span>
              </div>

              <p className="clustering-link-copy">{noiseFallback.summary}</p>

              <div className="module-card-grid clustering-review-grid">
                <article className="metric-spotlight-card">
                  <span>Candidate pool</span>
                  <strong>{formatNumber(noiseCounts?.candidateSegments ?? 0)}</strong>
                  <small>
                    {noiseCounts
                      ? `${formatPercent(candidateShare)} of ${formatNumber(noiseCounts.rawSegments)} raw segments survived into the clustering candidate pool.`
                      : 'Loading candidate pool stats'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Kept runtime corridors</span>
                  <strong>{formatNumber(noiseCounts?.keptSegments ?? 0)}</strong>
                  <small>
                    {noiseCounts
                      ? `${formatPercent(keptShare)} of raw segments remain in the shipped corridor runtime after filtering.`
                      : 'Loading kept corridor stats'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>Noise pool</span>
                  <strong>{formatNumber(dbscanNoise?.count ?? 0)}</strong>
                  <small>
                    {dbscanNoise && noiseCounts
                      ? `${formatPercent(dbscanNoiseShare)} of raw segments still sit in dbscan_noise, which is the only truthful stand-in for deferred CLUS-03.`
                      : 'Loading dbscan noise stats'}
                  </small>
                </article>
              </div>

              <div className="clustering-noise-grid">
                {noiseFallback.dropReasons.map((reason) => (
                  <article key={reason.id} className="clustering-noise-card">
                    <span>{reason.label}</span>
                    <strong>{formatNumber(reason.count)}</strong>
                    <small>
                      {noiseCounts?.rawSegments ? `${formatPercent(reason.count / noiseCounts.rawSegments)} of raw segments.` : 'Loading share.'}
                    </small>
                    <p>{reason.narrative}</p>
                  </article>
                ))}
              </div>

              <div className="corridor-story-note clustering-noise-note">
                <span>Evidence boundary</span>
                <strong>{noiseArtifactCopy?.headline ?? `${noiseFallback.deferredArtifact.fileName} is still unreadable`}</strong>
                <p>
                  {noiseArtifactCopy?.detail ?? 'This panel intentionally stops at pre-reclustering evidence.'} The artifact currently reports{' '}
                  {noiseFallback.deferredArtifact.fileBytes} bytes, so the site shows what the pipeline truly knows today without inventing
                  post-noise geometry or fake corridor promotion.
                </p>
                {noiseFallback.deferredArtifact.filePath ? <small>Workspace path: {noiseFallback.deferredArtifact.filePath}</small> : null}
              </div>
            </section>
          ) : null}

          <section className="module-deferred-note clustering-recovery-panel">
            <span>Recovery Checklist</span>
            <strong>Reopen CLUS-03 only after the distance artifact becomes usable</strong>
            <p>{viewModel?.recoveryChecklist.blocker ?? entry.deferredItems[0]?.reason ?? 'Noise re-clustering remains deferred.'}</p>
            <small>Missing artifact: {viewModel?.recoveryChecklist.artifactId ?? 'clustering-noise-reclustered'}</small>
            <small>Artifact state: {viewModel?.recoveryChecklist.artifactStatus ?? 'Deferred'}</small>
            {viewModel?.recoveryChecklist.artifactBytes !== undefined ? <small>Artifact bytes: {viewModel.recoveryChecklist.artifactBytes}</small> : null}
            {viewModel?.recoveryChecklist.artifactPath ? <small>Workspace path: {viewModel.recoveryChecklist.artifactPath}</small> : null}
            <small>Depends on: {viewModel?.recoveryChecklist.dependsOn.join(' -> ') ?? 'CLUS-03 -> Phase 10'}</small>
            <div className="clustering-recovery-list">
              {viewModel?.recoveryChecklist.steps.map((step, index) => (
                <article key={step}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </section>
  )
}
