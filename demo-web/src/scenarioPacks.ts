export type AlertLevel = 'high' | 'medium' | 'watch'
export type HotspotId = 'G03' | 'G25' | 'G60' | 'G15'
export type RouteId = 'C16' | 'C12' | 'C08' | 'C03' | 'C14' | 'C17'
export type ScenarioId = 'night-navigation' | 'morning-peak' | 'entrance-congestion' | 'peak-dissipation'
export type ResultTab = 'benefit' | 'model'
export type HorizonKey = '1h' | '2h' | '3h'
export type ModelName = 'STGCN' | 'LSTM' | 'BiLSTM'

export type Recommendation = {
  target: string
  action: string
  reason: string
  effect: string
}

export type BenefitMetric = {
  label: string
  before: string
  after: string
  unit?: string
}

export type Scene = {
  id: string
  label: string
  time: string
  phase: string
  status: string
  totalFlow: number
  next1h: number
  vessels: number
  hotspotCount: number
  focusGrid: HotspotId
  summary: string
  gridValues: { g25: number; g60: number; g15: number }
  alerts: { grid: HotspotId; level: AlertLevel; current: number; future: number; note: string }[]
  logs: string[]
  strategyHeadline: string
  strategySummary: string
  recommendations: Recommendation[]
  benefits: BenefitMetric[]
  appliedFocus: { current: number; future: number }
  appliedSummary: string
  appliedHotspotScale?: number
  appliedStatus?: string
}

export type GeoPoint = { lon: number; lat: number }
export type RouteBlueprint = { id: RouteId; labelPoint: GeoPoint; points: GeoPoint[]; markerBaseDur: number; markerRadius: number }
export type MapTagDefinition = { id: string; label: string; point: GeoPoint; focusGrid?: HotspotId }
export type HotspotAnchor = { id: HotspotId; point: GeoPoint }
export type FeedView = { title: string; tag: string; area: string; route: RouteId; grid: HotspotId; position: string; subtitle: string }
export type ScenarioPack = {
  id: ScenarioId
  name: string
  shortLabel: string
  description: string
  timeSlices: Scene[]
  baseRouteCounts: Record<RouteId, number>
  baseAutoplayMs: number
  hotspotSeries: Record<HotspotId, number[]>
}
export type BenchmarkEntry = { mae: number; rmse: number; r2: number; summary: string }

const rec = (target: string, action: string, reason: string, effect: string): Recommendation => ({ target, action, reason, effect })
const benefitSet = (risk: [string, string], wait: [string, string], efficiency: [string, string], hotspots: [string, string]): BenefitMetric[] => [
  { label: '冲突风险指数', before: risk[0], after: risk[1] },
  { label: '平均等待时间', before: wait[0], after: wait[1], unit: 'min' },
  { label: '主航道通行效率', before: efficiency[0], after: efficiency[1], unit: '%' },
  { label: '高压热点网格', before: hotspots[0], after: hotspots[1] },
]
const buildScene = (scene: Scene): Scene => ({ ...scene, appliedHotspotScale: scene.appliedHotspotScale ?? 0.68, appliedStatus: scene.appliedStatus ?? '协同已应用' })

export const routeIds: RouteId[] = ['C16', 'C12', 'C08', 'C03', 'C14', 'C17']
export const hotspotIds: HotspotId[] = ['G03', 'G25', 'G60', 'G15']
export const defaultScenarioId: ScenarioId = 'night-navigation'

export const routeBlueprints: RouteBlueprint[] = [
  { id: 'C16', labelPoint: { lon: 113.732197, lat: 22.563841 }, points: [{ lon: 113.722991, lat: 22.549134 }, { lon: 113.750066, lat: 22.461374 }, { lon: 113.766437, lat: 22.3266 }, { lon: 113.773153, lat: 22.210184 }, { lon: 113.773573, lat: 22.158244 }], markerBaseDur: 10.2, markerRadius: 4.6 },
  { id: 'C12', labelPoint: { lon: 113.786404, lat: 22.514937 }, points: [{ lon: 113.716904, lat: 22.556298 }, { lon: 113.733815, lat: 22.536225 }, { lon: 113.749226, lat: 22.520926 }, { lon: 113.7614, lat: 22.511971 }, { lon: 113.772104, lat: 22.501672 }], markerBaseDur: 9.4, markerRadius: 4.2 },
  { id: 'C08', labelPoint: { lon: 113.71305, lat: 22.537376 }, points: [{ lon: 113.727189, lat: 22.545552 }, { lon: 113.739572, lat: 22.518239 }, { lon: 113.749436, lat: 22.47615 }, { lon: 113.756363, lat: 22.420181 }, { lon: 113.763499, lat: 22.358391 }, { lon: 113.789314, lat: 22.190035 }, { lon: 113.796241, lat: 22.158244 }], markerBaseDur: 11.6, markerRadius: 4.8 },
  { id: 'C03', labelPoint: { lon: 113.795033, lat: 22.483294 }, points: [{ lon: 113.766017, lat: 22.529433 }, { lon: 113.768326, lat: 22.51018 }, { lon: 113.77861, lat: 22.463165 }, { lon: 113.788475, lat: 22.427345 }, { lon: 113.798549, lat: 22.390181 }, { lon: 113.805895, lat: 22.330182 }, { lon: 113.824159, lat: 22.275598 }], markerBaseDur: 8.4, markerRadius: 4.6 },
  { id: 'C14', labelPoint: { lon: 113.702262, lat: 22.191024 }, points: [{ lon: 113.704311, lat: 22.157797 }, { lon: 113.717324, lat: 22.192274 }, { lon: 113.72383, lat: 22.238393 }, { lon: 113.733065, lat: 22.287198 }, { lon: 113.719003, lat: 22.340033 }, { lon: 113.747128, lat: 22.426002 }, { lon: 113.770425, lat: 22.499881 }], markerBaseDur: 11, markerRadius: 4.4 },
  { id: 'C17', labelPoint: { lon: 113.842228, lat: 22.309543 }, points: [{ lon: 113.704941, lat: 22.156453 }, { lon: 113.720682, lat: 22.204363 }, { lon: 113.733695, lat: 22.277347 }, { lon: 113.751745, lat: 22.295257 }, { lon: 113.786796, lat: 22.275108 }, { lon: 113.825205, lat: 22.275108 }], markerBaseDur: 9.8, markerRadius: 4.3 },
]

