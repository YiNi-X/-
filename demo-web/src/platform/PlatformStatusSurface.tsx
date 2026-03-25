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
      return 'Loading'
    case 'unavailable':
      return 'Unavailable'
    case 'error':
      return 'Error'
    case 'deferred':
      return 'Deferred'
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
          <span>Detail</span>
          <strong>{detail}</strong>
        </div>
      ) : null}

      {actions.length ? (
        <div className="platform-status-actions" role="group" aria-label={`${tone} actions`}>
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
