import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AGGREGATE_REPAIR_SCOPE_ID, buildEvaluationViewModel } from '../src/platform/evaluation/evaluationViewModel.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(webDir, relativePath), 'utf8'))
}

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

function buildEvaluationEntry() {
  const manifest = readJson('public/data/modules/evaluation/manifest.json')
  const bundle = readJson('public/data/modules/evaluation/evaluation-bundle.json')
  const entryFileList = Object.entries(bundle.entryFiles).map(([key, filePath]) => ({ key, path: filePath }))

  return {
    artifactId: manifest.artifactId,
    moduleId: 'evaluation',
    routeId: 'evaluation',
    label: 'Evaluation',
    navLabel: 'Evaluation',
    shortLabel: 'Eval',
    description: 'Evaluation module',
    shellOrder: 5,
    navVisible: true,
    entryActionLabel: 'Compare Results',
    status: 'ready',
    manifestPath: 'data/modules/evaluation/manifest.json',
    bundlePath: manifest.bundlePath,
    scenarioId: manifest.scenarioId,
    timeRange: manifest.timeRange,
    authoritativeFor: manifest.authoritativeFor,
    generatedAt: manifest.generatedAt,
    sourceStage: manifest.sourceStage,
    readiness: 'ready',
    entryFiles: bundle.entryFiles,
    entryFileList,
    artifacts: manifest.artifacts,
    reviewFiles: [],
    sources: manifest.sources,
    deferredItems: [],
    hasDeferredSections: false,
    hasReviewArtifacts: false,
  }
}

test('evaluation view model exposes forecast and repair ranking controls plus traceability links', () => {
  const metrics = readJson('public/data/modules/evaluation/evaluation-metrics.json')
  const entry = buildEvaluationEntry()

  const aggregateView = buildEvaluationViewModel(metrics, entry, {
    selectedForecastHorizon: '2h',
    selectedForecastMetric: 'rmse',
    selectedRepairScopeId: AGGREGATE_REPAIR_SCOPE_ID,
    selectedRepairMetric: 'rmse',
  })

  assert.equal(aggregateView.forecast.selectedHorizon, '2h')
  assert.equal(aggregateView.forecast.selectedMetric, 'rmse')
  assert.equal(aggregateView.forecast.rows[0]?.model, 'BiLSTM')
  assert.equal(aggregateView.forecast.rows[0]?.rank, 1)
  assert.equal(aggregateView.repair.selectedScope.id, AGGREGATE_REPAIR_SCOPE_ID)
  assert.equal(aggregateView.repair.rows[0]?.modelLabel, 'ATT-BILSTM')
  assert.ok(aggregateView.summary.cards.length >= 4)
  assert.equal(aggregateView.traceability.artifactEntries.length, 3)
  assert.ok(aggregateView.traceability.sourceEntries.some((trace) => /forecast-metrics\.json$/.test(trace.path)))
  assert.ok(aggregateView.traceability.requirementCodes.includes('EVAL-01'))
  assert.ok(aggregateView.traceability.requirementCodes.includes('EVAL-04'))
  assert.ok(aggregateView.traceability.requirementCodes.includes('EVAL-05'))

  const sampleView = buildEvaluationViewModel(metrics, entry, {
    selectedForecastHorizon: '3h',
    selectedForecastMetric: 'r2',
    selectedRepairScopeId: 'repair-target-2-sample-1',
    selectedRepairMetric: 'dtwSimilarity',
  })

  assert.equal(sampleView.repair.selectedScope.id, 'repair-target-2-sample-1')
  assert.equal(sampleView.repair.selectedMetric, 'dtwSimilarity')
  assert.equal(sampleView.repair.rows[0]?.modelLabel, 'ATT-BILSTM')
  assert.equal(sampleView.forecast.rows[0]?.model, 'BiLSTM')
})

test('evaluation optimization artifact exposes real history and parameter-importance evidence', () => {
  const optimization = readJson('public/data/modules/evaluation/evaluation-optimization.json')
  const bundle = readJson('public/data/modules/evaluation/evaluation-bundle.json')
  const manifest = readJson('public/data/modules/evaluation/manifest.json')

  assert.match(bundle.entryFiles.optimization, /evaluation-optimization\.json$/)
  assert.equal(optimization.studyId, 'study1_1')
  assert.equal(optimization.objective.totalTrialSlots, 100)
  assert.equal(optimization.objective.completedTrials, 13)
  assert.equal(optimization.objective.bestTrial, 93)
  assert.equal(optimization.importance.parameters[0]?.id, 'batch_size')
  assert.equal(optimization.bestParameters.find((parameter) => parameter.id === 'lr')?.displayValue, '0.00806')
  assert.equal(optimization.supportingViews.length, 4)
  assert.ok(manifest.artifacts.some((artifact) => artifact.artifactId === 'evaluation-optimization'))
  assert.ok(manifest.sources['optimization-history-html'])
  assert.ok(manifest.sources['param-importance-html'])
})

test('evaluation page source exposes the phase 11 unified center affordances', () => {
  const evaluationSource = readSource('src/platform/pages/EvaluationPage.tsx')

  for (const label of [
    'Unified Scoreboard',
    'Forecast Ranking Table',
    'Repair Ranking Table',
    'Optimization Evidence',
    'Optimization History',
    'Parameter Importance',
    'Best Parameter Set',
    'Supporting Offline Views',
    'Traceability Links',
    'Source lineage',
    'Corridor Dominance Context',
    'Deferred CLUS-03',
  ]) {
    assert.match(evaluationSource, new RegExp(label), `Expected EvaluationPage to expose ${label}`)
  }

  assert.match(evaluationSource, /buildEvaluationViewModel/)
  assert.match(evaluationSource, /selectedForecastHorizon/)
  assert.match(evaluationSource, /selectedRepairScopeId/)
  assert.match(evaluationSource, /entry\.entryFiles\.optimization/)
  assert.match(evaluationSource, /evaluation-filter-button/)
  assert.match(evaluationSource, /evaluation-table-shell/)
})

test('package smoke script includes evaluation module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /evaluation-module\.test\.mjs/)
})