export const mapTagDefinitions: MapTagDefinition[] = [
  { id: 'M01', label: 'Northwest Entry', focusGrid: 'G03', point: { lon: 113.7368, lat: 22.5416 } },
  { id: 'M02', label: 'North Split', point: { lon: 113.7482, lat: 22.5228 } },
  { id: 'M03', label: 'Central Junction', focusGrid: 'G25', point: { lon: 113.7584, lat: 22.5064 } },
  { id: 'M04', label: 'East Main Channel', focusGrid: 'G60', point: { lon: 113.8015, lat: 22.3625 } },
  { id: 'M05', label: 'Southbound Exit', focusGrid: 'G15', point: { lon: 113.7698, lat: 22.2868 } },
]

export const hotspotAnchors: HotspotAnchor[] = [
  { id: 'G03', point: { lon: 113.769683, lat: 22.498253 } },
  { id: 'G25', point: { lon: 113.733276, lat: 22.281927 } },
  { id: 'G60', point: { lon: 113.77211, lat: 22.284228 } },
  { id: 'G15', point: { lon: 113.753232, lat: 22.444747 } },
]

export const feedViews: FeedView[] = [
  { title: 'East Main Channel', tag: 'CAM-01', area: 'M04', route: 'C03', grid: 'G60', position: '63% 44%', subtitle: 'Tracks east channel pressure.' },
  { title: 'Central Junction', tag: 'CAM-02', area: 'M03', route: 'C12', grid: 'G25', position: '52% 30%', subtitle: 'Tracks crossing interaction and hotspot evolution.' },
  { title: 'Southbound Exit', tag: 'CAM-03', area: 'M05', route: 'C17', grid: 'G15', position: '55% 66%', subtitle: 'Tracks southbound release and tail dissipation.' },
  { title: 'Northwest Entry', tag: 'CAM-04', area: 'M01', route: 'C08', grid: 'G03', position: '44% 24%', subtitle: 'Tracks inbound queue buildup at the northwest entry.' },
]

