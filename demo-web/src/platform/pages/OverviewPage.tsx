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
import { localizeClusteringNoiseFallback, localizeOverviewSummary } from '../zhCopy.ts'

type OverviewPageProps = {
  entry: ModuleRegistryEntry
  onNavigate: (routeId: ShellRouteId) => void
}

const CLUSTERING_NOISE_FALLBACK_PATH = '/data/modules/clustering/clustering-noise-fallback.json'

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
        setSummary(localizeOverviewSummary(data))
        setCorridorDominance(corridorRuntime ? buildCorridorDominanceSummary(corridorRuntime) : null)
        setNoiseFallback(fallback ? localizeClusteringNoiseFallback(fallback) : null)
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
  const businessLoop = summary?.businessLoop ?? []
  const moduleEntryPoints = summary?.moduleEntryPoints ?? []
  const scenarioEntryPoints = summary?.scenarioEntryPoints ?? []
  const framingPillars = summary?.framingPillars ?? []
  const readyModuleCount = moduleEntryPoints.filter((item) => item.status === 'ready').length
  const scenarioEntryCount = scenarioEntryPoints.length
  const sourceEntries = Object.entries(entry.sources)
  const topScenarioEntries = scenarioEntryPoints

  function getEntryActionLabel(routeId: ShellRouteId) {
    return routeId === 'home' ? '打开首页' : getShellRouteDescriptor(routeId).entryActionLabel
  }

  return (
    <section className="module-page">
      <section className="frame module-summary-band overview-summary-band">
        <div>
          <p className="panel-kicker">总览</p>
          <h1>业务闭环、模块入口与展示框架</h1>
          <p className="module-takeaway">{summary?.framing ?? '正在加载总览摘要。'}</p>
        </div>
        <div className="module-kpi-grid overview-kpi-grid">
          <article>
            <span>闭环步骤</span>
            <strong>{summary ? businessLoop.length : '--'}</strong>
          </article>
          <article>
            <span>入口模块</span>
            <strong>{summary ? readyModuleCount : '--'}</strong>
          </article>
          <article>
            <span>场景入口</span>
            <strong>{summary ? scenarioEntryCount : '--'}</strong>
          </article>
          <article>
            <span>预测帧数</span>
            <strong>{summary?.dataScale?.forecast?.timelineFrames ?? '--'}</strong>
          </article>
        </div>
        <div className="overview-summary-actions">
          <button type="button" className="module-primary-action" onClick={() => onNavigate('home')}>
            打开首页
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('forecast')}>
            查看预测
          </button>
          <button type="button" className="module-primary-action evaluation-secondary-action" onClick={() => onNavigate('evaluation')}>
            打开评估中心
          </button>
        </div>
      </section>

      <section className="module-layout">
        <section className="frame module-main-panel">
          <div className="panel-title">
            <div>
              <p className="panel-kicker">业务闭环</p>
              <h2>归档回放如何转成可用证据模块</h2>
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
                  <div className="overview-entry-actions">
                    <button type="button" className="panel-action subtle" onClick={() => onNavigate(step.routeId)}>
                      {getEntryActionLabel(step.routeId)}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : error ? (
            <PlatformStatusSurface tone="error" title="总览数据不可用" summary="overview summary 文件无法打开。" detail={error} />
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
                  <p className="panel-kicker">模块入口</p>
                  <h2>从业务闭环直接跳转到各算法页面</h2>
                </div>
                <span className="panel-code">OVER-02</span>
              </div>

              <div className="module-card-grid overview-entry-grid">
                {moduleEntryPoints.map((moduleEntry) => (
                  <article key={moduleEntry.routeId} className="metric-spotlight-card overview-entry-card">
                    <div className="overview-entry-head">
                      <span>{moduleEntry.label}</span>
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
                      <small>点击进入对应模块查看详细指标、场景与说明。</small>
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
                  <p className="panel-kicker">场景入口</p>
                  <h2>用明确入口替代泛化日志，进入归档展示站</h2>
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
                  <p className="panel-kicker">Corridor dominance</p>
                  <h2>聚类如何进入整站叙事</h2>
                </div>
                <span className="panel-code">XLINK</span>
              </div>

              <div className="module-card-grid corridor-dominance-grid">
                <article className="metric-spotlight-card">
                  <span>主导 corridor</span>
                  <strong>{corridorLeader ? `${corridorLeader.corridorId} ${formatSharePercent(corridorLeader.share)}` : '加载中'}</strong>
                  <small>
                    {corridorLeader
                      ? `${corridorLeader.directionLabel} 方向贡献了 ${corridorLeader.trackCount} / ${corridorDominance.totalTracks} 条 runtime 轨迹。`
                      : '正在等待 clustering runtime 上下文。'}
                  </small>
                </article>
                <article className="metric-spotlight-card">
                  <span>前三覆盖率</span>
                  <strong>{formatSharePercent(corridorDominance.topThreeShare)}</strong>
                  <small>前三条 runtime corridor 构成了整段归档港口叙事的运动主线。</small>
                </article>
                <article className="metric-spotlight-card">
                  <span>主导方向</span>
                  <strong>{leadingDirection ? `${leadingDirection.directionLabel} ${formatSharePercent(leadingDirection.share)}` : '加载中'}</strong>
                  <small>
                    {leadingDirection
                      ? `${leadingDirection.corridorCount} 条 corridor 归入该方向家族，领头 corridor 为 ${leadingDirection.leadCorridorId}。`
                      : '当前没有可用的方向家族分析。'}
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
                <span>跨页回链</span>
                <strong>Corridor dominance 已成为整站桥梁</strong>
                <p>
                  重点通道结论会同步到预测、修复与评估模块，帮助各页围绕同一港口主线解读结果。
                </p>
              </div>

              {noiseFallback && noiseReason ? (
                <div className="module-inline-section">
                  <div className="panel-title">
                    <div>
                      <p className="panel-kicker">聚类补充信息</p>
                      <h2>当前展示聚类分布概览</h2>
                    </div>
                    <span className="panel-code">CLUS-03</span>
                  </div>

                  <div className="module-card-grid corridor-dominance-grid">
                    <article className="metric-spotlight-card">
                      <span>噪声池</span>
                      <strong>{noiseReason.count}</strong>
                      <small>{formatSharePercent(noiseShare)} 的原始分段当前保留在噪声池统计中。</small>
                    </article>
                    <article className="metric-spotlight-card">
                      <span>候选分段</span>
                      <strong>{noiseFallback.counts.candidateSegments}</strong>
                      <small>这些分段共同构成 corridor 提取前的聚类候选池。</small>
                    </article>
                    <article className="metric-spotlight-card">
                      <span>已纳入 corridor</span>
                      <strong>{noiseFallback.counts.keptSegments}</strong>
                      <small>这些分段最终进入已上线的 corridor runtime，构成主导通道结构。</small>
                    </article>
                  </div>

                  <div className="corridor-story-note">
                    <span>跨页回链</span>
                    <strong>聚类页与总览页共用同一组补充统计</strong>
                    <p>
                      聚类页展示完整噪声池与筛除原因，总览页只保留这组统计摘要，用来说明主导 corridor 之外的结构分布。
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
              <p className="panel-kicker">Framing 支柱</p>
              <h2>为什么这个网站应被理解为归档回放加离线推理</h2>
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
              <p className="panel-kicker">规模摘要</p>
              <h2>当前数据规模与来源链路</h2>
            </div>
            <span className="panel-code">TRACE</span>
          </div>

          <div className="module-side-list">
            <article>
              <span>可用预测模型</span>
              <strong>{summary?.dataScale?.forecast?.availableModels?.join(', ') ?? '加载中'}</strong>
            </article>
            <article>
              <span>修复模型数</span>
              <strong>{summary?.dataScale?.repair?.availableModels?.length ?? '--'}</strong>
            </article>
            <article>
              <span>原始 AIS 行数</span>
              <strong>{summary?.dataScale?.clustering?.rawAisRows ?? '--'}</strong>
            </article>
            <article>
              <span>压缩后聚类轨迹数</span>
              <strong>{summary?.dataScale?.clustering?.compressedTracks ?? '--'}</strong>
            </article>
            <article>
              <span>runtime corridor 数</span>
              <strong>{summary?.dataScale?.clustering?.corridorRuntimeCorridors ?? '--'}</strong>
            </article>
            <article>
              <span>runtime corridor 轨迹数</span>
              <strong>{summary?.dataScale?.clustering?.corridorRuntimeTracks ?? '--'}</strong>
            </article>
            <article>
              <span>主导 corridor</span>
              <strong>{corridorLeader ? corridorLeader.corridorId : '加载中'}</strong>
              <small>{corridorLeader ? `${corridorLeader.trackCount} 条轨迹 | ${formatSharePercent(corridorLeader.share)}` : '正在等待 runtime corridor 数据。'}</small>
            </article>
            <article>
              <span>主导方向</span>
              <strong>{leadingDirection ? leadingDirection.directionLabel : '加载中'}</strong>
              <small>
                {leadingDirection
                  ? `${leadingDirection.corridorCount} 条 corridor | ${formatSharePercent(leadingDirection.share)} 的 runtime 流量`
                  : '方向家族汇总依赖 clustering runtime。'}
              </small>
            </article>
          </div>

          {entry.artifacts.length ? (
            <div className="module-inline-section overview-source-shell">
              <p className="evaluation-trace-title">模块资料</p>
              <div className="module-side-list">
                {entry.artifacts.map((artifact, index) => (
                  <article key={artifact.artifactId}>
                    <span>{`资料 ${index + 1}`}</span>
                    <strong>{artifact.description}</strong>
                    <small>当前模块已纳入该组摘要与说明。</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {sourceEntries.length ? (
            <div className="module-inline-section overview-source-shell">
              <p className="evaluation-trace-title">关联来源</p>
              <div className="module-side-list">
                {sourceEntries.map(([sourceId]) => (
                  <article key={sourceId}>
                    <span>{sourceId}</span>
                    <strong>上游来源</strong>
                    <small>总览页会把业务闭环持续绑定到对应模块的汇总结果与来源说明上。</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </section>
  )
}
