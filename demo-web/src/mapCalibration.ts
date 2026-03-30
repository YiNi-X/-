import type { CSSProperties } from 'react'

export type MapLayerCalibration = {
  scale: number
  offsetX: number
  offsetY: number
  opacity: number
  brightness: number
}

export type MapCalibrationState = {
  map: MapLayerCalibration
  tracks: MapLayerCalibration
}

export const MAP_CALIBRATION_STORAGE_KEY = 'demo-web.map-calibration.v1'

export const CALIBRATION_LIMITS = {
  scale: { min: 0.5, max: 2.4, step: 0.01 },
  offset: { min: -40, max: 40, step: 0.1 },
  opacity: { min: 0.15, max: 1, step: 0.01 },
  brightness: { min: 0.5, max: 1.5, step: 0.01 },
} as const

export const DEFAULT_MAP_LAYER_CALIBRATION: MapLayerCalibration = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  opacity: 0.92,
  brightness: 0.92,
}

export const DEFAULT_TRACK_LAYER_CALIBRATION: MapLayerCalibration = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  opacity: 1,
  brightness: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Number(clamp(parsed, min, max).toFixed(4))
}

function sanitizeLayerCalibration(value: unknown, fallback: MapLayerCalibration): MapLayerCalibration {
  const source = value && typeof value === 'object' ? (value as Partial<MapLayerCalibration>) : {}
  return {
    scale: sanitizeNumber(source.scale, fallback.scale, CALIBRATION_LIMITS.scale.min, CALIBRATION_LIMITS.scale.max),
    offsetX: sanitizeNumber(source.offsetX, fallback.offsetX, CALIBRATION_LIMITS.offset.min, CALIBRATION_LIMITS.offset.max),
    offsetY: sanitizeNumber(source.offsetY, fallback.offsetY, CALIBRATION_LIMITS.offset.min, CALIBRATION_LIMITS.offset.max),
    opacity: sanitizeNumber(source.opacity, fallback.opacity, CALIBRATION_LIMITS.opacity.min, CALIBRATION_LIMITS.opacity.max),
    brightness: sanitizeNumber(source.brightness, fallback.brightness, CALIBRATION_LIMITS.brightness.min, CALIBRATION_LIMITS.brightness.max),
  }
}

export function getDefaultMapCalibration(): MapCalibrationState {
  return {
    map: { ...DEFAULT_MAP_LAYER_CALIBRATION },
    tracks: { ...DEFAULT_TRACK_LAYER_CALIBRATION },
  }
}

export function readPersistedMapCalibration(): MapCalibrationState {
  if (typeof window === 'undefined') return getDefaultMapCalibration()
  const fallback = getDefaultMapCalibration()

  try {
    const rawValue = window.localStorage.getItem(MAP_CALIBRATION_STORAGE_KEY)
    if (!rawValue) return fallback
    const parsed = JSON.parse(rawValue) as Partial<MapCalibrationState>
    return {
      map: sanitizeLayerCalibration(parsed.map, fallback.map),
      tracks: sanitizeLayerCalibration(parsed.tracks, fallback.tracks),
    }
  } catch {
    return fallback
  }
}

export function persistMapCalibration(value: MapCalibrationState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      MAP_CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        map: sanitizeLayerCalibration(value.map, DEFAULT_MAP_LAYER_CALIBRATION),
        tracks: sanitizeLayerCalibration(value.tracks, DEFAULT_TRACK_LAYER_CALIBRATION),
      }),
    )
  } catch {
    // Ignore persistence failures and keep the UI responsive.
  }
}

export function buildCalibrationStyle(transform: MapLayerCalibration, saturation = 1): CSSProperties {
  return {
    transform: `translate(${transform.offsetX}%, ${transform.offsetY}%) scale(${transform.scale})`,
    opacity: transform.opacity,
    filter: `brightness(${transform.brightness}) saturate(${saturation})`,
    transformOrigin: 'center center',
  }
}

export function hasCustomLayerCalibration(transform: MapLayerCalibration, fallback: MapLayerCalibration) {
  return (
    Math.abs(transform.scale - fallback.scale) > 0.001 ||
    Math.abs(transform.offsetX - fallback.offsetX) > 0.001 ||
    Math.abs(transform.offsetY - fallback.offsetY) > 0.001 ||
    Math.abs(transform.opacity - fallback.opacity) > 0.001 ||
    Math.abs(transform.brightness - fallback.brightness) > 0.001
  )
}
