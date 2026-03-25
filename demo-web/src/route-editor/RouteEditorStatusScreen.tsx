type RouteEditorStatusScreenProps = {
  tracksDataError: string
}

export function RouteEditorStatusScreen({ tracksDataError }: RouteEditorStatusScreenProps) {
  const isUnavailable = Boolean(tracksDataError)

  return (
    <main className="route-editor-shell route-editor-status-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel editor-status-panel">
          <p className="editor-kicker">{isUnavailable ? 'Route Data Unavailable' : 'Preparing Route Workspace'}</p>
          <h1>{isUnavailable ? 'Corridor data unavailable' : 'Loading validated corridor data'}</h1>
          <p className="editor-copy">
            {isUnavailable
              ? 'RouteEditor stopped before enabling editing or export because the curated main-corridor payload is missing or malformed.'
              : 'RouteEditor is validating the committed main-corridor payload before enabling corridor inspection, edits, and exports.'}
          </p>
        </div>

        <div className="editor-panel editor-status-panel">
          <div className="editor-panel-head">
            <h2>Runtime Source</h2>
            <span>{isUnavailable ? 'Unavailable' : 'Checking'}</span>
          </div>
          <div className="editor-meta-grid">
            <div>
              <small>Expected asset</small>
              <strong>public/data/main-corridor-tracks.json</strong>
            </div>
            <div>
              <small>Contract path</small>
              <strong>/data/main-corridor-tracks.json</strong>
            </div>
          </div>
          <p className="traffic-note">
            {isUnavailable
              ? 'Editing, selection, and JSON export remain disabled until the corridor payload validates successfully.'
              : 'The editor will open only after the curated corridor payload passes the shared runtime contract boundary.'}
          </p>
        </div>

        <div className="editor-panel editor-status-panel">
          <div className="editor-panel-head">
            <h2>{isUnavailable ? 'Contract detail' : 'Status detail'}</h2>
            <span>{isUnavailable ? 'Blocking' : 'Loading'}</span>
          </div>
          <p className={isUnavailable ? 'editor-warning editor-warning-static' : 'traffic-note editor-status-note'}>
            {tracksDataError || 'Validating corridor summaries, track membership, point counts, and point geometry before the editing workspace becomes available.'}
          </p>
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div>
            <strong>Workspace</strong>
            <span>{isUnavailable ? 'Unavailable' : 'Preparing validated data'}</span>
          </div>
          <div>
            <strong>Editing Surface</strong>
            <span>{isUnavailable ? 'Locked' : 'Waiting for corridor payload'}</span>
          </div>
        </div>

        <div className="editor-status-stage">
          <div className="editor-status-stage-copy">
            <span>{isUnavailable ? 'No editable corridor data' : 'Validation in progress'}</span>
            <strong>{isUnavailable ? 'RouteEditor is paused until data is repaired.' : 'Building the corridor workspace from committed data.'}</strong>
            <p>
              {isUnavailable
                ? 'Repair or replace the curated main-corridor payload, then reload the page to restore the editor.'
                : 'The stage will remain disabled until the runtime loader confirms the corridor file is structurally valid.'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
