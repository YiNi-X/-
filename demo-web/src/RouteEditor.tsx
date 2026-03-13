import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

type GeoPoint = {
  lon: number
  lat: number
}

type MarkerConfig = {
  baseDur: number
  count: number
  radius: number
}

type RouteDraft = {
  id: string
  labelPoint: GeoPoint
  points: GeoPoint[]
  markerConfig: MarkerConfig
}

type HotspotDraft = {
  id: string
  point: GeoPoint
  intensities: number[]
}

type RoutePointHandle = {
  kind: 'point'
  routeId: string
  index: number
}

type RouteLabelHandle = {
  kind: 'label'
  routeId: string
}

type HotspotHandle = {
  kind: 'hotspot'
  hotspotId: string
}

type SelectedHandle = RoutePointHandle | RouteLabelHandle | HotspotHandle

type CursorState = {
  lon: number
  lat: number
  xPercent: number
  yPercent: number
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

const INITIAL_ROUTES: RouteDraft[] = [
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
    markerConfig: { baseDur: 10.2, count: 3, radius: 4.6 },
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
    markerConfig: { baseDur: 9.4, count: 2, radius: 4.2 },
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
    markerConfig: { baseDur: 11.6, count: 4, radius: 4.8 },
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
    markerConfig: { baseDur: 8.4, count: 4, radius: 4.6 },
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
    markerConfig: { baseDur: 11, count: 3, radius: 4.4 },
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
    markerConfig: { baseDur: 9.8, count: 4, radius: 4.3 },
  },
]

const INITIAL_HOTSPOTS: HotspotDraft[] = [
  { id: 'G03', point: { lon: 113.769683, lat: 22.498253 }, intensities: [0.28, 0.46, 0.58, 0.44, 1] },
  { id: 'G25', point: { lon: 113.733276, lat: 22.281927 }, intensities: [0.25, 0.35, 0.8, 1, 0.72] },
  { id: 'G60', point: { lon: 113.77211, lat: 22.284228 }, intensities: [0.58, 0.72, 0.74, 0.71, 0.75] },
  { id: 'G15', point: { lon: 113.753232, lat: 22.444747 }, intensities: [0.36, 0.3, 0.55, 0.76, 0.78] },
]

