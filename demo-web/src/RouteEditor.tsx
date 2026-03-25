import { RouteEditorStatusScreen } from './route-editor/RouteEditorStatusScreen'
import { BACKGROUND_PRESETS, formatCompactTime, MAP_VIEWBOX } from './route-editor/routeEditorUtils'
import { useRouteEditorStage } from './route-editor/useRouteEditorStage'
import { useRouteEditorWorkspace } from './route-editor/useRouteEditorWorkspace'

export function RouteEditor() {
  const {
    tracksFile,
    tracks,
    selectedCorridor,
    selectedTrack,
    selectedPoint,
    selectedTrackGeometry,
    selectedCorridorTracks,
    corridorSummaries,
    selectedObjectName,
    activeHandle,
    nudgeStep,
    setNudgeStep,
    copyStatus,
    tracksDataError,
    routeEditorLoading,
    studyBounds,
    geoViewport,
    corridorColors,
    corridorLabelLayers,
    trackLayers,
    selectedTrackExportText,
    selectedCorridorExportText,
    fullTracksExportText,
    selectCorridor,
    selectTrack,
    selectLabelAnchor,
    selectTrackPoint,
    updateSelectedPoint,
    handleCopy,
    resetSelectedTrack,
  } = useRouteEditorWorkspace()

  const {
    stageRef,
    cursor,
    canvasSource,
    canvasUrlInput,
    setCanvasUrlInput,
    canvasDisplay,
    setCanvasDisplay,
    mapPresetId,
    selectMapPreset,
    mapSource,
    mapUrlInput,
    setMapUrlInput,
    mapTransform,
    setMapTransform,
    trackTransform,
    setTrackTransform,
    activeTransformLayer,
    setActiveTransformLayer,
    stagePan,
    canvasStyle,
    mapLayerStyle,
    trackLayerStyle,
    handleStagePointerMove,
    handleStagePointerDown,
    handleStageWheel,
    handleCanvasFileChange,
    applyCanvasUrl,
    clearCanvasLayer,
    handleMapFileChange,
    applyMapUrl,
    resetMapView,
    resetTrackView,
  } = useRouteEditorStage({ studyBounds, geoViewport })

  if (tracksDataError || routeEditorLoading) {
    return <RouteEditorStatusScreen tracksDataError={tracksDataError} />
  }

  return (
    <main className="route-editor-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel">
          <p className="editor-kicker">Main Corridor Studio</p>
          <h1>Cleaned real-track alignment</h1>
          <p className="editor-copy">
            RouteEditor now reads the cleaned real vessel trajectories exported by <code>extract_main_corridors_from_clustered_ais.py</code>.
            The stage keeps the equal-ratio geo viewport and renders the original cleaned <code>lat/lon</code> tracks directly, without
            representative-line remapping or stretched percentage geometry.
          </p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Cleaned Track Source</h2><span>{tracksFile ? 'loaded' : 'waiting'}</span></div>
          {tracksFile ? (
            <div className="editor-meta-grid">
              <div><small>Data file</small><strong>{tracksFile.source}</strong></div>
              <div><small>Summary file</small><strong>{tracksFile.summarySource}</strong></div>
              <div><small>Cluster mode</small><strong>{tracksFile.clusterMode}</strong></div>
              <div><small>Requested</small><strong>{tracksFile.requestedClusterMode}</strong></div>
              <div><small>Corridors</small><strong>{tracksFile.corridorCount}</strong></div>
              <div><small>Tracks</small><strong>{tracksFile.trackCount}</strong></div>
            </div>
          ) : (
            <div className="editor-meta-grid">
              <div><small>Status</small><strong>Missing cleaned track file</strong></div>
              <div><small>Expected file</small><strong>public/data/main-corridor-tracks.json</strong></div>
            </div>
          )}
          <p className="traffic-note">
            {tracksFile
              ? 'This page is driven only by the cleaned real track export. The old six-route geometry and hotspot overlays are no longer used here.'
              : 'RouteEditor could not find the cleaned real-track JSON. Re-run extract_main_corridors_from_clustered_ais.py to regenerate it.'}
          </p>
          {tracksDataError ? <p className="editor-warning">{tracksDataError}</p> : null}
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Corridor Coverage</h2><span>{selectedCorridor?.corridorId ?? 'No corridor'}</span></div>
          <div className="route-count-grid">
            {corridorSummaries.map((corridor) => (
              <button
                key={`count-${corridor.corridorId}`}
                type="button"
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'route-count-pill active' : 'route-count-pill'}
                onClick={() => selectCorridor(corridor.corridorId)}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} tracks</span>
              </button>
            ))}
          </div>
          <p className="traffic-note">All 16 cleaned corridors stay visible on the map. Selecting a corridor raises the opacity of only its member tracks.</p>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>Corridor List</h2><span>{corridorSummaries.length} kept</span></div>
          <div className="corridor-list">
            {corridorSummaries.map((corridor) => (
              <button
                key={corridor.corridorId}
                type="button"
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'corridor-row active' : 'corridor-row'}
                onClick={() => selectCorridor(corridor.corridorId)}
              >
                <div className="corridor-row-head">
                  <strong>{corridor.corridorId}</strong>
                  <span>{corridor.trackCount} tracks</span>
                </div>
                <small>{corridor.directionLabel}</small>
                <small>{corridor.labelPoint.lon.toFixed(4)}, {corridor.labelPoint.lat.toFixed(4)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>Tracks In Corridor</h2><span>{selectedCorridorTracks.length} real tracks</span></div>
          <div className="track-list">
            {selectedCorridorTracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className={track.id === selectedTrack?.id ? 'track-row active' : 'track-row'}
                onClick={() => selectTrack(track.id)}
              >
                <div className="track-row-head">
                  <strong>{track.id}</strong>
                  <span>{track.pointCount} pts</span>
                </div>
                <small>{track.directionLabel}</small>
                <small>{formatCompactTime(track.points[0]?.time ?? '')} -&gt; {formatCompactTime(track.points[track.points.length - 1]?.time ?? '')}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Selected Object</h2><span>{selectedObjectName}</span></div>
          <div className="editor-meta-grid">
            <div><small>Longitude</small><strong>{selectedPoint.lon.toFixed(6)}</strong></div>
            <div><small>Latitude</small><strong>{selectedPoint.lat.toFixed(6)}</strong></div>
            <div><small>Corridor</small><strong>{selectedTrack?.corridorId ?? 'N/A'}</strong></div>
            <div><small>Track ID</small><strong>{selectedTrack?.trackId ?? 'N/A'}</strong></div>
          </div>
          <div className="nudge-head">
            <label htmlFor="nudge-step">Nudge step</label>
            <input id="nudge-step" value={nudgeStep} onChange={(event) => setNudgeStep(event.target.value)} />
          </div>
          <div className="nudge-grid">
            <button type="button" onClick={() => updateSelectedPoint(0, 1)}>Up</button>
            <button type="button" onClick={() => updateSelectedPoint(-1, 0)}>Left</button>
            <button type="button" onClick={() => updateSelectedPoint(1, 0)}>Right</button>
            <button type="button" onClick={() => updateSelectedPoint(0, -1)}>Down</button>
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head">
            <h2>Track Points</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={() => selectedTrack && selectLabelAnchor(selectedTrack.id)}
              disabled={!selectedTrack}
            >
              Select label anchor
            </button>
          </div>
          <p className="traffic-note">These are the original cleaned track points from the export. You can inspect them directly and nudge the selected point or label anchor in lat/lon space.</p>
          <div className="point-list">
            {(selectedTrack?.points ?? []).map((point, index) => (
              <div
                key={`${selectedTrack?.id ?? 'track'}-${index}`}
                className={activeHandle?.kind === 'point' && activeHandle.trackId === selectedTrack?.id && activeHandle.index === index ? 'point-row active' : 'point-row'}
              >
                <button
                  type="button"
                  className="point-main"
                  onClick={() => selectedTrack && selectTrackPoint(selectedTrack.id, index)}
                >
                  <span>P{index + 1}</span>
                  <small>{point.lon.toFixed(4)}, {point.lat.toFixed(4)} | {formatCompactTime(point.time)}</small>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Canvas Base</h2><span>{canvasSource ? 'fixed image' : 'blank'}</span></div>
          <div className="config-grid">
            <label className="config-field config-field-wide"><span>Image URL</span><input value={canvasUrlInput} onChange={(event) => setCanvasUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyCanvasUrl}>Use URL</button>
            <label className="ghost-button upload-button"><span>Upload image</span><input type="file" accept="image/*" onChange={handleCanvasFileChange} /></label>
            <button type="button" className="ghost-button" onClick={clearCanvasLayer}>Clear canvas</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={canvasDisplay.opacity} onChange={(event) => setCanvasDisplay((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={canvasDisplay.brightness} onChange={(event) => setCanvasDisplay((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Satellite Map</h2><span>{mapSource ? 'movable' : 'missing'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'map' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('map')}>Drive map</button>
            <button type="button" className="ghost-button" onClick={resetMapView}>Reset map</button>
          </div>
          <div className="config-grid">
            <label className="config-field config-field-wide">
              <span>Preset</span>
              <select
                value={mapPresetId}
                onChange={(event) => selectMapPreset(event.target.value)}
              >
                {BACKGROUND_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <label className="config-field config-field-wide"><span>Image URL</span><input value={mapUrlInput} onChange={(event) => setMapUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyMapUrl}>Use URL</button>
            <label className="ghost-button upload-button"><span>Upload map</span><input type="file" accept="image/*" onChange={handleMapFileChange} /></label>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Scale</span><input type="range" min="0.25" max="6" step="0.01" value={mapTransform.scale} onChange={(event) => setMapTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset X</span><input type="range" min="-1200" max="1200" step="1" value={mapTransform.offsetX} onChange={(event) => setMapTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset Y</span><input type="range" min="-900" max="900" step="1" value={mapTransform.offsetY} onChange={(event) => setMapTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={mapTransform.opacity} onChange={(event) => setMapTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={mapTransform.brightness} onChange={(event) => setMapTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">Mouse wheel zooms the selected layer. Drag directly on the stage to pan the layer marked as active.</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Cleaned Track Layer</h2><span>{selectedTrack?.id ?? 'No track'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'tracks' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('tracks')}>Drive tracks</button>
            <button type="button" className="ghost-button" onClick={resetTrackView}>Reset tracks</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>Scale</span><input type="range" min="0.25" max="6" step="0.01" value={trackTransform.scale} onChange={(event) => setTrackTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset X</span><input type="range" min="-1200" max="1200" step="1" value={trackTransform.offsetX} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Offset Y</span><input type="range" min="-900" max="900" step="1" value={trackTransform.offsetY} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Opacity</span><input type="range" min="0" max="1" step="0.01" value={trackTransform.opacity} onChange={(event) => setTrackTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Brightness</span><input type="range" min="0.4" max="1.6" step="0.02" value={trackTransform.brightness} onChange={(event) => setTrackTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">The stage shows every cleaned real track. The selected corridor is emphasized as a group, and the selected track gets its own highlight and editable point handles.</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>Export</h2><span>{copyStatus || 'Ready'}</span></div>
          <div className="export-actions">
            <button type="button" onClick={() => selectedTrack && handleCopy(`${selectedTrack.id} copied`, selectedTrackExportText)} disabled={!selectedTrack}>Copy selected track JSON</button>
            <button type="button" onClick={() => selectedCorridor && handleCopy(`${selectedCorridor.corridorId} copied`, selectedCorridorExportText)} disabled={!selectedCorridor}>Copy current corridor JSON</button>
            <button type="button" onClick={() => handleCopy('All cleaned tracks copied', fullTracksExportText)} disabled={!tracksFile}>Copy all cleaned tracks JSON</button>
            <button type="button" className="ghost-button" onClick={resetSelectedTrack} disabled={!selectedTrack}>Reset current track</button>
          </div>
          <p className="traffic-note">Exports stay in the cleaned real-track schema. RouteEditor no longer emits the old shared-geometry structure.</p>
          <textarea readOnly value={selectedCorridorExportText} className="export-box export-box-compact" />
          <textarea readOnly value={fullTracksExportText} className="export-box" />
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div><strong>Track Source</strong><span>{tracksFile ? `main-corridor-tracks.json | ${tracksFile.corridorCount} corridors | ${tracksFile.trackCount} tracks` : 'Loading cleaned tracks...'}</span></div>
          <div><strong>Cursor</strong><span>{cursor ? `${cursor.lon.toFixed(6)}, ${cursor.lat.toFixed(6)} (${cursor.xPercent.toFixed(1)}%, ${cursor.yPercent.toFixed(1)}%)` : 'Move on map'}</span></div>
        </div>

        <div
          ref={stageRef}
          className={stagePan ? 'editor-stage is-panning' : 'editor-stage'}
          data-active-layer={activeTransformLayer}
          onPointerMove={handleStagePointerMove}
          onPointerDown={handleStagePointerDown}
          onWheel={handleStageWheel}
        >
          <div className="editor-canvas-base">
            {canvasSource ? <img src={canvasSource} alt="canvas base" className="editor-canvas-image" style={canvasStyle} /> : <div className="editor-stage-empty" style={canvasStyle}>Canvas base fixed</div>}
          </div>

          <div className="editor-satellite-layer" style={mapLayerStyle}>
            {mapSource ? <img src={mapSource} alt="satellite map" className="editor-satellite-image" /> : <div className="editor-stage-empty">No satellite map</div>}
          </div>

          <div className="editor-track-layer" style={trackLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {trackLayers.map((track) => (
                <path
                  key={track.id}
                  d={track.path}
                  className={[
                    'editor-cleaned-track',
                    track.isCorridorSelected ? 'corridor-focus' : '',
                    track.isTrackSelected ? 'track-focus' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ stroke: corridorColors[track.corridorId] ?? '#7dd3fc' }}
                />
              ))}
            </svg>

            {corridorLabelLayers.map((corridor) => (
              <div
                key={`corridor-tag-${corridor.corridorId}`}
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'editor-corridor-tag active' : 'editor-corridor-tag'}
                style={{ left: `${corridor.label.x}%`, top: `${corridor.label.y}%` }}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} tracks</span>
                <small>{corridor.directionLabel}</small>
              </div>
            ))}
          </div>

          <div className="editor-geometry-layer" style={trackLayerStyle}>
            <svg className="editor-track-overlay" viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`} preserveAspectRatio="xMidYMid meet">
              {selectedTrackGeometry ? <path d={selectedTrackGeometry.path} className="editor-route-guide" /> : null}
            </svg>

            {selectedTrackGeometry ? (
              <button
                key={`label-${selectedTrackGeometry.id}`}
                type="button"
                className={activeHandle?.kind === 'label' && activeHandle.trackId === selectedTrackGeometry.id ? 'editor-label-anchor active' : 'editor-label-anchor'}
                style={{ left: `${selectedTrackGeometry.label.x}%`, top: `${selectedTrackGeometry.label.y}%` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  selectLabelAnchor(selectedTrackGeometry.id)
                }}
              >
                <strong>{selectedTrackGeometry.id}</strong>
                <span>LABEL</span>
              </button>
            ) : null}

            {selectedTrackGeometry
              ? selectedTrackGeometry.points.map((point) => (
                <button
                  key={`handle-${selectedTrackGeometry.id}-${point.id}`}
                  type="button"
                  className={[
                    'editor-handle',
                    'point',
                    'selected-route',
                    activeHandle?.kind === 'point' && activeHandle.trackId === selectedTrackGeometry.id && activeHandle.index === point.index ? 'active' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left: `${point.position.x}%`, top: `${point.position.y}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectTrackPoint(selectedTrackGeometry.id, point.index)
                  }}
                >
                  {point.index + 1}
                </button>
                ))
              : null}
          </div>

          <div className="editor-stage-hud">
            <div><strong>Active drag</strong><span>{activeTransformLayer === 'map' ? 'Satellite map' : 'Cleaned tracks'}</span></div>
            <div><strong>Selected corridor</strong><span>{selectedCorridor?.corridorId ?? 'None'}</span></div>
            <div><strong>Selected track</strong><span>{selectedTrack?.id ?? 'None'}</span></div>
            <div><strong>Loaded data</strong><span>{corridorSummaries.length} corridors / {tracks.length} tracks</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}
