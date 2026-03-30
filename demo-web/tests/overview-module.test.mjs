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

test('overview summary exposes framing pillars, loop routing, and scenario/module entry contracts', () => {
  const summary = readJson('public/data/modules/overview/overview-summary.json')
  const bundle = readJson('public/data/modules/overview/overview-bundle.json')
  const manifest = readJson('public/data/modules/overview/manifest.json')

  assert.match(summary.framing, /archived AIS playback/i)
  assert.equal(summary.framingPillars.length, 3)
  assert.ok(summary.framingPillars.some((pillar) => /not a live AIS backend/i.test(pillar.title)))
  assert.ok(summary.businessLoop.every((step) => step.routeId && step.status && step.sourceArtifacts.length > 0))
  assert.equal(summary.businessLoop.at(-1)?.routeId, 'forward-looking')
  assert.equal(summary.businessLoop.at(-1)?.status, 'ready')
  assert.deepEqual(
    summary.moduleEntryPoints.map((item) => item.routeId),
    ['forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )
  assert.equal(summary.moduleEntryPoints.find((item) => item.routeId === 'forward-looking')?.status, 'ready')
  assert.deepEqual(
    summary.scenarioEntryPoints.map((item) => item.routeId),
    ['home', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )
  assert.match(bundle.entryFiles.summary, /overview-summary\.json$/)
  assert.ok(manifest.artifacts.some((artifact) => artifact.artifactId === 'overview-summary'))
  assert.ok(manifest.sources['forecast-runtime'])
  assert.ok(manifest.sources['repair-samples'])
  assert.ok(manifest.sources['clustering-corridor-runtime'])
  assert.ok(manifest.sources['evaluation-optimization'])
  assert.ok(manifest.sources['forward-looking-summary'])
})

test('overview and home source expose the phase 11 framing and entry affordances', () => {
  const overviewSource = readSource('src/platform/pages/OverviewPage.tsx')
  const homeSource = readSource('src/platform/pages/HomePage.tsx')

  for (const label of ['Business Loop', 'Module Entry Points', 'Scenario Entry Points', 'Framing Pillars', 'Source lineage']) {
    assert.match(overviewSource, new RegExp(label), `Expected OverviewPage to expose ${label}`)
  }

  assert.match(overviewSource, /How clustering enters the site narrative/)
  assert.match(overviewSource, /Deferred CLUS-03/)
  assert.match(overviewSource, /getEntryActionLabel/)

  assert.match(homeSource, /Offline showcase framing/)
  assert.match(homeSource, /scenarioEntryPoints/)
  assert.match(homeSource, /home-storyline-card/)
  assert.match(homeSource, /Corridor dominance/)
})

test('package smoke script includes overview module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /overview-module\.test\.mjs/)
})