function roundCoord(value: number) {
  return Number(value.toFixed(6))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function geoToPercent(point: GeoPoint) {
  const x = ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * 100
  const y = ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * 100

  return { x, y }
}

function geoToSvg(point: GeoPoint) {
  return {
    x: ((point.lon - STUDY_BOUNDS.minLon) / (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)) * MAP_VIEWBOX.width,
    y: ((STUDY_BOUNDS.maxLat - point.lat) / (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)) * MAP_VIEWBOX.height,
  }
}

function svgToGeo(xRatio: number, yRatio: number) {
  const lon = STUDY_BOUNDS.minLon + xRatio * (STUDY_BOUNDS.maxLon - STUDY_BOUNDS.minLon)
  const lat = STUDY_BOUNDS.maxLat - yRatio * (STUDY_BOUNDS.maxLat - STUDY_BOUNDS.minLat)

  return {
    lon: roundCoord(lon),
    lat: roundCoord(lat),
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

function formatPoint(point: GeoPoint) {
  return `{ lon: ${point.lon.toFixed(6)}, lat: ${point.lat.toFixed(6)} }`
}

function formatRoute(route: RouteDraft) {
  const points = route.points.map((point) => `      ${formatPoint(point)},`).join('\n')

  return [
    '  {',
    `    id: '${route.id}',`,
    `    labelPoint: ${formatPoint(route.labelPoint)},`,
    '    points: [',
    points,
    '    ],',
    `    markers: createMarkers(${route.markerConfig.baseDur}, ${route.markerConfig.count}, ${route.markerConfig.radius}),`,
    '  },',
  ].join('\n')
}

function formatRoutes(routes: RouteDraft[]) {
  return ['const routeBlueprints: RouteBlueprint[] = [', ...routes.map((route) => formatRoute(route)), ']'].join('\n')
}

function formatHotspot(hotspot: HotspotDraft) {
  const intensities = hotspot.intensities.join(', ')

  return `  { id: '${hotspot.id}', ...geoToNumericPercent(${formatPoint(hotspot.point)}), intensities: [${intensities}] },`
}

function formatHotspots(hotspots: HotspotDraft[]) {
  return ['const hotspots: Hotspot[] = [', ...hotspots.map((hotspot) => formatHotspot(hotspot)), ']'].join('\n')
}

function buildMarkers(baseDur: number, count: number, radius: number) {
  const safeCount = Math.max(0, Math.round(count))

  return Array.from({ length: safeCount }, (_, index) => ({
    id: `m${index + 1}`,
    dur: Number((Math.max(2, baseDur) + index * 1.15).toFixed(1)),
    begin: Number((-(Math.max(2, baseDur) / Math.max(safeCount, 1)) * index).toFixed(1)),
    radius: Number((Math.max(1.8, radius) - (index % 2) * 0.4).toFixed(1)),
  }))
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function getHotspotVisual(hotspot: HotspotDraft) {
  const intensity = Math.max(...hotspot.intensities)

  return {
    size: 28 + intensity * 34,
    opacity: 0.22 + intensity * 0.4,
  }
}

export function RouteEditor() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [routes, setRoutes] = useState<RouteDraft[]>(INITIAL_ROUTES)
  const [hotspots, setHotspots] = useState<HotspotDraft[]>(INITIAL_HOTSPOTS)
  const [selectedRouteId, setSelectedRouteId] = useState(INITIAL_ROUTES[0].id)
  const [selectedHandle, setSelectedHandle] = useState<SelectedHandle>({ kind: 'point', routeId: INITIAL_ROUTES[0].id, index: 0 })
  const [dragging, setDragging] = useState<SelectedHandle | null>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [nudgeStep, setNudgeStep] = useState('0.0015')

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0]
  const selectedHotspot = selectedHandle.kind === 'hotspot' ? hotspots.find((hotspot) => hotspot.id === selectedHandle.hotspotId) ?? hotspots[0] : hotspots[0]
  const selectedPoint =
    selectedHandle.kind === 'hotspot'
      ? selectedHotspot.point
      : selectedHandle.kind === 'point' && selectedHandle.routeId === selectedRoute.id
        ? selectedRoute.points[selectedHandle.index]
        : selectedRoute.labelPoint

  const routeExportText = useMemo(() => formatRoutes(routes), [routes])
  const selectedRouteExportText = useMemo(() => formatRoute(selectedRoute), [selectedRoute])
  const hotspotExportText = useMemo(() => formatHotspots(hotspots), [hotspots])
  const selectedHotspotExportText = useMemo(() => formatHotspot(selectedHotspot), [selectedHotspot])

  useEffect(() => {
    if (!dragging) return
    const activeHandle = dragging

    function handlePointerMove(event: PointerEvent) {
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return

      const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
      const nextPoint = svgToGeo(xRatio, yRatio)

      if (activeHandle.kind === 'hotspot') {
        setHotspots((current) =>
          current.map((hotspot) =>
            hotspot.id === activeHandle.hotspotId
              ? {
                  ...hotspot,
                  point: nextPoint,
                }
              : hotspot,
          ),
        )
        return
      }

      setRoutes((current) =>
        current.map((route) => {
          if (route.id !== activeHandle.routeId) return route

          if (activeHandle.kind === 'label') {
            return {
              ...route,
              labelPoint: nextPoint,
            }
          }

          return {
            ...route,
            points: route.points.map((point, index) => (index === activeHandle.index ? nextPoint : point)),
          }
        }),
      )
    }

    function handlePointerUp() {
      setDragging(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging])

  useEffect(() => {
    if (!copyStatus) return

    const timer = window.setTimeout(() => setCopyStatus(''), 1600)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  function updateSelectedPoint(deltaLon: number, deltaLat: number) {
    const step = Number.parseFloat(nudgeStep)
    if (Number.isNaN(step)) return

    if (selectedHandle.kind === 'hotspot') {
      setHotspots((current) =>
        current.map((hotspot) =>
          hotspot.id === selectedHandle.hotspotId
            ? {
                ...hotspot,
                point: {
                  lon: roundCoord(clamp(hotspot.point.lon + deltaLon * step, STUDY_BOUNDS.minLon, STUDY_BOUNDS.maxLon)),
                  lat: roundCoord(clamp(hotspot.point.lat + deltaLat * step, STUDY_BOUNDS.minLat, STUDY_BOUNDS.maxLat)),
                },
              }
            : hotspot,
        ),
      )
      return
    }

    setRoutes((current) =>
      current.map((route) => {
        if (route.id !== selectedRoute.id) return route

        if (selectedHandle.kind === 'label') {
          return {
            ...route,
            labelPoint: {
              lon: roundCoord(clamp(route.labelPoint.lon + deltaLon * step, STUDY_BOUNDS.minLon, STUDY_BOUNDS.maxLon)),
              lat: roundCoord(clamp(route.labelPoint.lat + deltaLat * step, STUDY_BOUNDS.minLat, STUDY_BOUNDS.maxLat)),
            },
          }
        }

        return {
          ...route,
          points: route.points.map((point, index) =>
            index === selectedHandle.index
              ? {
                  lon: roundCoord(clamp(point.lon + deltaLon * step, STUDY_BOUNDS.minLon, STUDY_BOUNDS.maxLon)),
                  lat: roundCoord(clamp(point.lat + deltaLat * step, STUDY_BOUNDS.minLat, STUDY_BOUNDS.maxLat)),
                }
              : point,
          ),
        }
      }),
    )
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return

    const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    const nextGeo = svgToGeo(xRatio, yRatio)

    setCursor({
      ...nextGeo,
      xPercent: xRatio * 100,
      yPercent: yRatio * 100,
    })
  }

  function handlePointerStart(handle: SelectedHandle) {
    if (handle.kind !== 'hotspot') {
      setSelectedRouteId(handle.routeId)
    }

    setSelectedHandle(handle)
    setDragging(handle)
  }

  function insertPointAfter(index: number) {
    setRoutes((current) =>
      current.map((route) => {
        if (route.id !== selectedRoute.id) return route

        const nextPoint = route.points[index + 1]
        const currentPoint = route.points[index]
        if (!currentPoint || !nextPoint) return route

        const midpoint = {
          lon: roundCoord((currentPoint.lon + nextPoint.lon) / 2),
          lat: roundCoord((currentPoint.lat + nextPoint.lat) / 2),
        }

        const nextPoints = [...route.points]
        nextPoints.splice(index + 1, 0, midpoint)

        return {
          ...route,
          points: nextPoints,
        }
      }),
    )

    setSelectedHandle({ kind: 'point', routeId: selectedRoute.id, index: index + 1 })
  }

  function removePoint(index: number) {
    if (selectedRoute.points.length <= 2) return

    setRoutes((current) =>
      current.map((route) => {
        if (route.id !== selectedRoute.id) return route

        return {
          ...route,
          points: route.points.filter((_, pointIndex) => pointIndex !== index),
        }
      }),
    )

    setSelectedHandle({
      kind: 'point',
      routeId: selectedRoute.id,
      index: Math.max(0, index - 1),
    })
  }

  function changeRoute(routeId: string) {
    setSelectedRouteId(routeId)
    setSelectedHandle({ kind: 'point', routeId, index: 0 })
  }

  function selectHotspot(hotspotId: string) {
    setSelectedHandle({ kind: 'hotspot', hotspotId })
  }

  async function handleCopyCurrentRoute() {
    await copyText(selectedRouteExportText)
    setCopyStatus(`${selectedRoute.id} copied`)
  }

  async function handleCopyAllRoutes() {
    await copyText(routeExportText)
    setCopyStatus('All routes copied')
  }

  async function handleCopyHotspots() {
    await copyText(hotspotExportText)
    setCopyStatus('Hotspots copied')
  }

  async function handleCopyCurrentHotspot() {
    await copyText(selectedHotspotExportText)
    setCopyStatus(`${selectedHotspot.id} copied`)
  }

  function handleResetCurrentRoute() {
    const resetRoute = INITIAL_ROUTES.find((route) => route.id === selectedRoute.id)
    if (!resetRoute) return

    setRoutes((current) => current.map((route) => (route.id === selectedRoute.id ? structuredClone(resetRoute) : route)))
  }

  function updateMarkerConfig(field: keyof MarkerConfig, value: number) {
    if (Number.isNaN(value)) return

    setRoutes((current) =>
      current.map((route) => {
        if (route.id !== selectedRoute.id) return route

        if (field === 'count') {
          return {
            ...route,
            markerConfig: {
              ...route.markerConfig,
              count: Math.max(0, Math.round(value)),
            },
          }
        }

        return {
          ...route,
          markerConfig: {
            ...route.markerConfig,
            [field]: Number((field === 'baseDur' ? Math.max(2, value) : Math.max(1.8, value)).toFixed(2)),
          },
        }
      }),
    )
  }

  function handleResetHotspots() {
    setHotspots(structuredClone(INITIAL_HOTSPOTS))
    setSelectedHandle({ kind: 'hotspot', hotspotId: INITIAL_HOTSPOTS[0].id })
  }

  const selectedObjectName =
    selectedHandle.kind === 'hotspot' ? selectedHotspot.id : selectedHandle.kind === 'label' ? `${selectedRoute.id} tag anchor` : `${selectedRoute.id} P${selectedHandle.index + 1}`

  return (
    <main className="route-editor-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel">
          <p className="editor-kicker">Route Editor</p>
          <h1>轨迹与热区可视化调试台</h1>
          <p className="editor-copy">同一张底图上同时调整主航路和热区位置。调完后直接复制右侧代码块，贴回主站配置。</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head">
            <h2>航路选择</h2>
            <span>{selectedRoute.id}</span>
          </div>
          <div className="route-chip-grid">
            {routes.map((route) => (
              <button key={route.id} type="button" className={route.id === selectedRoute.id ? 'route-chip active' : 'route-chip'} onClick={() => changeRoute(route.id)}>
                {route.id}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head">
            <h2>Selected Object</h2>
            <span>{selectedObjectName}</span>
          </div>
          <div className="editor-meta-grid">
            <div>
              <small>Longitude</small>
              <strong>{selectedPoint.lon.toFixed(6)}</strong>
            </div>
            <div>
              <small>Latitude</small>
              <strong>{selectedPoint.lat.toFixed(6)}</strong>
            </div>
          </div>
          <div className="nudge-head">
            <label htmlFor="nudge-step">Nudge step</label>
            <input id="nudge-step" value={nudgeStep} onChange={(event) => setNudgeStep(event.target.value)} />
          </div>
          <div className="nudge-grid">
            <button type="button" onClick={() => updateSelectedPoint(0, 1)}>
              Up
            </button>
            <button type="button" onClick={() => updateSelectedPoint(-1, 0)}>
              Left
            </button>
            <button type="button" onClick={() => updateSelectedPoint(1, 0)}>
              Right
            </button>
            <button type="button" onClick={() => updateSelectedPoint(0, -1)}>
              Down
            </button>
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head">
            <h2>Route Points</h2>
            <button type="button" className="ghost-button" onClick={() => setSelectedHandle({ kind: 'label', routeId: selectedRoute.id })}>
              Select tag anchor
            </button>
          </div>
          <p className="traffic-note">Numbered circles change the route shape. The draggable Cxx tag only changes the route label position.</p>
          <div className="point-list">
            {selectedRoute.points.map((point, index) => (
              <div key={`${selectedRoute.id}-${index}`} className={selectedHandle.kind === 'point' && selectedHandle.routeId === selectedRoute.id && selectedHandle.index === index ? 'point-row active' : 'point-row'}>
                <button type="button" className="point-main" onClick={() => setSelectedHandle({ kind: 'point', routeId: selectedRoute.id, index })}>
                  <span>P{index + 1}</span>
                  <small>
                    {point.lon.toFixed(4)}, {point.lat.toFixed(4)}
                  </small>
                </button>
                <div className="point-actions">
                  {index < selectedRoute.points.length - 1 ? (
                    <button type="button" className="ghost-button" onClick={() => insertPointAfter(index)}>
                      + Insert
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button danger" onClick={() => removePoint(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head">
            <h2>Traffic Density</h2>
            <span>{selectedRoute.id}</span>
          </div>
          <div className="config-grid">
            <label className="config-field">
              <span>Ship count</span>
              <input
                type="number"
                min="0"
                step="1"
                value={selectedRoute.markerConfig.count}
                onChange={(event) => updateMarkerConfig('count', Number(event.target.value))}
              />
            </label>
            <label className="config-field">
              <span>Base speed</span>
              <input
                type="number"
                min="2"
                step="0.1"
                value={selectedRoute.markerConfig.baseDur}
                onChange={(event) => updateMarkerConfig('baseDur', Number(event.target.value))}
              />
            </label>
            <label className="config-field">
              <span>Dot size</span>
              <input
                type="number"
                min="2"
                step="0.1"
                value={selectedRoute.markerConfig.radius}
                onChange={(event) => updateMarkerConfig('radius', Number(event.target.value))}
              />
            </label>
          </div>
          <p className="traffic-note">
            Numbered circles are route control points. Moving arrow markers are ships. `Ship count` controls how many ships appear on this route, and `0`
            temporarily hides them.
          </p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head">
            <h2>Hotspots</h2>
            <button type="button" className="ghost-button" onClick={handleResetHotspots}>
              Reset hotspots
            </button>
          </div>
          <div className="hotspot-list">
            {hotspots.map((hotspot) => {
              const intensity = Math.max(...hotspot.intensities)

              return (
                <button
                  key={hotspot.id}
                  type="button"
                  className={selectedHandle.kind === 'hotspot' && selectedHandle.hotspotId === hotspot.id ? 'hotspot-row active' : 'hotspot-row'}
                  onClick={() => selectHotspot(hotspot.id)}
                >
                  <span>{hotspot.id}</span>
                  <small>
                    {hotspot.point.lon.toFixed(4)}, {hotspot.point.lat.toFixed(4)}
                  </small>
                  <strong>peak {intensity.toFixed(2)}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head">
            <h2>Export</h2>
            <span>{copyStatus || 'Ready'}</span>
          </div>
          <div className="export-actions">
            <button type="button" onClick={handleCopyCurrentRoute}>
              Copy route
            </button>
            <button type="button" onClick={handleCopyAllRoutes}>
              Copy all routes
            </button>
            <button type="button" onClick={handleCopyCurrentHotspot}>
              Copy hotspot
            </button>
            <button type="button" onClick={handleCopyHotspots}>
              Copy all hotspots
            </button>
            <button type="button" className="ghost-button" onClick={handleResetCurrentRoute}>
              Reset current route
            </button>
          </div>
          <textarea readOnly value={selectedRouteExportText} className="export-box" />
          <textarea readOnly value={hotspotExportText} className="export-box hotspot-export-box" />
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div>
            <strong>Study Bounds</strong>
            <span>
              {STUDY_BOUNDS.minLon.toFixed(6)} - {STUDY_BOUNDS.maxLon.toFixed(6)} / {STUDY_BOUNDS.minLat.toFixed(6)} - {STUDY_BOUNDS.maxLat.toFixed(6)}
            </span>
          </div>
          <div>
            <strong>Cursor</strong>
            <span>{cursor ? `${cursor.lon.toFixed(6)}, ${cursor.lat.toFixed(6)} (${cursor.xPercent.toFixed(1)}%, ${cursor.yPercent.toFixed(1)}%)` : 'move on map'}</span>
          </div>
        </div>

        <div ref={stageRef} className="editor-stage" onPointerMove={handleStagePointerMove}>
          <img src="/static-port-map.jpg" alt="route editor background" className="editor-stage-image" />
          <svg className="editor-stage-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="none">
            {routes.map((route) => {
              const path = createSmoothPath(route.points)
              const markers = buildMarkers(route.markerConfig.baseDur, route.markerConfig.count, route.markerConfig.radius)

              return (
                <g key={route.id}>
                  <path d={path} className={route.id === selectedRoute.id ? 'editor-route active' : 'editor-route'} />
                  {markers.map((marker) => (
                    <g key={`${route.id}-${marker.id}`} className={route.id === selectedRoute.id ? 'editor-traffic-ship active' : 'editor-traffic-ship'}>
                      <path
                        d={`M ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${(-(marker.radius * 1.68) * 0.74).toFixed(1)} L ${((marker.radius * 1.68) + 4).toFixed(1)} 0 L ${(-(marker.radius * 1.68) - 4).toFixed(1)} ${((marker.radius * 1.68) * 0.74).toFixed(1)} L ${(-(marker.radius * 1.68) * 0.18).toFixed(1)} 0 Z`}
                      />
                      <animateMotion dur={`${marker.dur}s`} begin={`${marker.begin}s`} repeatCount="indefinite" rotate="auto" path={path} />
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>

          {hotspots.map((hotspot) => {
            const position = geoToPercent(hotspot.point)
            const visual = getHotspotVisual(hotspot)
            const style = {
              left: `${position.x}%`,
              top: `${position.y}%`,
              width: `${visual.size}px`,
              height: `${visual.size}px`,
              '--hotspot-alpha': visual.opacity.toFixed(2),
            } as CSSProperties & Record<'--hotspot-alpha', string>

            return (
              <button
                key={hotspot.id}
                type="button"
                className={selectedHandle.kind === 'hotspot' && selectedHandle.hotspotId === hotspot.id ? 'editor-hotspot active' : 'editor-hotspot'}
                style={style}
                onPointerDown={() => handlePointerStart({ kind: 'hotspot', hotspotId: hotspot.id })}
              >
                <span>{hotspot.id}</span>
              </button>
            )
          })}

          {routes.map((route) => {
            const routeLabelPosition = geoToPercent(route.labelPoint)

            return (
              <button
                key={`${route.id}-label`}
                type="button"
                className={route.id === selectedRoute.id && selectedHandle.kind === 'label' && selectedHandle.routeId === route.id ? 'editor-label-anchor active' : 'editor-label-anchor'}
                style={{ left: `${routeLabelPosition.x}%`, top: `${routeLabelPosition.y}%` }}
                onPointerDown={() => handlePointerStart({ kind: 'label', routeId: route.id })}
                title={`Drag to move ${route.id} tag`}
              >
                <strong>{route.id}</strong>
                <span>TAG</span>
              </button>
            )
          })}

          {routes.flatMap((route) =>
            route.points.map((point, index) => {
              const pointPosition = geoToPercent(point)
              const isSelected = selectedHandle.kind === 'point' && selectedHandle.routeId === route.id && selectedHandle.index === index

              return (
                <button
                  key={`${route.id}-p${index}`}
                  type="button"
                  className={isSelected ? 'editor-handle point active' : route.id === selectedRoute.id ? 'editor-handle point selected-route' : 'editor-handle point'}
                  style={{ left: `${pointPosition.x}%`, top: `${pointPosition.y}%` }}
                  onPointerDown={() => handlePointerStart({ kind: 'point', routeId: route.id, index })}
                >
                  {index + 1}
                </button>
              )
            }),
          )}
        </div>
      </section>
    </main>
  )
}
