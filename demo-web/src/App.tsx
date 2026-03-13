import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type AlertLevel = 'high' | 'medium' | 'watch'

type Recommendation = {
  target: string
  action: string
  reason: string
  effect: string
}

type BenefitMetric = {
  label: string
  before: string
  after: string
  unit?: string
}

type Scene = {
  id: string
  label: string
  time: string
  phase: string
  status: string
  totalFlow: number
  next1h: number
  vessels: number
  hotspotCount: number
  focusGrid: string
  summary: string
  gridValues: {
    g25: number
    g60: number
    g15: number
  }
  alerts: {
    grid: string
    level: AlertLevel
    current: number
    future: number
    note: string
  }[]
  logs: string[]
  strategyHeadline: string
  strategySummary: string
  recommendations: Recommendation[]
  benefits: BenefitMetric[]
  appliedFocus: {
    current: number
    future: number
  }
  appliedSummary: string
  appliedHotspotScale?: number
  appliedStatus?: string
}

type RouteLine = {
  id: string
  d: string
  x: string
  y: string
  markers: {
    id: string
    dur: number
    begin: number
    radius: number
  }[]
}

type MapTag = {
  id: string
  label: string
  x: string
  y: string
  focusGrid?: string
}

type Hotspot = {
  id: string
  x: number
  y: number
  intensities: number[]
}

type GeoPoint = {
  lon: number
  lat: number
}

type HeaderBlock = {
  label: string
  value: string
  note: string
}

type FeedView = {
  title: string
  tag: string
  area: string
  route: string
  grid: string
  position: string
  subtitle: string
}

type RouteBlueprint = {
  id: string
  labelPoint: GeoPoint
  points: GeoPoint[]
  markers: {
    id: string
    dur: number
    begin: number
    radius: number
  }[]
}

const STUDY_BOUNDS = {
  minLon: 113.558356434,
  maxLon: 113.95835643400001,
  minLat: 22.155739805,
  maxLat: 22.635739805,
}

const MAP_VIEWBOX = {
  width: 1920,
  height: 1080,
}

function geoToPercent(point: GeoPoint) {
  const x = ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * 100
  const y = ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * 100

  return {
    x: `${x.toFixed(1)}%`,
    y: `${y.toFixed(1)}%`,
  }
}

function geoToNumericPercent(point: GeoPoint) {
  const position = geoToPercent(point)

  return {
    x: Number.parseFloat(position.x),
    y: Number.parseFloat(position.y),
  }
}

function geoToSvg(point: GeoPoint) {
  return {
    x: ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * MAP_VIEWBOX.width,
    y: ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * MAP_VIEWBOX.height,
  }
}

function lineMetrics(a: { x: number; y: number }, b: { x: number; y: number }) {
  const lengthX = b.x - a.x
  const lengthY = b.y - a.y

  return {
    length: Math.sqrt(lengthX ** 2 + lengthY ** 2),
    angle: Math.atan2(lengthY, lengthX),
  }
}

function controlPoint(current: { x: number; y: number }, previous?: { x: number; y: number }, next?: { x: number; y: number }, reverse = false) {
  const p = previous ?? current
  const n = next ?? current
  const smoothing = 0.16
  const { length, angle } = lineMetrics(p, n)
  const adjustedAngle = angle + (reverse ? Math.PI : 0)
  const controlLength = length * smoothing

  return {
    x: current.x + Math.cos(adjustedAngle) * controlLength,
    y: current.y + Math.sin(adjustedAngle) * controlLength,
  }
}

