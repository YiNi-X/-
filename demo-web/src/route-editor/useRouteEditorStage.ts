import type { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { StudyBounds } from '../sharedContracts'
import {
  BACKGROUND_PRESETS,
  clamp,
  type CursorState,
  type FixedLayerDisplay,
  type GeoViewport,
  type LayerTransform,
  resolvePageAsset,
  type StagePanState,
  svgToGeo,
  type TransformLayerTarget,
} from './routeEditorUtils'

type UseRouteEditorStageArgs = {
  studyBounds: StudyBounds
  geoViewport: GeoViewport
}

export function useRouteEditorStage({ studyBounds, geoViewport }: UseRouteEditorStageArgs) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)
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

  const canvasSource = uploadedCanvasUrl || canvasUrlInput.trim()
  const mapPreset = BACKGROUND_PRESETS.find((item) => item.id === mapPresetId) ?? BACKGROUND_PRESETS[0]
  const mapSource = uploadedMapUrl || mapUrlInput.trim() || (mapPreset.src ? resolvePageAsset(mapPreset.src) : '')

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

  function handleStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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

  function handleStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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

  function handleStageWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.editor-stage-hud')) return
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.08 : 0.92
    updateLayerTransform(activeTransformLayer, (current) => ({ ...current, scale: clamp(Number((current.scale * factor).toFixed(3)), 0.25, 6) }))
  }

  function handleCanvasFileChange(event: ChangeEvent<HTMLInputElement>) {
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

  function handleMapFileChange(event: ChangeEvent<HTMLInputElement>) {
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

  function selectMapPreset(nextPresetId: string) {
    setMapPresetId(nextPresetId)
    if (nextPresetId !== 'blank') {
      setMapUrlInput('')
      if (uploadedMapUrl.startsWith('blob:')) URL.revokeObjectURL(uploadedMapUrl)
      setUploadedMapUrl('')
    }
  }

  return {
    stageRef,
    cursor,
    canvasSource,
    canvasUrlInput,
    setCanvasUrlInput,
    canvasDisplay,
    setCanvasDisplay,
    mapPresetId,
    selectMapPreset,
    mapSource,
    mapUrlInput,
    setMapUrlInput,
    mapTransform,
    setMapTransform,
    trackTransform,
    setTrackTransform,
    activeTransformLayer,
    setActiveTransformLayer,
    stagePan,
    canvasStyle,
    mapLayerStyle,
    trackLayerStyle,
    handleStagePointerMove,
    handleStagePointerDown,
    handleStageWheel,
    handleCanvasFileChange,
    applyCanvasUrl,
    clearCanvasLayer,
    handleMapFileChange,
    applyMapUrl,
    resetMapView,
    resetTrackView,
  }
}
