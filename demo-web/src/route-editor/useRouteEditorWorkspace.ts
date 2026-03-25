import { useEffect, useMemo, useState } from 'react'
import type { MainCorridorTrackEntry, MainCorridorTracksFile } from '../sharedContracts'
import { formatRuntimeLoadFailure, loadMainCorridorTracksResource } from '../runtimeData'
import {
  buildGeoViewport,
  buildTrackLookup,
  CLEANED_TRACKS_PATH,
  cloneTrack,
  CORRIDOR_COLORS,
  createGeoPath,
  geoToPercent,
  roundCoord,
  STUDY_BOUNDS,
  clamp,
} from './routeEditorUtils'
import type { SelectedHandle } from './routeEditorUtils'

const EMPTY_CORRIDOR_SUMMARIES: MainCorridorTracksFile['corridors'] = []
const EMPTY_TRACKS: MainCorridorTrackEntry[] = []

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function useRouteEditorWorkspace() {
  const [tracksFile, setTracksFile] = useState<MainCorridorTracksFile | null>(null)
  const [tracks, setTracks] = useState<MainCorridorTrackEntry[]>([])
  const [defaultTracks, setDefaultTracks] = useState<Record<string, MainCorridorTrackEntry>>({})
  const [selectedCorridorId, setSelectedCorridorId] = useState('')
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const [selectedHandle, setSelectedHandle] = useState<SelectedHandle | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [nudgeStep, setNudgeStep] = useState('0.0015')
  const [tracksDataError, setTracksDataError] = useState('')

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

  useEffect(() => {
    let cancelled = false
    loadMainCorridorTracksResource(CLEANED_TRACKS_PATH).then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setTracksFile(null)
        setTracks([])
        setDefaultTracks({})
        setSelectedCorridorId('')
        setSelectedTrackId('')
        setSelectedHandle(null)
        setCopyStatus('')
        setTracksDataError(formatRuntimeLoadFailure(result))
        return
      }

      const draftTracks = result.data.tracks.map(cloneTrack)
      setTracksFile(result.data)
      setTracks(draftTracks)
      setDefaultTracks(buildTrackLookup(result.data.tracks))
      setTracksDataError('')
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

  function selectLabelAnchor(trackId: string) {
    setSelectedTrackId(trackId)
    setSelectedHandle({ kind: 'label', trackId })
  }

  function selectTrackPoint(trackId: string, index: number) {
    setSelectedTrackId(trackId)
    setSelectedHandle({ kind: 'point', trackId, index })
  }

  const selectedObjectName =
    !activeHandle || !selectedTrack
      ? 'No selection'
      : activeHandle.kind === 'label'
        ? `${selectedTrack.id} label anchor`
        : `${selectedTrack.id} P${activeHandle.index + 1}`

  const routeEditorReady = Boolean(tracksFile && tracks.length)
  const routeEditorLoading = !tracksDataError && !routeEditorReady

  return {
    tracksFile,
    tracks,
    selectedCorridor,
    selectedTrack,
    selectedPoint,
    selectedTrackGeometry,
    selectedCorridorTracks,
    corridorSummaries,
    selectedObjectName,
    activeHandle,
    nudgeStep,
    setNudgeStep,
    copyStatus,
    tracksDataError,
    routeEditorReady,
    routeEditorLoading,
    studyBounds,
    geoViewport,
    corridorColors,
    corridorLabelLayers,
    trackLayers,
    selectedTrackExportText,
    selectedCorridorExportText,
    fullTracksExportText,
    selectCorridor,
    selectTrack,
    selectLabelAnchor,
    selectTrackPoint,
    updateSelectedPoint,
    handleCopy,
    resetSelectedTrack,
  }
}
