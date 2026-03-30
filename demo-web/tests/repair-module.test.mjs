import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildRepairViewModel } from '../src/platform/repair/repairViewModel.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(webDir, relativePath), 'utf8'))
}

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

function loadRepairBundle() {
  const repairBundle = readJson('public/data/modules/repair/repair-bundle.json')
  return {
    samples: readJson(`public/${repairBundle.entryFiles.samples}`),
    trajectories: readJson(`public/${repairBundle.entryFiles.trajectories}`),
    errors: readJson(`public/${repairBundle.entryFiles.errors}`),
    metrics: readJson(`public/${repairBundle.entryFiles.metrics}`),
  }
}

test('repair view model exposes curated samples, model switching, and full metric-summary data for 09-03 surfaces', () => {
  const bundle = loadRepairBundle()
  const sampleId = bundle.samples.samples[0].sampleId
  const preferredModel = bundle.samples.samples[0].availableModels[0]
  const viewModel = buildRepairViewModel(bundle, sampleId, preferredModel, 'euclideanDistance')

  assert.equal(viewModel.meta.sampleCount, 3)
  assert.ok(viewModel.modelSelector.items.length >= 5)
  assert.ok(viewModel.trajectoryStage.missing.length > 0)
  assert.ok(viewModel.trajectoryStage.groundTruth.length > 0)
  assert.ok(viewModel.trajectoryStage.repair.length > 0)
  assert.ok(viewModel.errors.selectedSeriesByModel.length >= viewModel.modelSelector.items.length)
  assert.ok(viewModel.metrics.selectedModel)
  assert.equal(typeof viewModel.metrics.selectedModel.r2, 'number')
  assert.equal(typeof viewModel.metrics.selectedModel.ade, 'number')
  assert.equal(typeof viewModel.metrics.selectedModel.hausdorffDistance, 'number')
  assert.match(viewModel.readiness.trajectoryMessage, /Phase 6 export|live replay/i)
  assert.match(viewModel.readiness.errorMessage, /point order/i)
})

test('repair sources expose the full metric-summary language needed for REPR-05', () => {
  const primarySource = readSource('src/platform/repair/RepairPrimaryStage.tsx')
  const detailSource = readSource('src/platform/repair/RepairDetailGrid.tsx')
  const pageSource = readSource('src/platform/pages/RepairPage.tsx')

  for (const label of ['R-squared', 'ADE', 'Hausdorff', 'DTW', 'RMSE', 'MAE']) {
    assert.match(primarySource + detailSource, new RegExp(label), `Expected repair UI to surface ${label}`)
  }

  assert.match(detailSource, /Repair error chart/)
  assert.match(detailSource, /Sample Ranking/)
  assert.match(pageSource, /RepairPrimaryStage/)
  assert.match(pageSource, /RepairDetailGrid/)
})

test('package smoke script includes repair module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /repair-module\.test\.mjs/)
})

test('repair bundle exposes curated samples and expected method coverage', () => {
  const repairBundle = readJson('public/data/modules/repair/repair-bundle.json')
  const repairSamples = readJson('public/data/modules/repair/repair-samples.json')

  assert.equal(repairBundle.sampleCount, 3)
  assert.deepEqual(repairBundle.availableModels, [
    'att-bilstm',
    'bilstm',
    'linear-interpolation',
    'lstm',
    'spline-interpolation',
  ])
  assert.equal(repairSamples.samples.length, 3)
  for (const sample of repairSamples.samples) {
    assert.ok(sample.availableModels.includes('att-bilstm'))
    assert.ok(sample.availableModels.includes('linear-interpolation'))
  }
})