const nightNavigationScenes: Scene[] = [
  buildScene({ id: 'n0', label: '23:00', time: '2020-10-20 23:00', phase: '初始态势', status: '平稳抬升', totalFlow: 1099, next1h: 1352, vessels: 14, hotspotCount: 2, focusGrid: 'G03', summary: '夜间入口与交汇已出现持续抬升迹象。', gridValues: { g25: 43, g60: 64, g15: 49 }, alerts: [{ grid: 'G03', level: 'watch', current: 43, future: 91, note: '西北入口进入预热。' }, { grid: 'G60', level: 'medium', current: 64, future: 70, note: '东侧通道维持高位。' }, { grid: 'G25', level: 'watch', current: 43, future: 82, note: '交汇区即将抬升。' }], logs: ['23:00 载入夜间场景。', '23:00 G03 进入重点监测。', '23:00 C03 保持高位。', '23:00 尚未出现突发冲击。'], strategyHeadline: '入口预分流', strategySummary: '提前分批放行入口船组，避免入口与交汇区在下一窗口同步叠压。', recommendations: [rec('西北入口船组', '延后 1 个 10 分钟窗口进港', '避开中央交汇预热点', '入口峰值削减'), rec('中央交汇 C12', '限制双向同窗会遇', '减轻 G25 压力', '冲突风险下降'), rec('南向离港 C17', '优先释放离港船舶', '为交汇腾挪带', '主航道效率提升'), rec('东侧主通道 C03', '保持单向高通过', '承接入口分流', '全局分配更均衡')], benefits: benefitSet(['0.71', '0.49'], ['36', '28'], ['82', '89'], ['2', '0']), appliedFocus: { current: 29, future: 57 }, appliedSummary: '入口与交汇的耦合压力明显减弱。' }),
  buildScene({ id: 'n1', label: '00:00', time: '2020-10-21 00:00', phase: '流量抬升', status: '繁忙上升', totalFlow: 1352, next1h: 1582, vessels: 16, hotspotCount: 3, focusGrid: 'G25', summary: '中央交汇开始承接入口和东侧双重压力。', gridValues: { g25: 68, g60: 72, g15: 53 }, alerts: [{ grid: 'G25', level: 'medium', current: 68, future: 96, note: '交汇区进入高压前夜。' }, { grid: 'G60', level: 'medium', current: 72, future: 84, note: '东侧主通道持续承压。' }, { grid: 'G03', level: 'watch', current: 52, future: 76, note: '入口仍有持续补给流。' }], logs: ['00:00 流量继续抬升。', '00:00 G25 变为主焦点。', '00:00 会遇频率增加。', '00:00 需准备协同干预。'], strategyHeadline: '交汇区削峰', strategySummary: '压缩交汇区双向会遇窗口，并将入口流量切成更细的放行节拍。', recommendations: [rec('中央交汇船流', '执行交替放行', '减少双向叠加', 'G25 压力回落'), rec('西北入口 C08', '入口队列拆分为两批', '削弱瞬时强度', '拥堵不向交汇传递'), rec('东侧主通道 C03', '维持高通过节奏', '吸收转向流量', '缓解交汇回压'), rec('监测终端 CAM-02', '提升扫描频率', '提高感知灵敏度', '策略执行更稳')], benefits: benefitSet(['0.79', '0.56'], ['39', '31'], ['80', '87'], ['3', '0']), appliedFocus: { current: 38, future: 62 }, appliedSummary: '交汇区会遇窗口被拉开，G25 与 G60 的耦合峰值开始回落。' }),
  buildScene({ id: 'n2', label: '01:00', time: '2020-10-21 01:00', phase: '热点形成', status: '热点聚集', totalFlow: 1582, next1h: 1761, vessels: 17, hotspotCount: 3, focusGrid: 'G60', summary: '东侧主通道进入连续高位区间。', gridValues: { g25: 82, g60: 91, g15: 61 }, alerts: [{ grid: 'G60', level: 'high', current: 91, future: 98, note: '东侧主通道进入高压热点。' }, { grid: 'G25', level: 'high', current: 82, future: 93, note: '中央交汇负荷逼近上限。' }, { grid: 'G15', level: 'medium', current: 61, future: 74, note: '南向出口开始积压。' }], logs: ['01:00 热点形成完成。', '01:00 G60 成为主热区。', '01:00 东向主通道饱和。', '01:00 需进入主动管控。'], strategyHeadline: '主通道疏导', strategySummary: '对东侧主通道执行分批通行，并提前抬升南向出口释放能力。', recommendations: [rec('东侧主通道 C03', '按 2 批次节拍放行', '缓解 G60 堆积', '主热区缩小'), rec('中央交汇 C12', '限制交汇区临界会遇', '避免次级热点放大', '交汇风险下降'), rec('南向出口 C17', '提前提升离港释放率', '承接东侧通道分流', '下游不再回压'), rec('入口引导窗口', '延后补给流进入', '防止新高位叠加', '高压持续时间缩短')], benefits: benefitSet(['0.88', '0.61'], ['42', '32'], ['78', '86'], ['3', '0']), appliedFocus: { current: 44, future: 65 }, appliedSummary: '主通道高压已被切割为多个更短窗口。' }),
  buildScene({ id: 'n3', label: '02:00', time: '2020-10-21 02:00', phase: '高压运行', status: '拥堵临界', totalFlow: 1761, next1h: 1810, vessels: 18, hotspotCount: 4, focusGrid: 'G60', summary: '东侧主通道和中央交汇均维持长时间高负荷。', gridValues: { g25: 86, g60: 95, g15: 73 }, alerts: [{ grid: 'G60', level: 'high', current: 95, future: 100, note: '主通道接近峰值上限。' }, { grid: 'G25', level: 'high', current: 86, future: 94, note: '交汇区继续高压。' }, { grid: 'G15', level: 'medium', current: 73, future: 86, note: '南向出口出现次级高压。' }], logs: ['02:00 进入峰前临界。', '02:00 G60、G25 持续高位。', '02:00 G15 转为次级热点。', '02:00 策略需立即落地。'], strategyHeadline: '峰前协同控压', strategySummary: '同步压缩东侧主通道输入和交汇区会遇，并释放南向出口节奏。', recommendations: [rec('东侧主通道 C03', '执行峰前控压窗口', '避免 G60 突破阈值', '高压时长缩短'), rec('中央交汇船组', '交替放行并拉开车距', '降低会遇密度', '冲突风险下降'), rec('南向出口 C17', '提升释放率 1 个等级', '消化次级热点', 'G15 回到中压'), rec('入口补给流', '暂缓新一批进港', '避免峰值叠加', '全局负荷回落更快')], benefits: benefitSet(['0.93', '0.67'], ['47', '35'], ['76', '85'], ['4', '0']), appliedFocus: { current: 48, future: 69 }, appliedSummary: '主热区与次级热区同步回落，系统从临界状态退出。' }),
  buildScene({ id: 'n4', label: '03:00', time: '2020-10-21 03:00', phase: '峰值到达', status: '协同缓释', totalFlow: 1810, next1h: 1686, vessels: 16, hotspotCount: 2, focusGrid: 'G15', summary: '峰值后，主通道压力开始转移到南向出口。', gridValues: { g25: 70, g60: 79, g15: 84 }, alerts: [{ grid: 'G15', level: 'high', current: 84, future: 90, note: '南向出口成为最后高压节点。' }, { grid: 'G60', level: 'medium', current: 79, future: 72, note: '东侧主通道开始回落。' }, { grid: 'G25', level: 'medium', current: 70, future: 64, note: '中央交汇退出高压。' }], logs: ['03:00 峰值窗口到达。', '03:00 负荷向南向出口转移。', '03:00 主通道开始回落。', '03:00 进入缓释收束。'], strategyHeadline: '出口缓释收束', strategySummary: '以南向出口为最后干预点，保持离港释放与入口控流。', recommendations: [rec('南向出口 C17', '保持高释放 1 个窗口', '尽快卸载尾部积压', '最后热区退场'), rec('东侧主通道 C03', '恢复常态高通过', '配合出口回落', '避免反向回压'), rec('中央交汇 C12', '切回轻量监测模式', '高压已经退出', '资源集中到尾部'), rec('入口控制', '维持节拍放行直至 03:20', '防止尾部反弹', '平稳进入常态')], benefits: benefitSet(['0.81', '0.52'], ['38', '29'], ['84', '90'], ['2', '0']), appliedFocus: { current: 34, future: 55 }, appliedSummary: '尾部出口压力已被有效卸载，夜间场景回到常态监测。' }),
]

