import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  const filePath = path.join(projectDir, relativePath)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function assertFile(relativePath) {
  const filePath = path.join(projectDir, relativePath)
  assert.ok(existsSync(filePath), `Expected file to exist: ${relativePath}`)
}

function assertPublicRuntimeAsset(relativePath) {
  const normalized = relativePath.replace(/^\/+/, '')
  assertFile(path.join('public', normalized))
}

function assertNonEmptyString(value, message) {
  assert.equal(typeof value, 'string', message)
  assert.ok(value.trim().length > 0, message)
}

function assertFiniteNumber(value, message) {
  assert.equal(typeof value, 'number', message)
  assert.ok(Number.isFinite(value), message)
}

function assertGeoPoint(point, message) {
  assert.equal(typeof point, 'object', message)
  assertFiniteNumber(point.lon, `${message}: lon`)
  assertFiniteNumber(point.lat, `${message}: lat`)
}

function assertStudyBounds(bounds, message) {
  assert.equal(typeof bounds, 'object', message)
  assertFiniteNumber(bounds.minLon, `${message}: minLon`)
  assertFiniteNumber(bounds.maxLon, `${message}: maxLon`)
  assertFiniteNumber(bounds.minLat, `${message}: minLat`)
  assertFiniteNumber(bounds.maxLat, `${message}: maxLat`)
  assert.ok(bounds.minLon < bounds.maxLon, `${message}: longitude bounds must increase`)
  assert.ok(bounds.minLat < bounds.maxLat, `${message}: latitude bounds must increase`)
}

test('required entry files exist for both demo surfaces', () => {
  assertFile('index.html')
  assertFile('route-editor.html')
  assertFile('src/main.tsx')
  assertFile('src/route-editor.tsx')
})

test('dataset catalog points to committed runtime assets', () => {
  const catalog = readJson('public/data/dataset-catalog.json')

  assertNonEmptyString(catalog.defaultDatasetId, 'defaultDatasetId should be a non-empty string')
  assert.ok(Array.isArray(catalog.datasets))
  assert.ok(catalog.datasets.length > 0)

  for (const dataset of catalog.datasets) {
    assertNonEmptyString(dataset.id, 'dataset.id should be a non-empty string')
    assertNonEmptyString(dataset.label, 'dataset.label should be a non-empty string')
    assertNonEmptyString(dataset.aisPlaybackPath, 'dataset.aisPlaybackPath should be a non-empty string')
    assertPublicRuntimeAsset(dataset.aisPlaybackPath)
    if (typeof dataset.flowForecastPath === 'string' && dataset.flowForecastPath.length > 0) {
      assertPublicRuntimeAsset(dataset.flowForecastPath)
    }
  }

  assert.ok(
    catalog.datasets.some((dataset) => dataset.id === catalog.defaultDatasetId),
    'defaultDatasetId should match a committed dataset entry',
  )
})

test('shared geometry asset satisfies the structural contract used by the dashboard', () => {
  const geometry = readJson('public/data/shared-geometry.json')

  assert.equal(typeof geometry.meta, 'object')
  assertFiniteNumber(geometry.meta.version, 'shared geometry version should be numeric')
  assertStudyBounds(geometry.meta.studyArea, 'shared geometry studyArea')
  assert.ok(Array.isArray(geometry.meta.routeOrder))
  assert.ok(Array.isArray(geometry.meta.hotspotOrder))

  assert.ok(Array.isArray(geometry.routes))
  assert.ok(geometry.routes.length > 0)
  const route = geometry.routes[0]
  assertNonEmptyString(route.id, 'route.id should be present')
  assertGeoPoint(route.labelPoint, 'route.labelPoint')
  assertFiniteNumber(route.marker.baseDurationSeconds, 'route marker baseDurationSeconds should be numeric')
  assertFiniteNumber(route.marker.radius, 'route marker radius should be numeric')
  assert.ok(Array.isArray(route.points))
  assert.ok(route.points.length >= 2)
  assertGeoPoint(route.points[0], 'route.points[0]')

  assert.ok(Array.isArray(geometry.hotspots))
  assert.ok(geometry.hotspots.length > 0)
  const hotspot = geometry.hotspots[0]
  assertNonEmptyString(hotspot.id, 'hotspot.id should be present')
  assertNonEmptyString(hotspot.routeId, 'hotspot.routeId should be present')
  assertGeoPoint(hotspot.point, 'hotspot.point')

  assert.equal(typeof geometry.routeFocusMap, 'object')
})

