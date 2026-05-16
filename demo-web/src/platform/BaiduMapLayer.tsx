import { useEffect, useMemo, useRef, useState } from 'react'
import type { StudyBounds } from '../sharedContracts'

const DEFAULT_BAIDU_MAP_AK = 'o77H2yXStYQWAfa59LCttCRa2A0g2xNv'
const BAIDU_MAP_AK = import.meta.env.VITE_BAIDU_MAP_AK || DEFAULT_BAIDU_MAP_AK
const BAIDU_MAP_SCRIPT_ID = 'baidu-map-gl-sdk'
const BAIDU_MAP_CALLBACK = '__zhigangBaiduMapGLReady'
const BAIDU_MAP_SCRIPT_TIMEOUT_MS = 15000
const X_PI = (Math.PI * 3000) / 180
const EARTH_RADIUS = 6378245
const EE = 0.006693421622965943
const VIEWPORT_OPTIONS = { margins: [18, 18, 118, 18] }

type GeoPointLike = {
  lon: number
  lat: number
}

type BaiduPoint = {
  lng: number
  lat: number
}

type BMapGLMap = {
  centerAndZoom: (center: BaiduPoint, zoom: number) => void
  setViewport: (view: BaiduPoint[], viewportOptions?: Record<string, unknown>) => void
  disableDragging: () => void
  disableScrollWheelZoom: () => void
  disableDoubleClickZoom: () => void
  disableKeyboard: () => void
  disablePinchToZoom?: () => void
  disableRotateGestures?: () => void
  disableTiltGestures?: () => void
  setTilt?: (tilt: number) => void
  setHeading?: (heading: number) => void
  setCopyrightOffset?: (logo: Record<string, number>, copyright: Record<string, number>) => void
  resize?: () => void
  checkResize?: () => void
  destroy?: () => void
}

type BMapGLNamespace = {
  Map: new (container: HTMLElement, opts?: Record<string, unknown>) => BMapGLMap
  Point: new (lng: number, lat: number) => BaiduPoint
}

declare global {
  interface Window {
    BMapGL?: BMapGLNamespace
    __zhigangBaiduMapGLReady?: () => void
  }
}

type BaiduMapLayerProps = {
  studyArea: StudyBounds
}

type BaiduMapStatus = 'loading' | 'ready' | 'failed'

let baiduMapSdkPromise: Promise<BMapGLNamespace> | null = null

function outOfChina(point: GeoPointLike) {
  return point.lon < 72.004 || point.lon > 137.8347 || point.lat < 0.8293 || point.lat > 55.8271
}

function transformLat(x: number, y: number) {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  value += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  value += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  value += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return value
}

function transformLon(x: number, y: number) {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  value += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  value += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  value += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return value
}

function wgs84ToGcj02(point: GeoPointLike): GeoPointLike {
  if (outOfChina(point)) return point

  let dLat = transformLat(point.lon - 105, point.lat - 35)
  let dLon = transformLon(point.lon - 105, point.lat - 35)
  const radLat = (point.lat / 180) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / (((EARTH_RADIUS * (1 - EE)) / (magic * sqrtMagic)) * Math.PI)
  dLon = (dLon * 180) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radLat) * Math.PI)

  return {
    lon: point.lon + dLon,
    lat: point.lat + dLat,
  }
}

function gcj02ToBd09(point: GeoPointLike): GeoPointLike {
  const z = Math.sqrt(point.lon * point.lon + point.lat * point.lat) + 0.00002 * Math.sin(point.lat * X_PI)
  const theta = Math.atan2(point.lat, point.lon) + 0.000003 * Math.cos(point.lon * X_PI)
  return {
    lon: z * Math.cos(theta) + 0.0065,
    lat: z * Math.sin(theta) + 0.006,
  }
}

function wgs84ToBd09(point: GeoPointLike): GeoPointLike {
  return gcj02ToBd09(wgs84ToGcj02(point))
}

function getStudyAreaCenter(studyArea: StudyBounds): GeoPointLike {
  return {
    lon: (studyArea.minLon + studyArea.maxLon) / 2,
    lat: (studyArea.minLat + studyArea.maxLat) / 2,
  }
}