const morningPeakScenes: Scene[] = [
  buildScene({ id: 'm0', label: '07:30', time: '2020-10-21 07:30', phase: '早高峰起步', status: '快速升温', totalFlow: 1260, next1h: 1486, vessels: 18, hotspotCount: 2, focusGrid: 'G03', summary: '晨间入口补给流先行抬升。', gridValues: { g25: 48, g60: 69, g15: 41 }, alerts: [{ grid: 'G03', level: 'medium', current: 58, future: 88, note: '西北入口形成连续排队。' }, { grid: 'G60', level: 'medium', current: 69, future: 79, note: '东侧主通道承接晨间流。' }, { grid: 'G25', level: 'watch', current: 48, future: 74, note: '交汇区预计跟随上升。' }], logs: ['07:30 早高峰场景启用。', '07:30 入口补给流增加。', '07:30 G03 首先抬升。', '07:30 交汇区进入预警。'], strategyHeadline: '入口节拍控制', strategySummary: '优先削峰西北入口，同时为交汇区预留通行空间。', recommendations: [rec('西北入口船组', '将入港船拆为 2 批', '降低瞬时到达强度', '入口不再堆积'), rec('中央交汇 C12', '预留单向穿越窗口', '为后续入口流做缓冲', '避免交汇过早升压'), rec('东侧主通道 C03', '保持连续高通过', '承接晨间转向流量', '系统整体更平衡'), rec('港外待进船舶', '提前发出分流提醒', '降低集中到达', '后续峰值更低')], benefits: benefitSet(['0.69', '0.47'], ['32', '24'], ['83', '89'], ['2', '0']), appliedFocus: { current: 35, future: 54 }, appliedSummary: '入口节拍被拉开后，晨间流量抬升曲线明显变缓。' }),
  buildScene({ id: 'm1', label: '08:00', time: '2020-10-21 08:00', phase: '入口放大', status: '繁忙增强', totalFlow: 1486, next1h: 1668, vessels: 21, hotspotCount: 3, focusGrid: 'G25', summary: '高峰流量从入口向交汇传递。', gridValues: { g25: 71, g60: 76, g15: 46 }, alerts: [{ grid: 'G25', level: 'medium', current: 71, future: 94, note: '中央交汇进入主风险区。' }, { grid: 'G03', level: 'medium', current: 67, future: 85, note: '入口补给流维持高位。' }, { grid: 'G60', level: 'medium', current: 76, future: 81, note: '东侧通道同步承压。' }], logs: ['08:00 交汇区抬升明显。', '08:00 入口与交汇形成联动。', '08:00 G25 成为主焦点。', '08:00 需同步做入口和交汇控制。'], strategyHeadline: '交汇区控密', strategySummary: '在入口削峰的同时，对交汇区执行交替放行与会遇压缩。', recommendations: [rec('中央交汇船流', '执行双向交替放行', '减少会遇密度', 'G25 回落到可控区间'), rec('西北入口 C08', '入口补给流按节拍排队', '不再连续推高交汇', '入口与交汇脱耦'), rec('东侧主通道 C03', '维持主通道高通过', '吸收转向流', '避免回压至交汇'), rec('监测终端 CAM-02', '提升扫描频率', '保障策略实时调整', '风险提示更及时')], benefits: benefitSet(['0.82', '0.58'], ['37', '28'], ['80', '87'], ['3', '0']), appliedFocus: { current: 42, future: 60 }, appliedSummary: '入口高位不再直接传导成中央热点。' }),
  buildScene({ id: 'm2', label: '08:30', time: '2020-10-21 08:30', phase: '主通道承压', status: '高位运行', totalFlow: 1668, next1h: 1788, vessels: 23, hotspotCount: 3, focusGrid: 'G60', summary: '东侧主通道开始承受大量分流后的船流。', gridValues: { g25: 79, g60: 92, g15: 55 }, alerts: [{ grid: 'G60', level: 'high', current: 92, future: 98, note: '东侧主通道接近峰值。' }, { grid: 'G25', level: 'high', current: 79, future: 88, note: '中央交汇仍处高位。' }, { grid: 'G15', level: 'medium', current: 55, future: 70, note: '南向出口开始接收溢出流。' }], logs: ['08:30 主通道成为核心压力带。', '08:30 G60 升至峰前高位。', '08:30 G15 开始抬升。', '08:30 需要主通道分批通行。'], strategyHeadline: '主通道削峰', strategySummary: '对东侧主通道实施分批通行，并将一部分离港流提前释放到下游。', recommendations: [rec('东侧主通道 C03', '拆分主通道通行批次', '缓解 G60 连续高压', '主热区范围缩小'), rec('中央交汇 C12', '降低次级会遇密度', '防止交汇高位持续', '交汇强度回落'), rec('南向出口 C17', '提前提升释放率', '承接溢出流量', '下游不再形成新高压'), rec('入口补给流', '临时削减新增船组', '控制总流入强度', '系统峰值更平滑')], benefits: benefitSet(['0.9', '0.63'], ['41', '31'], ['78', '86'], ['3', '0']), appliedFocus: { current: 47, future: 67 }, appliedSummary: '主热区由连续高压切换为可控的批次放行。' }),
  buildScene({ id: 'm3', label: '09:00', time: '2020-10-21 09:00', phase: '峰前临界', status: '拥堵临界', totalFlow: 1788, next1h: 1712, vessels: 22, hotspotCount: 4, focusGrid: 'G60', summary: 'G60 与 G25 同时处于高压边缘。', gridValues: { g25: 84, g60: 95, g15: 69 }, alerts: [{ grid: 'G60', level: 'high', current: 95, future: 97, note: '主通道维持峰前高压。' }, { grid: 'G25', level: 'high', current: 84, future: 91, note: '中央交汇会遇仍高。' }, { grid: 'G15', level: 'medium', current: 69, future: 83, note: '南向出口承接峰尾压力。' }], logs: ['09:00 达到峰前临界。', '09:00 G60 与 G25 高压叠加。', '09:00 G15 形成次级热点。', '09:00 需立即执行协同策略。'], strategyHeadline: '峰前协同控压', strategySummary: '同步压缩主通道、交汇区和出口链路，实现从临界状态的快速回落。', recommendations: [rec('东侧主通道 C03', '执行峰前控压批次', '避免超过主阈值', '主热区快速收缩'), rec('中央交汇船流', '限制双向同窗会遇', '减少高压叠加', '冲突风险下降'), rec('南向出口 C17', '加快离港释放', '卸载尾部压力', '出口热点减弱'), rec('入口排队区', '短时冻结新增入港', '防止再次推高主通道', '峰值更快退出')], benefits: benefitSet(['0.94', '0.69'], ['45', '34'], ['77', '85'], ['4', '0']), appliedFocus: { current: 49, future: 66 }, appliedSummary: '高压叠加链路被打散，系统回退到可控高位。' }),
  buildScene({ id: 'm4', label: '09:30', time: '2020-10-21 09:30', phase: '峰后回落', status: '高位回落', totalFlow: 1712, next1h: 1594, vessels: 19, hotspotCount: 2, focusGrid: 'G15', summary: '高峰尾段开始由主通道向出口回落。', gridValues: { g25: 63, g60: 73, g15: 79 }, alerts: [{ grid: 'G15', level: 'high', current: 79, future: 86, note: '出口仍需短时关注。' }, { grid: 'G60', level: 'medium', current: 73, future: 68, note: '主通道已开始回落。' }, { grid: 'G25', level: 'medium', current: 63, future: 58, note: '交汇区进入高位回落。' }], logs: ['09:30 早高峰开始收束。', '09:30 G15 成为尾部焦点。', '09:30 主通道退出峰值。', '09:30 进入峰后回落阶段。'], strategyHeadline: '尾部出口收束', strategySummary: '以出口为最后干预点，保持离港释放和入口平滑，完成高峰场景收束。', recommendations: [rec('南向出口 C17', '保持高释放 1 个窗口', '尽快卸载尾部压力', '最后热点退场'), rec('东侧主通道 C03', '恢复常态高通过', '配合出口回落', '避免反向回压'), rec('中央交汇 C12', '切换为轻量监测', '高压已退出', '资源集中到尾部场景'), rec('入口排队区', '恢复平滑节拍放行', '防止尾段反弹', '稳定转入常态')], benefits: benefitSet(['0.78', '0.51'], ['34', '26'], ['85', '90'], ['2', '0']), appliedFocus: { current: 32, future: 49 }, appliedSummary: '尾部出口压力已被平稳释放，系统回到晨间常态水平。' }),
]

