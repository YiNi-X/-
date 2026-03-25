import type { ModuleId, ShellRouteId } from '../sharedContracts'
import type { ShellRouteDescriptor } from './moduleContracts'

type ModuleRouteBlueprint = Omit<ShellRouteDescriptor, 'id' | 'kind' | 'moduleId' | 'status' | 'notice'>

const moduleRouteBlueprints: Record<ModuleId, ModuleRouteBlueprint> = {
  overview: {
    label: 'Overview',
    navLabel: 'Overview',
    description: 'Business-loop framing and project-wide module summary.',
    shellOrder: 1,
    navVisible: false,
    entryActionLabel: 'Open Overview',
  },
  forecast: {
    label: 'Flow Prediction',
    navLabel: 'Flow Prediction',
    description: 'Traffic forecasting timelines, hotspot monitoring, and model readiness.',
    shellOrder: 2,
    navVisible: true,
    entryActionLabel: 'View Details',
  },
  repair: {
    label: 'Trajectory Repair',
    navLabel: 'Trajectory Repair',
    description: 'Curated repair samples, repaired trajectories, and model comparisons.',
    shellOrder: 3,
    navVisible: true,
    entryActionLabel: 'View Trajectory',
  },
  clustering: {
    label: 'Trajectory Clustering',
    navLabel: 'Trajectory Clustering',
    description: 'Raw-to-corridor clustering pipeline with staged preview layers.',
    shellOrder: 4,
    navVisible: true,
    entryActionLabel: 'View Pipeline',
  },
  evaluation: {
    label: 'Evaluation Center',
    navLabel: 'Evaluation Center',
    description: 'Unified metrics, rankings, and module-wide scoreboard views.',
    shellOrder: 5,
    navVisible: true,
    entryActionLabel: 'Compare Results',
  },
}

const homeRoute: ShellRouteDescriptor = {
  id: 'home',
  kind: 'home',
  label: 'Home',
  navLabel: 'Home',
  description: 'Command-center homepage with live-style status framing and module entry points.',
  shellOrder: 0,
  navVisible: true,
  entryActionLabel: 'Return Home',
  status: 'ready',
}

const forwardLookingRoute: ShellRouteDescriptor = {
  id: 'forward-looking',
  kind: 'placeholder',
  label: 'Forward-Looking Analysis',
  navLabel: 'Forward-Looking',
  description: 'Collaborative decision analysis remains reserved for a later update.',
  shellOrder: 6,
  navVisible: true,
  entryActionLabel: 'See Status',
  status: 'deferred',
  notice: 'This capability will be connected in a later update.',
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
    case 'forward-looking':
      return { ...forwardLookingRoute }
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
