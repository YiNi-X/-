import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_DATASET_CATALOG,
  formatDatasetPath,
  loadDatasetCatalog,
  persistDatasetSelection,
  readPreferredDatasetId,
  resolveRuntimeResource,
  selectDatasetEntry,
} from './datasetCatalog'
import type { AisPlaybackData, GeometryConfig, GeoPoint, StudyBounds } from './sharedContracts'
import { loadPublicJson } from './sharedContracts'

type PrecomputedCorridorEntry = {
  corridorId: string
  trackCount: number
  directionLabel: string
  representativePoints: GeoPoint[]
}

type PrecomputedCorridorsFile = {
  source: string
  signaturePoints: number
  corridorCount: number
  corridors: PrecomputedCorridorEntry[]
}

type MarkerConfig = { baseDur: number; count: number; radius: number }
type RouteDraft = {
  id: string
  labelPoint: GeoPoint
  points: GeoPoint[]
  markerConfig: MarkerConfig
  corridorId: string
  directionLabel: string
}
type HotspotDraft = { id: string; point: GeoPoint; intensities: number[] }
type RouteSeedMode = 'shared-geometry' | 'precomputed-corridors'
type SelectedHandle =
  | { kind: 'point'; routeId: string; index: number }
  | { kind: 'label'; routeId: string }
  | { kind: 'hotspot'; hotspotId: string }
type CursorState = { lon: number; lat: number; xPercent: number; yPercent: number }
type PlaybackPayload = AisPlaybackData
type HotspotVisual = { size: number; opacity: number; intensity: number; level: 'watch' | 'medium' | 'high' }
type LayerTransform = { scale: number; offsetX: number; offsetY: number; opacity: number; brightness: number }
type FixedLayerDisplay = { opacity: number; brightness: number }
type TransformLayerTarget = 'map' | 'corridors'
type StagePanState = { target: TransformLayerTarget; startX: number; startY: number; originX: number; originY: number }
type GeoViewport = { width: number; height: number; offsetX: number; offsetY: number }

const STUDY_BOUNDS = { minLon: 113.558356434, maxLon: 113.95835643400001, minLat: 22.155739805, maxLat: 22.635739805 }
const MAP_VIEWBOX = { width: 1920, height: 1080 }
const resolvePageAsset = (value: string) => new URL(value.replace(/^\//, ''), window.location.href).toString()
const BACKGROUND_PRESETS = [
  { id: 'port-map', label: 'Static Port Map', src: 'static-port-map.jpg' },
  { id: 'blank', label: 'No Background', src: '' },
]
const CORRIDOR_COLORS = ['#3a86ff', '#00bbf9', '#06d6a0', '#80ed99', '#ffd166', '#f4a261', '#ef476f', '#9b5de5', '#4cc9f0', '#f72585']
const SHARED_GEOMETRY_PATH = 'data/shared-geometry.json'
const BASE_HOTSPOT_INTENSITIES = [0.35, 0.48, 0.62, 0.76, 0.9]
const METERS_PER_DEGREE = 111_000
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const roundCoord = (value: number) => Number(value.toFixed(6))

function buildGeoViewport(bounds: StudyBounds = STUDY_BOUNDS): GeoViewport {
  const meanLat = (bounds.minLat + bounds.maxLat) / 2
  const geoWidth = Math.max((bounds.maxLon - bounds.minLon) * Math.cos((meanLat * Math.PI) / 180) * METERS_PER_DEGREE, 1)
  const geoHeight = Math.max((bounds.maxLat - bounds.minLat) * METERS_PER_DEGREE, 1)
  const geoAspect = geoWidth / geoHeight
  const stageAspect = MAP_VIEWBOX.width / MAP_VIEWBOX.height

  if (geoAspect >= stageAspect) {
    const height = MAP_VIEWBOX.width / geoAspect
    return {
      width: MAP_VIEWBOX.width,
      height,
      offsetX: 0,
      offsetY: (MAP_VIEWBOX.height - height) / 2,
    }
  }

  const width = MAP_VIEWBOX.height * geoAspect
  return {
    width,
    height: MAP_VIEWBOX.height,
    offsetX: (MAP_VIEWBOX.width - width) / 2,
    offsetY: 0,
  }
}

const percentToSvg = (point: { x: number; y: number }) => ({ x: (point.x / 100) * MAP_VIEWBOX.width, y: (point.y / 100) * MAP_VIEWBOX.height })
const geoToPercent = (point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) => {
  const xRatio = clamp((point.lon - bounds.minLon) / Math.max(bounds.maxLon - bounds.minLon, Number.EPSILON), 0, 1)
  const yRatio = clamp((bounds.maxLat - point.lat) / Math.max(bounds.maxLat - bounds.minLat, Number.EPSILON), 0, 1)
  return {
    x: ((viewport.offsetX + xRatio * viewport.width) / MAP_VIEWBOX.width) * 100,
    y: ((viewport.offsetY + yRatio * viewport.height) / MAP_VIEWBOX.height) * 100,
  }
}
const geoToSvg = (point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) => percentToSvg(geoToPercent(point, bounds, viewport))
const svgToGeo = (xRatio: number, yRatio: number, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) => {
  const svgX = xRatio * MAP_VIEWBOX.width
  const svgY = yRatio * MAP_VIEWBOX.height
  const innerX = clamp((svgX - viewport.offsetX) / Math.max(viewport.width, Number.EPSILON), 0, 1)
  const innerY = clamp((svgY - viewport.offsetY) / Math.max(viewport.height, Number.EPSILON), 0, 1)
  return {
    lon: roundCoord(bounds.minLon + innerX * (bounds.maxLon - bounds.minLon)),
    lat: roundCoord(bounds.maxLat - innerY * (bounds.maxLat - bounds.minLat)),
  }
}
const lineMetrics = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ length: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) })

