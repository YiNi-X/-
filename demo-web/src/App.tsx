import './App.css'
import { PlatformShell } from './platform/PlatformShell.tsx'
import { PlatformStatusSurface } from './platform/PlatformStatusSurface.tsx'
import { ClusteringPage } from './platform/pages/ClusteringPage.tsx'
import { EvaluationPage } from './platform/pages/EvaluationPage.tsx'
import { ForecastPage } from './platform/pages/ForecastPage.tsx'
import { ForwardLookingPage } from './platform/pages/ForwardLookingPage.tsx'
import { HomePage } from './platform/pages/HomePage.tsx'
import { OverviewPage } from './platform/pages/OverviewPage.tsx'
import { RepairPage } from './platform/pages/RepairPage.tsx'

function App() {
  return (
    <PlatformShell>
      {(shell) => {
        switch (shell.activeRouteId) {
          case 'home':
            return <HomePage key={`home-${shell.selectedDatasetId}`} selectedDatasetId={shell.selectedDatasetId} onNavigate={shell.navigate} />
          case 'overview':
            return shell.activeModule ? (
              <OverviewPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="总览不可用"
                summary="总览 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'forecast':
            return shell.activeModule ? (
              <ForecastPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="流量预测不可用"
                summary="预测 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'repair':
            return shell.activeModule ? (
              <RepairPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="轨迹修复不可用"
                summary="修复 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'clustering':
            return shell.activeModule ? (
              <ClusteringPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="轨迹聚类不可用"
                summary="聚类 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'evaluation':
            return shell.activeModule ? (
              <EvaluationPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="评估中心不可用"
                summary="评估 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'forward-looking':
            return shell.activeModule ? (
              <ForwardLookingPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="前瞻分析不可用"
                summary="前瞻分析 bundle 还没有被加载到壳层中。"
                detail="注册表加载完成后，请返回首页或重试当前模块。"
                actions={[{ label: '返回首页', onClick: () => shell.navigate('home') }]}
              />
            )
          default:
            return null
        }
      }}
    </PlatformShell>
  )
}

export default App
