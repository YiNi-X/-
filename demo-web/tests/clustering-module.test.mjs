import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCorridorDominanceSummary } from '../src/platform/clustering/corridorDominance.ts'
import { buildClusteringViewModel } from '../src/platform/clustering/clusteringViewModel.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(webDir, relativePath), 'utf8'))
}

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

function loadClusteringBundle() {
  const clusteringBundle = readJson('public/data/modules/clustering/clustering-bundle.json')
  return {
    summary: readJson(`public/${clusteringBundle.entryFiles.summary}`),
    stagePreviews: readJson(`public/${clusteringBundle.entryFiles.stagePreviews}`),
    corridorRuntime: readJson(`public/${clusteringBundle.entryFiles.corridorRuntime}`),
    corridorReview: readJson(`public/${clusteringBundle.entryFiles.corridorReview}`),
  }
}

test('clustering view model exposes layer switching, corridor statistics, and runtime-review comparison', () => {
  const bundle = loadClusteringBundle()
  const selectedCorridorId = bundle.corridorRuntime.corridors[0].corridorId
  const viewModel = buildClusteringViewModel(bundle, 'corridorExported', selectedCorridorId)

  assert.deepEqual(
    viewModel.meta.availableLayers.map((layer) => layer.id),
    ['raw', 'segmented', 'compressed', 'corridorExported', 'corridorReview'],
  )
  assert.equal(viewModel.meta.selectedLayer, 'corridorExported')
  assert.equal(viewModel.meta.noiseReclusterReady, false)
  assert.equal(viewModel.stats.totalCorridors, 16)
  assert.equal(viewModel.stats.selectedCorridor?.corridorId, selectedCorridorId)
  assert.ok(viewModel.stats.averageTracksPerCorridor > 0)
  assert.equal(viewModel.reviewComparison.corridorDelta, 0)
  assert.equal(viewModel.reviewComparison.trackDelta, 0)
  assert.equal(viewModel.reviewComparison.selectedCorridorMatches, true)
  assert.ok(viewModel.selectedLayer.previewTracks.length > 0)
  assert.match(viewModel.selectedLayer.summary, /corridor/i)
  assert.match(viewModel.stats.noiseStatusMessage, /deferred|0 bytes|zero-byte|unreadable|stable/i)
  assert.equal(viewModel.pipelineStory.steps.length, 4)
  assert.match(viewModel.pipelineStory.compressionRatio, /%/)
  assert.ok(viewModel.corridorLeaderboard.length >= 8)
  assert.equal(viewModel.stats.selectedCorridor?.rank, 1)
  assert.match(viewModel.recoveryChecklist.artifactId, /clustering-noise-reclustered/)
  assert.match(viewModel.recoveryChecklist.blocker, /normalized_distances|0 bytes|zero-byte|unreadable|stable/i)
  assert.match(viewModel.recoveryChecklist.artifactStatus, /0 字节|0 bytes|工作区|workspace|缺失|missing|不可读取|unreadable/i)
  assert.equal(viewModel.recoveryChecklist.steps.length, 3)
})

test('corridor dominance helper exposes the runtime corridor spine for cross-module narrative', () => {
  const corridorRuntime = readJson('public/data/modules/clustering/clustering-corridor-runtime.json')
  const dominance = buildCorridorDominanceSummary(corridorRuntime)

  assert.equal(dominance.totalTracks, 1321)
  assert.equal(dominance.corridorCount, 16)
  assert.equal(dominance.leadingCorridor?.corridorId, 'D07-C01')
  assert.equal(dominance.leadingDirection?.directionLabel, 'South')
  assert.equal(dominance.leadingDirection?.leadCorridorId, 'D06-C01')
  assert.equal(dominance.topCorridors[1]?.corridorId, 'D06-C01')
  assert.equal(dominance.topCorridors[2]?.corridorId, 'D06-C02')
  assert.equal(Math.round((dominance.leadingCorridor?.share ?? 0) * 100), 15)
  assert.equal(Math.round(dominance.topThreeShare * 100), 41)
  assert.equal(Math.round((dominance.leadingDirection?.share ?? 0) * 100), 26)
})