function controlPoint(current: { x: number; y: number }, previous?: { x: number; y: number }, next?: { x: number; y: number }, reverse = false) {
  const p = previous ?? current
  const n = next ?? current
  const { length, angle } = lineMetrics(p, n)
  const adjustedAngle = angle + (reverse ? Math.PI : 0)
  return { x: current.x + Math.cos(adjustedAngle) * length * 0.16, y: current.y + Math.sin(adjustedAngle) * length * 0.16 }
}

function createSmoothSvgPath(points: Array<{ x: number; y: number }>) {
  return points.reduce((path, point, index, array) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    const previous = array[index - 1]
    const previousPrevious = array[index - 2]
    const next = array[index + 1]
    const startControl = controlPoint(previous, previousPrevious, point)
    const endControl = controlPoint(point, previous, next, true)
    return `${path} C ${startControl.x.toFixed(1)} ${startControl.y.toFixed(1)} ${endControl.x.toFixed(1)} ${endControl.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }, '')
}

function createLinearSvgPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

function createGeoPath(points: GeoPoint[], bounds: StudyBounds, smooth: boolean, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const svgPoints = points.map((point) => geoToSvg(point, bounds, viewport))
  return smooth ? createSmoothSvgPath(svgPoints) : createLinearSvgPath(svgPoints)
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function buildRouteDrafts(geometryConfig: GeometryConfig) {
  return geometryConfig.routes.map<RouteDraft>((route) => ({
    id: route.id,
    labelPoint: route.labelPoint,
    points: route.points,
    markerConfig: { baseDur: route.marker.baseDurationSeconds, count: 4, radius: route.marker.radius },
    corridorId: route.id,
    directionLabel: '',
  }))
}

function buildRouteDraftsFromCorridors(corridors: PrecomputedCorridorEntry[]) {
  return corridors
    .filter((corridor) => corridor.representativePoints.length >= 2)
    .map<RouteDraft>((corridor) => {
      const labelPoint = corridor.representativePoints[Math.floor(corridor.representativePoints.length / 2)] ?? corridor.representativePoints[0]

      return {
        id: corridor.corridorId,
        labelPoint: labelPoint ?? corridor.representativePoints[0],
        points: corridor.representativePoints.map((point) => ({ ...point })),
        markerConfig: { baseDur: 9.6, count: 4, radius: 4.4 },
        corridorId: corridor.corridorId,
        directionLabel: corridor.directionLabel,
      }
    })
}

function buildHotspotDrafts(geometryConfig: GeometryConfig) {
  return geometryConfig.hotspots.map<HotspotDraft>((hotspot, index) => ({
    id: hotspot.id,
    point: hotspot.point,
    intensities: BASE_HOTSPOT_INTENSITIES.map((value, valueIndex) => Number(clamp(value + (index - valueIndex) * 0.05, 0.16, 1).toFixed(2))),
  }))
}

function buildGeometryPayload(geometryConfig: GeometryConfig, routes: RouteDraft[], hotspots: HotspotDraft[]) {
  return {
    meta: geometryConfig.meta,
    routes: routes.map((route) => ({
      id: route.id,
      labelPoint: route.labelPoint,
      marker: {
        baseDurationSeconds: route.markerConfig.baseDur,
        radius: route.markerConfig.radius,
      },
      points: route.points,
    })),
    hotspots: hotspots.map((hotspot) => ({
      id: hotspot.id,
      routeId: geometryConfig.routeFocusMap[hotspot.id] ?? '',
      point: hotspot.point,
    })),
    routeFocusMap: geometryConfig.routeFocusMap,
  }
}

function classifyHotspot(intensity: number): HotspotVisual['level'] {
  if (intensity >= 0.7) return 'high'
  if (intensity >= 0.5) return 'medium'
  return 'watch'
}

function getHotspotVisual(hotspot: HotspotDraft): HotspotVisual {
  const intensity = hotspot.intensities[Math.floor(hotspot.intensities.length / 2)] ?? hotspot.intensities[0] ?? 0.35
  return {
    size: 22 + intensity * 42,
    opacity: 0.25 + intensity * 0.75,
    intensity,
    level: classifyHotspot(intensity),
  }
}

function corridorLabelPoint(corridor: PrecomputedCorridorEntry, bounds: StudyBounds, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const labelPoint = corridor.representativePoints[Math.floor(corridor.representativePoints.length / 2)] ?? corridor.representativePoints[0]
  return labelPoint ? geoToPercent(labelPoint, bounds, viewport) : { x: 50, y: 50 }
}

function buildCorridorPath(corridor: PrecomputedCorridorEntry, bounds: StudyBounds, viewport: GeoViewport = buildGeoViewport(bounds)) {
  return createGeoPath(corridor.representativePoints, bounds, false, viewport)
}

export function RouteEditor() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [geometryConfig, setGeometryConfig] = useState<GeometryConfig | null>(null)
  const [routes, setRoutes] = useState<RouteDraft[]>([])
  const [hotspots, setHotspots] = useState<HotspotDraft[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [selectedHandle, setSelectedHandle] = useState<SelectedHandle | null>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [nudgeStep, setNudgeStep] = useState('0.0015')
  const [playbackData, setPlaybackData] = useState<PlaybackPayload | null>(null)
  const [playbackError, setPlaybackError] = useState('')
  const [geometryError, setGeometryError] = useState('')
  const [datasetCatalog, setDatasetCatalog] = useState(DEFAULT_DATASET_CATALOG)
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => readPreferredDatasetId() ?? DEFAULT_DATASET_CATALOG.defaultDatasetId)
  const [canvasUrlInput, setCanvasUrlInput] = useState('')
  const [uploadedCanvasUrl, setUploadedCanvasUrl] = useState('')
  const [canvasDisplay, setCanvasDisplay] = useState<FixedLayerDisplay>({ opacity: 1, brightness: 1 })
  const [mapPresetId, setMapPresetId] = useState(BACKGROUND_PRESETS[0].id)
  const [mapUrlInput, setMapUrlInput] = useState('')
  const [uploadedMapUrl, setUploadedMapUrl] = useState('')
  const [mapTransform, setMapTransform] = useState<LayerTransform>({ scale: 1, offsetX: 0, offsetY: 0, opacity: 0.92, brightness: 0.92 })
  const [corridorTransform, setCorridorTransform] = useState<LayerTransform>({ scale: 1, offsetX: 0, offsetY: 0, opacity: 1, brightness: 1 })
  const [activeTransformLayer, setActiveTransformLayer] = useState<TransformLayerTarget>('map')
  const [stagePan, setStagePan] = useState<StagePanState | null>(null)
  const [precomputedCorridorsFile, setPrecomputedCorridorsFile] = useState<PrecomputedCorridorsFile | null>(null)
  const [corridorDataError, setCorridorDataError] = useState('')
  const [defaultRoutes, setDefaultRoutes] = useState<RouteDraft[]>([])
  const [routeSeedMode, setRouteSeedMode] = useState<RouteSeedMode>('shared-geometry')

  const studyBounds = geometryConfig?.meta.studyArea ?? playbackData?.meta.studyArea ?? STUDY_BOUNDS
  const geoViewport = useMemo(() => buildGeoViewport(studyBounds), [studyBounds])
  const fallbackPoint = { lon: studyBounds.minLon, lat: studyBounds.minLat }
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null
  const selectedHotspot = hotspots.find((hotspot) => hotspot.id === (selectedHandle?.kind === 'hotspot' ? selectedHandle.hotspotId : hotspots[0]?.id ?? '')) ?? hotspots[0] ?? null
  const activeHandle =
    selectedHandle ??
    (selectedRoute
      ? ({ kind: 'point', routeId: selectedRoute.id, index: 0 } satisfies SelectedHandle)
      : selectedHotspot
        ? ({ kind: 'hotspot', hotspotId: selectedHotspot.id } satisfies SelectedHandle)
        : null)
  const selectedPoint =
    activeHandle?.kind === 'hotspot'
      ? selectedHotspot?.point ?? fallbackPoint
      : activeHandle?.kind === 'point' && selectedRoute && activeHandle.routeId === selectedRoute.id
        ? selectedRoute.points[activeHandle.index] ?? selectedRoute.labelPoint
        : selectedRoute?.labelPoint ?? fallbackPoint
  const availableDatasets = useMemo(() => datasetCatalog.datasets.filter((item) => item.aisPlaybackPath), [datasetCatalog.datasets])
  const selectedDataset = useMemo(() => selectDatasetEntry(datasetCatalog, selectedDatasetId, ['ais']), [datasetCatalog, selectedDatasetId])
  const displayedCorridors = useMemo(
    () => [...(precomputedCorridorsFile?.corridors ?? [])].sort((a, b) => (b.trackCount - a.trackCount) || a.corridorId.localeCompare(b.corridorId)),
    [precomputedCorridorsFile],
  )
  const corridorDisplayLayers = useMemo(
    () =>
      displayedCorridors.map((corridor) => {
        return {
          ...corridor,
          path: buildCorridorPath(corridor, studyBounds, geoViewport),
          label: corridorLabelPoint(corridor, studyBounds, geoViewport),
        }
      }),
    [displayedCorridors, geoViewport, studyBounds],
  )
  const corridorTrackCounts = useMemo(
    () => Object.fromEntries(displayedCorridors.map((corridor) => [corridor.corridorId, corridor.trackCount] as const)) as Record<string, number>,
    [displayedCorridors],
  )
  const corridorColors = useMemo(
    () => Object.fromEntries(displayedCorridors.map((corridor, index) => [corridor.corridorId, CORRIDOR_COLORS[index % CORRIDOR_COLORS.length]])) as Record<string, string>,
    [displayedCorridors],
  )
  const hotspotVisuals = useMemo(
    () => Object.fromEntries(hotspots.map((hotspot) => [hotspot.id, getHotspotVisual(hotspot)])) as Record<string, HotspotVisual>,
    [hotspots],
  )
  const routeGeometryLayers = useMemo(
    () =>
      routes.map((route) => ({
        id: route.id,
        path: createGeoPath(route.points, studyBounds, routeSeedMode === 'shared-geometry', geoViewport),
        label: geoToPercent(route.labelPoint, studyBounds, geoViewport),
        points: route.points.map((point, index) => ({
          id: `${route.id}-${index}`,
          index,
          position: geoToPercent(point, studyBounds, geoViewport),
        })),
      })),
    [geoViewport, routeSeedMode, routes, studyBounds],
  )
  const selectedRouteGeometry = useMemo(
    () => routeGeometryLayers.find((route) => route.id === selectedRoute?.id) ?? null,
    [routeGeometryLayers, selectedRoute?.id],
  )
  const hotspotGeometryLayers = useMemo(
    () =>
      hotspots.map((hotspot) => ({
        id: hotspot.id,
        position: geoToPercent(hotspot.point, studyBounds, geoViewport),
        visual: hotspotVisuals[hotspot.id] ?? getHotspotVisual(hotspot),
      })),
    [geoViewport, hotspotVisuals, hotspots, studyBounds],
  )
  const routeEntityLabel = routeSeedMode === 'precomputed-corridors' ? 'Corridor' : 'Route'
  const routeEntityLabelLower = routeEntityLabel.toLowerCase()
  const routeEntityLabelPlural = routeSeedMode === 'precomputed-corridors' ? 'Corridors' : 'Routes'
  const routeEntityLabelPluralLower = routeEntityLabelPlural.toLowerCase()
  const routeExportText = useMemo(
    () =>
      JSON.stringify(
        routes.map((route) => ({
          id: route.id,
          corridorId: route.corridorId,
          directionLabel: route.directionLabel,
          labelPoint: route.labelPoint,
          marker: { baseDurationSeconds: route.markerConfig.baseDur, radius: route.markerConfig.radius },
          points: route.points,
        })),
        null,
        2,
      ),
    [routes],
  )
  const hotspotExportText = useMemo(
    () =>
      JSON.stringify(
        hotspots.map((hotspot) => ({
          id: hotspot.id,
          routeId: geometryConfig?.routeFocusMap[hotspot.id] ?? '',
          point: hotspot.point,
        })),
        null,
        2,
      ),
    [geometryConfig, hotspots],
  )
  const geometryExportText = useMemo(
    () =>
      geometryConfig && routeSeedMode === 'shared-geometry'
        ? JSON.stringify(buildGeometryPayload(geometryConfig, routes, hotspots), null, 2)
        : 'Geometry export is disabled while RouteEditor is seeded from precomputed-corridors.json. Use the corridor JSON export to copy the current representative lat/lon lines.',
    [geometryConfig, hotspots, routeSeedMode, routes],
  )
  const canvasSource = uploadedCanvasUrl || canvasUrlInput.trim()
  const mapPreset = BACKGROUND_PRESETS.find((item) => item.id === mapPresetId) ?? BACKGROUND_PRESETS[0]
  const mapSource = uploadedMapUrl || mapUrlInput.trim() || (mapPreset.src ? resolvePageAsset(mapPreset.src) : '')
  const canvasStyle = { opacity: canvasDisplay.opacity, filter: `brightness(${canvasDisplay.brightness}) saturate(0.92)` } satisfies CSSProperties
  const mapLayerStyle = {
    transform: `translate(${mapTransform.offsetX}px, ${mapTransform.offsetY}px) scale(${mapTransform.scale})`,
    opacity: mapTransform.opacity,
    filter: `brightness(${mapTransform.brightness}) saturate(0.92)`,
  } satisfies CSSProperties
  const corridorLayerStyle = {
    transform: `translate(${corridorTransform.offsetX}px, ${corridorTransform.offsetY}px) scale(${corridorTransform.scale})`,
    opacity: corridorTransform.opacity,
    filter: `brightness(${corridorTransform.brightness})`,
  } satisfies CSSProperties

  useEffect(() => {
    let cancelled = false

    loadDatasetCatalog().then((catalog) => {
      if (cancelled) return
      setDatasetCatalog(catalog)
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadPublicJson<GeometryConfig>(resolveRuntimeResource(SHARED_GEOMETRY_PATH))
      .then((payload) => {
        if (cancelled) return
        setGeometryConfig(payload)
        const nextHotspots = buildHotspotDrafts(payload)
        setHotspots(nextHotspots)
        setGeometryError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setGeometryError(error instanceof Error ? error.message : 'Failed to load shared geometry config')
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadPublicJson<PlaybackPayload>(resolveRuntimeResource(selectedDataset.aisPlaybackPath))
      .then((payload) => {
        if (cancelled) return
        setPlaybackData(payload)
        setPlaybackError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPlaybackError(error instanceof Error ? error.message : `Failed to load dataset ${selectedDataset.label}`)
      })

    return () => { cancelled = true }
  }, [selectedDataset])

  useEffect(() => {
    let cancelled = false

    loadPublicJson<PrecomputedCorridorsFile>(resolveRuntimeResource('data/precomputed-corridors.json'))
      .then((payload) => {
        if (cancelled) return
        setPrecomputedCorridorsFile(payload)
        setCorridorDataError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPrecomputedCorridorsFile(null)
        setCorridorDataError(error instanceof Error ? error.message : 'Failed to load precomputed corridors')
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const nextRoutes = precomputedCorridorsFile?.corridors.length
      ? buildRouteDraftsFromCorridors(precomputedCorridorsFile.corridors)
      : geometryConfig
        ? buildRouteDrafts(geometryConfig)
        : []

    if (!nextRoutes.length) return

    const seededRoutes = structuredClone(nextRoutes)
    setDefaultRoutes(seededRoutes)
    setRoutes(structuredClone(nextRoutes))
    setRouteSeedMode(precomputedCorridorsFile?.corridors.length ? 'precomputed-corridors' : 'shared-geometry')
    setSelectedRouteId((current) => (nextRoutes.some((route) => route.id === current) ? current : nextRoutes[0]?.id ?? ''))
    setSelectedHandle((current) => {
      if (current?.kind === 'hotspot') return current

      const activeRouteId =
        current && 'routeId' in current && nextRoutes.some((route) => route.id === current.routeId)
          ? current.routeId
          : nextRoutes[0]?.id ?? ''
      const activeRoute = nextRoutes.find((route) => route.id === activeRouteId) ?? nextRoutes[0]

      if (!activeRoute) return null
      if (current?.kind === 'label' && current.routeId === activeRoute.id) return current

      const nextIndex =
        current?.kind === 'point' && current.routeId === activeRoute.id
          ? clamp(current.index, 0, Math.max(activeRoute.points.length - 1, 0))
          : 0

      return { kind: 'point', routeId: activeRoute.id, index: nextIndex }
    })
  }, [geometryConfig, precomputedCorridorsFile])

  useEffect(() => { if (!copyStatus) return; const timer = window.setTimeout(() => setCopyStatus(''), 1600); return () => window.clearTimeout(timer) }, [copyStatus])
  useEffect(() => () => {
    if (uploadedCanvasUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedCanvasUrl)
    if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
  }, [uploadedCanvasUrl, uploadedMapUrl])
  useEffect(() => {
    if (!stagePan) return
    const onMove = (event: PointerEvent) => {
      const deltaX = event.clientX - stagePan.startX
      const deltaY = event.clientY - stagePan.startY
      if (stagePan.target === 'map') {
        setMapTransform((current) => ({ ...current, offsetX: stagePan.originX + deltaX, offsetY: stagePan.originY + deltaY }))
        return
      }
      setCorridorTransform((current) => ({ ...current, offsetX: stagePan.originX + deltaX, offsetY: stagePan.originY + deltaY }))
    }
    const onUp = () => setStagePan(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [stagePan])

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    const nextGeo = svgToGeo(xRatio, yRatio, studyBounds, geoViewport)
    setCursor({ ...nextGeo, xPercent: xRatio * 100, yPercent: yRatio * 100 })
  }

  function updateLayerTransform(target: TransformLayerTarget, updater: (current: LayerTransform) => LayerTransform) {
    if (target === 'map') {
      setMapTransform((current) => updater(current))
      return
    }
    setCorridorTransform((current) => updater(current))
  }

  function resetMapView() {
    setMapTransform({ scale: 1, offsetX: 0, offsetY: 0, opacity: 0.92, brightness: 0.92 })
  }

  function resetCorridorView() {
    setCorridorTransform({ scale: 1, offsetX: 0, offsetY: 0, opacity: 1, brightness: 1 })
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.editor-stage-hud, .editor-timeline-shell')) return
    setStagePan({
      target: activeTransformLayer,
      startX: event.clientX,
      startY: event.clientY,
      originX: activeTransformLayer === 'map' ? mapTransform.offsetX : corridorTransform.offsetX,
      originY: activeTransformLayer === 'map' ? mapTransform.offsetY : corridorTransform.offsetY,
    })
  }

  function handleStageWheel(event: React.WheelEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.editor-stage-hud, .editor-timeline-shell')) return
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.08 : 0.92
    updateLayerTransform(activeTransformLayer, (current) => ({ ...current, scale: clamp(Number((current.scale * factor).toFixed(3)), 0.25, 6) }))
  }

  function updateSelectedPoint(deltaLon: number, deltaLat: number) {
    const step = Number.parseFloat(nudgeStep)
    if (Number.isNaN(step) || !activeHandle) return
    if (activeHandle.kind === 'hotspot') {
      setHotspots((current) =>
        current.map((hotspot) =>
          hotspot.id === activeHandle.hotspotId
            ? {
                ...hotspot,
                point: {
                  lon: roundCoord(clamp(hotspot.point.lon + deltaLon * step, studyBounds.minLon, studyBounds.maxLon)),
                  lat: roundCoord(clamp(hotspot.point.lat + deltaLat * step, studyBounds.minLat, studyBounds.maxLat)),
                },
              }
            : hotspot,
        ),
      )
      return
    }

    if (!selectedRoute) return

    setRoutes((current) =>
      current.map((route) =>
        route.id !== selectedRoute.id
          ? route
          : activeHandle.kind === 'label'
            ? {
                ...route,
                labelPoint: {
                  lon: roundCoord(clamp(route.labelPoint.lon + deltaLon * step, studyBounds.minLon, studyBounds.maxLon)),
                  lat: roundCoord(clamp(route.labelPoint.lat + deltaLat * step, studyBounds.minLat, studyBounds.maxLat)),
                },
              }
            : {
                ...route,
                points: route.points.map((point, index) =>
                  index === activeHandle.index
                    ? {
                        lon: roundCoord(clamp(point.lon + deltaLon * step, studyBounds.minLon, studyBounds.maxLon)),
                        lat: roundCoord(clamp(point.lat + deltaLat * step, studyBounds.minLat, studyBounds.maxLat)),
                      }
                    : point,
                ),
              },
      ),
    )
  }

  function insertPointAfter(index: number) {
    if (!selectedRoute) return
    setRoutes((current) => current.map((route) => {
      if (route.id !== selectedRoute.id || index >= route.points.length - 1) return route
      const currentPoint = route.points[index]
      const nextPoint = route.points[index + 1]
      const nextPoints = [...route.points]
      nextPoints.splice(index + 1, 0, { lon: roundCoord((currentPoint.lon + nextPoint.lon) / 2), lat: roundCoord((currentPoint.lat + nextPoint.lat) / 2) })
      return { ...route, points: nextPoints }
    }))
    setSelectedHandle({ kind: 'point', routeId: selectedRoute.id, index: index + 1 })
  }

  function removePoint(index: number) {
    if (!selectedRoute || selectedRoute.points.length <= 2) return
    setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points: route.points.filter((_, pointIndex) => pointIndex !== index) } : route))
    setSelectedHandle({ kind: 'point', routeId: selectedRoute.id, index: Math.max(0, index - 1) })
  }

  function resetSelectedRoute() {
    if (!selectedRoute) return
    const resetRoute = defaultRoutes.find((route) => route.id === selectedRoute.id)
    if (!resetRoute) return

    setRoutes((current) => current.map((route) => (route.id === selectedRoute.id ? structuredClone(resetRoute) : route)))
  }

  async function handleCopy(label: string, text: string) { await copyText(text); setCopyStatus(label) }
  function handleCanvasFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (uploadedCanvasUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedCanvasUrl)
    setUploadedCanvasUrl(URL.createObjectURL(file))
    setCanvasUrlInput('')
  }
  function applyCanvasUrl() {
    if (uploadedCanvasUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedCanvasUrl)
    setUploadedCanvasUrl('')
  }
  function clearCanvasLayer() {
    if (uploadedCanvasUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedCanvasUrl)
    setUploadedCanvasUrl('')
    setCanvasUrlInput('')
    setCanvasDisplay({ opacity: 1, brightness: 1 })
  }
  function handleMapFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
    setUploadedMapUrl(URL.createObjectURL(file))
    setMapUrlInput('')
    setMapPresetId('blank')
  }
  function applyMapUrl() {
    if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
    setUploadedMapUrl('')
    setMapPresetId('blank')
  }

  function handleDatasetChange(nextDatasetId: string) {
    setSelectedDatasetId(nextDatasetId)
    persistDatasetSelection(nextDatasetId)
  }

  function selectRoute(routeId: string) {
    const nextRoute = routes.find((route) => route.id === routeId) ?? null
    if (!nextRoute) return
    setSelectedRouteId(nextRoute.id)
    setSelectedHandle({ kind: 'point', routeId: nextRoute.id, index: 0 })
  }

  const selectedObjectName =
    !activeHandle || (!selectedRoute && !selectedHotspot)
      ? 'No selection'
      : activeHandle.kind === 'hotspot'
        ? selectedHotspot?.id ?? 'Hotspot'
        : activeHandle.kind === 'label'
          ? `${selectedRoute?.id ?? routeEntityLabel} tag anchor`
          : `${selectedRoute?.id ?? routeEntityLabel} P${activeHandle.index + 1}`

  return (
    <main className="route-editor-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel">
          <p className="editor-kicker">Main Corridor Studio</p>
          <h1>Representative corridor alignment</h1>
          <p className="editor-copy">The editor now hides the old AIS trajectory playback and uses the representative corridor lines exported by `export_corridors_for_web.py`, matching the comparison image built from the senior cleaned tracks.</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Dataset Source</h2><span>{selectedDataset.label}</span></div>
          <label className="config-field config-field-wide">
            <span>Dataset</span>
            <select value={selectedDataset.id} onChange={(event) => handleDatasetChange(event.target.value)}>
              {availableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="traffic-note">{selectedDataset.description || 'Switch datasets from the shared catalog or open the page with ?dataset=<id>.'}</p>
          <div className="editor-meta-grid editor-dataset-grid">
            <div><small>AIS payload</small><strong>{formatDatasetPath(selectedDataset.aisPlaybackPath)}</strong></div>
            <div><small>Forecast payload</small><strong>{formatDatasetPath(selectedDataset.flowForecastPath)}</strong></div>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>{routeEntityLabel} Selection</h2><span>{selectedRoute?.id ?? `No ${routeEntityLabelPluralLower}`}</span></div>
          <div className="route-chip-grid">
            {routes.map((route) => (
              <button key={route.id} type="button" className={route.id === selectedRoute?.id ? 'route-chip active' : 'route-chip'} onClick={() => selectRoute(route.id)}>
                {route.id}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Extracted Corridors</h2><span>{displayedCorridors.length}</span></div>
          {precomputedCorridorsFile ? (
            <div className="editor-meta-grid">
              <div><small>Source</small><strong>precomputed-corridors.json</strong></div>
              <div><small>Data file</small><strong>{precomputedCorridorsFile.source}</strong></div>
              <div><small>Signature points</small><strong>{precomputedCorridorsFile.signaturePoints}</strong></div>
              <div><small>Corridors</small><strong>{precomputedCorridorsFile.corridorCount}</strong></div>
            </div>
          ) : (
            <div className="editor-meta-grid">
              <div><small>Status</small><strong>Missing representative corridor file</strong></div>
              <div><small>Expected file</small><strong>public/data/precomputed-corridors.json</strong></div>
            </div>
          )}
          <p className="traffic-note">
            {precomputedCorridorsFile
              ? 'Showing the representative corridor lines exported by export_corridors_for_web.py. This is the same lat/lon line set used in the comparison image.'
              : 'RouteEditor could not find the representative corridor JSON. Re-run export_corridors_for_web.py to regenerate it.'}
          </p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Corridor Coverage</h2><span>{selectedRoute?.id ?? `All ${routeEntityLabelPluralLower}`}</span></div>
          <div className="route-count-grid">
            {displayedCorridors.map((corridor) => (
              <button key={`count-${corridor.corridorId}`} type="button" className={corridor.corridorId === selectedRoute?.id ? 'route-count-pill active' : 'route-count-pill'} onClick={() => selectRoute(corridor.corridorId)}>
                <strong>{corridor.corridorId}</strong>
                <span>{corridorTrackCounts[corridor.corridorId] ?? 0} tracks</span>
              </button>
            ))}
          </div>
          <p className="traffic-note">
            {routeSeedMode === 'precomputed-corridors'
              ? 'These counts come from export_corridors_for_web.py and match the representative lines currently shown on the map and in the comparison image.'
              : 'These counts come from the extracted main-corridor member tracks, not from frame-by-frame live playback.'}
          </p>
          {geometryError || playbackError || corridorDataError ? <p className="editor-warning">{geometryError || playbackError || corridorDataError}</p> : null}
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Canvas Base</h2><span>{canvasSource ? 'fixed image' : 'blank'}</span></div>
          <div className="config-grid">
            <label className="config-field config-field-wide"><span>Image URL</span><input value={canvasUrlInput} onChange={(event) => setCanvasUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyCanvasUrl}>Use URL</button>
            <label className="ghost-button upload-button"><span>Upload image</span><input type="file" accept="image/*" onChange={handleCanvasFileChange} /></label>
            <button type="button" className="ghost-button" onClick={clearCanvasLayer}>Clear canvas</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={canvasDisplay.opacity} onChange={(event) => setCanvasDisplay((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={canvasDisplay.brightness} onChange={(event) => setCanvasDisplay((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Satellite Map</h2><span>{mapSource ? 'movable' : 'missing'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'map' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('map')}>Drive map</button>
            <button type="button" className="ghost-button" onClick={resetMapView}>Reset map</button>
          </div>
          <div className="config-grid">
            <label className="config-field config-field-wide">
              <span>Preset</span>
              <select value={mapPresetId} onChange={(event) => { setMapPresetId(event.target.value); if (event.target.value !== 'blank') { setMapUrlInput(''); if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl); setUploadedMapUrl('') } }}>
                {BACKGROUND_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <label className="config-field config-field-wide"><span>Image URL</span><input value={mapUrlInput} onChange={(event) => setMapUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyMapUrl}>Use URL</button>
            <label className="ghost-button upload-button"><span>Upload map</span><input type="file" accept="image/*" onChange={handleMapFileChange} /></label>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Scale</span><input type="range" min="0.25" max="6" step="0.01" value={mapTransform.scale} onChange={(event) => setMapTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset X</span><input type="range" min="-1200" max="1200" step="1" value={mapTransform.offsetX} onChange={(event) => setMapTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset Y</span><input type="range" min="-900" max="900" step="1" value={mapTransform.offsetY} onChange={(event) => setMapTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={mapTransform.opacity} onChange={(event) => setMapTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={mapTransform.brightness} onChange={(event) => setMapTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">Mouse wheel zooms the selected layer. Drag directly on the stage to pan the layer marked as active.</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Corridor Layer</h2><span>{selectedRoute?.id ?? `No ${routeEntityLabelLower}`}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'corridors' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('corridors')}>Drive corridors</button>
            <button type="button" className="ghost-button" onClick={resetCorridorView}>Reset corridors</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Scale</span><input type="range" min="0.25" max="6" step="0.01" value={corridorTransform.scale} onChange={(event) => setCorridorTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset X</span><input type="range" min="-1200" max="1200" step="1" value={corridorTransform.offsetX} onChange={(event) => setCorridorTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset Y</span><input type="range" min="-900" max="900" step="1" value={corridorTransform.offsetY} onChange={(event) => setCorridorTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={corridorTransform.opacity} onChange={(event) => setCorridorTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={corridorTransform.brightness} onChange={(event) => setCorridorTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">This layer renders the same representative corridor lines shown in the export comparison image. Original vessel trajectories, current ship markers, autoplay, and playback timeline are all hidden.</p>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>Corridor List</h2><span>{corridorDisplayLayers.length} kept</span></div>
          <div className="corridor-list">
            {corridorDisplayLayers.map((corridor) => (
              <button key={corridor.corridorId} type="button" className={corridor.corridorId === selectedRoute?.id ? 'corridor-row active' : 'corridor-row'} onClick={() => selectRoute(corridor.corridorId)}>
                <div className="corridor-row-head">
                  <strong>{corridor.corridorId}</strong>
                  <span>{corridor.trackCount} tracks</span>
                </div>
                <small>{corridor.directionLabel}</small>
                <small>{corridor.representativePoints.length} representative points</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Selected Object</h2><span>{selectedObjectName}</span></div>
          <div className="editor-meta-grid"><div><small>Longitude</small><strong>{selectedPoint.lon.toFixed(6)}</strong></div><div><small>Latitude</small><strong>{selectedPoint.lat.toFixed(6)}</strong></div></div>
          <div className="nudge-head"><label htmlFor="nudge-step">Nudge step</label><input id="nudge-step" value={nudgeStep} onChange={(event) => setNudgeStep(event.target.value)} /></div>
          <div className="nudge-grid">
            <button type="button" onClick={() => updateSelectedPoint(0, 1)}>Up</button>
            <button type="button" onClick={() => updateSelectedPoint(-1, 0)}>Left</button>
            <button type="button" onClick={() => updateSelectedPoint(1, 0)}>Right</button>
            <button type="button" onClick={() => updateSelectedPoint(0, -1)}>Down</button>
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>{routeEntityLabel} Points</h2><button type="button" className="ghost-button" onClick={() => selectedRoute && setSelectedHandle({ kind: 'label', routeId: selectedRoute.id })} disabled={!selectedRoute}>Select tag anchor</button></div>
          <p className="traffic-note">
            {routeSeedMode === 'precomputed-corridors'
              ? 'These lat/lon points are the representative lines replotted by export_corridors_for_web.py. Editing them changes the displayed corridor and tag anchor together.'
              : 'Numbered points change the route shape. The draggable tag only changes label position.'}
          </p>
          <div className="point-list">
            {(selectedRoute?.points ?? []).map((point, index) => (
              <div key={`${selectedRoute?.id ?? routeEntityLabelLower}-${index}`} className={activeHandle?.kind === 'point' && activeHandle.routeId === selectedRoute?.id && activeHandle.index === index ? 'point-row active' : 'point-row'}>
                <button type="button" className="point-main" onClick={() => selectedRoute && setSelectedHandle({ kind: 'point', routeId: selectedRoute.id, index })}>
                  <span>P{index + 1}</span>
                  <small>{point.lon.toFixed(4)}, {point.lat.toFixed(4)}</small>
                </button>
                <div className="point-actions">
                  {index < (selectedRoute?.points.length ?? 0) - 1 ? <button type="button" className="ghost-button" onClick={() => insertPointAfter(index)}>+ Insert</button> : null}
                  <button type="button" className="ghost-button danger" onClick={() => removePoint(index)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Hotspots</h2><button type="button" className="ghost-button" onClick={() => { const nextHotspots = geometryConfig ? buildHotspotDrafts(geometryConfig) : []; setHotspots(nextHotspots); if (nextHotspots[0]) setSelectedHandle({ kind: 'hotspot', hotspotId: nextHotspots[0].id }) }}>Reset hotspots</button></div>
          <div className="hotspot-list">
            {hotspots.map((hotspot) => (
              <button key={hotspot.id} type="button" className={activeHandle?.kind === 'hotspot' && activeHandle.hotspotId === hotspot.id ? 'hotspot-row active' : 'hotspot-row'} onClick={() => setSelectedHandle({ kind: 'hotspot', hotspotId: hotspot.id })}>
                <span>{hotspot.id}</span>
                <small>{hotspot.point.lon.toFixed(4)}, {hotspot.point.lat.toFixed(4)}</small>
                <strong>{hotspotVisuals[hotspot.id]?.level ?? 'watch'} · now {(hotspotVisuals[hotspot.id]?.intensity ?? 0).toFixed(2)}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Export</h2><span>{copyStatus || 'Ready'}</span></div>
          <div className="export-actions">
            <button type="button" onClick={() => selectedRoute && handleCopy(`${selectedRoute.id} copied`, JSON.stringify({ id: selectedRoute.id, corridorId: selectedRoute.corridorId, directionLabel: selectedRoute.directionLabel, labelPoint: selectedRoute.labelPoint, marker: { baseDurationSeconds: selectedRoute.markerConfig.baseDur, radius: selectedRoute.markerConfig.radius }, points: selectedRoute.points }, null, 2))} disabled={!selectedRoute}>Copy {routeEntityLabelLower} JSON</button>
            <button type="button" onClick={() => handleCopy(`${routeEntityLabelPlural} copied`, routeExportText)}>Copy {routeEntityLabelPluralLower} JSON</button>
            <button type="button" onClick={() => selectedHotspot && handleCopy(`${selectedHotspot.id} copied`, JSON.stringify({ id: selectedHotspot.id, routeId: geometryConfig?.routeFocusMap[selectedHotspot.id] ?? '', point: selectedHotspot.point }, null, 2))} disabled={!selectedHotspot}>Copy hotspot JSON</button>
            <button type="button" onClick={() => handleCopy('Geometry copied', geometryExportText)} disabled={!geometryConfig || routeSeedMode !== 'shared-geometry'}>Copy full geometry JSON</button>
            <button type="button" className="ghost-button" onClick={resetSelectedRoute} disabled={!selectedRoute}>Reset current {routeEntityLabelLower}</button>
          </div>
          <p className="traffic-note">
            {routeSeedMode === 'precomputed-corridors'
              ? 'Editable trajectories are currently seeded from public/data/precomputed-corridors.json, generated by export_corridors_for_web.py. Export the corridor JSON here when you want the current representative lat/lon lines.'
              : 'Shared target: overwrite public/data/shared-geometry.json after calibration.'}
          </p>
          <textarea readOnly value={geometryExportText} className="export-box" />
          <textarea readOnly value={hotspotExportText} className="export-box hotspot-export-box" />
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div><strong>Corridor Source</strong><span>{precomputedCorridorsFile ? `precomputed-corridors.json | ${precomputedCorridorsFile.source} | ${precomputedCorridorsFile.corridorCount} representative corridors` : `Loading ${selectedDataset.label}...`}</span></div>
          <div><strong>Cursor</strong><span>{cursor ? `${cursor.lon.toFixed(6)}, ${cursor.lat.toFixed(6)} (${cursor.xPercent.toFixed(1)}%, ${cursor.yPercent.toFixed(1)}%)` : 'Move on map'}</span></div>
        </div>

        <div
          ref={stageRef}
          className={stagePan ? 'editor-stage is-panning' : 'editor-stage'}
          data-active-layer={activeTransformLayer}
          onPointerMove={handleStagePointerMove}
          onPointerDown={handleStagePointerDown}
          onWheel={handleStageWheel}
        >
          <div className="editor-canvas-base">
            {canvasSource ? <img src={canvasSource} alt="canvas base" className="editor-canvas-image" style={canvasStyle} /> : <div className="editor-stage-empty" style={canvasStyle}>Canvas base fixed</div>}
          </div>

          <div className="editor-satellite-layer" style={mapLayerStyle}>
            {mapSource ? <img src={mapSource} alt="satellite map" className="editor-satellite-image" /> : <div className="editor-stage-empty">No satellite map</div>}
          </div>

          <div className="editor-corridor-layer" style={corridorLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {corridorDisplayLayers.map((corridor) => (
                <path
                  key={corridor.corridorId}
                  d={corridor.path}
                  className={corridor.corridorId === selectedRouteId ? 'editor-corridor-path focus' : 'editor-corridor-path'}
                  style={{ stroke: corridorColors[corridor.corridorId] ?? '#7dd3fc' }}
                />
              ))}
            </svg>
            {corridorDisplayLayers.map((corridor) => (
              <div
                key={`corridor-tag-${corridor.corridorId}`}
                className={corridor.corridorId === selectedRoute?.id ? 'editor-corridor-tag active' : 'editor-corridor-tag'}
                style={{ left: `${corridor.label.x}%`, top: `${corridor.label.y}%` }}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} tracks</span>
              </div>
            ))}
          </div>

          <div className="editor-geometry-layer" style={corridorLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {selectedRouteGeometry ? <path d={selectedRouteGeometry.path} className="editor-route-guide" /> : null}
            </svg>

            {selectedRouteGeometry ? (
              <button
                key={`label-${selectedRouteGeometry.id}`}
                type="button"
                className={activeHandle?.kind === 'label' && activeHandle.routeId === selectedRouteGeometry.id ? 'editor-label-anchor active' : 'editor-label-anchor'}
                style={{ left: `${selectedRouteGeometry.label.x}%`, top: `${selectedRouteGeometry.label.y}%` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedRouteId(selectedRouteGeometry.id)
                  setSelectedHandle({ kind: 'label', routeId: selectedRouteGeometry.id })
                }}
              >
                <strong>{selectedRouteGeometry.id}</strong>
                <span>EDIT</span>
              </button>
            ) : null}

            {selectedRouteGeometry
              ? selectedRouteGeometry.points.map((point) => (
                <button
                  key={`handle-${selectedRouteGeometry.id}-${point.id}`}
                  type="button"
                  className={[
                    'editor-handle',
                    'point',
                    'selected-route',
                    activeHandle?.kind === 'point' && activeHandle.routeId === selectedRouteGeometry.id && activeHandle.index === point.index ? 'active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: `${point.position.x}%`, top: `${point.position.y}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedRouteId(selectedRouteGeometry.id)
                    setSelectedHandle({ kind: 'point', routeId: selectedRouteGeometry.id, index: point.index })
                  }}
                >
                  {point.index + 1}
                </button>
                ))
              : null}

            {hotspotGeometryLayers.map((hotspot) => {
              const className = [
                'editor-hotspot',
                hotspot.visual.level === 'medium' ? 'level-medium' : hotspot.visual.level === 'high' ? 'level-high' : '',
                activeHandle?.kind === 'hotspot' && activeHandle.hotspotId === hotspot.id ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const style = {
                left: `${hotspot.position.x}%`,
                top: `${hotspot.position.y}%`,
                width: `${hotspot.visual.size}px`,
                height: `${hotspot.visual.size}px`,
                opacity: hotspot.visual.opacity,
                ['--hotspot-alpha' as string]: hotspot.visual.opacity,
              } as CSSProperties

              return (
                <button
                  key={`hotspot-${hotspot.id}`}
                  type="button"
                  className={className}
                  style={style}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedHandle({ kind: 'hotspot', hotspotId: hotspot.id })
                  }}
                >
                  <span>{hotspot.id}</span>
                </button>
              )
            })}
          </div>

          <div className="editor-stage-hud">
            <div><strong>Active drag</strong><span>{activeTransformLayer === 'map' ? 'Satellite map' : 'Extracted corridors'}</span></div>
            <div><strong>Selected {routeEntityLabelLower}</strong><span>{selectedRoute?.id ?? `No ${routeEntityLabelLower}`}</span></div>
            <div><strong>Kept data</strong><span>{corridorDisplayLayers.length} representative lines</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}