const entranceCongestionScenes: Scene[] = [
  buildScene({ id: 'e0', label: '10:00', time: '2020-10-21 10:00', phase: '入口堆积', status: '入口承压', totalFlow: 1184, next1h: 1326, vessels: 17, hotspotCount: 2, focusGrid: 'G03', summary: '入口拥堵从西北入口积压开始。', gridValues: { g25: 39, g60: 52, g15: 34 }, alerts: [{ grid: 'G03', level: 'high', current: 72, future: 96, note: '西北入口形成持续排队。' }, { grid: 'G25', level: 'watch', current: 39, future: 71, note: '交汇区存在传导风险。' }, { grid: 'G60', level: 'watch', current: 52, future: 63, note: '主通道暂未进入高压。' }], logs: ['10:00 入口拥堵场景启动。', '10:00 G03 首先进入高压。', '10:00 队列开始向内传导。', '10:00 需先控制入口节拍。'], strategyHeadline: '入口削峰导流', strategySummary: '先切断入口连续到达，再为中央交汇预留足够的消纳空间。', recommendations: [rec('西北入口 C08', '按批次切断连续到达', '降低入口排队长度', '入口压力快速回落'), rec('港外待进船舶', '延迟一批次进港', '避免继续叠压入口', '后续交汇风险下降'), rec('中央交汇 C12', '提前预留穿越窗口', '承接入口导流', '防止高压传递'), rec('监测终端 CAM-04', '加密入口监测频率', '确保排队变化可见', '干预更及时')], benefits: benefitSet(['0.76', '0.5'], ['35', '25'], ['81', '88'], ['2', '0']), appliedFocus: { current: 31, future: 53 }, appliedSummary: '入口削峰后，西北入口排队长度明显缩短。' }),
  buildScene({ id: 'e1', label: '10:20', time: '2020-10-21 10:20', phase: '传导形成', status: '交汇升温', totalFlow: 1326, next1h: 1492, vessels: 18, hotspotCount: 3, focusGrid: 'G25', summary: '入口压力开始传导到中央交汇。', gridValues: { g25: 69, g60: 57, g15: 36 }, alerts: [{ grid: 'G25', level: 'medium', current: 69, future: 92, note: '交汇区开始接收入口积压。' }, { grid: 'G03', level: 'high', current: 81, future: 93, note: '入口仍保持高压。' }, { grid: 'G60', level: 'watch', current: 57, future: 68, note: '主通道开始感受到传导。' }], logs: ['10:20 队列传导形成。', '10:20 G25 进入升温。', '10:20 G03 仍处高位。', '10:20 需同步入口和交汇干预。'], strategyHeadline: '入口与交汇双控', strategySummary: '入口继续削峰，同时在交汇区执行交替放行，防止拥堵向主通道扩散。', recommendations: [rec('中央交汇 C12', '执行交替通行', '减少入口传导后的会遇', '交汇升温减弱'), rec('西北入口船组', '延后最靠后的补给流', '减小持续传导', '入口与交汇脱耦'), rec('东侧主通道 C03', '预留承接窗口', '吸收部分转向流量', '避免全局连锁放大'), rec('南向出口 C17', '维持常态释放', '为后续分流准备余量', '全局更稳定')], benefits: benefitSet(['0.84', '0.59'], ['38', '29'], ['79', '86'], ['3', '0']), appliedFocus: { current: 39, future: 58 }, appliedSummary: '入口与交汇双控后，拥堵传导被截断在交汇区之前。' }),
  buildScene({ id: 'e2', label: '10:40', time: '2020-10-21 10:40', phase: '主链高压', status: '链式放大', totalFlow: 1492, next1h: 1675, vessels: 19, hotspotCount: 3, focusGrid: 'G03', summary: '入口成为高压链路源头，交汇和主通道均出现放大迹象。', gridValues: { g25: 76, g60: 68, g15: 42 }, alerts: [{ grid: 'G03', level: 'high', current: 88, future: 99, note: '入口已经接近链路饱和。' }, { grid: 'G25', level: 'high', current: 76, future: 89, note: '交汇区受入口持续挤压。' }, { grid: 'G60', level: 'medium', current: 68, future: 74, note: '主通道开始形成次级压力。' }], logs: ['10:40 入口链式放大。', '10:40 G03 接近饱和。', '10:40 G25 跟随升压。', '10:40 需立即执行入口优先控制。'], strategyHeadline: '入口优先去耦', strategySummary: '把入口拥堵作为首要控制点，先切断源头，再压低交汇与主通道压力。', recommendations: [rec('西北入口 C08', '进入入口优先控压模式', '切断高压源头', '链式放大被中断'), rec('中央交汇 C12', '只保留单向优先穿越', '避免叠加会遇', 'G25 回到可控区间'), rec('东侧主通道 C03', '维持稳定承接能力', '托底入口分流', '不形成新热点'), rec('港外待进队列', '实施临时等待提示', '控制继续到达', '入口恢复更快')], benefits: benefitSet(['0.89', '0.62'], ['41', '30'], ['77', '85'], ['3', '0']), appliedFocus: { current: 43, future: 61 }, appliedSummary: '源头去耦完成后，入口不再持续推高交汇和主通道。' }),
  buildScene({ id: 'e3', label: '11:00', time: '2020-10-21 11:00', phase: '拥堵峰值', status: '源头高压', totalFlow: 1675, next1h: 1602, vessels: 17, hotspotCount: 4, focusGrid: 'G03', summary: '入口拥堵到达峰值，源头高压仍在。', gridValues: { g25: 83, g60: 71, g15: 47 }, alerts: [{ grid: 'G03', level: 'high', current: 95, future: 100, note: '入口维持源头高压。' }, { grid: 'G25', level: 'high', current: 83, future: 90, note: '交汇区仍受持续挤压。' }, { grid: 'G60', level: 'medium', current: 71, future: 76, note: '主通道处于边缘承压。' }], logs: ['11:00 入口达到峰值。', '11:00 G03 维持最高位。', '11:00 G25 仍处高压。', '11:00 需维持源头控制直到回落。'], strategyHeadline: '入口峰值稳控', strategySummary: '继续保持入口优先控压，并强化交汇的单向放行，直到源头开始回落。', recommendations: [rec('西北入口船流', '持续入口优先控压', '源头高压尚未退出', '避免再次放大'), rec('中央交汇 C12', '保持单向优先策略', '减少高压传导', '交汇负荷不再扩大'), rec('东侧主通道 C03', '维持托底承接', '避免源头高压下沉', '主通道维持中压'), rec('港外待进队列', '继续等待 1 个窗口', '给入口恢复留时间', '队列长度开始下降')], benefits: benefitSet(['0.96', '0.71'], ['46', '34'], ['74', '83'], ['4', '0']), appliedFocus: { current: 50, future: 68 }, appliedSummary: '入口峰值被稳定压住，交汇和主通道没有继续恶化。' }),
  buildScene({ id: 'e4', label: '11:20', time: '2020-10-21 11:20', phase: '出口恢复', status: '压力回落', totalFlow: 1602, next1h: 1470, vessels: 15, hotspotCount: 1, focusGrid: 'G25', summary: '入口源头开始回落，交汇区成为剩余的尾部节点。', gridValues: { g25: 67, g60: 58, g15: 39 }, alerts: [{ grid: 'G25', level: 'medium', current: 67, future: 75, note: '交汇区仍需短时压制。' }, { grid: 'G03', level: 'medium', current: 58, future: 49, note: '入口已明显回落。' }, { grid: 'G60', level: 'watch', current: 58, future: 50, note: '主通道退出边缘承压。' }], logs: ['11:20 源头高压退出。', '11:20 交汇区成为最后尾部。', '11:20 主通道恢复正常。', '11:20 场景进入收束。'], strategyHeadline: '交汇尾部收束', strategySummary: '保持交汇区短时交替放行，完成入口拥堵场景的尾部收束。', recommendations: [rec('中央交汇 C12', '维持短时交替放行', '清除尾部压力', '最后热点退出'), rec('西北入口 C08', '恢复平滑节拍', '入口已进入常态', '不再形成新传导'), rec('东侧主通道 C03', '切回轻量监测', '压力已退出', '保持常态运行'), rec('运行日志', '归档本次入口拥堵处置', '用于后续复盘', '形成闭环经验')], benefits: benefitSet(['0.72', '0.48'], ['33', '25'], ['83', '89'], ['1', '0']), appliedFocus: { current: 30, future: 44 }, appliedSummary: '入口拥堵已完成收束，交汇尾部被短时策略平滑带走。' }),
]