test('clustering page source exposes the phase 10 module affordances', () => {
  const clusteringSource = readSource('src/platform/pages/ClusteringPage.tsx')

  for (const label of ['图层切换', '聚类统计', 'Runtime vs Review', '打开 RouteEditor runtime', 'noise 重聚类', '流水线叙事', 'corridor 排行', '当前 corridor 档案', '恢复清单', '噪声池 / Deferred CLUS-03', '诚实 fallback', '0 字节', '产物状态']) {
    assert.match(clusteringSource, new RegExp(label), `Expected ClusteringPage to expose ${label}`)
  }

  assert.match(clusteringSource, /clustering-layer-buttons/)
  assert.match(clusteringSource, /clustering-leaderboard/)
  assert.match(clusteringSource, /恢复清单/)
  assert.match(clusteringSource, /CLUSTERING_NOISE_FALLBACK_PATH/)
  assert.match(clusteringSource, /entry\.entryFiles\.noiseFallback/)
  assert.match(clusteringSource, /main-corridor-tracks\.json/)
})

test('home, overview, and evaluation pages expose corridor dominance cross-links', () => {
  const homeSource = readSource('src/platform/pages/HomePage.tsx')
  const overviewSource = readSource('src/platform/pages/OverviewPage.tsx')
  const evaluationSource = readSource('src/platform/pages/EvaluationPage.tsx')

  assert.match(homeSource, /Corridor dominance/)
  assert.match(homeSource, /corridor-dominance-card/)
  assert.match(homeSource, /CLUSTERING_CORRIDOR_RUNTIME_PATH/)
  assert.match(overviewSource, /聚类如何进入整站叙事/)
  assert.match(overviewSource, /Corridor dominance/)
  assert.match(overviewSource, /Deferred CLUS-03/)
  assert.match(overviewSource, /为什么 noise re-clustering 仍然暂停/)
  assert.match(overviewSource, /0 字节|0 bytes/)
  assert.match(overviewSource, /整站桥梁/)
  assert.match(evaluationSource, /Corridor dominance 上下文/)
  assert.match(evaluationSource, /为什么排名需要聚类语境/)
  assert.match(evaluationSource, /Deferred CLUS-03/)
  assert.match(evaluationSource, /fallback 证据/)
  assert.match(evaluationSource, /0 字节|0 bytes/)
  assert.match(evaluationSource, /corridor-led 运动主线|主导 runtime corridor/)
})

test('package smoke script includes clustering module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /clustering-module\.test\.mjs/)
})

test('clustering bundle exposes the entry files required for layer switching', () => {
  const clusteringBundle = readJson('public/data/modules/clustering/clustering-bundle.json')
  const stagePreviews = readJson('public/data/modules/clustering/clustering-stage-previews.json')
  const noiseFallback = readJson('public/data/modules/clustering/clustering-noise-fallback.json')

  assert.match(clusteringBundle.entryFiles.summary, /clustering-summary\.json$/)
  assert.match(clusteringBundle.entryFiles.stagePreviews, /clustering-stage-previews\.json$/)
  assert.match(clusteringBundle.entryFiles.corridorRuntime, /clustering-corridor-runtime\.json$/)
  assert.match(clusteringBundle.entryFiles.corridorReview, /clustering-corridor-review\.json$/)
  assert.match(clusteringBundle.entryFiles.noiseFallback, /clustering-noise-fallback\.json$/)
  assert.deepEqual(Object.keys(stagePreviews.previews), [
    'raw',
    'segmented',
    'compressed',
    'corridorExported',
    'corridorReview',
  ])
  assert.deepEqual(clusteringBundle.deferred, ['clustering-noise-reclustered'])
  assert.equal(noiseFallback.deferredArtifact.status, 'zero-byte')
  assert.equal(noiseFallback.deferredArtifact.fileBytes, 0)
  assert.match(noiseFallback.deferredArtifact.filePath, /normalized_distances/)
  assert.match(noiseFallback.sourceSummary, /corridor-review-summary\.json$/)
  assert.equal(noiseFallback.dropReasons.find((reason) => reason.id === 'dbscan_noise')?.count, 541)
  assert.match(noiseFallback.summary, /Honest fallback|deferred CLUS-03|0 bytes/i)
})
