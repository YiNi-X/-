import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveRuntimeResource } from './datasetCatalog'
import type {
  GeoPoint,
  MainCorridorTrackEntry,
  MainCorridorTracksFile,
  StudyBounds,
} from './sharedContracts'
import { loadPublicJson } from './sharedContracts'

type SelectedHandle =
  | { kind: 'point'; trackId: string; index: number }
  | { kind: 'label'; trackId: string }

type CursorState = { lon: number; lat: number; xPercent: number; yPercent: number }
type LayerTransform = { scale: number; offsetX: number; offsetY: number; opacity: number; brightness: number }
type FixedLayerDisplay = { opacity: number; brightness: number }
type TransformLayerTarget = 'map' | 'tracks'
type StagePanState = { target: TransformLayerTarget; startX: number; startY: number; originX: number; originY: number }
type GeoViewport = { width: number; height: number; offsetX: number; offsetY: number }

const CLEANED_TRACKS_PATH = 'data/main-corridor-tracks.json'
const STUDY_BOUNDS = { minLon: 113.558356434, maxLon: 113.95835643400001, minLat: 22.155739805, maxLat: 22.635739805 }
const MAP_VIEWBOX = { width: 1920, height: 1080 }
const BACKGROUND_PRESETS = [
  { id: 'port-map', label: 'Static Port Map', src: 'static-port-map.jpg' },
  { id: 'blank', label: 'No Background', src: '' },
]
const CORRIDOR_COLORS = ['#3a86ff', '#00bbf9', '#06d6a0', '#80ed99', '#ffd166', '#f4a261', '#ef476f', '#9b5de5', '#4cc9f0', '#f72585']
const METERS_PER_DEGREE = 111_000
const EMPTY_CORRIDOR_SUMMARIES: MainCorridorTracksFile['corridors'] = []
const EMPTY_TRACKS: MainCorridorTrackEntry[] = []

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const roundCoord = (value: number) => Number(value.toFixed(6))
const resolvePageAsset = (value: string) => new URL(value.replace(/^\//, ''), window.location.href).toString()

function cloneTrack(track: MainCorridorTrackEntry): MainCorridorTrackEntry {
  return {
    ...track,
    labelPoint: { ...track.labelPoint },
    points: track.points.map((point) => ({ ...point })),
  }
}

function buildTrackLookup(tracks: MainCorridorTrackEntry[]) {
  return Object.fromEntries(tracks.map((track) => [track.id, cloneTrack(track)])) as Record<string, MainCorridorTrackEntry>
}

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

function geoToPercent(point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const xRatio = clamp((point.lon - bounds.minLon) / Math.max(bounds.maxLon - bounds.minLon, Number.EPSILON), 0, 1)
  const yRatio = clamp((bounds.maxLat - point.lat) / Math.max(bounds.maxLat - bounds.minLat, Number.EPSILON), 0, 1)
  return {
    x: ((viewport.offsetX + xRatio * viewport.width) / MAP_VIEWBOX.width) * 100,
    y: ((viewport.offsetY + yRatio * viewport.height) / MAP_VIEWBOX.height) * 100,
  }
}

const geoToSvg = (point: GeoPoint, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) =>
  percentToSvg(geoToPercent(point, bounds, viewport))

function svgToGeo(xRatio: number, yRatio: number, bounds: StudyBounds = STUDY_BOUNDS, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const svgX = xRatio * MAP_VIEWBOX.width
  const svgY = yRatio * MAP_VIEWBOX.height
  const innerX = clamp((svgX - viewport.offsetX) / Math.max(viewport.width, Number.EPSILON), 0, 1)
  const innerY = clamp((svgY - viewport.offsetY) / Math.max(viewport.height, Number.EPSILON), 0, 1)
  return {
    lon: roundCoord(bounds.minLon + innerX * (bounds.maxLon - bounds.minLon)),
    lat: roundCoord(bounds.maxLat - innerY * (bounds.maxLat - bounds.minLat)),
  }
}

function createLinearSvgPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
}

function createGeoPath(points: GeoPoint[], bounds: StudyBounds, viewport: GeoViewport = buildGeoViewport(bounds)) {
  const svgPoints = points.map((point) => geoToSvg(point, bounds, viewport))
  return createLinearSvgPath(svgPoints)
}

function formatCompactTime(value: string) {
  if (!value) return 'no time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function RouteEditor() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [tracksFile, setTracksFile] = useState<MainCorridorTracksFile | null>(null)
  const [tracks, setTracks] = useState<MainCorridorTrackEntry[]>([])
  const [defaultTracks, setDefaultTracks] = useState<Record<string, MainCorridorTrackEntry>>({})
  const [selectedCorridorId, setSelectedCorridorId] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [selectedHandle, setSelectedHandle] = useState<SelectedHandle | null>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [nudgeStep, setNudgeStep] = useState('0.0015')
  const [tracksDataError, setTracksDataError] = useState('')
  const [canvasUrlInput, setCanvasUrlInput] = useState('')
  const [uploadedCanvasUrl, setUploadedCanvasUrl] = useState('')
  const [canvasDisplay, setCanvasDisplay] = useState<FixedLayerDisplay>({ opacity: 1, brightness: 1 })
  const [mapPresetId, setMapPresetId] = useState(BACKGROUND_PRESETS[0].id)
  const [mapUrlInput, setMapUrlInput] = useState('')
  const [uploadedMapUrl, setUploadedMapUrl] = useState('')
  const [mapTransform, setMapTransform] = useState<LayerTransform>({ scale: 1, offsetX: 0, offsetY: 0, opacity: 0.92, brightness: 0.92 })
  const [trackTransform, setTrackTransform] = useState<LayerTransform>({ scale: 1, offsetX: 0, offsetY: 0, opacity: 1, brightness: 1 })
  const [activeTransformLayer, setActiveTransformLayer] = useState<TransformLayerTarget>('map')
  const [stagePan, setStagePan] = useState<StagePanState | null>(null)

  const studyBounds = tracksFile?.studyArea ?? STUDY_BOUNDS
  const geoViewport = useMemo(() => buildGeoViewport(studyBounds), [studyBounds])
  const fallbackPoint = { lon: studyBounds.minLon, lat: studyBounds.minLat }
  const corridorSummaries = useMemo(() => tracksFile?.corridors ?? EMPTY_CORRIDOR_SUMMARIES, [tracksFile])
  const effectiveSelectedCorridorId = useMemo(
    () =>
      corridorSummaries.some((corridor) => corridor.corridorId === selectedCorridorId)
        ? selectedCorridorId
        : corridorSummaries[0]?.corridorId ?? '',
    [corridorSummaries, selectedCorridorId],
  )
  const selectedCorridor = useMemo(
    () => corridorSummaries.find((corridor) => corridor.corridorId === effectiveSelectedCorridorId) ?? null,
    [corridorSummaries, effectiveSelectedCorridorId],
  )
  const canvasSource = uploadedCanvasUrl || canvasUrlInput.trim()
  const mapPreset = BACKGROUND_PRESETS.find((item) => item.id === mapPresetId) ?? BACKGROUND_PRESETS[0]
  const mapSource = uploadedMapUrl || mapUrlInput.trim() || (mapPreset.src ? resolvePageAsset(mapPreset.src) : '')

  const tracksByCorridor = useMemo(() => {
    const grouped: Record<string, MainCorridorTrackEntry[]> = {}
    corridorSummaries.forEach((corridor) => {
      grouped[corridor.corridorId] = []
    })
    tracks.forEach((track) => {
      if (!grouped[track.corridorId]) grouped[track.corridorId] = []
      grouped[track.corridorId].push(track)
    })
    return grouped
  }, [corridorSummaries, tracks])

  const selectedCorridorTracks = useMemo(
    () => (selectedCorridor ? tracksByCorridor[selectedCorridor.corridorId] ?? EMPTY_TRACKS : EMPTY_TRACKS),
    [selectedCorridor, tracksByCorridor],
  )
  const effectiveSelectedTrackId = useMemo(
    () =>
      selectedCorridorTracks.some((track) => track.id === selectedTrackId)
        ? selectedTrackId
        : selectedCorridorTracks[0]?.id ?? '',
    [selectedCorridorTracks, selectedTrackId],
  )
  const selectedTrack = useMemo(
    () => selectedCorridorTracks.find((track) => track.id === effectiveSelectedTrackId) ?? null,
    [effectiveSelectedTrackId, selectedCorridorTracks],
  )
  const activeHandle = useMemo(() => {
    if (!selectedTrack) return null
    if (!selectedHandle || selectedHandle.trackId !== selectedTrack.id) {
      return { kind: 'point', trackId: selectedTrack.id, index: 0 } satisfies SelectedHandle
    }
    if (selectedHandle.kind !== 'point') return selectedHandle
    return {
      kind: 'point',
      trackId: selectedTrack.id,
      index: clamp(selectedHandle.index, 0, Math.max(selectedTrack.points.length - 1, 0)),
    } satisfies SelectedHandle
  }, [selectedHandle, selectedTrack])
  const selectedPoint =
    activeHandle?.kind === 'point' && selectedTrack && activeHandle.trackId === selectedTrack.id
      ? selectedTrack.points[activeHandle.index] ?? selectedTrack.labelPoint
      : selectedTrack?.labelPoint ?? fallbackPoint

  const corridorColors = useMemo(
    () =>
      Object.fromEntries(
        corridorSummaries.map((corridor, index) => [corridor.corridorId, CORRIDOR_COLORS[index % CORRIDOR_COLORS.length]] as const),
      ) as Record<string, string>,
    [corridorSummaries],
  )

  const corridorLabelLayers = useMemo(
    () =>
      corridorSummaries.map((corridor) => ({
        ...corridor,
        label: geoToPercent(corridor.labelPoint, studyBounds, geoViewport),
      })),
    [corridorSummaries, geoViewport, studyBounds],
  )

  const trackLayers = useMemo(() => {
    const priority = (track: MainCorridorTrackEntry) => (track.id === selectedTrack?.id ? 2 : track.corridorId === selectedCorridor?.corridorId ? 1 : 0)

    return [...tracks]
      .sort((a, b) => priority(a) - priority(b))
      .map((track) => ({
        id: track.id,
        corridorId: track.corridorId,
        path: createGeoPath(track.points, studyBounds, geoViewport),
        isCorridorSelected: track.corridorId === selectedCorridor?.corridorId,
        isTrackSelected: track.id === selectedTrack?.id,
      }))
  }, [geoViewport, selectedCorridor?.corridorId, selectedTrack?.id, studyBounds, tracks])

  const selectedTrackGeometry = useMemo(
    () =>
      selectedTrack
        ? {
            id: selectedTrack.id,
            path: createGeoPath(selectedTrack.points, studyBounds, geoViewport),
            label: geoToPercent(selectedTrack.labelPoint, studyBounds, geoViewport),
            points: selectedTrack.points.map((point, index) => ({
              id: `${selectedTrack.id}-${index}`,
              index,
              position: geoToPercent(point, studyBounds, geoViewport),
            })),
          }
        : null,
    [geoViewport, selectedTrack, studyBounds],
  )

  const selectedTrackExportText = useMemo(() => (selectedTrack ? JSON.stringify(selectedTrack, null, 2) : ''), [selectedTrack])

  const selectedCorridorExportText = useMemo(
    () =>
      selectedCorridor
        ? JSON.stringify(
            {
              corridor: selectedCorridor,
              tracks: selectedCorridorTracks,
            },
            null,
            2,
          )
        : '',
    [selectedCorridor, selectedCorridorTracks],
  )

  const fullTracksExportText = useMemo(
    () => (tracksFile ? JSON.stringify({ ...tracksFile, tracks }, null, 2) : ''),
    [tracks, tracksFile],
  )

  const canvasStyle = { opacity: canvasDisplay.opacity, filter: `brightness(${canvasDisplay.brightness}) saturate(0.92)` } satisfies CSSProperties
  const mapLayerStyle = {
    transform: `translate(${mapTransform.offsetX}px, ${mapTransform.offsetY}px) scale(${mapTransform.scale})`,
    opacity: mapTransform.opacity,
    filter: `brightness(${mapTransform.brightness}) saturate(0.92)`,
  } satisfies CSSProperties
  const trackLayerStyle = {
    transform: `translate(${trackTransform.offsetX}px, ${trackTransform.offsetY}px) scale(${trackTransform.scale})`,
    opacity: trackTransform.opacity,
    filter: `brightness(${trackTransform.brightness})`,
  } satisfies CSSProperties

  useEffect(() => {
    let cancelled = false
    loadPublicJson<MainCorridorTracksFile>(resolveRuntimeResource(CLEANED_TRACKS_PATH))
      .then((payload) => {
        if (cancelled) return
        const draftTracks = payload.tracks.map(cloneTrack)
        setTracksFile(payload)
        setTracks(draftTracks)
        setDefaultTracks(buildTrackLookup(payload.tracks))
        setTracksDataError('')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setTracksFile(null)
        setTracks([])
        setDefaultTracks({})
        setTracksDataError(error instanceof Error ? error.message : 'Failed to load cleaned main corridor tracks')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!copyStatus) return
    const timer = window.setTimeout(() => setCopyStatus(''), 1600)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  useEffect(
    () => () => {
      if (uploadedCanvasUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedCanvasUrl)
      if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
    },
    [uploadedCanvasUrl, uploadedMapUrl],
  )

  useEffect(() => {
    if (!stagePan) return
    const onMove = (event: PointerEvent) => {
      const deltaX = event.clientX - stagePan.startX
      const deltaY = event.clientY - stagePan.startY
      if (stagePan.target === 'map') {
        setMapTransform((current) => ({ ...current, offsetX: stagePan.originX + deltaX, offsetY: stagePan.originY + deltaY }))
        return
      }
      setTrackTransform((current) => ({ ...current, offsetX: stagePan.originX + deltaX, offsetY: stagePan.originY + deltaY }))
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
    setTrackTransform((current) => updater(current))
  }

  function resetMapView() {
    setMapTransform({ scale: 1, offsetX: 0, offsetY: 0, opacity: 0.92, brightness: 0.92 })
  }

  function resetTrackView() {
    setTrackTransform({ scale: 1, offsetX: 0, offsetY: 0, opacity: 1, brightness: 1 })
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.editor-stage-hud')) return
    setStagePan({
      target: activeTransformLayer,
      startX: event.clientX,
      startY: event.clientY,
      originX: activeTransformLayer === 'map' ? mapTransform.offsetX : trackTransform.offsetX,
      originY: activeTransformLayer === 'map' ? mapTransform.offsetY : trackTransform.offsetY,
    })
  }

  function handleStageWheel(event: React.WheelEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.editor-stage-hud')) return
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.08 : 0.92
    updateLayerTransform(activeTransformLayer, (current) => ({ ...current, scale: clamp(Number((current.scale * factor).toFixed(3)), 0.25, 6) }))
  }

  function updateSelectedPoint(deltaLon: number, deltaLat: number) {
    const step = Number.parseFloat(nudgeStep)
    if (Number.isNaN(step) || !activeHandle || !selectedTrack) return
    setTracks((current) =>
      current.map((track) =>
        track.id !== selectedTrack.id
          ? track
          : activeHandle.kind === 'label'
            ? {
                ...track,
                labelPoint: {
                  lon: roundCoord(clamp(track.labelPoint.lon + deltaLon * step, studyBounds.minLon, studyBounds.maxLon)),
                  lat: roundCoord(clamp(track.labelPoint.lat + deltaLat * step, studyBounds.minLat, studyBounds.maxLat)),
                },
              }
            : {
                ...track,
                points: track.points.map((point, index) =>
                  index === activeHandle.index
                    ? {
                        ...point,
                        lon: roundCoord(clamp(point.lon + deltaLon * step, studyBounds.minLon, studyBounds.maxLon)),
                        lat: roundCoord(clamp(point.lat + deltaLat * step, studyBounds.minLat, studyBounds.maxLat)),
                      }
                    : point,
                ),
              },
      ),
    )
  }

  function resetSelectedTrack() {
    if (!selectedTrack) return
    const resetTrack = defaultTracks[selectedTrack.id]
    if (!resetTrack) return
    setTracks((current) => current.map((track) => (track.id === selectedTrack.id ? cloneTrack(resetTrack) : track)))
  }

  async function handleCopy(label: string, text: string) {
    await copyText(text)
    setCopyStatus(label)
  }

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

  function selectCorridor(corridorId: string) {
    const nextTrack = (tracksByCorridor[corridorId] ?? [])[0] ?? null
    setSelectedCorridorId(corridorId)
    setSelectedTrackId(nextTrack?.id ?? '')
    setSelectedHandle(nextTrack ? { kind: 'point', trackId: nextTrack.id, index: 0 } : null)
  }

  function selectTrack(trackId: string) {
    const nextTrack = tracks.find((track) => track.id === trackId) ?? null
    if (!nextTrack) return
    setSelectedCorridorId(nextTrack.corridorId)
    setSelectedTrackId(nextTrack.id)
    setSelectedHandle({ kind: 'point', trackId: nextTrack.id, index: 0 })
  }

  const selectedObjectName =
    !activeHandle || !selectedTrack
      ? 'No selection'
      : activeHandle.kind === 'label'
        ? `${selectedTrack.id} label anchor`
        : `${selectedTrack.id} P${activeHandle.index + 1}`

  return (
    <main className="route-editor-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel">
          <p className="editor-kicker">Main Corridor Studio</p>
          <h1>Cleaned real-track alignment</h1>
          <p className="editor-copy">
            RouteEditor now reads the cleaned real vessel trajectories exported by <code>extract_main_corridors_from_clustered_ais.py</code>.
            The stage keeps the equal-ratio geo viewport and renders the original cleaned <code>lat/lon</code> tracks directly, without
            representative-line remapping or stretched percentage geometry.
          </p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Cleaned Track Source</h2><span>{tracksFile ? 'loaded' : 'waiting'}</span></div>
          {tracksFile ? (
            <div className="editor-meta-grid">
              <div><small>Data file</small><strong>{tracksFile.source}</strong></div>
              <div><small>Summary file</small><strong>{tracksFile.summarySource}</strong></div>
              <div><small>Cluster mode</small><strong>{tracksFile.clusterMode}</strong></div>
              <div><small>Requested</small><strong>{tracksFile.requestedClusterMode}</strong></div>
              <div><small>Corridors</small><strong>{tracksFile.corridorCount}</strong></div>
              <div><small>Tracks</small><strong>{tracksFile.trackCount}</strong></div>
            </div>
          ) : (
            <div className="editor-meta-grid">
              <div><small>Status</small><strong>Missing cleaned track file</strong></div>
              <div><small>Expected file</small><strong>public/data/main-corridor-tracks.json</strong></div>
            </div>
          )}
          <p className="traffic-note">
            {tracksFile
              ? 'This page is driven only by the cleaned real track export. The old six-route geometry and hotspot overlays are no longer used here.'
              : 'RouteEditor could not find the cleaned real-track JSON. Re-run extract_main_corridors_from_clustered_ais.py to regenerate it.'}
          </p>
          {tracksDataError ? <p className="editor-warning">{tracksDataError}</p> : null}
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Corridor Coverage</h2><span>{selectedCorridor?.corridorId ?? 'No corridor'}</span></div>
          <div className="route-count-grid">
            {corridorSummaries.map((corridor) => (
              <button
                key={`count-${corridor.corridorId}`}
                type="button"
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'route-count-pill active' : 'route-count-pill'}
                onClick={() => selectCorridor(corridor.corridorId)}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} tracks</span>
              </button>
            ))}
          </div>
          <p className="traffic-note">All 16 cleaned corridors stay visible on the map. Selecting a corridor raises the opacity of only its member tracks.</p>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>Corridor List</h2><span>{corridorSummaries.length} kept</span></div>
          <div className="corridor-list">
            {corridorSummaries.map((corridor) => (
              <button
                key={corridor.corridorId}
                type="button"
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'corridor-row active' : 'corridor-row'}
                onClick={() => selectCorridor(corridor.corridorId)}
              >
                <div className="corridor-row-head">
                  <strong>{corridor.corridorId}</strong>
                  <span>{corridor.trackCount} tracks</span>
                </div>
                <small>{corridor.directionLabel}</small>
                <small>{corridor.labelPoint.lon.toFixed(4)}, {corridor.labelPoint.lat.toFixed(4)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>Tracks In Corridor</h2><span>{selectedCorridorTracks.length} real tracks</span></div>
          <div className="track-list">
            {selectedCorridorTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className={track.id === selectedTrack?.id ? 'track-row active' : 'track-row'}
                onClick={() => selectTrack(track.id)}
              >
                <div className="track-row-head">
                  <strong>{track.id}</strong>
                  <span>{track.pointCount} pts</span>
                </div>
                <small>{track.directionLabel}</small>
                <small>{formatCompactTime(track.points[0]?.time ?? '')} -&gt; {formatCompactTime(track.points[track.points.length - 1]?.time ?? '')}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Selected Object</h2><span>{selectedObjectName}</span></div>
          <div className="editor-meta-grid">
            <div><small>Longitude</small><strong>{selectedPoint.lon.toFixed(6)}</strong></div>
            <div><small>Latitude</small><strong>{selectedPoint.lat.toFixed(6)}</strong></div>
            <div><small>Corridor</small><strong>{selectedTrack?.corridorId ?? 'N/A'}</strong></div>
            <div><small>Track ID</small><strong>{selectedTrack?.trackId ?? 'N/A'}</strong></div>
          </div>
          <div className="nudge-head">
            <label htmlFor="nudge-step">Nudge step</label>
            <input id="nudge-step" value={nudgeStep} onChange={(event) => setNudgeStep(event.target.value)} />
          </div>
          <div className="nudge-grid">
            <button type="button" onClick={() => updateSelectedPoint(0, 1)}>Up</button>
            <button type="button" onClick={() => updateSelectedPoint(-1, 0)}>Left</button>
            <button type="button" onClick={() => updateSelectedPoint(1, 0)}>Right</button>
            <button type="button" onClick={() => updateSelectedPoint(0, -1)}>Down</button>
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head">
            <h2>Track Points</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={() => selectedTrack && setSelectedHandle({ kind: 'label', trackId: selectedTrack.id })}
              disabled={!selectedTrack}
            >
              Select label anchor
            </button>
          </div>
          <p className="traffic-note">These are the original cleaned track points from the export. You can inspect them directly and nudge the selected point or label anchor in lat/lon space.</p>
          <div className="point-list">
            {(selectedTrack?.points ?? []).map((point, index) => (
              <div
                key={`${selectedTrack?.id ?? 'track'}-${index}`}
                className={activeHandle?.kind === 'point' && activeHandle.trackId === selectedTrack?.id && activeHandle.index === index ? 'point-row active' : 'point-row'}
              >
                <button
                  type="button"
                  className="point-main"
                  onClick={() => selectedTrack && setSelectedHandle({ kind: 'point', trackId: selectedTrack.id, index })}
                >
                  <span>P{index + 1}</span>
                  <small>{point.lon.toFixed(4)}, {point.lat.toFixed(4)} | {formatCompactTime(point.time)}</small>
                </button>
              </div>
            ))}
          </div>
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
              <select
                value={mapPresetId}
                onChange={(event) => {
                  setMapPresetId(event.target.value)
                  if (event.target.value !== 'blank') {
                    setMapUrlInput('')
                    if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
                    setUploadedMapUrl('')
                  }
                }}
              >
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
          <div className="editor-panel-head"><h2>Cleaned Track Layer</h2><span>{selectedTrack?.id ?? 'No track'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'tracks' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('tracks')}>Drive tracks</button>
            <button type="button" className="ghost-button" onClick={resetTrackView}>Reset tracks</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Scale</span><input type="range" min="0.25" max="6" step="0.01" value={trackTransform.scale} onChange={(event) => setTrackTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset X</span><input type="range" min="-1200" max="1200" step="1" value={trackTransform.offsetX} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset Y</span><input type="range" min="-900" max="900" step="1" value={trackTransform.offsetY} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={trackTransform.opacity} onChange={(event) => setTrackTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={trackTransform.brightness} onChange={(event) => setTrackTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">The stage shows every cleaned real track. The selected corridor is emphasized as a group, and the selected track gets its own highlight and editable point handles.</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Export</h2><span>{copyStatus || 'Ready'}</span></div>
          <div className="export-actions">
            <button type="button" onClick={() => selectedTrack && handleCopy(`${selectedTrack.id} copied`, selectedTrackExportText)} disabled={!selectedTrack}>Copy selected track JSON</button>
            <button type="button" onClick={() => selectedCorridor && handleCopy(`${selectedCorridor.corridorId} copied`, selectedCorridorExportText)} disabled={!selectedCorridor}>Copy current corridor JSON</button>
            <button type="button" onClick={() => handleCopy('All cleaned tracks copied', fullTracksExportText)} disabled={!tracksFile}>Copy all cleaned tracks JSON</button>
            <button type="button" className="ghost-button" onClick={resetSelectedTrack} disabled={!selectedTrack}>Reset current track</button>
          </div>
          <p className="traffic-note">Exports stay in the cleaned real-track schema. RouteEditor no longer emits the old shared-geometry structure.</p>
          <textarea readOnly value={selectedCorridorExportText} className="export-box export-box-compact" />
          <textarea readOnly value={fullTracksExportText} className="export-box" />
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div><strong>Track Source</strong><span>{tracksFile ? `main-corridor-tracks.json | ${tracksFile.corridorCount} corridors | ${tracksFile.trackCount} tracks` : 'Loading cleaned tracks...'}</span></div>
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

          <div className="editor-track-layer" style={trackLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {trackLayers.map((track) => (
                <path
                  key={track.id}
                  d={track.path}
                  className={[
                    'editor-cleaned-track',
                    track.isCorridorSelected ? 'corridor-focus' : '',
                    track.isTrackSelected ? 'track-focus' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ stroke: corridorColors[track.corridorId] ?? '#7dd3fc' }}
                />
              ))}
            </svg>

            {corridorLabelLayers.map((corridor) => (
              <div
                key={`corridor-tag-${corridor.corridorId}`}
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'editor-corridor-tag active' : 'editor-corridor-tag'}
                style={{ left: `${corridor.label.x}%`, top: `${corridor.label.y}%` }}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} tracks</span>
                <small>{corridor.directionLabel}</small>
              </div>
            ))}
          </div>

          <div className="editor-geometry-layer" style={trackLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {selectedTrackGeometry ? <path d={selectedTrackGeometry.path} className="editor-route-guide" /> : null}
            </svg>

            {selectedTrackGeometry ? (
              <button
                key={`label-${selectedTrackGeometry.id}`}
                type="button"
                className={activeHandle?.kind === 'label' && activeHandle.trackId === selectedTrackGeometry.id ? 'editor-label-anchor active' : 'editor-label-anchor'}
                style={{ left: `${selectedTrackGeometry.label.x}%`, top: `${selectedTrackGeometry.label.y}%` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedTrackId(selectedTrackGeometry.id)
                  setSelectedHandle({ kind: 'label', trackId: selectedTrackGeometry.id })
                }}
              >
                <strong>{selectedTrackGeometry.id}</strong>
                <span>LABEL</span>
              </button>
            ) : null}

            {selectedTrackGeometry
              ? selectedTrackGeometry.points.map((point) => (
                <button
                  key={`handle-${selectedTrackGeometry.id}-${point.id}`}
                  type="button"
                  className={[
                    'editor-handle',
                    'point',
                    'selected-route',
                    activeHandle?.kind === 'point' && activeHandle.trackId === selectedTrackGeometry.id && activeHandle.index === point.index ? 'active' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left: `${point.position.x}%`, top: `${point.position.y}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedTrackId(selectedTrackGeometry.id)
                    setSelectedHandle({ kind: 'point', trackId: selectedTrackGeometry.id, index: point.index })
                  }}
                >
                  {point.index + 1}
                </button>
                ))
              : null}
          </div>

          <div className="editor-stage-hud">
            <div><strong>Active drag</strong><span>{activeTransformLayer === 'map' ? 'Satellite map' : 'Cleaned tracks'}</span></div>
            <div><strong>Selected corridor</strong><span>{selectedCorridor?.corridorId ?? 'None'}</span></div>
            <div><strong>Selected track</strong><span>{selectedTrack?.id ?? 'None'}</span></div>
            <div><strong>Loaded data</strong><span>{corridorSummaries.length} corridors / {tracks.length} tracks</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}