test('AIS playback and forecast assets satisfy the runtime contract surface', () => {
  const aisPlayback = readJson('public/data/ais-playback.json')
  const flowForecast = readJson('public/data/flow-forecast.json')

  assert.equal(typeof aisPlayback.meta, 'object')
  assertNonEmptyString(aisPlayback.meta.source, 'ais meta source should be present')
  assertNonEmptyString(aisPlayback.meta.windowStart, 'ais meta windowStart should be present')
  assertNonEmptyString(aisPlayback.meta.windowEnd, 'ais meta windowEnd should be present')
  assertStudyBounds(aisPlayback.meta.studyArea, 'ais meta studyArea')
  assert.ok(Array.isArray(aisPlayback.meta.routeIds))
  assert.ok(aisPlayback.meta.routeIds.length > 0)
  assert.ok(Array.isArray(aisPlayback.frames))
  assert.ok(aisPlayback.frames.length > 0)
  const frame = aisPlayback.frames[0]
  assertNonEmptyString(frame.id, 'ais frame id should be present')
  assertNonEmptyString(frame.sceneId, 'ais frame sceneId should be present')
  assertNonEmptyString(frame.bucketTime, 'ais frame bucketTime should be present')
  assertNonEmptyString(frame.displayLabel, 'ais frame displayLabel should be present')
  assertFiniteNumber(frame.activeVesselCount, 'ais frame activeVesselCount should be numeric')
  assert.ok(Array.isArray(frame.vessels))
  const vessel = frame.vessels[0]
  assertNonEmptyString(vessel.mmsi, 'playback vessel mmsi should be present')
  assertNonEmptyString(vessel.routeId, 'playback vessel routeId should be present')
  assertFiniteNumber(vessel.lon, 'playback vessel lon should be numeric')
  assertFiniteNumber(vessel.lat, 'playback vessel lat should be numeric')
  assert.equal(typeof vessel.isFocusArea, 'boolean')
  if (Array.isArray(vessel.trail) && vessel.trail.length > 0) {
    assertGeoPoint(vessel.trail[0], 'playback vessel trail[0]')
  }

  assert.ok(flowForecast.meta)
  assertNonEmptyString(flowForecast.meta.model, 'forecast meta model should be present')
  assertNonEmptyString(flowForecast.meta.modelConfigPath, 'forecast meta modelConfigPath should be present')
  assertNonEmptyString(flowForecast.meta.notice, 'forecast meta notice should be present')
  assert.ok(Array.isArray(flowForecast.meta.horizons))
  assert.deepEqual(flowForecast.meta.horizons, ['1h', '2h', '3h'])
  assert.equal(typeof flowForecast.meta.routeFocusMap, 'object')

  assert.equal(typeof flowForecast.series, 'object')
  assert.ok(Array.isArray(flowForecast.series.totalFlow))
  assert.ok(flowForecast.series.totalFlow.length > 0)
  assert.ok(Array.isArray(flowForecast.series.forecastTotals['1h']))
  assert.ok(Array.isArray(flowForecast.series.forecastTotals['2h']))
  assert.ok(Array.isArray(flowForecast.series.forecastTotals['3h']))

  assert.ok(Array.isArray(flowForecast.timeline))
  assert.ok(flowForecast.timeline.length > 0)
  const forecastEntry = flowForecast.timeline[0]
  assertNonEmptyString(forecastEntry.sceneId, 'forecast timeline sceneId should be present')
  assertNonEmptyString(forecastEntry.time, 'forecast timeline time should be present')
  assertFiniteNumber(forecastEntry.current.totalFlow, 'forecast current totalFlow should be numeric')
  assertFiniteNumber(forecastEntry.current.visibleVessels, 'forecast current visibleVessels should be numeric')
  assert.equal(typeof forecastEntry.current.keyGrids, 'object')
  assertFiniteNumber(forecastEntry.forecast['1h'].totalFlow, 'forecast 1h totalFlow should be numeric')
  assertFiniteNumber(forecastEntry.forecast['2h'].totalFlow, 'forecast 2h totalFlow should be numeric')
  assertFiniteNumber(forecastEntry.forecast['3h'].totalFlow, 'forecast 3h totalFlow should be numeric')
  assertNonEmptyString(forecastEntry.derived.focusGrid, 'forecast derived focusGrid should be present')
  assertNonEmptyString(forecastEntry.derived.focusRoute, 'forecast derived focusRoute should be present')
  assert.ok(Array.isArray(forecastEntry.derived.hotspots))
  assert.ok(Array.isArray(forecastEntry.derived.alerts))
  const alert = forecastEntry.derived.alerts[0]
  if (alert) {
    assertNonEmptyString(alert.grid, 'forecast alert grid should be present')
    assert.ok(['high', 'medium', 'watch'].includes(alert.level))
    assertFiniteNumber(alert.current, 'forecast alert current should be numeric')
    assertFiniteNumber(alert.future, 'forecast alert future should be numeric')
  }

  assert.equal(typeof forecastEntry.narrative, 'object')
  assert.equal(typeof forecastEntry.narrative.strategy, 'object')
  assert.ok(Array.isArray(forecastEntry.narrative.logs))
  assert.ok(Array.isArray(forecastEntry.narrative.recommendations))
  assert.ok(Array.isArray(forecastEntry.narrative.benefits))
  assert.equal(typeof forecastEntry.narrative.appliedState, 'object')
})

