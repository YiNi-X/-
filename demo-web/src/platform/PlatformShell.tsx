import type { ReactNode } from 'react'
import { PlatformStatusSurface } from './PlatformStatusSurface.tsx'
import type { PlatformShellOptions, PlatformShellResult } from './usePlatformShell.ts'
import { usePlatformShell } from './usePlatformShell.ts'
import { localizeReadinessLabel } from './zhCopy.ts'

type PlatformShellProps = PlatformShellOptions & {
  children?: (shell: PlatformShellResult) => ReactNode
}

function renderShellBody(shell: PlatformShellResult, children?: (shell: PlatformShellResult) => ReactNode) {
  if (shell.shellLoading) {
    return (
      <PlatformStatusSurface
        tone="loading"
        title="正在加载网站壳层"
        summary="壳层正在校验数据集目录与模块注册表，然后才会打开当前工作区。"
        detail={shell.shellUnavailableReason || `正在准备 ${shell.selectedDatasetLabel}。`}
      />
    )
  }

  if (shell.shellUnavailableReason) {
    return (
      <PlatformStatusSurface
        tone="error"
        title="壳层不可用"
        summary="网站壳层未能完成共享 runtime 契约校验。"
        detail={shell.shellUnavailableReason}
        actions={[{ label: '重试壳层', onClick: shell.retryRegistry }]}
      />
    )
  }

  if (shell.activeModuleId && shell.activeModuleStatus?.state === 'loading') {
    return (
      <PlatformStatusSurface
        tone="loading"
        title={`正在加载${shell.activeRoute.label}`}
        summary="正在按需获取并校验当前模块 bundle。"
        detail={`数据集：${shell.selectedDatasetLabel}`}
      />
    )
  }

  if (shell.activeModuleId && shell.activeModuleStatus?.state === 'error') {
    return (
      <PlatformStatusSurface
        tone="error"
        title={`${shell.activeRoute.label}不可用`}
        summary="共享壳层 runtime 无法打开当前模块 bundle。"
        detail={shell.activeModuleStatus.message}
        actions={[
          { label: '重试模块', onClick: shell.retryActiveModule },
          { label: '返回首页', onClick: () => shell.navigate('home') },
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
      summary="壳层 runtime 已就绪，页面主体内容会在这里挂载。"
      detail={`数据集：${shell.selectedDatasetLabel}`}
    />
  )
}

export function PlatformShell({ children, ...options }: PlatformShellProps) {
  const shell = usePlatformShell(options)

  return (
    <div className="platform-shell">
      <header className="header-bar frame platform-shell-header">
        <div className="platform-shell-brand">
          <span className="header-side-label">港口调度中枢</span>
          <strong>港口智能管理平台</strong>
          <small>{shell.activeRoute.label}</small>
        </div>

        <nav className="platform-shell-nav" aria-label="主导航">
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
            <span>数据集</span>
            <select value={shell.selectedDatasetId} onChange={(event) => shell.selectDataset(event.target.value)}>
              {shell.availableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span>状态</span>
            <strong>{localizeReadinessLabel(shell.activeModule?.readiness ?? shell.activeRoute.status)}</strong>
          </div>
        </div>
      </header>

      <main className="platform platform-shell-body">{renderShellBody(shell, children)}</main>
    </div>
  )
}