function createSmoothPath(points: GeoPoint[]) {
  const svgPoints = points.map(geoToSvg)

  return svgPoints.reduce((path, point, index, array) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    }

    const previous = array[index - 1]
    const previousPrevious = array[index - 2]
    const next = array[index + 1]
    const startControl = controlPoint(previous, previousPrevious, point)
    const endControl = controlPoint(point, previous, next, true)

    return `${path} C ${startControl.x.toFixed(1)} ${startControl.y.toFixed(1)} ${endControl.x.toFixed(1)} ${endControl.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }, '')
}

function createMarkers(baseDur: number, count: number, radius: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    dur: Number((baseDur + index * 1.15).toFixed(1)),
    begin: Number((-(baseDur / Math.max(count, 1)) * index).toFixed(1)),
    radius: Number((radius - (index % 2) * 0.4).toFixed(1)),
  }))
}

const scenes: Scene[] = [
  {
    id: 't0',
    label: '23:00',
    time: '2020-10-20 23:00',
    phase: '初始态势',
    status: '平稳抬升',
    totalFlow: 1099,
    next1h: 1352,
    vessels: 14,
    hotspotCount: 2,
    focusGrid: 'G03',
    summary: '夜间进出港通道整体顺畅，但中部交汇带已出现持续抬升迹象。',
    gridValues: {
      g25: 43,
      g60: 64,
      g15: 49,
    },
    alerts: [
      { grid: 'G03', level: 'watch', current: 43, future: 91, note: '西北入口网格处于预热阶段。' },
      { grid: 'G60', level: 'medium', current: 64, future: 70, note: '东侧通道维持高位。' },
      { grid: 'G25', level: 'watch', current: 43, future: 82, note: '中部交汇即将抬升。' },
    ],
    logs: [
      '23:00 系统加载珠江口主航路骨架。',
      '23:00 G03 网格热度进入监视状态。',
      '23:00 东侧主通道保持持续高位。',
      '23:00 当前无明显峰值冲击信号。',
    ],
    strategyHeadline: '西北入口预分流',
    strategySummary: '西北入口将在下一窗口继续抬升，建议提前分批放行，避免入口流与中央交汇流同步叠加。',
    recommendations: [
      { target: '西北入口进港船组', action: '延后 1 个 10 分钟窗口进港', reason: '避开中部交汇预热段', effect: '入口峰值提前削减' },
      { target: '中央交汇带 C12', action: '限制双向同时会遇', reason: '减轻 G25 交汇压力', effect: '冲突风险指数下降' },
      { target: '南向离港线 C17', action: '优先释放离港船舶', reason: '为空间交汇腾挪通行带', effect: '主航道通过效率提升' },
      { target: '东侧主通道 C03', action: '保持 1 个窗口的单向高通过', reason: '承接入口分流后的侧向通行需求', effect: '全局流量分配更均衡' },
    ],
    benefits: [
      { label: '冲突风险指数', before: '0.71', after: '0.49' },
      { label: '平均等待时间', before: '36', after: '28', unit: 'min' },
      { label: '主航道通行效率', before: '82', after: '89', unit: '%' },
      { label: '高压热点网格', before: '2', after: '0' },
    ],
    appliedFocus: {
      current: 29,
      future: 57,
    },
    appliedSummary: '协同策略已应用：入口侧进港节奏被拉开，西北入口与中部交汇的压力耦合明显减弱。',
    appliedHotspotScale: 0.62,
    appliedStatus: '协同已应用',
  },
  {
    id: 't1',
    label: '00:00',
    time: '2020-10-21 00:00',
    phase: '流量抬升',
    status: '流量上升',
    totalFlow: 1352,
    next1h: 1582,
    vessels: 16,
    hotspotCount: 3,
    focusGrid: 'G25',
    summary: '总流量跨过 1300，G25 开始成为最值得关注的交汇网格。',
    gridValues: {
      g25: 45,
      g60: 70,
      g15: 44,
    },
    alerts: [
      { grid: 'G25', level: 'high', current: 45, future: 93, note: '未来 2 小时内增幅最明显。' },
      { grid: 'G60', level: 'medium', current: 70, future: 71, note: '东向主通道维持高负荷。' },
      { grid: 'G15', level: 'watch', current: 44, future: 66, note: '南向通道进入抬升段。' },
    ],
    logs: [
      '00:00 研究区总流量升至 1352。',
      '00:00 G25 被识别为当前焦点网格。',
      '00:00 G25 两小时后参考值提升至 93。',
      '00:00 预测模块进入持续跟踪状态。',
    ],
    strategyHeadline: '中部交汇消峰',
    strategySummary: 'G25 成为主焦点后，优先通过分批放行与入口后移控制交汇压力，避免中央会遇进一步堆积。',
    recommendations: [
      { target: '中央交汇区 G25', action: '分批释放进港船组', reason: '削减瞬时交汇密度', effect: '中央交汇峰值后移' },
      { target: '西北入口 G03', action: '后移进港 8 分钟', reason: '为中央会遇留出消峰带', effect: '入口抬升速度下降' },
      { target: '东侧主通道 C03', action: '优先保持单向高通过', reason: '减少横向冲突干扰', effect: '东侧主通道维持稳定' },
      { target: '南向离港线 C17', action: '提前释放离港船组 1 批次', reason: '压缩中部水域持续占用时间', effect: '交汇区恢复速度提升' },
    ],
    benefits: [
      { label: '冲突风险指数', before: '0.83', after: '0.56' },
      { label: '平均等待时间', before: '39', after: '30', unit: 'min' },
      { label: '主航道通行效率', before: '80', after: '88', unit: '%' },
      { label: '高压热点网格', before: '3', after: '0' },
    ],
    appliedFocus: {
      current: 31,
      future: 68,
    },
    appliedSummary: '协同策略已应用：中央交汇区改为分批通行，G25 热度被压回可控区间，东侧主通道保持稳定高通过。',
    appliedHotspotScale: 0.64,
    appliedStatus: '协同已应用',
  },
  {
    id: 't2',
    label: '01:00',
    time: '2020-10-21 01:00',
    phase: '热点形成',
    status: '快速攀升',
    totalFlow: 1582,
    next1h: 1761,
    vessels: 17,
    hotspotCount: 4,
    focusGrid: 'G25',
    summary: '系统进入本轮流量放大期，交汇区与东侧通道同时增压。',
    gridValues: {
      g25: 82,
      g60: 71,
      g15: 58,
    },
    alerts: [
      { grid: 'G25', level: 'high', current: 82, future: 93, note: '接近本轮峰值，交汇区承压明显。' },
      { grid: 'G60', level: 'high', current: 71, future: 70, note: '东侧通道保持连续高位。' },
      { grid: 'G15', level: 'medium', current: 58, future: 67, note: '南向主线继续上升。' },
      { grid: 'G03', level: 'watch', current: 72, future: 100, note: '入口网格二次被拉高。' },
    ],
    logs: [
      '01:00 总流量进入放大区间。',
      '01:00 G25 与 G60 同时进入高负荷区。',
      '01:00 南向主线热度提升，联动增强。',
      '01:00 热点传播呈现空间扩散趋势。',
    ],
    strategyHeadline: '双通道分批放行',
    strategySummary: '流量进入放大期后，重点控制 G25 与 G60 的同步增压，通过双通道分批放行维持主航路秩序。',
    recommendations: [
      { target: '东侧主通道 G60', action: '限制连续进港密度', reason: '避免与 G25 同时到峰', effect: '双核心热点不再同步抬升' },
      { target: '中央交汇区 G25', action: '增加 1 个缓冲窗口', reason: '为跨向会遇留出安全距离', effect: '中央交汇峰值削减' },
      { target: '南向离港线 C17', action: '优先疏散离港序列', reason: '释放中部水域占用', effect: '高压运行时段缩短' },
      { target: '西北入口 G03', action: '启动入口预分流', reason: '避免入口流再次推高中央交汇带', effect: '热点扩散范围被截断' },
    ],
    benefits: [
      { label: '冲突风险指数', before: '0.92', after: '0.61' },
      { label: '平均等待时间', before: '44', after: '32', unit: 'min' },
      { label: '主航道通行效率', before: '77', after: '87', unit: '%' },
      { label: '高压热点网格', before: '4', after: '0' },
    ],
    appliedFocus: {
      current: 54,
      future: 66,
    },
    appliedSummary: '协同策略已应用：东侧主通道与中央交汇区被拆峰运行，双核心热点结构明显收缩。',
    appliedHotspotScale: 0.58,
    appliedStatus: '协同已应用',
  },
  {
    id: 't3',
    label: '02:00',
    time: '2020-10-21 02:00',
    phase: '高压运行',
    status: '高压运行',
    totalFlow: 1761,
    next1h: 1810,
    vessels: 18,
    hotspotCount: 4,
    focusGrid: 'G25',
    summary: '研究区域逼近峰值，G25 与 G60 形成双核心热点。',
    gridValues: {
      g25: 93,
      g60: 69,
      g15: 66,
    },
    alerts: [
      { grid: 'G25', level: 'high', current: 93, future: 75, note: '本轮峰值出现，中央交汇最繁忙。' },
      { grid: 'G60', level: 'high', current: 69, future: 70, note: '东向通道处于持续高位。' },
      { grid: 'G15', level: 'medium', current: 66, future: 67, note: '南向通道稳定高流量。' },
      { grid: 'G03', level: 'watch', current: 60, future: 100, note: '入口网格仍需重点观察。' },
    ],
    logs: [
      '02:00 总流量升至 1761。',
      '02:00 G25 达到本轮最高负荷区间。',
      '02:00 G60 保持稳定高位，未见明显回落。',
      '02:00 系统标记双核心热点结构。',
    ],
    strategyHeadline: '高压时段协同控峰',
    strategySummary: '在高压运行阶段，通过入口削峰、交汇消峰和离港优先三项动作，压缩 G25 与 G60 的持续高位时间。',
    recommendations: [
      { target: '中央交汇区 G25', action: '执行双窗口交替放行', reason: '降低双向会遇重叠', effect: '高峰维持时长缩短' },
      { target: '西北入口船组', action: '延后进港并分散编队', reason: '减轻交汇区持续输入', effect: '入口冲击回落' },
      { target: '离港船舶序列', action: '提升离港优先级', reason: '释放交汇带通行空间', effect: '主航道效率回升' },
      { target: '东侧主通道 C03', action: '维持侧向单向高通过', reason: '分担交汇区与入口的外溢压力', effect: '双核心热点同步降温' },
    ],
    benefits: [
      { label: '冲突风险指数', before: '0.96', after: '0.64' },
      { label: '平均等待时间', before: '48', after: '35', unit: 'min' },
      { label: '主航道通行效率', before: '74', after: '85', unit: '%' },
      { label: '高压热点网格', before: '4', after: '0' },
    ],
    appliedFocus: {
      current: 59,
      future: 63,
    },
    appliedSummary: '协同策略已应用：高压时段被拆分为可控窗口，G25 与 G60 的高位重叠显著减弱。',
    appliedHotspotScale: 0.56,
    appliedStatus: '协同已应用',
  },
  {
    id: 't4',
    label: '03:00',
    time: '2020-10-21 03:00',
    phase: '峰值到达',
    status: '峰值时刻',
    totalFlow: 1810,
    next1h: 1539,
    vessels: 18,
    hotspotCount: 3,
    focusGrid: 'G03',
    summary: '总流量达到当前演示时段峰值，西北入口与中部交汇成为双重点。',
    gridValues: {
      g25: 75,
      g60: 70,
      g15: 67,
    },
    alerts: [
      { grid: 'G03', level: 'high', current: 100, future: 81, note: '入口网格达到本轮最高值。' },
      { grid: 'G25', level: 'high', current: 75, future: 81, note: '交汇区仍处于高位运行。' },
      { grid: 'G60', level: 'medium', current: 70, future: 55, note: '东向通道将缓慢回落。' },
    ],
    logs: [
      '03:00 当前演示场景达到总流量峰值。',
      '03:00 G03 成为入口侧最高负荷点。',
      '03:00 G25 仍维持交汇区高压状态。',
      '03:00 后续 1 小时预测开始出现回落信号。',
    ],
    strategyHeadline: '入口与交汇双点缓释',
    strategySummary: '峰值阶段的关键在于同时压低 G03 与 G25，两点缓释后可避免入口回压再次传导到中部交汇。',
    recommendations: [
      { target: '西北入口 G03', action: '执行临时分批进港', reason: '抑制入口瞬时峰值', effect: '入口高压快速回落' },
      { target: '中央交汇区 G25', action: '维持交替通过策略', reason: '防止入口回压继续传导', effect: '交汇区稳定降温' },
      { target: '东侧主通道 C03', action: '保持单向高通过运行', reason: '提供侧向分流能力', effect: '整体通行效率提升' },
      { target: '南向离港线 C17', action: '提前释放尾部离港船列', reason: '减少峰值末段的水域占用', effect: '峰值回落更快完成' },
    ],
    benefits: [
      { label: '冲突风险指数', before: '0.94', after: '0.66' },
      { label: '平均等待时间', before: '46', after: '34', unit: 'min' },
      { label: '主航道通行效率', before: '76', after: '84', unit: '%' },
      { label: '高压热点网格', before: '3', after: '0' },
    ],
    appliedFocus: {
      current: 62,
      future: 54,
    },
    appliedSummary: '协同策略已应用：入口与交汇的双重点被同步缓释，峰值时段从连续高压转为可控回落。',
    appliedHotspotScale: 0.6,
    appliedStatus: '协同已应用',
  },
]

const routeBlueprints: RouteBlueprint[] = [
  {
    id: 'C16',
    labelPoint: { lon: 113.732197, lat: 22.563841 },
    points: [
      { lon: 113.722991, lat: 22.549134 },
      { lon: 113.750066, lat: 22.461374 },
      { lon: 113.766437, lat: 22.3266 },
      { lon: 113.773153, lat: 22.210184 },
      { lon: 113.773573, lat: 22.158244 },
    ],
    markers: createMarkers(10.2, 3, 4.6),
  },
  {
    id: 'C12',
    labelPoint: { lon: 113.786404, lat: 22.514937 },
    points: [
      { lon: 113.716904, lat: 22.556298 },
      { lon: 113.733815, lat: 22.536225 },
      { lon: 113.749226, lat: 22.520926 },
      { lon: 113.7614, lat: 22.511971 },
      { lon: 113.772104, lat: 22.501672 },
    ],
    markers: createMarkers(9.4, 2, 4.2),
  },
  {
    id: 'C08',
    labelPoint: { lon: 113.71305, lat: 22.537376 },
    points: [
      { lon: 113.727189, lat: 22.545552 },
      { lon: 113.739572, lat: 22.518239 },
      { lon: 113.749436, lat: 22.47615 },
      { lon: 113.756363, lat: 22.420181 },
      { lon: 113.763499, lat: 22.358391 },
      { lon: 113.789314, lat: 22.190035 },
      { lon: 113.796241, lat: 22.158244 },
    ],
    markers: createMarkers(11.6, 4, 4.8),
  },
  {
    id: 'C03',
    labelPoint: { lon: 113.795033, lat: 22.483294 },
    points: [
      { lon: 113.766017, lat: 22.529433 },
      { lon: 113.768326, lat: 22.51018 },
      { lon: 113.77861, lat: 22.463165 },
      { lon: 113.788475, lat: 22.427345 },
      { lon: 113.798549, lat: 22.390181 },
      { lon: 113.805895, lat: 22.330182 },
      { lon: 113.824159, lat: 22.275598 },
    ],
    markers: createMarkers(8.4, 4, 4.6),
  },
  {
    id: 'C14',
    labelPoint: { lon: 113.702262, lat: 22.191024 },
    points: [
      { lon: 113.704311, lat: 22.157797 },
      { lon: 113.717324, lat: 22.192274 },
      { lon: 113.72383, lat: 22.238393 },
      { lon: 113.733065, lat: 22.287198 },
      { lon: 113.719003, lat: 22.340033 },
      { lon: 113.747128, lat: 22.426002 },
      { lon: 113.770425, lat: 22.499881 },
    ],
    markers: createMarkers(11, 3, 4.4),
  },
  {
    id: 'C17',
    labelPoint: { lon: 113.842228, lat: 22.309543 },
    points: [
      { lon: 113.704941, lat: 22.156453 },
      { lon: 113.720682, lat: 22.204363 },
      { lon: 113.733695, lat: 22.277347 },
      { lon: 113.751745, lat: 22.295257 },
      { lon: 113.786796, lat: 22.275108 },
      { lon: 113.825205, lat: 22.275108 },
    ],
    markers: createMarkers(9.8, 4, 4.3),
  },
]

const routeLines: RouteLine[] = routeBlueprints.map((route) => {
  const labelPosition = geoToPercent(route.labelPoint)

  return {
    id: route.id,
    d: createSmoothPath(route.points),
    x: labelPosition.x,
    y: labelPosition.y,
    markers: route.markers,
  }
})

const mapTags: MapTag[] = [
  { id: 'M01', label: 'Northwest Entry', focusGrid: 'G03', ...geoToPercent({ lon: 113.7368, lat: 22.5416 }) },
  { id: 'M02', label: 'North Split', ...geoToPercent({ lon: 113.7482, lat: 22.5228 }) },
  { id: 'M03', label: 'Central Junction', focusGrid: 'G25', ...geoToPercent({ lon: 113.7584, lat: 22.5064 }) },
  { id: 'M04', label: 'East Main Channel', focusGrid: 'G60', ...geoToPercent({ lon: 113.8015, lat: 22.3625 }) },
  { id: 'M05', label: 'Southbound Exit', focusGrid: 'G15', ...geoToPercent({ lon: 113.7698, lat: 22.2868 }) },
]

const hotspots: Hotspot[] = [
  { id: 'G03', ...geoToNumericPercent({ lon: 113.769683, lat: 22.498253 }), intensities: [0.28, 0.46, 0.58, 0.44, 1] },
  { id: 'G25', ...geoToNumericPercent({ lon: 113.733276, lat: 22.281927 }), intensities: [0.25, 0.35, 0.8, 1, 0.72] },
  { id: 'G60', ...geoToNumericPercent({ lon: 113.77211, lat: 22.284228 }), intensities: [0.58, 0.72, 0.74, 0.71, 0.75] },
  { id: 'G15', ...geoToNumericPercent({ lon: 113.753232, lat: 22.444747 }), intensities: [0.36, 0.3, 0.55, 0.76, 0.78] },
]

const feedViews: FeedView[] = [
  {
    title: '东侧主通道',
    tag: 'CAM-01',
    area: 'M04',
    route: 'C03',
    grid: 'G60',
    position: '63% 44%',
    subtitle: '对应东侧主通道持续高位监测窗口',
  },
  {
    title: '中部交汇区',
    tag: 'CAM-02',
    area: 'M03',
    route: 'C12',
    grid: 'G25',
    position: '52% 30%',
    subtitle: '对应中央交汇热点与双向会遇窗口',
  },
  {
    title: '南向离港线',
    tag: 'CAM-03',
    area: 'M05',
    route: 'C17',
    grid: 'G15',
    position: '55% 66%',
    subtitle: '对应南向离港通道抬升监测窗口',
  },
  {
    title: '西北入口线',
    tag: 'CAM-04',
    area: 'M01',
    route: 'C08',
    grid: 'G03',
    position: '44% 24%',
    subtitle: '对应西北入口高压进港监测窗口',
  },
]

const totalFlowSeries = scenes.map((scene) => scene.totalFlow)
const CHART_WIDTH = 560
const CHART_HEIGHT = 248
const CHART_PAD_X = 22
const CHART_PAD_Y = 18

function createLinePath(values: number[], min: number, max: number) {
  const step = (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1)

  return values
    .map((value, index) => {
      const x = CHART_PAD_X + step * index
      const ratio = (value - min) / (max - min)
      const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function createAreaPath(values: number[], min: number, max: number) {
  const step = (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1)
  const points = values.map((value, index) => {
    const x = CHART_PAD_X + step * index
    const ratio = (value - min) / (max - min)
    const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })

  return `M ${CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} L ${points.join(' L ')} L ${CHART_WIDTH - CHART_PAD_X} ${CHART_HEIGHT - CHART_PAD_Y} Z`
}

function metricNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function levelText(level: AlertLevel) {
  if (level === 'high') return '高'
  if (level === 'medium') return '中'
  return '监视'
}

function feedRiskText(level: AlertLevel) {
  if (level === 'high') return '高风险'
  if (level === 'medium') return '中风险'
  return '监视'
}

function App() {
  const [sceneIndex, setSceneIndex] = useState(1)
  const [autoplay, setAutoplay] = useState(true)
  const [planApplied, setPlanApplied] = useState(false)

  useEffect(() => {
    if (!autoplay) return

    const timer = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % scenes.length)
    }, 3600)

    return () => window.clearInterval(timer)
  }, [autoplay])

  const scene = scenes[sceneIndex]
  const flowMin = Math.min(...totalFlowSeries) - 80
  const flowMax = Math.max(...totalFlowSeries) + 80
  const flowPath = createLinePath(totalFlowSeries, flowMin, flowMax)
  const flowArea = createAreaPath(totalFlowSeries, flowMin, flowMax)
  const focusRoute =
    scene.focusGrid === 'G03' ? 'C08' : scene.focusGrid === 'G60' ? 'C03' : scene.focusGrid === 'G15' ? 'C17' : 'C12'
  const focusFeed = feedViews.find((feed) => feed.grid === scene.focusGrid) ?? feedViews[0]
  const sceneDate = scene.time.slice(0, 10)
  const sceneClock = scene.time.slice(11)
  const displayedStatus = planApplied ? scene.appliedStatus ?? '协同已应用' : scene.status
  const displayedAlerts = scene.alerts.map((alert) => {
    if (!planApplied) return alert

    const isFocus = alert.grid === scene.focusGrid
    const current = isFocus ? scene.appliedFocus.current : Math.max(Math.round(alert.current * 0.74), 18)
    const future = isFocus ? scene.appliedFocus.future : Math.max(Math.round(alert.future * 0.78), 24)
    const level: AlertLevel = future >= 78 ? 'high' : future >= 58 ? 'medium' : 'watch'

    return {
      ...alert,
      current,
      future,
      level,
      note: isFocus ? `${scene.strategyHeadline}已执行，当前压力回落。` : '协同放行后，局部热度已出现下降。',
    }
  })
  const focusAlert = displayedAlerts.find((alert) => alert.grid === scene.focusGrid) ?? displayedAlerts[0]
  const hotspotScale = planApplied ? 0.01 : 1
  const displayedHotspotCount = planApplied ? 0 : scene.hotspotCount

  function handleApplyPlan() {
    setPlanApplied(true)
    setAutoplay(false)
  }

  function handleAutoplayToggle() {
    if (autoplay) {
      setAutoplay(false)
      return
    }

    setPlanApplied(false)
    setAutoplay(true)
  }

  function handleSceneSelect(index: number) {
    setSceneIndex(index)
    setPlanApplied(false)
    setAutoplay(false)
  }

  const headerLeftBlocks: HeaderBlock[] = [
    { label: '系统状态', value: 'ONLINE', note: 'AIS / GRID / STGCN' },
    {
      label: '场景序列',
      value: `SCN-${String(sceneIndex + 1).padStart(2, '0')}`,
      note: `${scene.vessels} 船 / ${displayedHotspotCount} 热点`,
    },
    { label: '焦点航路', value: focusRoute, note: `焦点网格 ${scene.focusGrid}` },
  ]

  const headerRightBlocks: HeaderBlock[] = [
    { label: '当前时刻', value: sceneClock, note: sceneDate },
    { label: '运行阶段', value: scene.phase, note: displayedStatus },
    { label: '地图模式', value: '聚类 / 网格', note: '静态场景回放' },
  ]

  const dialCards = useMemo(
    () => [
      { label: '当前流量', value: scene.totalFlow, percent: Math.min(scene.totalFlow / 2000, 1) },
      { label: '1H 预测', value: scene.next1h, percent: Math.min(scene.next1h / 2000, 1) },
      { label: '热点网格', value: displayedHotspotCount, percent: Math.min(displayedHotspotCount / 5, 1) },
      { label: '展示船舶', value: scene.vessels, percent: Math.min(scene.vessels / 20, 1) },
    ],
    [displayedHotspotCount, scene.next1h, scene.totalFlow, scene.vessels],
  )

  return (
    <main className="platform">
      <header className="header-bar frame">
        <div className="header-side header-side-left">
          <div className="header-side-label">PORT CONTROL</div>
          <div className="header-block-grid">
            {headerLeftBlocks.map((block) => (
              <article key={block.label} className="header-block">
                <span>{block.label}</span>
                <strong>{block.value}</strong>
                <small>{block.note}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="header-title-shell">
          <div className="header-title-plaque">
            <span className="header-title-code">PEARL RIVER ESTUARY PORT TRAFFIC MONITOR</span>
            <h1>港口智慧管理平台</h1>
            <p>珠江口船舶交通状态识别与协同决策演示界面</p>
          </div>

          <div className="header-title-tags">
            <span>轨迹修复</span>
            <span>主航路识别</span>
            <span>流量预测</span>
            <span>协同管控</span>
          </div>
        </div>

        <div className="header-side header-side-right">
          <div className="header-side-label">SCENE CONTROL</div>
          <div className="header-block-grid header-block-grid-right">
            {headerRightBlocks.map((block) => (
              <article key={block.label} className="header-block">
                <span>{block.label}</span>
                <strong>{block.value}</strong>
                <small>{block.note}</small>
              </article>
            ))}

            <button type="button" className="header-control" onClick={handleAutoplayToggle}>
              <span>轮播控制</span>
              <strong>{autoplay ? '自动回放中' : '已暂停'}</strong>
              <small>{autoplay ? '点击停止轮播' : '点击恢复轮播'}</small>
            </button>
          </div>
        </div>
      </header>

      <section className="console-layout">
        <aside className="left-rail">
          <section className="frame panel-block metrics-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">System Overview</p>
                <h2>运行态势</h2>
              </div>
              <span className="panel-code">LIVE</span>
            </div>

            <div className="dial-grid">
              {dialCards.map((dial) => {
                const style = {
                  backgroundImage: `conic-gradient(#18bfd4 ${dial.percent * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                } satisfies CSSProperties

                return (
                  <article key={dial.label} className="dial-card">
                    <div className="dial-ring" style={style}>
                      <div className="dial-core">
                        <strong>{metricNumber(dial.value)}</strong>
                      </div>
                    </div>
                    <span>{dial.label}</span>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="frame panel-block grid-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Hot Grid Table</p>
                <h2>重点网格</h2>
              </div>
              <span className="panel-code">{scene.focusGrid}</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>网格</th>
                  <th>等级</th>
                  <th>当前</th>
                  <th>参考</th>
                </tr>
              </thead>
              <tbody>
                {displayedAlerts.map((alert) => (
                  <tr key={`${scene.id}-${alert.grid}`}>
                    <td>{alert.grid}</td>
                    <td>{levelText(alert.level)}</td>
                    <td>{alert.current}</td>
                    <td>{alert.future}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="frame panel-block log-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">System Log</p>
                <h2>运行日志</h2>
              </div>
              <span className="panel-code">LOG</span>
            </div>

            <ul className="log-list">
              {scene.logs.map((log) => (
                <li key={log}>{log}</li>
              ))}
            </ul>
          </section>

          <section className="frame panel-block chart-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Forecast Curve</p>
                <h2>流量曲线</h2>
              </div>
              <span className="panel-code">1H</span>
            </div>

            <div className="chart-area compact-chart-area">
              <svg className="flow-chart compact" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="总流量趋势图">
                <defs>
                  <linearGradient id="flow-area-compact" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(24, 195, 214, 0.34)" />
                    <stop offset="100%" stopColor="rgba(24, 195, 214, 0.02)" />
                  </linearGradient>
                </defs>

                {[1100, 1400, 1700].map((tick) => {
                  const ratio = (tick - flowMin) / (flowMax - flowMin)
                  const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)
                  return (
                    <g key={`compact-${tick}`}>
                      <line x1={CHART_PAD_X} x2={CHART_WIDTH - CHART_PAD_X} y1={y} y2={y} className="chart-grid-line" />
                      <text x="2" y={y + 4} className="chart-axis">
                        {tick}
                      </text>
                    </g>
                  )
                })}

                <path d={flowArea} fill="url(#flow-area-compact)" />
                <path d={flowPath} className="chart-line" />

                {totalFlowSeries.map((value, index) => {
                  const x = CHART_PAD_X + ((CHART_WIDTH - CHART_PAD_X * 2) / (totalFlowSeries.length - 1)) * index
                  const ratio = (value - flowMin) / (flowMax - flowMin)
                  const y = CHART_HEIGHT - CHART_PAD_Y - ratio * (CHART_HEIGHT - CHART_PAD_Y * 2)

                  return (
                    <g key={`compact-point-${value}-${index}`}>
                      <circle cx={x} cy={y} r={index === sceneIndex ? 5 : 3.5} className={index === sceneIndex ? 'chart-point active' : 'chart-point'} />
                      <text x={x} y={CHART_HEIGHT - 8} className={index === sceneIndex ? 'chart-label active' : 'chart-label'}>
                        {scenes[index].label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="chart-footer">
              <span>当前 {metricNumber(scene.totalFlow)}</span>
              <span>1H {metricNumber(scene.next1h)}</span>
              <span>{scene.phase}</span>
            </div>
          </section>
        </aside>

        <section className="map-column">
          <section className="frame map-frame">
            <div className="map-stage">
              <img src="/static-port-map.jpg" alt="珠江口静态卫星底图" className="map-image" />
              <div className="map-grid"></div>

              <div className="map-panel-title">
                <div>
                  <p className="panel-kicker">Spatial Monitor</p>
                  <h2>珠江口主航道与热点分析</h2>
                </div>
                <span className="panel-code">AREA 60 GRID</span>
              </div>

              <div className="map-hud map-hud-left">
                <span>研究区域</span>
                <strong>113.5583E - 113.9583E</strong>
                <strong>22.1557N - 22.6357N</strong>
              </div>

              <div className="map-right-rail">
                <div className="map-hud focus-card">
                  <div className="focus-card-head">
                    <span className="focus-card-label">焦点对象</span>
                    <span className={planApplied ? 'focus-card-state applied' : 'focus-card-state'}>{planApplied ? '已响应' : '待推演'}</span>
                  </div>
                  <div className="focus-card-tags">
                    <strong>{scene.focusGrid}</strong>
                    <strong>{focusRoute}</strong>
                    <strong>{focusFeed.tag}</strong>
                  </div>
                  <div className="focus-card-metric">
                    <small>当前值</small>
                    <strong>
                      {focusAlert.current} <span>→</span> {focusAlert.future}
                    </strong>
                  </div>
                  <p className="focus-card-summary">{scene.strategySummary}</p>
                  <button type="button" className={planApplied ? 'focus-card-action applied' : 'focus-card-action'} onClick={handleApplyPlan} disabled={planApplied}>
                    {planApplied ? '已应用方案' : '应用方案'}
                  </button>
                </div>

                <div className="map-control-stack">
                  <div className="map-control-card">
                    <span>当前状态</span>
                    <strong>{displayedStatus}</strong>
                    <small>{scene.phase}</small>
                  </div>
                  <div className="map-control-card">
                    <span>1H 预测</span>
                    <strong>{metricNumber(scene.next1h)}</strong>
                    <small>
                      较当前 {scene.next1h - scene.totalFlow > 0 ? '+' : ''}
                      {scene.next1h - scene.totalFlow}
                    </small>
                  </div>
                  <div className="map-button-grid">
                    <button type="button">主航路</button>
                    <button type="button">热点网格</button>
                    <button type="button">协同建议</button>
                    <button type="button">收益对比</button>
                  </div>
                </div>
              </div>

              <svg className="route-overlay" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
                {routeLines.map((route) => (
                  <g key={route.id}>
                    <path id={`route-${route.id}`} d={route.d} className={route.id === focusRoute ? 'route-line route-base focus' : 'route-line route-base'} />
                    <path
                      d={route.d}
                      className={route.id === focusRoute ? 'route-line route-flow focus' : 'route-line route-flow'}
                      style={{ animationDuration: `${route.id === focusRoute ? 5.8 : 8.6}s` }}
                    />
                  </g>
                ))}

                {routeLines.flatMap((route) =>
                  route.markers.map((marker) => (
                    <g key={`${route.id}-${marker.id}`} className={route.id === focusRoute ? 'traffic-ship focus' : 'traffic-ship'}>
                      <path
                        d={`M ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${(-(marker.radius * 1.68) * 0.74).toFixed(1)} L ${((marker.radius * 1.68) + 4).toFixed(1)} 0 L ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${((marker.radius * 1.68) * 0.74).toFixed(1)} L ${(-(marker.radius * 1.68) * 0.18).toFixed(1)} 0 Z`}
                      />
                      <animateMotion dur={`${marker.dur}s`} begin={`${marker.begin}s`} repeatCount="indefinite" rotate="auto" path={route.d} />
                    </g>
                  )),
                )}
              </svg>

              {routeLines.map((route) => (
                <div key={route.id} className={route.id === focusRoute ? 'route-tag active' : 'route-tag'} style={{ left: route.x, top: route.y }}>
                  {route.id}
                </div>
              ))}

              {mapTags.map((tag) => (
                <div
                  key={tag.id}
                  className={tag.focusGrid === scene.focusGrid ? 'map-tag active' : 'map-tag'}
                  style={{ left: tag.x, top: tag.y }}
                >
                  <strong>{tag.id}</strong>
                  <span>{tag.label}</span>
                </div>
              ))}

              {hotspots.map((hotspot) => {
                const intensity = hotspot.intensities[sceneIndex]
                const size = (22 + intensity * 42) * hotspotScale
                const style = {
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity: (0.25 + intensity * 0.75) * (planApplied ? 0 : 1),
                } satisfies CSSProperties

                return (
                  <div
                    key={hotspot.id}
                    className={
                      `${intensity > 0.72 ? 'hotspot high' : intensity > 0.42 ? 'hotspot medium' : 'hotspot'}${planApplied ? ' suppressed' : ''}`
                    }
                    style={style}
                  >
                    <span>{hotspot.id}</span>
                  </div>
                )
              })}

              <div className="map-bottom-strip">
                <div className="map-bottom-summary">
                  <span>场景摘要</span>
                  <strong>{planApplied ? scene.appliedSummary : scene.summary}</strong>
                </div>

                <div className="map-bottom-focus">
                  <span>{focusFeed.tag}</span>
                  <span>{focusRoute}</span>
                  <span>
                    {scene.focusGrid} {focusAlert.current}
                  </span>
                </div>

                <div className="map-bottom-timeline">
                  {scenes.map((item, index) => (
                    <button key={item.id} type="button" className={index === sceneIndex ? 'map-timeline-node active' : 'map-timeline-node'} onClick={() => handleSceneSelect(index)}>
                      <strong>{item.label}</strong>
                      <small>{item.phase}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="right-rail">
          <section className="frame panel-block strategy-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Collaborative Strategy</p>
                <h2>协同管控建议</h2>
              </div>
              <span className="panel-code">{planApplied ? 'APPLIED' : 'PENDING'}</span>
            </div>

            <div className="strategy-hero">
              <strong>{scene.strategyHeadline}</strong>
              <p>{scene.strategySummary}</p>
            </div>

            <div className="strategy-list">
              {scene.recommendations.map((item) => (
                <article key={`${scene.id}-${item.target}`} className={planApplied ? 'strategy-item applied' : 'strategy-item'}>
                  <div className="strategy-item-head">
                    <strong>{item.target}</strong>
                    <span>{planApplied ? '已执行' : '待执行'}</span>
                  </div>
                  <p>{item.action}</p>
                  <small>{item.reason}</small>
                  <em>{item.effect}</em>
                </article>
              ))}
            </div>

            <div className="strategy-footer">
              <span>基于研究成果的协同策略推演</span>
              <button type="button" className={planApplied ? 'panel-action applied' : 'panel-action'} onClick={handleApplyPlan} disabled={planApplied}>
                {planApplied ? '已应用方案' : '应用方案'}
              </button>
            </div>
          </section>

          <section className="frame panel-block feed-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Observation Feeds</p>
                <h2>监测终端</h2>
              </div>
              <span className="panel-code">CAM</span>
            </div>

            <div className="feed-stack">
              {feedViews.map((feed) => {
                const alert = displayedAlerts.find((item) => item.grid === feed.grid)
                const style = {
                  backgroundPosition: feed.position,
                } satisfies CSSProperties

                return (
                  <article
                    key={feed.tag}
                    className={
                      planApplied && feed.grid === scene.focusGrid
                        ? 'feed-card active resolved'
                        : feed.grid === scene.focusGrid
                          ? 'feed-card active'
                          : 'feed-card'
                    }
                    style={style}
                  >
                    <div className="feed-overlay"></div>
                    <div className="feed-head">
                      <div className="feed-ident">
                        <span className="feed-tag">{feed.tag}</span>
                        <strong>{feed.title}</strong>
                      </div>
                      <span className={planApplied && feed.grid === scene.focusGrid ? 'feed-state applied' : 'feed-state'}>
                        {planApplied ? (feed.grid === scene.focusGrid ? 'ADJUSTED' : 'SYNC') : feed.grid === scene.focusGrid ? 'TRACK' : 'SCAN'}
                      </span>
                    </div>

                    <div className="feed-meta">
                      <span>{feed.area}</span>
                      <span>{feed.route}</span>
                      <span>{feed.grid}</span>
                    </div>

                    <p className="feed-subtitle">{planApplied && feed.grid === scene.focusGrid ? scene.appliedSummary : alert?.note ?? feed.subtitle}</p>

                    <div className="feed-foot">
                      <div className="feed-bars">
                        <i></i>
                        <i></i>
                        <i></i>
                      </div>
                      <small>
                        {alert
                          ? `${planApplied && feed.grid === scene.focusGrid ? '已响应' : feedRiskText(alert.level)}  ${alert.current} → ${alert.future}`
                          : '持续监测中'}
                      </small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="frame panel-block benefit-panel">
            <div className="panel-title">
              <div>
                <p className="panel-kicker">Benefit Comparison</p>
                <h2>方案收益对比</h2>
              </div>
              <span className="panel-code">{planApplied ? 'APPLIED' : 'PREVIEW'}</span>
            </div>

            <div className="benefit-intro">
              <strong>{planApplied ? '协同策略已生效' : '等待应用协同方案'}</strong>
              <p>以下结果为基于研究成果的场景化推演值，用于展示协同决策后的改善方向。</p>
            </div>

            <div className="benefit-grid">
              {scene.benefits.map((item) => (
                <article key={`${scene.id}-${item.label}`} className={planApplied ? 'benefit-card applied' : 'benefit-card'}>
                  <span>{item.label}</span>
                  <div className="benefit-values">
                    <div className="benefit-value before">
                      <small>Before</small>
                      <strong>
                        {item.before}
                        {item.unit ? <em>{item.unit}</em> : null}
                      </strong>
                    </div>
                    <div className="benefit-arrow">→</div>
                    <div className="benefit-value after">
                      <small>After</small>
                      <strong>
                        {item.after}
                        {item.unit ? <em>{item.unit}</em> : null}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
