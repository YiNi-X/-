import { formatDatasetPath } from '../datasetCatalog'
import type { DatasetCatalog, DatasetCatalogEntry } from '../datasetCatalog'
import type { AisPlaybackData, FlowForecastData, GeometryConfig } from '../sharedContracts'
import { SHARED_GEOMETRY_PATH } from './dashboardUtils'

type DashboardStatusScreenProps = {
  selectedDatasetLabel: string
  selectedDataset: DatasetCatalogEntry | null
  datasetCatalog: DatasetCatalog | null
  geometryConfig: GeometryConfig | null
  aisPlayback: AisPlaybackData | null
  flowForecast: FlowForecastData | null
  dashboardUnavailableReason: string
}

export function DashboardStatusScreen({
  selectedDatasetLabel,
  selectedDataset,
  datasetCatalog,
  geometryConfig,
  aisPlayback,
  flowForecast,
  dashboardUnavailableReason,
}: DashboardStatusScreenProps) {
  const isUnavailable = Boolean(dashboardUnavailableReason)

  return (
    <main className="platform platform-status">
      <section className="frame platform-status-shell">
        <div className="platform-status-copy">
          <span className="platform-status-eyebrow">{isUnavailable ? '运行时不可用' : '正在准备工作区'}</span>
          <h1>{isUnavailable ? '交通数据不可用' : '正在加载已校验交通数据'}</h1>
          <p>
            {isUnavailable
              ? '由于一个或多个必需的离线资产缺失或格式异常，仪表板在渲染实时风格指标前已停止。'
              : '在打开控制界面之前，仪表板会先校验已提交的数据集目录、共享 geometry、AIS 回放与预测载荷。'}
          </p>
        </div>

        <div className="platform-status-grid">
          <article className="platform-status-card accent">
            <span>数据集</span>
            <strong>{selectedDatasetLabel}</strong>
            <small>{selectedDataset?.description || '只有在可校验的离线数据集就绪后，仪表板才会继续。'}</small>
          </article>

          <article className="platform-status-card">
            <span>目录</span>
            <strong>{datasetCatalog ? '已校验' : isUnavailable ? '不可用' : '检查中'}</strong>
            <small>{formatDatasetPath('data/dataset-catalog.json')}</small>
          </article>

          <article className="platform-status-card">
            <span>几何配置</span>
            <strong>{geometryConfig ? '已校验' : isUnavailable ? '不可用' : '检查中'}</strong>
            <small>{formatDatasetPath(SHARED_GEOMETRY_PATH)}</small>
          </article>

          <article className="platform-status-card">
            <span>AIS 回放</span>
            <strong>{aisPlayback ? '已校验' : isUnavailable ? '不可用' : '检查中'}</strong>
            <small>{selectedDataset ? formatDatasetPath(selectedDataset.aisPlaybackPath) : '等待目录加载'}</small>
          </article>

          <article className="platform-status-card">
            <span>流量预测</span>
            <strong>{flowForecast ? '已校验' : isUnavailable ? '不可用' : '检查中'}</strong>
            <small>{selectedDataset ? formatDatasetPath(selectedDataset.flowForecastPath) : '等待目录加载'}</small>
          </article>
        </div>

        <div className="platform-status-detail">
          <span>{isUnavailable ? '契约详情' : '状态详情'}</span>
          <strong>{dashboardUnavailableReason || `正在准备 ${selectedDatasetLabel}。在所有必需载荷校验通过前，不会渲染场景状态。`}</strong>
        </div>
      </section>
    </main>
  )
}
