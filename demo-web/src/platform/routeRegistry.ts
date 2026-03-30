import type { ModuleId, ShellRouteId } from '../sharedContracts'
import type { ShellRouteDescriptor } from './moduleContracts'

type ModuleRouteBlueprint = Omit<ShellRouteDescriptor, 'id' | 'kind' | 'moduleId' | 'status' | 'notice'>

const moduleRouteBlueprints: Record<ModuleId, ModuleRouteBlueprint> = {
  overview: {
    label: '总览',
    navLabel: '总览',
    description: '业务闭环 framing 与全站模块概览。',
    shellOrder: 1,
    navVisible: false,
    entryActionLabel: '打开总览',
  },
  forecast: {
    label: '流量预测',
    navLabel: '流量预测',
    description: '流量预测时间线、热点监测与模型 readiness。',
    shellOrder: 2,
    navVisible: true,
    entryActionLabel: '查看详情',
  },
  repair: {
    label: '轨迹修复',
    navLabel: '轨迹修复',
    description: '精选修复样本、修复轨迹与模型对比。',
    shellOrder: 3,
    navVisible: true,
    entryActionLabel: '查看轨迹',
  },
  clustering: {
    label: '轨迹聚类',
    navLabel: '轨迹聚类',
    description: '从原始轨迹到 corridor 的聚类流水线与分层预览。',
    shellOrder: 4,
    navVisible: true,
    entryActionLabel: '查看流水线',
  },
  evaluation: {
    label: '评估中心',
    navLabel: '评估中心',
    description: '统一指标、排名与跨模块记分板视图。',
    shellOrder: 5,
    navVisible: true,
    entryActionLabel: '对比结果',
  },
  'forward-looking': {
    label: '前瞻分析',
    navLabel: '前瞻分析',
    description: '规则驱动的协同决策场景，并回链预测、评估与 corridor 证据。',
    shellOrder: 6,
    navVisible: true,
    entryActionLabel: '打开分析',
  },
}

const homeRoute: ShellRouteDescriptor = {
  id: 'home',
  kind: 'home',
  label: '首页',
  navLabel: '首页',
  description: '带有指挥中枢 framing 与模块入口的主页。',
  shellOrder: 0,
  navVisible: true,
  entryActionLabel: '返回首页',
  status: 'ready',
}

export const SHELL_ROUTE_ORDER: ShellRouteId[] = [
  'home',
  'overview',
  'forecast',
  'repair',
  'clustering',
  'evaluation',
  'forward-looking',
]

export const PRIMARY_SHELL_ROUTE_IDS: ShellRouteId[] = [
  'home',
  'forecast',
  'repair',
  'clustering',
  'evaluation',
  'forward-looking',
]

export function isModuleRouteId(routeId: ShellRouteId): routeId is ModuleId {
  return routeId !== 'home'
}

export function getModuleRouteDescriptor(moduleId: ModuleId): ShellRouteDescriptor {
  const blueprint = moduleRouteBlueprints[moduleId]
  return {
    id: moduleId,
    kind: 'module',
    moduleId,
    label: blueprint.label,
    navLabel: blueprint.navLabel,
    description: blueprint.description,
    shellOrder: blueprint.shellOrder,
    navVisible: blueprint.navVisible,
    entryActionLabel: blueprint.entryActionLabel,
    status: 'ready',
  }
}

export function getShellRouteDescriptor(routeId: ShellRouteId): ShellRouteDescriptor {
  switch (routeId) {
    case 'home':
      return { ...homeRoute }
    default:
      return getModuleRouteDescriptor(routeId)
  }
}

export function listShellRoutes(): ShellRouteDescriptor[] {
  return SHELL_ROUTE_ORDER.map((routeId) => getShellRouteDescriptor(routeId))
}

export function listPrimaryShellRoutes(): ShellRouteDescriptor[] {
  return listShellRoutes().filter((route) => route.navVisible)
}