test('main corridor tracks asset satisfies the RouteEditor contract surface', () => {
  const mainCorridors = readJson('public/data/main-corridor-tracks.json')

  assertNonEmptyString(mainCorridors.source, 'main corridor source should be present')
  assertNonEmptyString(mainCorridors.summarySource, 'main corridor summarySource should be present')
  assertNonEmptyString(mainCorridors.clusterMode, 'main corridor clusterMode should be present')
  assertNonEmptyString(mainCorridors.requestedClusterMode, 'main corridor requestedClusterMode should be present')
  assertFiniteNumber(mainCorridors.trackCount, 'main corridor trackCount should be numeric')
  assertFiniteNumber(mainCorridors.corridorCount, 'main corridor corridorCount should be numeric')
  assertStudyBounds(mainCorridors.studyArea, 'main corridor studyArea')
  assert.ok(Array.isArray(mainCorridors.corridors))
  assert.ok(mainCorridors.corridors.length > 0)
  assert.ok(Array.isArray(mainCorridors.tracks))
  assert.ok(mainCorridors.tracks.length > 0)
  assert.equal(mainCorridors.corridorCount, mainCorridors.corridors.length)
  assert.equal(mainCorridors.trackCount, mainCorridors.tracks.length)

  const corridor = mainCorridors.corridors[0]
  assertNonEmptyString(corridor.corridorId, 'corridor summary id should be present')
  assertFiniteNumber(corridor.trackCount, 'corridor summary trackCount should be numeric')
  assertNonEmptyString(corridor.directionLabel, 'corridor summary directionLabel should be present')
  assertGeoPoint(corridor.labelPoint, 'corridor summary labelPoint')

  const track = mainCorridors.tracks[0]
  assertNonEmptyString(track.id, 'corridor track id should be present')
  assertFiniteNumber(track.trackId, 'corridor trackId should be numeric')
  assertNonEmptyString(track.corridorId, 'corridor track corridorId should be present')
  assertFiniteNumber(track.directionBin, 'corridor track directionBin should be numeric')
  assertNonEmptyString(track.directionLabel, 'corridor track directionLabel should be present')
  assertFiniteNumber(track.pointCount, 'corridor track pointCount should be numeric')
  assertGeoPoint(track.labelPoint, 'corridor track labelPoint')
  assert.ok(Array.isArray(track.points))
  assert.ok(track.points.length >= 2)
  assert.equal(track.pointCount, track.points.length)
  assertFiniteNumber(track.points[0].lon, 'corridor track point lon should be numeric')
  assertFiniteNumber(track.points[0].lat, 'corridor track point lat should be numeric')
  assertNonEmptyString(track.points[0].time, 'corridor track point time should be present')
})
