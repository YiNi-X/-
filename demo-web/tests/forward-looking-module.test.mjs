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

test('forward-looking page source exposes phase 12 evidence, cross-links, and scenario comparison surfaces', () => {
  const source = readSource('src/platform/pages/ForwardLookingPage.tsx')

  for (const label of [
    '精选场景',
    '焦点面板',
    '状态摘要',
    'Route 与 Grid 语境',
    '焦点 Grid 压力',
    '策略建议',
    '建议栈',
    '场景 route 对比',
    '收益切换',
    '告警对比',
    '解释链路',
    '模型依据',
    'Corridor dominance',
    '关联模块',
    '跨页回链',
    '场景说明',
  ]) {
    assert.match(source, new RegExp(label), `Expected ForwardLookingPage to expose ${label}`)
  }

  assert.match(source, /loadPublicJson<ForwardLookingSummary>/)
  assert.match(source, /loadPublicJson<ForwardLookingScenarioCatalog>/)
  assert.match(source, /loadPublicJson<GeometryConfig>/)
  assert.match(source, /共享 geometry/)
  assert.match(source, /策略状态切换/)
  assert.match(source, /before\/after 切换/)
  assert.match(source, /应用态预览与策略基线共享同一场景锚点|场景说明/)
})

test('package smoke script includes forward-looking module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /forward-looking-module\.test\.mjs/)
})