const peakDissipationScenes: Scene[] = [
  buildScene({ id: 'd0', label: '11:30', time: '2020-10-21 11:30', phase: '峰值消散', status: '高位回落', totalFlow: 1742, next1h: 1628, vessels: 16, hotspotCount: 3, focusGrid: 'G25', summary: '峰值消散从中央交汇开始回落。', gridValues: { g25: 86, g60: 72, g15: 62 }, alerts: [{ grid: 'G25', level: 'high', current: 86, future: 76, note: '交汇区开始高位回落。' }, { grid: 'G60', level: 'medium', current: 72, future: 61, note: '主通道热度持续降低。' }, { grid: 'G15', level: 'medium', current: 62, future: 52, note: '出口尾部仍需关注。' }], logs: ['11:30 峰值消散场景启动。', '11:30 G25 由高位向中位回落。', '11:30 多热点同步缩小。', '11:30 可进入收缩型控制。'], strategyHeadline: '收缩型协同控制', strategySummary: '以交汇区为主、主通道和出口为辅，逐步撤出高压控制强度。', recommendations: [rec('中央交汇 C12', '保持交替放行但缩短强度', '平滑退出高压模式', '交汇回落更稳'), rec('东侧主通道 C03', '恢复常态高通过', '配合峰值消散', '主通道热度下降'), rec('南向出口 C17', '继续释放尾部离港流', '消除残余积压', '出口不再形成回压'), rec('策略控制层', '按阶段撤出强控制参数', '避免过度干预', '系统过渡更平顺')], benefits: benefitSet(['0.84', '0.56'], ['34', '26'], ['84', '90'], ['3', '0']), appliedFocus: { current: 38, future: 29 }, appliedSummary: '交汇区已平稳退出高压，场景进入多热点同步消散。' }),
  buildScene({ id: 'd1', label: '11:50', time: '2020-10-21 11:50', phase: '同步回落', status: '中压同步下降', totalFlow: 1628, next1h: 1506, vessels: 14, hotspotCount: 2, focusGrid: 'G60', summary: '主通道和交汇区同步回落。', gridValues: { g25: 67, g60: 74, g15: 58 }, alerts: [{ grid: 'G60', level: 'medium', current: 74, future: 62, note: '主通道是最晚回落节点之一。' }, { grid: 'G25', level: 'medium', current: 67, future: 55, note: '交汇区继续回落。' }, { grid: 'G15', level: 'medium', current: 58, future: 46, note: '出口尾部开始退出。' }], logs: ['11:50 主通道成为主焦点。', '11:50 G25、G60 同步下降。', '11:50 热点数量减少。', '11:50 可进一步下调策略强度。'], strategyHeadline: '主通道温和回落', strategySummary: '以东侧主通道为主观察对象，避免在消散阶段出现二次反弹。', recommendations: [rec('东侧主通道 C03', '维持温和限流 1 个窗口', '防止尾部反弹', 'G60 平稳退出'), rec('中央交汇 C12', '切回轻量交替放行', '减小干预强度', '交汇继续下降'), rec('南向出口 C17', '维持常态释放', '避免尾部积压回流', '出口恢复更顺滑'), rec('监测终端 CAM-01', '保持高频观察', '识别二次升温迹象', '回落更稳妥')], benefits: benefitSet(['0.73', '0.49'], ['31', '23'], ['86', '91'], ['2', '0']), appliedFocus: { current: 34, future: 25 }, appliedSummary: '主通道未出现二次升温，系统顺利转入稳定回落。' }),
  buildScene({ id: 'd2', label: '12:10', time: '2020-10-21 12:10', phase: '尾部消散', status: '热点缩小', totalFlow: 1506, next1h: 1372, vessels: 12, hotspotCount: 1, focusGrid: 'G15', summary: '高压尾部逐渐集中到南向出口。', gridValues: { g25: 51, g60: 56, g15: 63 }, alerts: [{ grid: 'G15', level: 'medium', current: 63, future: 48, note: '南向出口是最后的尾部热点。' }, { grid: 'G60', level: 'watch', current: 56, future: 44, note: '主通道已接近常态。' }, { grid: 'G25', level: 'watch', current: 51, future: 40, note: '交汇区恢复完成。' }], logs: ['12:10 热点集中到出口尾部。', '12:10 其他区域恢复常态。', '12:10 策略进入退场准备。', '12:10 系统风险明显下降。'], strategyHeadline: '尾部平滑退场', strategySummary: '继续跟踪南向出口一个窗口，随后逐步退出高压控制模式。', recommendations: [rec('南向出口 C17', '保持短时离港释放', '平滑卸掉尾部压力', '最后热点缩小'), rec('东侧主通道 C03', '切换为常态观测', '压力已退出', '释放监测资源'), rec('中央交汇 C12', '结束主动干预', '恢复常态放行', '保持系统平顺'), rec('控制层', '准备退出协同模式', '场景已接近结束', '平台回到常态')], benefits: benefitSet(['0.61', '0.4'], ['25', '19'], ['87', '91'], ['1', '0']), appliedFocus: { current: 34, future: 28 }, appliedSummary: '尾部热点已被平滑带走，系统顺利完成常态恢复。' }),
  buildScene({ id: 'd3', label: '12:30', time: '2020-10-21 12:30', phase: '退出控制', status: '监测常态', totalFlow: 1372, next1h: 1288, vessels: 11, hotspotCount: 0, focusGrid: 'G15', summary: '高压场景已结束，平台进入常态监测与轻量预测阶段。', gridValues: { g25: 44, g60: 48, g15: 33 }, alerts: [{ grid: 'G15', level: 'watch', current: 33, future: 28, note: '出口保持稳定常态。' }, { grid: 'G60', level: 'watch', current: 48, future: 38, note: '主通道完全退出高位。' }, { grid: 'G25', level: 'watch', current: 44, future: 35, note: '交汇区维持常态监测。' }], logs: ['12:30 高压场景进入收尾。', '12:30 所有高压热点已退出。', '12:30 仅保留常态监测与预测。', '12:30 本轮高压闭环完成。'], strategyHeadline: '退出临时协同策略', strategySummary: '系统已回归常态，只需保留基础监测和短窗预测能力。', recommendations: [rec('全局策略控制', '退出临时控峰模式', '高压场景已结束', '控制流程恢复常态'), rec('主航道监测', '切回轻量监测节奏', '热点已消散', '计算资源回收'), rec('预测模块', '保留 1h 常态预测', '维持基础预警能力', '常态风险仍可感知'), rec('运行日志', '归档本轮策略结果', '支撑后续复盘', '形成闭环记录')], benefits: benefitSet(['0.48', '0.34'], ['21', '17'], ['89', '92'], ['0', '0']), appliedFocus: { current: 24, future: 21 }, appliedSummary: '系统已退出高压控制模式，恢复到常态监测与预测状态。' }),
  buildScene({ id: 'd4', label: '12:50', time: '2020-10-21 12:50', phase: '常态巡航', status: '系统平稳', totalFlow: 1288, next1h: 1186, vessels: 10, hotspotCount: 0, focusGrid: 'G25', summary: '港口交通回到平稳巡航与常态预测水平。', gridValues: { g25: 36, g60: 39, g15: 28 }, alerts: [{ grid: 'G25', level: 'watch', current: 36, future: 29, note: '交汇区保持常态巡航。' }, { grid: 'G60', level: 'watch', current: 39, future: 33, note: '主通道恢复稳定。' }, { grid: 'G15', level: 'watch', current: 28, future: 24, note: '出口尾部已完全消散。' }], logs: ['12:50 系统进入常态巡航。', '12:50 所有热点已清零。', '12:50 策略模块仅保留待命。', '12:50 峰值消散场景结束。'], strategyHeadline: '保持常态策略待命', strategySummary: '当前无需执行强干预，仅保持预测、监测和策略待命能力。', recommendations: [rec('监测层', '保持常态巡航监测', '交通已平稳', '无需额外干预'), rec('预测层', '继续滚动 1h 短窗预测', '保持基础预警', '便于下一轮快速响应'), rec('策略层', '切换为待命模式', '当前无高压风险', '平台保持响应准备'), rec('数据归档', '沉淀本轮场景日志', '支撑论文展示与复盘', '形成完整链路说明')], benefits: benefitSet(['0.42', '0.31'], ['18', '15'], ['91', '93'], ['0', '0']), appliedFocus: { current: 20, future: 16 }, appliedSummary: '系统保持常态巡航，策略层进入待命状态。' }),
]

