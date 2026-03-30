import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseModuleArtifactIndex,
  parseModuleBundleMetadata,
  parseModuleManifest,
} from '../src/runtimeSchemas.ts'
import {
  buildModuleDiscoveryRegistry,
  buildModuleRegistryEntries,
  createModuleRegistryEntry,
} from '../src/platform/moduleRegistry.ts'
import {
  PRIMARY_SHELL_ROUTE_IDS,
  SHELL_ROUTE_ORDER,
  getShellRouteDescriptor,
  listPrimaryShellRoutes,
  listShellRoutes,
} from '../src/platform/routeRegistry.ts'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(testDir, '..')
const repoDir = path.resolve(webDir, '..')

function readWebJson(relativePath) {
  const filePath = path.join(webDir, relativePath)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function assertWebFile(relativePath) {
  const filePath = path.join(webDir, relativePath)
  assert.ok(existsSync(filePath), `Expected web file to exist: ${relativePath}`)
}

function assertRepoFile(relativePath) {
  const filePath = path.join(repoDir, relativePath)
  assert.ok(existsSync(filePath), `Expected repo file to exist: ${relativePath}`)
}

test('shell routes preserve the locked navigation order and overview remains addressable', () => {
  assert.deepEqual(SHELL_ROUTE_ORDER, ['home', 'overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'])
  assert.deepEqual(PRIMARY_SHELL_ROUTE_IDS, ['home', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'])
  assert.deepEqual(
    listPrimaryShellRoutes().map((route) => route.id),
    ['home', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )
  assert.deepEqual(
    listShellRoutes().map((route) => route.id),
    ['home', 'overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )

  const overviewRoute = getShellRouteDescriptor('overview')
  assert.equal(overviewRoute.kind, 'module')
  assert.equal(overviewRoute.navVisible, false)

  const forwardLookingRoute = getShellRouteDescriptor('forward-looking')
  assert.equal(forwardLookingRoute.kind, 'module')
  assert.equal(forwardLookingRoute.moduleId, 'forward-looking')
  assert.equal(forwardLookingRoute.entryActionLabel, 'Open Analysis')
})

test('artifact index parses and normalizes into the shell discovery order', () => {
  const artifactIndex = parseModuleArtifactIndex(readWebJson('public/data/modules/artifact-index.json'))
  const discovery = buildModuleDiscoveryRegistry(artifactIndex)

  assert.deepEqual(
    discovery.map((entry) => entry.moduleId),
    ['overview', 'forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )
  assert.deepEqual(
    discovery.filter((entry) => entry.navVisible).map((entry) => entry.routeId),
    ['forecast', 'repair', 'clustering', 'evaluation', 'forward-looking'],
  )

  for (const entry of discovery) {
    assert.ok(entry.manifestPath.startsWith('data/modules/'))
    assert.ok(entry.bundlePath.startsWith('data/modules/'))
    assertWebFile(path.join('public', entry.manifestPath))
    assertWebFile(path.join('public', entry.bundlePath))
  }
})

test('module manifests and bundles parse through the runtime contract layer', () => {
  const artifactIndex = parseModuleArtifactIndex(readWebJson('public/data/modules/artifact-index.json'))
  const discoveryEntries = buildModuleDiscoveryRegistry(artifactIndex)

  const manifests = {}
  const bundles = {}

  for (const discovery of discoveryEntries) {
    const manifest = parseModuleManifest(readWebJson(path.join('public', discovery.manifestPath)))
    const bundle = parseModuleBundleMetadata(readWebJson(path.join('public', discovery.bundlePath)))
    const registryEntry = createModuleRegistryEntry(discovery, manifest, bundle)

    manifests[discovery.moduleId] = manifest
    bundles[discovery.moduleId] = bundle

    assert.equal(registryEntry.moduleId, discovery.moduleId)
    assert.ok(registryEntry.entryFileList.length > 0)
    assert.equal(registryEntry.entryFileList.length, Object.keys(registryEntry.entryFiles).length)

    for (const entryFile of registryEntry.entryFileList) {
      assertWebFile(path.join('public', entryFile.path))
    }

    for (const artifact of registryEntry.artifacts) {
      assertWebFile(path.join('public', artifact.path))
    }

    for (const reviewFile of registryEntry.reviewFiles) {
      assertRepoFile(reviewFile)
    }
  }

  const registryEntries = buildModuleRegistryEntries(artifactIndex, manifests, bundles)
  const readinessByModule = Object.fromEntries(registryEntries.map((entry) => [entry.moduleId, entry.readiness]))

  assert.deepEqual(readinessByModule, {
    overview: 'ready',
    forecast: 'ready',
    repair: 'partial',
    clustering: 'partial',
    evaluation: 'ready',
    'forward-looking': 'ready',
  })

  const clusteringEntry = registryEntries.find((entry) => entry.moduleId === 'clustering')
  assert.ok(clusteringEntry)
  assert.equal(clusteringEntry.hasReviewArtifacts, true)
  assert.equal(clusteringEntry.hasDeferredSections, true)

  const forwardLookingEntry = registryEntries.find((entry) => entry.moduleId === 'forward-looking')
  assert.ok(forwardLookingEntry)
  assert.equal(forwardLookingEntry.readiness, 'ready')
  assert.equal(forwardLookingEntry.hasDeferredSections, false)
})
