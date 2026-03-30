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
import { localizeClusteringNoiseFallback } from '../zhCopy.ts'

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
      headline: `${artifact.fileName} 已存在，但仍是 0 字节`,
      detail: '由于距离矩阵文件还没有可用载荷，fallback 只能停留在重聚类前的证据层。',
    }
  }

  if (artifact.status === 'missing') {
    return {
      headline: `${artifact.fileName} 仍然缺失`,
      detail: '由于工作区中还没有距离矩阵文件，fallback 只能停留在重聚类前的证据层。',
    }
  }

  if (artifact.status === 'present') {
    return {
      headline: `${artifact.fileName} 已恢复，但导出结果仍处于 deferred`,
      detail: '只有在面向网站的重聚类 bundle 重新生成并通过校验后，fallback 才会退出。',
    }
  }

  return {
    headline: `${artifact.fileName} 仍然无法读取`,
    detail: '由于距离矩阵文件暂时无法被可靠加载，fallback 只能停留在重聚类前的证据层。',
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
        setNoiseFallback(fallback ? localizeClusteringNoiseFallback(fallback) : null)
        setSelectedLayer(getDefaultClusteringLayer(summary))
        setSelectedCorridorId(corridorRuntime.corridors[0]?.corridorId ?? '')
        setError('')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : '轨迹聚类模块加载失败。')
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
          <p className="panel-kicker">轨迹聚类</p>
          <h1>从原始轨迹到分段、压缩与 corridor 提取</h1>
          <p className="module-takeaway">
            {viewModel
              ? 'Phase 10 聚类模块现在可以在不同 provenance 图层间切换，展示 corridor 统计，并保持 review-first 的上线边界可见，而不会假装 deferred 的 noise 路径已经恢复。'
              : '正在从模块 bundle 加载聚类阶段预览、corridor runtime 数据与评审元数据。'}
          </p>
        </div>
        <div className="module-kpi-grid">
          <article>
            <span>已开放图层</span>
            <strong>{viewModel?.meta.availableLayers.length ?? '--'}</strong>
            <small>{viewModel?.meta.availableLayers.map((layer) => layer.shortLabel).join(' / ') ?? '正在加载图层注册表'}</small>
          </article>
          <article>
            <span>corridor 数量</span>
            <strong>{viewModel ? formatNumber(viewModel.stats.totalCorridors) : '--'}</strong>
            <small>
              {viewModel
                ? `${formatNumber(viewModel.stats.totalRuntimeTracks)} 条 runtime 轨迹分布在方向性 corridor 家族中`
                : '正在加载 corridor 数量'}
            </small>
          </article>
          <article>
            <span>评审差异</span>
            <strong>{viewModel ? formatNumber(viewModel.reviewComparison.trackDelta) : '--'}</strong>
            <small>{viewModel?.reviewComparison.status ?? '正在加载 runtime 与 review 的对比结果'}</small>
          </article>
        </div>
        <div className="clustering-summary-actions">
          <a className="module-primary-action" href={viewModel?.routeEditorLink ?? '/route-editor.html'}>
            打开 RouteEditor runtime
          </a>
          <button type="button" className="module-primary-action clustering-secondary-action" onClick={() => onNavigate('overview')}>
            打开总览
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">图层切换</p>
              <h2>{viewModel?.selectedLayer.descriptor.label ?? '聚类阶段推进'}</h2>
            </div>
            <span className="panel-code">{viewModel?.selectedLayer.descriptor.stageCode ?? 'CLUS'}</span>
          </div>

          {error ? (
            <PlatformStatusSurface tone="error" title="聚类数据不可用" summary="轨迹聚类模块文件无法打开。" detail={error} />
          ) : viewModel && stageBounds ? (
            <>
              <div className="clustering-layer-buttons" aria-label="图层切换">
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
                    <p className="panel-kicker">流水线叙事</p>
                    <h2>corridor 结果是如何形成的</h2>
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
                    <span>压缩比例</span>
                    <strong>{viewModel.pipelineStory.compressionRatio}</strong>
                    <small>在保持 corridor 形状的前提下，分段点经过压缩后仍被保留的占比。</small>
                  </article>
                  <article className="metric-spotlight-card">
                    <span>corridor 产出率</span>
                    <strong>{viewModel.pipelineStory.corridorYield}</strong>
                    <small>压缩后轨迹中最终进入网站 runtime corridor 包的占比。</small>
                  </article>
                </div>
              </section>

              <section className="clustering-stage-shell">
                <div className="panel-title">
                  <div>
                    <p className="panel-kicker">阶段预览</p>
                    <h2>{viewModel.selectedLayer.descriptor.label}</h2>
                  </div>
                  <span className="panel-code">{previewTracks.length} 条轨迹</span>
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
                      <span>采样模式</span>
                      <strong>{viewModel.selectedLayer.samplingMode}</strong>
                      <small>当前舞台展示 {previewTracks.length} 条预览轨迹</small>
                    </div>
                  </div>

                  <div className="clustering-track-list">
                    {previewTracks.map((track) => (
                      <article key={track.id} className="module-flow-card clustering-track-card">
                        <span>{track.corridorId ?? viewModel.selectedLayer.descriptor.shortLabel}</span>
                        <strong>{track.label}</strong>
                        <p>{track.directionLabel ?? '轨迹预览样本'}</p>
                        <small>
                          {formatNumber(track.pointCount)} 个点
                          {track.startTime && track.endTime ? ` | ${track.startTime} 至 ${track.endTime}` : ''}
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
              <p className="panel-kicker">聚类统计</p>
              <h2>corridor 数量与选择</h2>
            </div>
            <span className="panel-code">STATS</span>
          </div>

          <div className="module-side-list">
            <article>
              <span>corridor 数量</span>
              <strong>{viewModel ? formatNumber(viewModel.stats.totalCorridors) : '加载中'}</strong>
              <small>面向网站上线的聚类结果目前以方向性 corridor 家族作为交付形态。</small>
            </article>
            <article>
              <span>每个 corridor 的平均轨迹数</span>
              <strong>{viewModel ? formatNumber(viewModel.stats.averageTracksPerCorridor) : '--'}</strong>
              <small>{viewModel ? `${formatNumber(viewModel.stats.totalRuntimeTracks)} 条 runtime 轨迹总计` : '正在加载 corridor 密度'}</small>
            </article>
            <article>
              <span>当前 corridor</span>
              <strong>{selectedCorridor?.corridorId ?? '加载中'}</strong>
              <small>
                {selectedCorridor
                  ? `${selectedCorridor.directionLabel} | 排名 ${selectedCorridor.rank} | ${formatNumber(selectedCorridor.runtimeTrackCount)} 条 runtime 轨迹 | 占 runtime 的 ${formatPercent(selectedCorridor.shareOfRuntimeTracks)}`
                  : '正在加载当前 corridor'}
              </small>
            </article>
            <article>
              <span>noise 重聚类</span>
              <strong>{viewModel?.meta.noiseReclusterReady ? '已就绪' : '已延后'}</strong>
              <small>{viewModel?.stats.noiseStatusMessage ?? '正在加载 deferred 产物状态'}</small>
            </article>
          </div>

          {selectedCorridor ? (
            <section className="clustering-profile-shell">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">当前 corridor 档案</p>
                  <h2>{selectedCorridor.corridorId}</h2>
                </div>
                <span className="panel-code">FOCUS</span>
              </div>

              <div className="module-side-list">
                <article>
                  <span>方向家族</span>
                  <strong>{selectedCorridor.directionLabel}</strong>
                  <small>{viewModel?.stats.directionFamilyLabel}</small>
                </article>
                <article>
                  <span>runtime 占比</span>
                  <strong>{formatPercent(selectedCorridor.shareOfRuntimeTracks)}</strong>
                  <small>{formatNumber(selectedCorridor.runtimeTrackCount)} 条 runtime 轨迹，{formatNumber(selectedCorridor.reviewTrackCount)} 条 review 轨迹。</small>
                </article>
                <article>
                  <span>标注点</span>
                  <strong>{selectedCorridor.labelPoint.lon.toFixed(4)}, {selectedCorridor.labelPoint.lat.toFixed(4)}</strong>
                  <small>该点用于锚定与 RouteEditor 共享的 corridor 实体。</small>
                </article>
              </div>
            </section>
          ) : null}

          {corridorLeaderboard.length ? (
            <section className="clustering-corridor-picker">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">corridor 排行</p>
                  <h2>主导航路家族</h2>
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
                    <em>占 runtime 的 {formatPercent(corridor.runtimeShare)}</em>
                  </button>
                ))}
              </div>

              <p className="clustering-link-copy">
                当前选中的 corridor 可以回链到 RouteEditor 复用的 <code>main-corridor-tracks.json</code> runtime，因此这个排行榜也兼具产品侧 corridor 实体选择器的作用。
              </p>
            </section>
          ) : null}

          <section className="clustering-review-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Runtime vs Review</p>
                <h2>上线边界</h2>
              </div>
              <span className="panel-code">REVIEW</span>
            </div>

            <div className="module-card-grid clustering-review-grid">
              <article className="metric-spotlight-card">
                <span>上线状态</span>
                <strong>{bundle?.summary.reviewStatus.corridorPromotion ?? '加载中'}</strong>
                <small>{viewModel?.reviewComparison.status ?? '正在加载评审状态'}</small>
              </article>
              <article className="metric-spotlight-card">
                <span>corridor 差异</span>
                <strong>{viewModel ? formatNumber(viewModel.reviewComparison.corridorDelta) : '--'}</strong>
                <small>{viewModel ? `轨迹差异 ${formatNumber(viewModel.reviewComparison.trackDelta)}` : '正在加载契约差异'}</small>
              </article>
              <article className="metric-spotlight-card">
                <span>当前 corridor 是否一致</span>
                <strong>{viewModel?.reviewComparison.selectedCorridorMatches ? '一致' : '以 review 为准'}</strong>
                <small>
                  {selectedCorridor
                    ? `${selectedCorridor.corridorId} 的 review 轨迹数为 ${formatNumber(selectedCorridor.reviewTrackCount)}`
                    : '选择一个 corridor 以比较 runtime 与 review 计数'}
                </small>
              </article>
            </div>
          </section>

          {noiseFallback ? (
            <section className="clustering-noise-panel">
              <div className="panel-title">
                <div>
                  <p className="panel-kicker">噪声池 / Deferred CLUS-03</p>
                  <h2>使用诚实 fallback，而不是伪造重聚类</h2>
                </div>
                <span className="panel-code">FALLBACK</span>
              </div>

              <p className="clustering-link-copy">{noiseFallback.summary}</p>

              <div className="module-card-grid clustering-review-grid">
                <article className="metric-spotlight-card">
                  <span>候选池</span>
                  <strong>{formatNumber(noiseCounts?.candidateSegments ?? 0)}</strong>
                  <small>
                    {noiseCounts
                      ? `${formatPercent(candidateShare)} 的 ${formatNumber(noiseCounts.rawSegments)} 条原始分段进入了聚类候选池。`
                      : '正在加载候选池统计'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>保留到 runtime 的 corridor</span>
                  <strong>{formatNumber(noiseCounts?.keptSegments ?? 0)}</strong>
                  <small>
                    {noiseCounts
                      ? `${formatPercent(keptShare)} 的原始分段在过滤后仍留在已交付的 corridor runtime 中。`
                      : '正在加载保留统计'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>噪声池</span>
                  <strong>{formatNumber(dbscanNoise?.count ?? 0)}</strong>
                  <small>
                    {dbscanNoise && noiseCounts
                      ? `${formatPercent(dbscanNoiseShare)} 的原始分段仍停留在 dbscan_noise 中，这是 Deferred CLUS-03 唯一诚实的替代视角。`
                      : '正在加载 dbscan noise 统计'}
                  </small>
                </article>
              </div>

              <div className="clustering-noise-grid">
                {noiseFallback.dropReasons.map((reason) => (
                  <article key={reason.id} className="clustering-noise-card">
                    <span>{reason.label}</span>
                    <strong>{formatNumber(reason.count)}</strong>
                    <small>
                      {noiseCounts?.rawSegments ? `占原始分段的 ${formatPercent(reason.count / noiseCounts.rawSegments)}。` : '正在加载占比。'}
                    </small>
                    <p>{reason.narrative}</p>
                  </article>
                ))}
              </div>

              <div className="corridor-story-note clustering-noise-note">
                <span>证据边界</span>
                <strong>{noiseArtifactCopy?.headline ?? `${noiseFallback.deferredArtifact.fileName} 仍然无法读取`}</strong>
                <p>
                  {noiseArtifactCopy?.detail ?? '该面板会有意识地停在重聚类之前的证据层。'} 当前产物大小为 {noiseFallback.deferredArtifact.fileBytes} 字节，因此网站只展示流程今天真正知道的内容，不会虚构 noise 之后的几何结果或伪造 corridor 上线。
                </p>
                {noiseFallback.deferredArtifact.filePath ? <small>工作区路径：{noiseFallback.deferredArtifact.filePath}</small> : null}
              </div>
            </section>
          ) : null}

          <section className="module-deferred-note clustering-recovery-panel">
            <span>恢复清单</span>
            <strong>只有距离产物可用后，才重新打开 CLUS-03</strong>
            <p>{viewModel?.recoveryChecklist.blocker ?? entry.deferredItems[0]?.reason ?? 'noise 重聚类仍处于 deferred 状态。'}</p>
            <small>缺失产物：{viewModel?.recoveryChecklist.artifactId ?? 'clustering-noise-reclustered'}</small>
            <small>产物状态：{viewModel?.recoveryChecklist.artifactStatus ?? 'Deferred'}</small>
            {viewModel?.recoveryChecklist.artifactBytes !== undefined ? <small>产物字节数：{viewModel.recoveryChecklist.artifactBytes}</small> : null}
            {viewModel?.recoveryChecklist.artifactPath ? <small>工作区路径：{viewModel.recoveryChecklist.artifactPath}</small> : null}
            <small>依赖关系：{viewModel?.recoveryChecklist.dependsOn.join(' -> ') ?? 'CLUS-03 -> Phase 10'}</small>
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
