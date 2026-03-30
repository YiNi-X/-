import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(webDir, relativePath), 'utf8'))
}

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

test('forward-looking bundle exposes a ready rule-driven scenario contract', () => {
  const artifactIndex = readJson('public/data/modules/artifact-index.json')
  const summary = readJson('public/data/modules/forward-looking/forward-looking-summary.json')
  const catalog = readJson('public/data/modules/forward-looking/forward-looking-scenarios.json')
  const bundle = readJson('public/data/modules/forward-looking/forward-looking-bundle.json')
  const manifest = readJson('public/data/modules/forward-looking/manifest.json')

  assert.equal(artifactIndex.modules.find((item) => item.module === 'forward-looking')?.status, 'ready')
  assert.equal(summary.module, 'forward-looking')
  assert.equal(summary.status, 'ready')
  assert.equal(summary.selectedModel, 'BiLSTM')
  assert.equal(summary.selectedHorizon, '1h')
  assert.equal(summary.scenarioCount, 4)
  assert.deepEqual(summary.uniqueFocusRoutes, ['C03', 'C08', 'C12', 'C14'])
  assert.equal(summary.noiseContext.status, 'zero-byte')
  assert.match(summary.summary, /curated scenarios/i)

  assert.equal(catalog.scenarios.length, 4)
  assert.ok(catalog.scenarios.every((scenario) => scenario.focusPressureDrop > 0))
  assert.ok(catalog.scenarios.every((scenario) => scenario.recommendations.length >= 2))
  assert.ok(catalog.scenarios.every((scenario) => scenario.evidenceLineage.length >= 4))
  assert.ok(catalog.scenarios.some((scenario) => scenario.focusRoute === 'C03' && scenario.focusGrid === 'G60'))

  assert.match(bundle.entryFiles.summary, /forward-looking-summary\.json$/)
  assert.match(bundle.entryFiles.scenarios, /forward-looking-scenarios\.json$/)
  assert.ok(manifest.artifacts.some((artifact) => artifact.artifactId === 'forward-looking-summary'))
  assert.ok(manifest.artifacts.some((artifact) => artifact.artifactId === 'forward-looking-scenarios'))
  assert.deepEqual(bundle.deferred ?? [], [])
  assert.deepEqual(manifest.deferred ?? [], [])
  assert.ok(manifest.sources['evaluation-metrics'])
  assert.ok(manifest.sources['clustering-noise-fallback'])
})

test('forward-looking page source exposes phase 12 evidence, cross-links, and deferred boundaries', () => {
  const source = readSource('src/platform/pages/ForwardLookingPage.tsx')

  for (const label of [
    'Curated Scenarios',
    'Focus Surface',
    'State Summary',
    'Route and Grid Context',
    'Focus Grid Pressure',
    'Strategy Recommendations',
    'Recommendation Stack',
    'Scenario Route Comparison',
    'Benefit Switching',
    'Alert Comparison',
    'Explanation linkage',
    'Evidence Authority',
    'Corridor Dominance',
    'Deferred CLUS-03',
    'Scenario Lineage',
    'Cross-links',
    'Deferred Next Steps',
  ]) {
    assert.match(source, new RegExp(label), `Expected ForwardLookingPage to expose ${label}`)
  }

  assert.match(source, /loadPublicJson<ForwardLookingSummary>/)
  assert.match(source, /loadPublicJson<ForwardLookingScenarioCatalog>/)
  assert.match(source, /loadPublicJson<GeometryConfig>/)
  assert.match(source, /Interactive focus route\/grid panel grounded in shared geometry/)
  assert.match(source, /Strategy state toggle/)
  assert.match(source, /The before\/after toggle now updates one shared state surface/)
  assert.match(source, /No live optimizer is implied here/)
})

test('package smoke script includes forward-looking module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /forward-looking-module\.test\.mjs/)
})
