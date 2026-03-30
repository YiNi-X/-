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
              ? '当前聚类模块已经支持图层切换、corridor 统计与噪声池补充说明，便于从原始轨迹一路看到重点通道结构。'
              : '正在加载聚类阶段预览、通道统计与评审摘要。'}
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
              <span>噪声池统计</span>
              <strong>{dbscanNoise ? formatNumber(dbscanNoise.count) : '--'}</strong>
              <small>
                {dbscanNoise && noiseCounts
                  ? `${formatPercent(dbscanNoiseShare)} 的原始分段当前保留在噪声池统计中。`
                  : '正在加载噪声池统计'}
              </small>
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
                  <p className="panel-kicker">补充分段分布</p>
                  <h2>补充理解 corridor 之外的尾部分布</h2>
                </div>
                <span className="panel-code">CLUS-03</span>
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
                      ? `${formatPercent(dbscanNoiseShare)} 的原始分段当前保留在噪声池统计中，反映重点 corridor 之外的尾部分布。`
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
                <span>结构说明</span>
                <strong>噪声池统计用于补充 corridor 主线之外的结构分布</strong>
                <p>
                  当前页面保留候选、保留与噪声池三组真实统计，用来解释哪些分段进入 corridor 主线，哪些分段留在外围结构。
                </p>
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
