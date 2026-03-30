import type { ReactNode } from 'react'

export type PlatformStatusTone = 'loading' | 'unavailable' | 'error' | 'deferred'

export type PlatformStatusAction = {
  label: string
  onClick?: () => void
  disabled?: boolean
}

type PlatformStatusSurfaceProps = {
  tone: PlatformStatusTone
  title: string
  summary: string
  detail?: string
  eyebrow?: string
  actions?: PlatformStatusAction[]
  children?: ReactNode
}

function getEyebrow(tone: PlatformStatusTone) {
  switch (tone) {
    case 'loading':
      return '加载中'
    case 'unavailable':
      return '不可用'
    case 'error':
      return '错误'
    case 'deferred':
      return '延后'
  }
}

export function PlatformStatusSurface({
  tone,
  title,
  summary,
  detail,
  eyebrow,
  actions = [],
  children,
}: PlatformStatusSurfaceProps) {
  return (
    <section className={`frame platform-status-shell platform-status-shell-${tone}`} data-tone={tone}>
      <div className="platform-status-copy">
        <span className="platform-status-eyebrow">{eyebrow ?? getEyebrow(tone)}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>

      {children ? <div className="platform-status-grid">{children}</div> : null}

      {detail ? (
        <div className="platform-status-detail">
          <span>详情</span>
          <strong>{detail}</strong>
        </div>
      ) : null}

      {actions.length ? (
        <div className="platform-status-actions" role="group" aria-label={`${tone} 操作`}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="platform-status-action"
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