export const scenarioPacks: ScenarioPack[] = [
  { id: 'night-navigation', name: '夜间通航场景', shortLabel: '夜间通航', description: '低照度条件下的连续通航与热点抬升演示。', timeSlices: nightNavigationScenes, baseRouteCounts: { C16: 3, C12: 2, C08: 4, C03: 4, C14: 3, C17: 4 }, baseAutoplayMs: 3000, hotspotSeries: { G03: [0.28, 0.46, 0.58, 0.44, 1], G25: [0.25, 0.35, 0.8, 1, 0.72], G60: [0.58, 0.72, 0.74, 0.71, 0.75], G15: [0.36, 0.3, 0.55, 0.76, 0.78] } },
  { id: 'morning-peak', name: '早高峰场景', shortLabel: '早高峰', description: '入口、交汇与东向主通道同步增压的早高峰演示。', timeSlices: morningPeakScenes, baseRouteCounts: { C16: 4, C12: 3, C08: 5, C03: 6, C14: 4, C17: 5 }, baseAutoplayMs: 2600, hotspotSeries: { G03: [0.32, 0.58, 0.72, 0.76, 0.61], G25: [0.28, 0.42, 0.72, 0.88, 0.79], G60: [0.58, 0.74, 0.86, 0.83, 0.72], G15: [0.22, 0.31, 0.44, 0.56, 0.62] } },
  { id: 'entrance-congestion', name: '入口拥堵场景', shortLabel: '入口拥堵', description: '以西北入口积压为起点的链式拥堵演示。', timeSlices: entranceCongestionScenes, baseRouteCounts: { C16: 5, C12: 3, C08: 5, C03: 3, C14: 4, C17: 3 }, baseAutoplayMs: 3200, hotspotSeries: { G03: [0.62, 0.81, 0.88, 0.95, 0.84], G25: [0.35, 0.48, 0.77, 0.83, 0.68], G60: [0.28, 0.42, 0.58, 0.63, 0.54], G15: [0.18, 0.24, 0.38, 0.46, 0.34] } },
  { id: 'peak-dissipation', name: '峰值消散场景', shortLabel: '峰值消散', description: '高位流量逐步退出、热点范围持续收缩的演示。', timeSlices: peakDissipationScenes, baseRouteCounts: { C16: 3, C12: 2, C08: 3, C03: 3, C14: 2, C17: 4 }, baseAutoplayMs: 3600, hotspotSeries: { G03: [0.31, 0.26, 0.2, 0.16, 0.12], G25: [0.81, 0.68, 0.55, 0.42, 0.3], G60: [0.62, 0.58, 0.61, 0.49, 0.31], G15: [0.52, 0.44, 0.35, 0.24, 0.18] } },
]

