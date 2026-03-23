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

test('required entry files exist for both demo surfaces', () => {
  assertFile('index.html')
  assertFile('route-editor.html')
  assertFile('src/main.tsx')
  assertFile('src/route-editor.tsx')
})

test('dataset catalog points to committed runtime assets', () => {
  const catalog = readJson('public/data/dataset-catalog.json')

  assert.equal(typeof catalog.defaultDatasetId, 'string')
  assert.ok(Array.isArray(catalog.datasets))
  assert.ok(catalog.datasets.length > 0)

  for (const dataset of catalog.datasets) {
    assert.equal(typeof dataset.id, 'string')
    assert.equal(typeof dataset.label, 'string')
    assert.equal(typeof dataset.aisPlaybackPath, 'string')
    assertPublicRuntimeAsset(dataset.aisPlaybackPath)
    if (typeof dataset.flowForecastPath === 'string' && dataset.flowForecastPath.length > 0) {
      assertPublicRuntimeAsset(dataset.flowForecastPath)
    }
  }
})

test('committed runtime JSON assets are parseable and expose expected top-level keys', () => {
  const aisPlayback = readJson('public/data/ais-playback.json')
  const flowForecast = readJson('public/data/flow-forecast.json')
  const mainCorridors = readJson('public/data/main-corridor-tracks.json')

  assert.ok(aisPlayback.meta)
  assert.ok(Array.isArray(aisPlayback.frames))
  assert.ok(flowForecast.meta)
  assert.ok(Array.isArray(flowForecast.timeline))
  assert.equal(typeof mainCorridors.trackCount, 'number')
  assert.ok(Array.isArray(mainCorridors.corridors))
  assert.ok(Array.isArray(mainCorridors.tracks))
})
