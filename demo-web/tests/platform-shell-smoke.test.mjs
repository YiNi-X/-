import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRIMARY_SHELL_ROUTE_IDS, SHELL_ROUTE_ORDER } from '../src/platform/routeRegistry.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readSource(relativePath) {
  return readFileSync(path.join(webDir, relativePath), 'utf8')
}

function assertFile(relativePath) {
  assert.ok(existsSync(path.join(webDir, relativePath)), `Expected file to exist: ${relativePath}`)
}

test('phase 7 shell keeps the locked route order and page files in place', () => {
  assert.deepEqual(SHELL_ROUTE_ORDER, ['home', 'overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'])
  assert.deepEqual(PRIMARY_SHELL_ROUTE_IDS, ['home', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'])

  for (const relativePath of [
    'src/App.tsx',
    'src/platform/PlatformShell.tsx',
    'src/platform/pages/HomePage.tsx',
    'src/platform/pages/OverviewPage.tsx',
    'src/platform/pages/ForecastPage.tsx',
    'src/platform/pages/RepairPage.tsx',
    'src/platform/pages/ClusteringPage.tsx',
    'src/platform/pages/EvaluationPage.tsx',
    'src/platform/pages/ForwardLookingPage.tsx',
  ]) {
    assertFile(relativePath)
  }
})

test('App route switch mounts every phase 7 destination', () => {
  const appSource = readSource('src/App.tsx')
  for (const routeId of SHELL_ROUTE_ORDER) {
    assert.match(appSource, new RegExp(`case '${routeId}'`), `Expected App.tsx to handle route ${routeId}`)
  }
})

test('homepage preview cards cover every module entry and keep click as the primary action', () => {
  const homeSource = readSource('src/platform/pages/HomePage.tsx')
  for (const routeId of ['overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking']) {
    assert.match(homeSource, new RegExp(`routeId: '${routeId}'`), `Expected a homepage preview card for ${routeId}`)
  }
  assert.match(homeSource, /onClick=\{\(\) => onNavigate\(card\.routeId\)\}/)
  assert.match(homeSource, /查看详情|查看轨迹|对比结果|查看状态|打开分析/)
})

test('platform shell pages keep delivery-friendly language while preserving the current module structure', () => {
  const forecastSource = readSource('src/platform/pages/ForecastPage.tsx')
  const clusteringSource = readSource('src/platform/pages/ClusteringPage.tsx')
  const forwardSource = readSource('src/platform/pages/ForwardLookingPage.tsx')

  assert.match(forecastSource, /预测驾驶舱|地图联动数据/)
  assert.match(clusteringSource, /补充分段分布|噪声池统计|CLUS-03/i)
  assert.match(forwardSource, /规则驱动协同决策|策略状态切换|场景说明/i)
})

test('package smoke script includes the new platform shell coverage', () => {
  const packageJson = JSON.parse(readSource('package.json'))
  assert.match(packageJson.scripts.smoke, /platform-shell-smoke\.test\.mjs/)
})
