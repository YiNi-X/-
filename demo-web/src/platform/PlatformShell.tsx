import type { ReactNode } from 'react'
import { PlatformStatusSurface } from './PlatformStatusSurface.tsx'
import type { PlatformShellOptions, PlatformShellResult } from './usePlatformShell.ts'
import { usePlatformShell } from './usePlatformShell.ts'

type PlatformShellProps = PlatformShellOptions & {
  children?: (shell: PlatformShellResult) => ReactNode
}

function renderShellBody(shell: PlatformShellResult, children?: (shell: PlatformShellResult) => ReactNode) {
  if (shell.shellLoading) {
    return (
      <PlatformStatusSurface
        tone="loading"
        title="Loading website shell"
        summary="The shell is validating the dataset catalog and module registry before opening the selected workspace."
        detail={shell.shellUnavailableReason || `Preparing ${shell.selectedDatasetLabel}.`}
      />
    )
  }

  if (shell.shellUnavailableReason) {
    return (
      <PlatformStatusSurface
        tone="error"
        title="Shell unavailable"
        summary="The website shell could not finish validating its shared runtime contracts."
        detail={shell.shellUnavailableReason}
        actions={[{ label: 'Retry shell', onClick: shell.retryRegistry }]}
      />
    )
  }

  if (shell.activeRoute.kind === 'placeholder') {
    return (
      <PlatformStatusSurface
        tone="deferred"
        title={shell.activeRoute.label}
        summary={shell.activeRoute.description}
        detail={shell.activeRoute.notice}
      />
    )
  }

  if (shell.activeModuleId && shell.activeModuleStatus?.state === 'loading') {
    return (
      <PlatformStatusSurface
        tone="loading"
        title={`Loading ${shell.activeRoute.label}`}
        summary="The selected module bundle is being fetched and validated on demand."
        detail={`Dataset: ${shell.selectedDatasetLabel}`}
      />
    )
  }

  if (shell.activeModuleId && shell.activeModuleStatus?.state === 'error') {
    return (
      <PlatformStatusSurface
        tone="error"
        title={`${shell.activeRoute.label} unavailable`}
        summary="The selected module bundle could not be opened through the shared shell runtime."
        detail={shell.activeModuleStatus.message}
        actions={[
          { label: 'Retry module', onClick: shell.retryActiveModule },
          { label: 'Return home', onClick: () => shell.navigate('home') },
        ]}
      />
    )
  }

  if (children) {
    return children(shell)
  }

  return (
    <PlatformStatusSurface
      tone="loading"
      title={shell.activeRoute.label}
      summary="The shell runtime is ready. Baseline page content will mount here in Wave 3."
      detail={`Dataset: ${shell.selectedDatasetLabel}`}
    />
  )
}

export function PlatformShell({ children, ...options }: PlatformShellProps) {
  const shell = usePlatformShell(options)

  return (
    <div className="platform-shell">
      <header className="header-bar frame platform-shell-header">
        <div className="platform-shell-brand">
          <span className="header-side-label">PORT CONTROL</span>
          <strong>Port Smart Management Platform</strong>
          <small>{shell.activeRoute.label}</small>
        </div>

        <nav className="platform-shell-nav" aria-label="Primary navigation">
          {shell.primaryRoutes.map((route) => (
            <button
              key={route.id}
              type="button"
              className={`platform-shell-nav-item${shell.activeRouteId === route.id ? ' is-active' : ''}`}
              aria-current={shell.activeRouteId === route.id ? 'page' : undefined}
              onClick={() => shell.navigate(route.id)}
            >
              {route.navLabel}
            </button>
          ))}
        </nav>

        <div className="platform-shell-status-strip">
          <label>
            <span>Dataset</span>
            <select value={shell.selectedDatasetId} onChange={(event) => shell.selectDataset(event.target.value)}>
              {shell.availableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span>Status</span>
            <strong>{shell.activeModule?.readiness ?? shell.activeRoute.status}</strong>
          </div>
        </div>
      </header>

      <main className="platform platform-shell-body">{renderShellBody(shell, children)}</main>
    </div>
  )
}