function buildViewportSourcePoints(studyArea: StudyBounds): GeoPointLike[] {
  const center = getStudyAreaCenter(studyArea)

  return [
    { lon: studyArea.minLon, lat: studyArea.minLat },
    { lon: studyArea.minLon, lat: studyArea.maxLat },
    { lon: studyArea.maxLon, lat: studyArea.minLat },
    { lon: studyArea.maxLon, lat: studyArea.maxLat },
    { lon: center.lon, lat: studyArea.minLat },
    { lon: center.lon, lat: studyArea.maxLat },
    { lon: studyArea.minLon, lat: center.lat },
    { lon: studyArea.maxLon, lat: center.lat },
    center,
  ]
}

function toBaiduPoint(BMapGL: BMapGLNamespace, point: GeoPointLike) {
  const bd09 = wgs84ToBd09(point)
  return new BMapGL.Point(bd09.lon, bd09.lat)
}

function loadBaiduMapSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Baidu Map GL can only load in a browser.'))
  }

  if (window.BMapGL) {
    return Promise.resolve(window.BMapGL)
  }

  if (baiduMapSdkPromise) {
    return baiduMapSdkPromise
  }

  baiduMapSdkPromise = new Promise<BMapGLNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Baidu Map GL script timed out.'))
    }, BAIDU_MAP_SCRIPT_TIMEOUT_MS)

    const finish = () => {
      window.clearTimeout(timeout)
      if (window.BMapGL) {
        resolve(window.BMapGL)
        return
      }
      reject(new Error('Baidu Map GL loaded without BMapGL.'))
    }

    window[BAIDU_MAP_CALLBACK] = finish

    const existingScript = document.getElementById(BAIDU_MAP_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Baidu Map GL script failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = BAIDU_MAP_SCRIPT_ID
    script.async = true
    script.src = `https://api.map.baidu.com/api?type=webgl&v=1.0&ak=${encodeURIComponent(BAIDU_MAP_AK)}&callback=${BAIDU_MAP_CALLBACK}`
    script.onload = finish
    script.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error('Baidu Map GL script failed to load.'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    baiduMapSdkPromise = null
    throw error
  })

  return baiduMapSdkPromise
}

function configureMap(map: BMapGLMap) {
  map.disableDragging()
  map.disableScrollWheelZoom()
  map.disableDoubleClickZoom()
  map.disableKeyboard()
  map.disablePinchToZoom?.()
  map.disableRotateGestures?.()
  map.disableTiltGestures?.()
  map.setTilt?.(0)
  map.setHeading?.(0)

  try {
    map.setCopyrightOffset?.({ x: 10, y: 112 }, { x: 88, y: 112 })
  } catch {
    // The copyright offset API differs slightly across GL builds; keep the map usable if it rejects.
  }
}

export function BaiduMapLayer({ studyArea }: BaiduMapLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<BMapGLMap | null>(null)
  const resizeFrameRef = useRef(0)
  const [status, setStatus] = useState<BaiduMapStatus>('loading')

  const viewportSourcePoints = useMemo(
    () => buildViewportSourcePoints(studyArea),
    [studyArea],
  )
  const centerPoint = useMemo(
    () => getStudyAreaCenter(studyArea),
    [studyArea],
  )

  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    void loadBaiduMapSdk()
      .then((BMapGL) => {
        if (cancelled || !containerRef.current) return

        try {
          const map = new BMapGL.Map(containerRef.current, {
            enableMapClick: false,
            minZoom: 9,
            maxZoom: 17,
          })
          const viewportPoints = viewportSourcePoints.map((point) => toBaiduPoint(BMapGL, point))
          const center = toBaiduPoint(BMapGL, centerPoint)
          const applyViewport = () => {
            map.resize?.()
            map.checkResize?.()
            map.setViewport(viewportPoints, VIEWPORT_OPTIONS)
          }

          mapRef.current = map
          map.centerAndZoom(center, 11)
          configureMap(map)
          applyViewport()

          resizeObserver = new ResizeObserver(() => {
            window.cancelAnimationFrame(resizeFrameRef.current)
            resizeFrameRef.current = window.requestAnimationFrame(applyViewport)
          })
          resizeObserver.observe(containerRef.current)

          setStatus('ready')
        } catch {
          setStatus('failed')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(resizeFrameRef.current)
      mapRef.current?.destroy?.()
      mapRef.current = null
    }
  }, [centerPoint, viewportSourcePoints])

  return (
    <div className={status === 'ready' ? 'baidu-map-layer is-ready' : 'baidu-map-layer'} aria-hidden="true">
      <div ref={containerRef} className="baidu-map-container"></div>
      {status !== 'ready' ? <div className="baidu-map-status">{status === 'failed' ? '百度地图暂不可用' : '百度地图加载中'}</div> : null}
    </div>
  )
}
