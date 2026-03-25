import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseModuleArtifactIndex,
  parseModuleBundleMetadata,
  parseModuleManifest,
} from '../src/runtimeSchemas.ts'
import { createModuleLoader } from '../src/platform/moduleLoader.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')

function readWebJson(relativePath) {
  const filePath = path.join(webDir, relativePath)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function buildSuccess(kind, label, resourcePath, data) {
  return {
    ok: true,
    kind,
    label,
    path: `/${resourcePath.replace(/^\/+/, '')}`,
    data,
  }
}

function buildFailure(kind, label, resourcePath, detail, reason = 'contract') {
  return {
    ok: false,
    kind,
    label,
    path: `/${resourcePath.replace(/^\/+/, '')}`,
    reason,
    message: `${label} unavailable.`,
    detail,
  }
}

function loadFixtures() {
  const artifactIndex = parseModuleArtifactIndex(readWebJson('public/data/modules/artifact-index.json'))
  const manifests = new Map(
    artifactIndex.modules.map((entry) => [
      entry.manifestPath,
      parseModuleManifest(readWebJson(path.join('public', entry.manifestPath))),
    ]),
  )
  const bundles = new Map(
    artifactIndex.modules.map((entry) => [
      entry.bundlePath,
      parseModuleBundleMetadata(readWebJson(path.join('public', entry.bundlePath))),
    ]),
  )

  return { artifactIndex, manifests, bundles }
}

function buildLoaderHarness(overrides = {}) {
  const fixtures = loadFixtures()
  const calls = {
    artifactIndex: 0,
    manifest: [],
    bundle: [],
  }

  const loader = createModuleLoader({
    loadArtifactIndex: async () => {
      calls.artifactIndex += 1
      if (typeof overrides.artifactIndexFailure === 'string') {
        return buildFailure('moduleArtifactIndex', 'Module artifact index', 'data/modules/artifact-index.json', overrides.artifactIndexFailure)
      }
      return buildSuccess('moduleArtifactIndex', 'Module artifact index', 'data/modules/artifact-index.json', fixtures.artifactIndex)
    },
    loadManifest: async (resource) => {
      calls.manifest.push(resource)
      if (overrides.manifestFailures?.[resource]) {
        return buildFailure('moduleManifest', 'Module manifest', resource, overrides.manifestFailures[resource])
      }
      const manifest = fixtures.manifests.get(resource)
      if (!manifest) {
        return buildFailure('moduleManifest', 'Module manifest', resource, 'Fixture manifest missing.', 'http')
      }
      return buildSuccess('moduleManifest', 'Module manifest', resource, manifest)
    },
    loadBundle: async (resource) => {
      calls.bundle.push(resource)
      if (overrides.bundleFailures?.[resource]) {
        return buildFailure('moduleBundle', 'Module bundle', resource, overrides.bundleFailures[resource])
      }
      const bundle = fixtures.bundles.get(resource)
      if (!bundle) {
        return buildFailure('moduleBundle', 'Module bundle', resource, 'Fixture bundle missing.', 'http')
      }
      return buildSuccess('moduleBundle', 'Module bundle', resource, bundle)
    },
  })

  return { loader, calls }
}

test('module loader discovers registry metadata without eagerly loading every module bundle', async () => {
  const { loader, calls } = buildLoaderHarness()

  const discoveryResult = await loader.loadDiscovery()
  assert.equal(discoveryResult.ok, true)
  assert.equal(discoveryResult.source, 'network')
  assert.deepEqual(
    discoveryResult.entries.map((entry) => entry.moduleId),
    ['overview', 'forecast', 'repair', 'clustering', 'evaluation'],
  )
  assert.equal(calls.artifactIndex, 1)
  assert.deepEqual(calls.manifest, [])
  assert.deepEqual(calls.bundle, [])

  const cachedDiscovery = await loader.loadDiscovery()
  assert.equal(cachedDiscovery.ok, true)
  assert.equal(cachedDiscovery.source, 'cache')
  assert.equal(calls.artifactIndex, 1)
})

test('module loader lazy-loads only the selected module and reuses cached entries across navigation', async () => {
  const { loader, calls } = buildLoaderHarness()

  const forecastResult = await loader.loadModule('forecast')
  assert.equal(forecastResult.ok, true)
  assert.equal(forecastResult.source, 'network')
  assert.equal(forecastResult.entry.moduleId, 'forecast')
  assert.deepEqual(calls.manifest, ['data/modules/forecast/manifest.json'])
  assert.deepEqual(calls.bundle, ['data/modules/forecast/forecast-bundle.json'])
  assert.deepEqual(loader.listCachedModuleIds(), ['forecast'])

  const cachedForecast = await loader.loadModule('forecast')
  assert.equal(cachedForecast.ok, true)
  assert.equal(cachedForecast.source, 'cache')
  assert.deepEqual(calls.manifest, ['data/modules/forecast/manifest.json'])
  assert.deepEqual(calls.bundle, ['data/modules/forecast/forecast-bundle.json'])

  const repairResult = await loader.loadModule('repair')
  assert.equal(repairResult.ok, true)
  assert.deepEqual(calls.manifest, ['data/modules/forecast/manifest.json', 'data/modules/repair/manifest.json'])
  assert.deepEqual(calls.bundle, ['data/modules/forecast/forecast-bundle.json', 'data/modules/repair/repair-bundle.json'])
  assert.deepEqual(loader.listCachedModuleIds(), ['forecast', 'repair'])
})

test('module loader propagates deferred metadata and review markers from the selected module package', async () => {
  const { loader } = buildLoaderHarness()

  const clusteringResult = await loader.loadModule('clustering')
  assert.equal(clusteringResult.ok, true)
  assert.equal(clusteringResult.entry.hasDeferredSections, true)
  assert.equal(clusteringResult.entry.hasReviewArtifacts, true)
  assert.ok(clusteringResult.entry.deferredItems.some((item) => item.artifactId === 'clustering-noise-reclustered'))
})

test('module loader surfaces registry, manifest, and bundle failures with explicit stages', async () => {
  const registryHarness = buildLoaderHarness({ artifactIndexFailure: 'artifact-index.json could not be fetched.' })
  const registryResult = await registryHarness.loader.loadModule('forecast')
  assert.equal(registryResult.ok, false)
  assert.equal(registryResult.stage, 'artifact-index')

  const manifestHarness = buildLoaderHarness({
    manifestFailures: {
      'data/modules/repair/manifest.json': 'repair manifest contract failed.',
    },
  })
  const manifestResult = await manifestHarness.loader.loadModule('repair')
  assert.equal(manifestResult.ok, false)
  assert.equal(manifestResult.stage, 'manifest')

  const bundleHarness = buildLoaderHarness({
    bundleFailures: {
      'data/modules/evaluation/evaluation-bundle.json': 'evaluation bundle contract failed.',
    },
  })
  const bundleResult = await bundleHarness.loader.loadModule('evaluation')
  assert.equal(bundleResult.ok, false)
  assert.equal(bundleResult.stage, 'bundle')
})
