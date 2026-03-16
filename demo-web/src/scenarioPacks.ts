import type { HorizonKey, ModelName } from './sharedContracts'

export type MapTagDefinition = {
  id: string
  label: string
  point: { lon: number; lat: number }
  focusGrid?: string
}

export type FeedView = {
  title: string
  tag: string
  area: string
  route: string
  grid: string
  position: string
  subtitle: string
}

export type BenchmarkEntry = {
  mae: number
  rmse: number
  r2: number
  summary: string
}

export const mapTagDefinitions: MapTagDefinition[] = [
  { id: 'M01', label: 'North feeder', focusGrid: 'G03', point: { lon: 113.7264, lat: 22.5476 } },
  { id: 'M02', label: 'Main merge', focusGrid: 'G25', point: { lon: 113.7428, lat: 22.5198 } },
  { id: 'M03', label: 'Southbound spine', focusGrid: 'G25', point: { lon: 113.7496, lat: 22.4762 } },
  { id: 'M04', label: 'East branch', focusGrid: 'G60', point: { lon: 113.8046, lat: 22.324 } },
  { id: 'M05', label: 'West link', focusGrid: 'G15', point: { lon: 113.7324, lat: 22.332 } },
]

export const feedViews: FeedView[] = [
  {
    title: 'Southbound Main Route',
    tag: 'CAM-01',
    area: 'M03',
    route: 'C08',
    grid: 'G25',
    position: '52% 38%',
    subtitle: 'Tracks the dominant southbound main route in the current playback frame.',
  },
  {
    title: 'North Parallel Route',
    tag: 'CAM-02',
    area: 'M02',
    route: 'C12',
    grid: 'G03',
    position: '46% 24%',
    subtitle: 'Tracks the north-side merge and the parallel relation to the main route.',
  },
  {
    title: 'East Branch Route',
    tag: 'CAM-03',
    area: 'M04',
    route: 'C03',
    grid: 'G60',
    position: '62% 55%',
    subtitle: 'Tracks the east branch that stays outside the main-route replay layer.',
  },
  {
    title: 'West Connector',
    tag: 'CAM-04',
    area: 'M05',
    route: 'C14',
    grid: 'G15',
    position: '38% 60%',
    subtitle: 'Tracks the west-side connector and cross-route interference watch.',
  },
]

export const modelBenchmarkMatrix: Record<HorizonKey, Record<ModelName, BenchmarkEntry>> = {
  '1h': {
    STGCN: { mae: 3.434, rmse: 4.667, r2: 0.85, summary: 'STGCN keeps the lowest overall error in the 1h forecast window.' },
    LSTM: { mae: 4.118, rmse: 5.561, r2: 0.789, summary: 'LSTM remains stable at 1h but trails STGCN on all headline metrics.' },
    BiLSTM: { mae: 3.892, rmse: 5.208, r2: 0.814, summary: 'BiLSTM outperforms vanilla LSTM at 1h but still stays behind STGCN.' },
  },
  '2h': {
    STGCN: { mae: 3.871, rmse: 5.299, r2: 0.807, summary: 'STGCN still leads the 2h horizon with the strongest combined accuracy.' },
    LSTM: { mae: 4.426, rmse: 5.936, r2: 0.752, summary: 'LSTM error grows more quickly once the horizon extends to 2h.' },
    BiLSTM: { mae: 4.135, rmse: 5.684, r2: 0.776, summary: 'BiLSTM remains the runner-up at 2h but is less stable than STGCN.' },
  },
  '3h': {
    STGCN: { mae: 4.216, rmse: 5.742, r2: 0.781, summary: 'STGCN remains the strongest option even at the 3h horizon.' },
    LSTM: { mae: 4.812, rmse: 6.241, r2: 0.731, summary: 'LSTM continues to lose accuracy as the forecast horizon grows longer.' },
    BiLSTM: { mae: 4.468, rmse: 5.986, r2: 0.756, summary: 'BiLSTM keeps a modest edge over LSTM at 3h, but not over STGCN.' },
  },
}
