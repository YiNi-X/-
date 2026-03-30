import type { BenefitMetric, FlowForecastData, ForecastAlert, Recommendation } from '../sharedContracts.ts'
import type { ClusteringNoiseFallback } from './clustering/clusteringTypes.ts'
import type { EvaluationOptimizationFile } from './evaluation/evaluationTypes.ts'
import type { ForecastMetricsFile } from './forecast/forecastTypes.ts'
import type { ForwardLookingScenarioCatalog, ForwardLookingSummary } from './forwardLooking/forwardLookingTypes.ts'
import type { OverviewSummary } from './overview/overviewTypes.ts'
import type { RepairSampleCatalog } from './repair/repairTypes.ts'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatMomentLabel(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

function formatFixed(value: number, digits = 1) {
  return value.toFixed(digits)
}

function translateLaterUpdateReason(reason: string) {
  if (reason.includes('This capability will be connected in a later update.')) {
    return '该能力将在后续版本接入。'
  }
  if (reason.includes('This model is not exported yet.')) {
    return '该模型尚未导出到当前版本。'
  }
  return reason
}

function localizeBenefitLabel(label: string) {
  switch (label) {
    case 'Focus-grid pressure':
      return '焦点网格压力'
    case 'Elevated hotspots':
      return '高压热点数'
    case 'Total-flow delta':
      return '总流量变化'
    case 'Focus-route load share':
      return '焦点航线负载占比'
    default:
      return label
  }
}

function localizeBenefits(benefits: BenefitMetric[]) {
  return benefits.map((benefit) => ({
    ...benefit,
    label: localizeBenefitLabel(benefit.label),
  }))
}

function pickSecondaryAlert(alerts: ForecastAlert[], focusGrid: string) {
  return alerts
    .filter((alert) => alert.grid !== focusGrid)
    .slice()
    .sort((left, right) => right.future - left.future)[0] ?? null
}

function routeIdFromGrid(routeFocusMap: Record<string, string>, gridId: string | null) {
  return gridId ? routeFocusMap[gridId] ?? null : null
}

function localizeRecommendationAction(
  recommendation: Recommendation,
  context: {
    model: string
    focusGrid: string
    focusRoute: string
    secondaryGrid: string | null
    secondaryRoute: string | null
  },
) {
  if (recommendation.target === 'Evidence drawer') {
    return {
      ...recommendation,
      action: '联查当前模型的指标、结构说明与证据条目。',
      reason: `当前页面已经把 ${context.model} 的运行时与证据链打通，可以直接在同一界面查看摘要与细节。`,
      effect: '摘要、主图与证据层可以在同一模型上下文下保持一致。',
    }
  }

  if (recommendation.target === context.focusRoute) {
    return {
      ...recommendation,
      action: '优先把焦点航线放入当前值守读数。',
      reason: `${context.focusGrid} 是 ${context.model} 当前帧里最需要关注的热点网格，对应航线为 ${context.focusRoute}。`,
      effect: '热点、航线与主图叙事将围绕同一条主线展开，便于解释当前风险。 ',
    }
  }

  return {
    ...recommendation,
    action: '把次重点航线纳入交叉复核。',
    reason: `${context.secondaryGrid ?? recommendation.target} 仍可能与 ${context.focusGrid} 形成联动压力，需要作为补充观察对象。`,
    effect: '页面会保留备用叙事，不会因为只盯住一个热点而忽略次级变化。',
  }
}

function localizeForecastAlert(alert: ForecastAlert, model: string, focusRoute: string, applied = false): ForecastAlert {
  if (applied) {
    return {
      ...alert,
      note: `应用态预览显示 ${focusRoute} 周边热点压力已经进入协同响应读数。`,
    }
  }

  return {
    ...alert,
    note: `${model} 仍将 ${alert.grid} 保留在当前帧热点观察列表中。`,
  }
}

function moduleLabel(routeId: string) {
  switch (routeId) {
    case 'overview':
      return '总览'
    case 'forecast':
      return '流量预测'
    case 'repair':
      return '轨迹修复'
    case 'clustering':
      return '轨迹聚类'
    case 'evaluation':
      return '评估中心'
    case 'forward-looking':
      return '前瞻分析'
    case 'home':
      return '首页'
    default:
      return routeId
  }
}

function localizeOverviewMetricLabel(label: string) {
  switch (label) {
    case 'Horizons':
      return '预测 horizon'
    case '1h leader':
      return '1h 领先模型'
    case 'Curated samples':
      return '精选样本数'
    case 'RMSE leader':
      return 'RMSE 领先模型'
    case 'Runtime corridors':
      return '运行时 corridor'
    case 'Lead corridor':
      return '主导 corridor'
    case 'Traceability':
      return '可追溯链路'
    case 'Status':
      return '状态'
    case 'Current phase':
      return '当前阶段'
    default:
      return label
  }
}

function localizeOverviewScenarioEntry(
  entry: OverviewSummary['scenarioEntryPoints'][number],
  summary: OverviewSummary,
) {
  const forecast = summary.dataScale?.forecast
  const repair = summary.dataScale?.repair
  const clustering = summary.dataScale?.clustering

  switch (entry.routeId) {
    case 'home':
      return {
        ...entry,
        label: '归档回放窗口',
        summary: '从指挥中枢回放进入，而不是从零散日志开始，让所有模块共用同一个归档场景时钟。',
        detail: `${forecast?.timelineFrames ?? '--'} 个时间帧与 ${forecast?.horizons.length ?? '--'} 个预测 horizon 已围绕同一历史港口窗口完成打包。`,
      }
    case 'forecast':
      return {
        ...entry,
        label: '预测入口',
        summary: '直接进入已上线 1h 排名最强的模型，再看热点与航线级变化。',
        detail: `可用模型：${forecast?.availableModels.join('、') ?? '--'}；支持 horizon：${forecast?.horizons.join('、') ?? '--'}。`,
      }
    case 'repair':
      return {
        ...entry,
        label: '修复入口',
        summary: '从精选受损轨迹样本进入，直接观察修复前后的路径变化。',
        detail: `${repair?.sampleCount ?? '--'} 个精选样本已上线，ATT-BILSTM 当前在聚合 RMSE 上领先。`,
      }
    case 'clustering':
      return {
        ...entry,
        label: 'corridor 入口',
        summary: '沿着当前主导 corridor 家族进入整站运动叙事主线。',
        detail: `${clustering?.corridorRuntimeTracks ?? '--'} 条 runtime 轨迹已收束为 ${clustering?.corridorRuntimeCorridors ?? '--'} 条已上线 corridor。`,
      }
    case 'evaluation':
      return {
        ...entry,
        label: '评估入口',
        summary: '评估中心现在同时承载跨任务排名与离线调参证据。',
        detail: '已完成的 trial checkpoint、最优目标值与参数重要性都可以在同一路由中查看。',
      }
    case 'forward-looking':
      return {
        ...entry,
        label: '决策入口',
        summary: '打开精选决策层，查看显式回链预测排名与 corridor dominance 的焦点场景。',
        detail: '当前场景包覆盖 C03、C08、C12、C14，并与主导 corridor 的整站语境保持一致。',
      }
    default:
      return entry
  }
}

export function localizeReadinessLabel(value: string | null | undefined) {
  switch (value) {
    case 'ready':
      return '已就绪'
    case 'partial':
      return '已整理'
    case 'deferred':
      return '专题补充'
    case 'loading':
      return '加载中'
    case 'unavailable':
      return '不可用'
    case 'error':
      return '错误'
    case 'review-first':
      return '待审核'
    case 'phase-12-next':
      return '场景扩展'
    case 'later-phase':
      return '专题扩展'
    case 'Later update':
      return '补充说明'
    default:
      return value ?? '--'
  }
}

export function localizeAlertLevelLabel(value: string | null | undefined) {
  switch (value) {
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'watch':
      return '观察'
    default:
      return value ?? '--'
  }
}

export function localizeRepairSampleLabel(label: string) {
  const match = /^Target\s+(\d+)\s+Sample\s+(\d+)$/i.exec(label)
  if (!match) return label
  return `目标 ${match[1]} 样本 ${match[2]}`
}

export function localizeRepairSampleCatalog(catalog: RepairSampleCatalog): RepairSampleCatalog {
  return {
    ...catalog,
    samples: catalog.samples.map((sample) => ({
      ...sample,
      label: localizeRepairSampleLabel(sample.label),
    })),
  }
}

export function localizeForecastMetrics(metrics: ForecastMetricsFile): ForecastMetricsFile {
  return {
    ...metrics,
    metricBasis: '基于已提交 STGCN、LSTM 与 BiLSTM 运行时输出对齐的 totalFlow 时间线指标',
    deferredModels: metrics.deferredModels?.map((item) => ({
      ...item,
      reason: translateLaterUpdateReason(item.reason),
    })),
  }
}

export function localizeFlowForecastData(runtime: FlowForecastData): FlowForecastData {
  return {
    ...runtime,
    meta: {
      ...runtime.meta,
      forecastMode: '离线递归推理',
      interpolationMode: '按小时推理锚点做线性插值并映射到 5 分钟回放',
      narrativeMode: '按帧生成模型叙事',
      notice: `AIS 回放窗口保持固定，${runtime.meta.model} 预测通过每小时递归推理生成，再线性映射到 5 分钟回放时间线。`,
    },
    timeline: runtime.timeline.map((entry) => {
      const secondaryAlert = pickSecondaryAlert(entry.derived.alerts, entry.derived.focusGrid)
      const secondaryRoute = routeIdFromGrid(runtime.meta.routeFocusMap, secondaryAlert?.grid ?? null)
      const forecast1h = entry.forecast['1h']

      return {
        ...entry,
        derived: {
          ...entry.derived,
          alerts: entry.derived.alerts.map((alert) => localizeForecastAlert(alert, runtime.meta.model, entry.derived.focusRoute)),
        },
        narrative: {
          ...entry.narrative,
          status: `${runtime.meta.model} 当前聚焦 ${entry.derived.focusGrid} / ${entry.derived.focusRoute}，1h 预测仍需重点关注。`,
          summary: `${formatMomentLabel(entry.time)} 时刻，可见船舶 ${entry.current.visibleVessels} 艘，当前总流量 ${formatFixed(
            entry.current.totalFlow,
          )}；${runtime.meta.model} 对 1h 后总流量预测为 ${formatFixed(forecast1h.totalFlow)}，主关注热点为 ${entry.derived.focusGrid}，对应航线 ${entry.derived.focusRoute}。`,
          logs: [
            `${formatMomentLabel(entry.time)}：当前回放帧已与热点、航线和总流量读数完成对齐。`,
            `${formatMomentLabel(entry.time)}：${runtime.meta.model} 使用过去 ${runtime.meta.historyWindowHours}h 的历史窗口生成本帧预测。`,
            secondaryAlert && secondaryRoute
              ? `${formatMomentLabel(entry.time)}：次重点热点 ${secondaryAlert.grid} / ${secondaryRoute} 也需要同步关注。`
              : `${formatMomentLabel(entry.time)}：当前最强热点仍集中在 ${entry.derived.focusGrid} / ${entry.derived.focusRoute}。`,
          ],
          strategy: {
            headline: `${entry.derived.focusRoute} 航线优先监控`,
            summary: `建议先围绕 ${entry.derived.focusRoute} 与 ${entry.derived.focusGrid} 调度，再关注 ${secondaryAlert?.grid ?? '--'} / ${
              secondaryRoute ?? '--'
            } 的次级压力变化；整页解释继续以 ${runtime.meta.model} 结果为主。`,
          },
          recommendations: entry.narrative.recommendations.map((recommendation) =>
            localizeRecommendationAction(recommendation, {
              model: runtime.meta.model,
              focusGrid: entry.derived.focusGrid,
              focusRoute: entry.derived.focusRoute,
              secondaryGrid: secondaryAlert?.grid ?? null,
              secondaryRoute,
            }),
          ),
          benefits: localizeBenefits(entry.narrative.benefits),
          appliedState: {
            ...entry.narrative.appliedState,
            status: '已应用协调策略预览',
            summary: `在应用态预览下，${entry.derived.focusGrid} 的 1h 预测压力从 ${
              entry.narrative.benefits[0]?.before ?? '--'
            } 调整为 ${entry.narrative.benefits[0]?.after ?? '--'}。`,
            alerts: entry.narrative.appliedState.alerts.map((alert) =>
              localizeForecastAlert(alert, runtime.meta.model, entry.derived.focusRoute, true),
            ),
          },
        },
      }
    }),
  }
}

export function localizeOverviewSummary(summary: OverviewSummary): OverviewSummary {
  const forecastModelCount = summary.dataScale?.forecast?.availableModels.length ?? 0
  const forecastHorizonCount = summary.dataScale?.forecast?.horizons.length ?? 0
  const repairSampleCount = summary.dataScale?.repair?.sampleCount ?? 0
  const corridorCount = summary.dataScale?.clustering?.corridorRuntimeCorridors ?? 0
  const corridorTrackCount = summary.dataScale?.clustering?.corridorRuntimeTracks ?? 0

  return {
    ...summary,
    framing: '网站以归档 AIS 回放为场景时钟，并叠加离线分析整理出的预测、修复、聚类与评估结果，形成可浏览的港口运行展示。',
    framingPillars: [
      {
        id: 'archived-scene-clock',
        kicker: '回放',
        title: '归档 AIS 回放就是整站的场景时钟',
        detail: '所有模块共用同一段已提交历史港口窗口，便于把不同模块结果放回同一业务场景中理解。',
      },
      {
        id: 'offline-inference',
        kicker: '推理',
        title: '预测、修复、聚类与调参都来自整理后的离线结果',
        detail: '网站打包的是面向展示整理后的 JSON 与 Plotly 结果，便于稳定复现关键结论。',
      },
      {
        id: 'truth-boundary',
        kicker: '边界',
        title: '展示层聚焦归档回放与离线分析的可解释结果',
        detail: '页面以统一场景串联多模块结果，让模型表现、聚类结构与策略建议可以放在同一语境下对照。',
      },
    ],
    businessLoop: [
      {
        ...summary.businessLoop[0],
        step: '归档 AIS 回放',
        description: '用已提交的历史 AIS 回放作为所有后续证据页面共享的场景时钟。',
      },
      {
        ...summary.businessLoop[1],
        step: '轨迹聚类与 corridor 提取',
        description: '先解释从原始轨迹到分段、压缩、corridor 的运动结构，再让其他模块解读流量模式。',
      },
      {
        ...summary.businessLoop[2],
        step: '流量预测',
        description: '用已提交的多模型预测 bundle，在归档回放时间线上投射近未来流量变化。',
      },
      {
        ...summary.businessLoop[3],
        step: '轨迹修复',
        description: '展示受损轨迹样本如何被重建，并与精选参考轨迹进行对比。',
      },
      {
        ...summary.businessLoop[4],
        step: '评估中心',
        description: '把预测、修复、聚类上下文与离线调参结果收进一个跨任务对比中心。',
      },
      ...(summary.businessLoop[5]
        ? [
            {
              ...summary.businessLoop[5],
              step: '协同决策',
              description: '在预测、评估与聚类证据之上，组织规则驱动的协同决策场景，并保留前后状态切换。',
            },
          ]
        : []),
    ],
    moduleEntryPoints: summary.moduleEntryPoints.map((item) => {
      switch (item.routeId) {
        case 'forecast':
          return {
            ...item,
            label: '流量预测',
            summary: `${item.secondaryMetric.value} 当前在 ${forecastModelCount} 个预测模型、${forecastHorizonCount} 个 horizon 的已上线 1h RMSE 中领先。`,
            primaryMetric: {
              ...item.primaryMetric,
              label: localizeOverviewMetricLabel(item.primaryMetric.label),
            },
            secondaryMetric: {
              ...item.secondaryMetric,
              label: localizeOverviewMetricLabel(item.secondaryMetric.label),
            },
          }
        case 'repair':
          return {
            ...item,
            label: '轨迹修复',
            summary: `${repairSampleCount} 个精选修复样本已上线，${item.secondaryMetric.value} 当前在聚合 RMSE 对比中领先。`,
            primaryMetric: {
              ...item.primaryMetric,
              label: localizeOverviewMetricLabel(item.primaryMetric.label),
            },
            secondaryMetric: {
              ...item.secondaryMetric,
              label: localizeOverviewMetricLabel(item.secondaryMetric.label),
            },
          }
        case 'clustering':
          return {
            ...item,
            label: '轨迹聚类',
            summary: `${corridorCount} 条 runtime corridor 与 ${corridorTrackCount} 条 corridor 轨迹，让聚类结果收束到以 ${item.secondaryMetric.value} 为代表的主导通道叙事。`,
            primaryMetric: {
              ...item.primaryMetric,
              label: localizeOverviewMetricLabel(item.primaryMetric.label),
            },
            secondaryMetric: {
              ...item.secondaryMetric,
              label: localizeOverviewMetricLabel(item.secondaryMetric.label),
            },
          }
        case 'evaluation':
          return {
            ...item,
            label: '评估中心',
            summary: '统一评估中心把预测、修复与聚类上下文收进同一个比较外壳，并支持从摘要进入细节。',
            primaryMetric: {
              ...item.primaryMetric,
              label: '链路数',
            },
            secondaryMetric: {
              ...item.secondaryMetric,
              label: '当前状态',
            },
          }
        case 'forward-looking':
          return {
            ...item,
            label: '前瞻分析',
            summary: '协同决策层显式回链预测排名与 corridor dominance，把场景化建议纳入整站叙事。',
            primaryMetric: {
              ...item.primaryMetric,
              label: localizeOverviewMetricLabel(item.primaryMetric.label),
            },
            secondaryMetric: {
              ...item.secondaryMetric,
              label: localizeOverviewMetricLabel(item.secondaryMetric.label),
            },
          }
        default:
          return item
      }
    }),
    scenarioEntryPoints: summary.scenarioEntryPoints.map((item) => localizeOverviewScenarioEntry(item, summary)),
    deferredModules: summary.deferredModules?.map((item) => ({
      ...item,
      module: moduleLabel(item.module),
      status: localizeReadinessLabel(item.status),
      reason: translateLaterUpdateReason(item.reason),
    })),
  }
}

export function localizeClusteringNoiseFallback(fallback: ClusteringNoiseFallback): ClusteringNoiseFallback {
  return {
    ...fallback,
    summary: '当前面板汇总候选分段、重点 corridor 与噪声池统计，用来补充 corridor 主线之外的结构分布。',
    dropReasons: fallback.dropReasons.map((reason) => {
      switch (reason.id) {
        case 'dbscan_noise':
          return {
            ...reason,
            label: 'DBSCAN 噪声池',
            narrative: '这些分段当前保留在噪声池统计中，用于说明重点 corridor 之外的尾部分布。',
          }
        case 'non_top_corridor':
          return {
            ...reason,
            label: '未进入 Top-K corridor',
            narrative: '这些分段形成了较小的方向簇，但没有被提升到当前网站使用的 Top-K corridor runtime 中。',
          }
        case 'too_few_points':
          return {
            ...reason,
            label: '点数不足',
            narrative: '这些分段在进入重点 corridor 之前就已经低于最小支撑阈值。',
          }
        case 'too_short':
          return {
            ...reason,
            label: '位移过短',
            narrative: '这些分段因为位移低于当前 corridor 提取阈值而被剔除。',
          }
        default:
          return reason
      }
    }),
  }
}

function localizeOptimizationParameterLabel(label: string) {
  switch (label) {
    case 'Batch size':
      return 'Batch size'
    case 'Learning rate':
      return 'Learning rate'
    case 'Epochs':
      return '训练轮数'
    case 'Layers':
      return '层数'
    case 'Hidden dim':
      return '隐藏维度'
    default:
      return label
  }
}

export function localizeEvaluationOptimization(optimization: EvaluationOptimizationFile): EvaluationOptimizationFile {
  return {
    ...optimization,
    studyLabel: '轨迹修复离线调参研究',
    summary: `本页汇总已提交的 Plotly 调参结果，共记录 ${optimization.objective.totalTrialSlots} 个 trial 槽位，其中 ${optimization.objective.completedTrials} 个形成可见目标值；当前最佳结果出现在 trial ${optimization.objective.bestTrial}，目标值为 ${optimization.objective.bestValue.toExponential(
      3,
    )}。页面会重点展示关键节点变化与参数影响，帮助快速理解搜索过程。`,
    objective: {
      ...optimization.objective,
      metricLabel: '目标值',
    },
    importance: {
      ...optimization.importance,
      parameters: optimization.importance.parameters.map((parameter) => ({
        ...parameter,
        label: localizeOptimizationParameterLabel(parameter.label),
      })),
    },
    bestParameters: optimization.bestParameters.map((parameter) => ({
      ...parameter,
      label: localizeOptimizationParameterLabel(parameter.label),
    })),
    supportingViews: optimization.supportingViews.map((view) => {
      switch (view.id) {
        case 'history-html':
          return {
            ...view,
            label: '优化历史 HTML',
            detail: '保留原始 Plotly 导出，方便对照结构化摘要查看每个 trial 的变化。',
          }
        case 'importance-html':
          return {
            ...view,
            label: '参数重要性 HTML',
            detail: '保留参数重要性原始导出，用于核对结构化 importance 排名。',
          }
        case 'parallel-coordinates':
          return {
            ...view,
            label: '平行坐标 HTML',
            detail: '展示不同 trial 在多参数空间中的分布，作为调参证据补充视图。',
          }
        case 'parameter-slice':
          return {
            ...view,
            label: '参数切片 HTML',
            detail: '从单参数切面观察目标值变化，帮助解释最佳参数附近的搜索行为。',
          }
        default:
          return view
      }
    }),
  }
}

export function localizeForwardLookingSummary(summary: ForwardLookingSummary): ForwardLookingSummary {
  return {
    ...summary,
    framing: '协同决策模块建立在归档预测、评估与聚类语境之上，用精选场景展示策略前后差异。',
    summary: `${summary.scenarioCount} 个精选场景围绕当前已上线的 ${summary.selectedModel} ${summary.selectedHorizon} 结果展开。模块提供统一的焦点状态切换、热点对照与 route 语境，便于在同一场景下比较策略变化。`,
    evidenceAuthority: {
      ...summary.evidenceAuthority,
      rankingLabel: '评估中心 1h 领先模型',
      rationale: `${summary.selectedModel} 被选为当前场景的参考模型，是因为它当前在已上线 1h RMSE 表中排名第一；场景建议会沿用这条模型依据。`,
    },
    corridorContext: {
      ...summary.corridorContext,
      narrative: `${summary.corridorContext.leadingCorridorId} 以 ${formatPercent(summary.corridorContext.leadingShare)} 领跑 runtime corridor 体系，前三条 corridor 合计覆盖 ${formatPercent(
        summary.corridorContext.topThreeShare,
      )} 的已上线轨迹。这条 dominance 主线会进入整站叙事，并为 route comparison 提供稳定的结构背景。`,
      routeMappingClaim: '结构背景',
    },
    noiseContext: {
      ...summary.noiseContext,
      reason: '聚类页补充展示噪声池与筛除分段统计，用于说明重点 corridor 之外的结构分布。',
    },
    crossLinks: summary.crossLinks.map((link) => ({
      ...link,
      label: moduleLabel(link.routeId),
      summary:
        link.routeId === 'forecast'
          ? '打开预测模块，查看每个精选决策帧对应的完整模型时间线。'
          : link.routeId === 'evaluation'
            ? '先确认为什么当前模型拥有 1h 权威，再解释任何规则驱动建议。'
            : link.routeId === 'clustering'
              ? '回到聚类页查看 corridor dominance 与噪声池统计。'
              : '查看协同决策如何作为已上线证据层进入归档回放业务闭环。',
    })),
    deferred: summary.deferred.map((item) => ({
      ...item,
      summary: '该扩展项已纳入交付后清单。',
    })),
  }
}

export function localizeForwardLookingCatalog(
  catalog: ForwardLookingScenarioCatalog,
  summary?: ForwardLookingSummary | null,
): ForwardLookingScenarioCatalog {
  const leadingCorridorId = summary?.corridorContext.leadingCorridorId ?? '主导 corridor'

  return {
    ...catalog,
    scenarios: catalog.scenarios.map((scenario, index) => {
      const secondaryAlert = pickSecondaryAlert(scenario.alertsBefore, scenario.focusGrid)
      const secondaryRoute =
        scenario.recommendations.find((recommendation) => recommendation.target !== scenario.focusRoute && recommendation.target !== 'Evidence drawer')?.target ??
        null

      return {
        ...scenario,
        title: `${scenario.focusRoute} / ${scenario.focusGrid} 压力窗口`,
        emphasis: `精选场景 #${index + 1}：应用态预览下，${scenario.focusGrid} 的压力下降 ${formatFixed(scenario.focusPressureDrop)}。`,
        strategyHeadline: `${scenario.focusRoute} 焦点航线复核`,
        strategySummary: `优先关注 ${scenario.focusGrid} / ${scenario.focusRoute}，同时保留 ${secondaryAlert?.grid ?? '--'} / ${
          secondaryRoute ?? '--'
        } 的次级观察位，并让主图、告警表与证据层持续对齐 ${scenario.selectedModel}。`,
        recommendations: scenario.recommendations.map((recommendation) =>
          localizeRecommendationAction(recommendation, {
            model: scenario.selectedModel,
            focusGrid: scenario.focusGrid,
            focusRoute: scenario.focusRoute,
            secondaryGrid: secondaryAlert?.grid ?? null,
            secondaryRoute,
          }),
        ),
        benefits: localizeBenefits(scenario.benefits),
        alertsBefore: scenario.alertsBefore.map((alert) => localizeForecastAlert(alert, scenario.selectedModel, scenario.focusRoute)),
        alertsAfter: scenario.alertsAfter.map((alert) => localizeForecastAlert(alert, scenario.selectedModel, scenario.focusRoute, true)),
        evaluationContext: {
          ...scenario.evaluationContext,
          summary: `${scenario.selectedModel} 当前是已上线 ${scenario.evaluationContext.metric} 的第 ${scenario.evaluationContext.rank} 名，数值为 ${scenario.evaluationContext.value.toFixed(
            3,
          )}；下一名 ${scenario.evaluationContext.nextModel} 落后 ${scenario.evaluationContext.nextModelGap.toFixed(3)}。`,
        },
        corridorContext: {
          ...scenario.corridorContext,
          headline: `${leadingCorridorId} 仍是整站运动主线`,
          detail: `${leadingCorridorId} 为本页的 route comparison 提供整站运动背景，让热点变化可以放回重点 corridor 结构中理解。`,
        },
        evidenceLineage: scenario.evidenceLineage.map((item) => {
          switch (item.artifactId) {
            case 'forecast-selected-runtime':
              return {
                ...item,
                label: `${scenario.selectedModel} 运行时帧`,
                detail: `场景 ${scenario.sceneId} 在 ${formatMomentLabel(scenario.time)} 锚定当前焦点航线/网格组合。`,
              }
            case 'evaluation-metrics':
              return {
                ...item,
                label: '1h 排名权威',
                detail: `${scenario.selectedModel} 当前位列已上线 1h ${scenario.evaluationContext.metric} 第 ${scenario.evaluationContext.rank}。`,
              }
            case 'clustering-corridor-runtime':
              return {
                ...item,
                label: 'corridor dominance 上下文',
                detail: `${leadingCorridorId} 提供整站共享的 corridor 背景，使场景 route 对比与聚类主线保持一致。`,
              }
            case 'clustering-noise-fallback':
              return {
                ...item,
                label: '聚类补充信息',
                detail: '聚类页补充展示噪声池统计与筛除原因，用于解释 corridor 主线之外的结构分布。',
              }
            default:
              return item
          }
        }),
        honestBoundary: '当前 applied-state preview 基于已提交预测结果与场景规则生成，用于对照策略前后的热点变化。',
      }
    }),
  }
}
