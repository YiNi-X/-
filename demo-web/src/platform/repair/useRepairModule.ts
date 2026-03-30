import { useEffect, useMemo, useState } from 'react'
import { loadPublicJson } from '../../sharedContracts'
import type { ModuleRegistryEntry } from '../moduleContracts.ts'
import { buildRepairViewModel } from './repairViewModel.ts'
import type {
  RepairEntryFiles,
  RepairErrorMetricKey,
  RepairErrorsFile,
  RepairLoadedBundle,
  RepairMetricsFile,
  RepairSampleCatalog,
  RepairTrajectoriesFile,
} from './repairTypes.ts'

type RepairModuleState = {
  bundle: RepairLoadedBundle | null
  selectedSampleId: string
  selectedModelId: string
  selectedErrorMetric: RepairErrorMetricKey
  showMissing: boolean
  showGroundTruth: boolean
  showRepair: boolean
  loading: boolean
  error: string
}

function asRepairEntryFiles(entryFiles: ModuleRegistryEntry['entryFiles']) {
  return entryFiles as RepairEntryFiles
}

export function useRepairModule(entry: ModuleRegistryEntry) {
  const entryFiles = asRepairEntryFiles(entry.entryFiles)
  const [state, setState] = useState<RepairModuleState>({
    bundle: null,
    selectedSampleId: '',
    selectedModelId: 'att-bilstm',
    selectedErrorMetric: 'euclideanDistance',
    showMissing: true,
    showGroundTruth: true,
    showRepair: true,
    loading: true,
    error: '',
  })

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadPublicJson<RepairSampleCatalog>(`/${entryFiles.samples}`),
      loadPublicJson<RepairTrajectoriesFile>(`/${entryFiles.trajectories}`),
      loadPublicJson<RepairErrorsFile>(`/${entryFiles.errors}`),
      loadPublicJson<RepairMetricsFile>(`/${entryFiles.metrics}`),
    ])
      .then(([samples, trajectories, errors, metrics]) => {
        if (cancelled) return

        const firstSample = samples.samples[0]
        setState((current) => ({
          ...current,
          bundle: { samples, trajectories, errors, metrics },
          selectedSampleId: firstSample?.sampleId ?? '',
          selectedModelId: firstSample?.availableModels.includes('att-bilstm') ? 'att-bilstm' : (firstSample?.availableModels[0] ?? 'att-bilstm'),
          loading: false,
          error: '',
        }))
      })
      .catch((loadError) => {
        if (cancelled) return
        setState((current) => ({
          ...current,
          bundle: null,
          loading: false,
          error: loadError instanceof Error ? loadError.message : 'Failed to load repair page data.',
        }))
      })

    return () => {
      cancelled = true
    }
  }, [entry.artifactId, entryFiles.errors, entryFiles.metrics, entryFiles.samples, entryFiles.trajectories])

  const viewModel = useMemo(() => {
    if (!state.bundle || !state.selectedSampleId) return null
    return buildRepairViewModel(state.bundle, state.selectedSampleId, state.selectedModelId, state.selectedErrorMetric)
  }, [state.bundle, state.selectedErrorMetric, state.selectedModelId, state.selectedSampleId])

  const selectedModelId =
    viewModel?.modelSelector.items.find((item) => item.modelId === state.selectedModelId)?.modelId ?? viewModel?.modelSelector.items[0]?.modelId ?? state.selectedModelId

  return {
    viewModel,
    loading: state.loading,
    error: state.error,
    selectedSampleId: state.selectedSampleId,
    selectedModelId,
    selectedErrorMetric: state.selectedErrorMetric,
    showMissing: state.showMissing,
    showGroundTruth: state.showGroundTruth,
    showRepair: state.showRepair,
    setSelectedSampleId: (selectedSampleId: string) =>
      setState((current) => {
        const availableModels = current.bundle?.samples.samples.find((sample) => sample.sampleId === selectedSampleId)?.availableModels ?? []
        const nextModelId = availableModels.includes(current.selectedModelId) ? current.selectedModelId : (availableModels[0] ?? current.selectedModelId)
        return { ...current, selectedSampleId, selectedModelId: nextModelId }
      }),
    setSelectedModelId: (selectedModelId: string) => setState((current) => ({ ...current, selectedModelId })),
    setSelectedErrorMetric: (selectedErrorMetric: RepairErrorMetricKey) => setState((current) => ({ ...current, selectedErrorMetric })),
    toggleMissing: () => setState((current) => ({ ...current, showMissing: !current.showMissing })),
    toggleGroundTruth: () => setState((current) => ({ ...current, showGroundTruth: !current.showGroundTruth })),
    toggleRepair: () => setState((current) => ({ ...current, showRepair: !current.showRepair })),
  }
}