export const modelBenchmarkMatrix: Record<HorizonKey, Record<ModelName, BenchmarkEntry>> = {
  '1h': {
    STGCN: { mae: 3.434, rmse: 4.667, r2: 0.85, summary: '1h 窗口下 STGCN 综合误差最低。' },
    LSTM: { mae: 4.118, rmse: 5.561, r2: 0.789, summary: 'LSTM 在 1h 下可提供稳定预测，但误差更高。' },
    BiLSTM: { mae: 3.892, rmse: 5.208, r2: 0.814, summary: 'BiLSTM 在 1h 下优于传统 LSTM，但仍逊于 STGCN。' },
  },
  '2h': {
    STGCN: { mae: 3.871, rmse: 5.299, r2: 0.807, summary: '2h 窗口下 STGCN 仍保持最佳综合精度。' },
    LSTM: { mae: 4.426, rmse: 5.936, r2: 0.752, summary: 'LSTM 在 2h 下误差扩大，趋势跟踪能力较弱。' },
    BiLSTM: { mae: 4.135, rmse: 5.684, r2: 0.776, summary: 'BiLSTM 在 2h 窗口中保持次优。' },
  },
  '3h': {
    STGCN: { mae: 4.216, rmse: 5.742, r2: 0.781, summary: '3h 窗口下 STGCN 依然表现最优。' },
    LSTM: { mae: 4.812, rmse: 6.241, r2: 0.731, summary: 'LSTM 在长窗口下误差进一步增大。' },
    BiLSTM: { mae: 4.468, rmse: 5.986, r2: 0.756, summary: 'BiLSTM 在 3h 下仍有一定优势，但稳定性不及 STGCN。' },
  },
}
