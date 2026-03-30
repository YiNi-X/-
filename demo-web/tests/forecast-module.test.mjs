import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildForecastViewModel } from '../src/platform/forecast/forecastViewModel.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(webDir, relativePath), 'utf8'))
}

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

function loadForecastBundle() {
  const forecastBundle = readJson('public/data/modules/forecast/forecast-bundle.json')
  return {
    runtime: readJson(`public/${forecastBundle.entryFiles.runtimeLSTM}`),
    metrics: readJson('public/data/modules/forecast/forecast-metrics.json'),
    modelConfig: readJson(`public/${forecastBundle.entryFiles.modelConfigLSTM}`),
    geometry: readJson('public/data/shared-geometry.json'),
  }
}

test('forecast view model exposes multi-model readiness, focus context, and evidence links for 08-01A/08-04 surfaces', () => {
  const bundle = loadForecastBundle()
  const selectedFrameIndex = Math.max(0, bundle.runtime.timeline.length - 1)
  const viewModel = buildForecastViewModel(bundle, 'LSTM', '1h', selectedFrameIndex)

  assert.deepEqual(viewModel.meta.availableModels, ['STGCN', 'LSTM', 'BiLSTM'])
  assert.deepEqual(viewModel.meta.availableHorizons, ['1h', '2h', '3h'])
  assert.equal(viewModel.meta.nodeViewReady, false)
  assert.equal(viewModel.meta.evidenceReady, true)
  assert.deepEqual(viewModel.meta.deferredModels, [])

  assert.ok(viewModel.summaryBand.focusGridId)
  assert.ok(viewModel.summaryBand.focusRouteId)
  assert.equal(viewModel.frameComparison.rows.length, viewModel.hotspotSeries.gridIds.length)
  assert.ok(viewModel.evidence.hotspotNodeLinks.length > 0)
  assert.match(viewModel.readiness.nodeViewMessage, /热点与节点|grid 视角|图结构/i)
  assert.match(viewModel.readiness.evidenceMessage, /抽屉|drawer/i)
  assert.match(viewModel.evidence.architectureFacts[0]?.value ?? '', /lstm/i)
})

test('forecast source exposes corridor-dominance cross-links in summary, route comparison, and hotspot alerts', () => {
  const pageSource = readSource('src/platform/pages/ForecastPage.tsx')
  const summarySource = readSource('src/platform/forecast/ForecastSummaryBand.tsx')
  const primaryStageSource = readSource('src/platform/forecast/ForecastPrimaryStage.tsx')
  const comparisonSource = readSource('src/platform/forecast/ForecastFrameComparisonPanel.tsx')
  const alertSource = readSource('src/platform/forecast/ForecastAlertTable.tsx')

  assert.match(pageSource, /corridorDominance/)
  assert.match(summarySource, /corridor dominance 主线/i)
  assert.match(summarySource, /Corridor dominance/)
  assert.match(primaryStageSource, /Corridor 上下文/)
  assert.match(primaryStageSource, /全站运动主线/)
  assert.match(comparisonSource, /Corridor 联动航线对比/)
  assert.match(comparisonSource, /航线叙事/)
  assert.match(alertSource, /Corridor 联动热点上下文/)
  assert.match(alertSource, /运动结构|corridor 家族/)
})

test('forecast analysis source exposes overview, grid, node, and evidence layers', () => {
  const analysisSource = readSource('src/platform/forecast/ForecastAnalysisTabs.tsx')
  const pageSource = readSource('src/platform/pages/ForecastPage.tsx')

  for (const label of ['概览', '网格焦点', '节点视图', '证据']) {
    assert.match(analysisSource, new RegExp(label), `Expected ForecastAnalysisTabs to expose ${label}`)
  }

  assert.match(analysisSource, /ForecastNodeViewTab/)
  assert.match(analysisSource, /ForecastEvidenceTab/)
  assert.match(analysisSource, /ForecastAlertTable/)
  assert.match(pageSource, /ForecastEvidenceDrawer/)
})

test('package smoke script includes forecast module coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /forecast-module\.test\.mjs/)
})

test('forecast bundle exposes per-model runtime and config entry files', () => {
  const forecastBundle = readJson('public/data/modules/forecast/forecast-bundle.json')

  assert.deepEqual(forecastBundle.availableModels, ['STGCN', 'LSTM', 'BiLSTM'])
  assert.deepEqual(forecastBundle.deferredModels, [])
  assert.match(forecastBundle.entryFiles.runtimeLSTM, /forecast-lstm-runtime\.json$/)
  assert.match(forecastBundle.entryFiles.runtimeBiLSTM, /forecast-bilstm-runtime\.json$/)
  assert.match(forecastBundle.entryFiles.modelConfigLSTM, /forecast-lstm-model-config\.json$/)
  assert.match(forecastBundle.entryFiles.modelConfigBiLSTM, /forecast-bilstm-model-config\.json$/)
})
