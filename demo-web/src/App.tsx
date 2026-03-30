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
                title="Overview unavailable"
                summary="The overview bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'forecast':
            return shell.activeModule ? (
              <ForecastPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="Flow prediction unavailable"
                summary="The forecast bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'repair':
            return shell.activeModule ? (
              <RepairPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="Trajectory repair unavailable"
                summary="The repair bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'clustering':
            return shell.activeModule ? (
              <ClusteringPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="Trajectory clustering unavailable"
                summary="The clustering bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'evaluation':
            return shell.activeModule ? (
              <EvaluationPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="Evaluation center unavailable"
                summary="The evaluation bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
              />
            )
          case 'forward-looking':
            return shell.activeModule ? (
              <ForwardLookingPage key={shell.activeModule.artifactId} entry={shell.activeModule} onNavigate={shell.navigate} />
            ) : (
              <PlatformStatusSurface
                tone="unavailable"
                title="Forward-looking analysis unavailable"
                summary="The forward-looking bundle has not been loaded into the shell yet."
                detail="Return home or retry the selected module once the registry finishes loading."
                actions={[{ label: 'Return home', onClick: () => shell.navigate('home') }]}
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
