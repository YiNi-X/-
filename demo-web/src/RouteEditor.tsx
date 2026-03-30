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
          <p className="editor-kicker">主 corridor 工作台</p>
          <h1>清洗后真实轨迹对齐</h1>
          <p className="editor-copy">
            RouteEditor 现在直接读取 <code>extract_main_corridors_from_clustered_ais.py</code> 导出的清洗后真实船舶轨迹。
            当前舞台会保持等比例 geo 视口，并直接渲染原始清洗后的 <code>lat/lon</code> 轨迹，不再经过代表线重映射，也不会拉伸成百分比几何。
          </p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>清洗轨迹来源</h2><span>{tracksFile ? '已加载' : '等待中'}</span></div>
          {tracksFile ? (
            <div className="editor-meta-grid">
              <div><small>数据文件</small><strong>{tracksFile.source}</strong></div>
              <div><small>摘要文件</small><strong>{tracksFile.summarySource}</strong></div>
              <div><small>聚类模式</small><strong>{tracksFile.clusterMode}</strong></div>
              <div><small>请求参数</small><strong>{tracksFile.requestedClusterMode}</strong></div>
              <div><small>corridor 数</small><strong>{tracksFile.corridorCount}</strong></div>
              <div><small>轨迹数</small><strong>{tracksFile.trackCount}</strong></div>
            </div>
          ) : (
            <div className="editor-meta-grid">
              <div><small>状态</small><strong>缺少清洗轨迹文件</strong></div>
              <div><small>期望文件</small><strong>public/data/main-corridor-tracks.json</strong></div>
            </div>
          )}
          <p className="traffic-note">
            {tracksFile
              ? '这个页面现在只由清洗后的真实轨迹导出驱动。旧的六航路 geometry 和 hotspot 覆盖层不再在这里使用。'
              : 'RouteEditor 没找到清洗后的真实轨迹 JSON，请重新运行 extract_main_corridors_from_clustered_ais.py 来生成它。'}
          </p>
          {tracksDataError ? <p className="editor-warning">{tracksDataError}</p> : null}
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>corridor 覆盖</h2><span>{selectedCorridor?.corridorId ?? '未选择 corridor'}</span></div>
          <div className="route-count-grid">
            {corridorSummaries.map((corridor) => (
              <button
                key={`count-${corridor.corridorId}`}
                type="button"
                className={corridor.corridorId === selectedCorridor?.corridorId ? 'route-count-pill active' : 'route-count-pill'}
                onClick={() => selectCorridor(corridor.corridorId)}
              >
                <strong>{corridor.corridorId}</strong>
                <span>{corridor.trackCount} 条轨迹</span>
              </button>
            ))}
          </div>
          <p className="traffic-note">地图上会始终显示全部 16 条清洗后的 corridor。选择某条 corridor 后，只有它的成员轨迹会被提高透明度权重。</p>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>corridor 列表</h2><span>保留 {corridorSummaries.length} 条</span></div>
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
                    <span>{corridor.trackCount} 条轨迹</span>
                  </div>
                <small>{corridor.directionLabel}</small>
                <small>{corridor.labelPoint.lon.toFixed(4)}, {corridor.labelPoint.lat.toFixed(4)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head"><h2>corridor 内轨迹</h2><span>{selectedCorridorTracks.length} 条真实轨迹</span></div>
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
                    <span>{track.pointCount} 个点</span>
                  </div>
                <small>{track.directionLabel}</small>
                <small>{formatCompactTime(track.points[0]?.time ?? '')} -&gt; {formatCompactTime(track.points[track.points.length - 1]?.time ?? '')}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>当前对象</h2><span>{selectedObjectName}</span></div>
          <div className="editor-meta-grid">
            <div><small>经度</small><strong>{selectedPoint.lon.toFixed(6)}</strong></div>
            <div><small>纬度</small><strong>{selectedPoint.lat.toFixed(6)}</strong></div>
            <div><small>corridor</small><strong>{selectedTrack?.corridorId ?? 'N/A'}</strong></div>
            <div><small>轨迹 ID</small><strong>{selectedTrack?.trackId ?? 'N/A'}</strong></div>
          </div>
          <div className="nudge-head">
            <label htmlFor="nudge-step">微调步长</label>
            <input id="nudge-step" value={nudgeStep} onChange={(event) => setNudgeStep(event.target.value)} />
          </div>
          <div className="nudge-grid">
            <button type="button" onClick={() => updateSelectedPoint(0, 1)}>上</button>
            <button type="button" onClick={() => updateSelectedPoint(-1, 0)}>左</button>
            <button type="button" onClick={() => updateSelectedPoint(1, 0)}>右</button>
            <button type="button" onClick={() => updateSelectedPoint(0, -1)}>下</button>
          </div>
        </div>

        <div className="editor-panel point-panel">
          <div className="editor-panel-head">
            <h2>轨迹点</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={() => selectedTrack && selectLabelAnchor(selectedTrack.id)}
              disabled={!selectedTrack}
            >
              选择标签锚点
            </button>
          </div>
          <p className="traffic-note">这里展示的是导出结果里的原始清洗轨迹点。你可以直接检查它们，并在 lat/lon 空间里微调当前点或标签锚点。</p>
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
          <div className="editor-panel-head"><h2>画布底图</h2><span>{canvasSource ? '已固定图片' : '空白'}</span></div>
          <div className="config-grid">
            <label className="config-field config-field-wide"><span>图片 URL</span><input value={canvasUrlInput} onChange={(event) => setCanvasUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyCanvasUrl}>使用 URL</button>
            <label className="ghost-button upload-button"><span>上传图片</span><input type="file" accept="image/*" onChange={handleCanvasFileChange} /></label>
            <button type="button" className="ghost-button" onClick={clearCanvasLayer}>清空画布</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>透明度</span><input type="range" min="0" max="1" step="0.01" value={canvasDisplay.opacity} onChange={(event) => setCanvasDisplay((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>亮度</span><input type="range" min="0.4" max="1.6" step="0.02" value={canvasDisplay.brightness} onChange={(event) => setCanvasDisplay((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>卫星底图</h2><span>{mapSource ? '可移动' : '缺失'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'map' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('map')}>操作底图</button>
            <button type="button" className="ghost-button" onClick={resetMapView}>重置底图</button>
          </div>
          <div className="config-grid">
            <label className="config-field config-field-wide">
              <span>预设</span>
              <select
                value={mapPresetId}
                onChange={(event) => selectMapPreset(event.target.value)}
              >
                {BACKGROUND_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
            </label>
            <label className="config-field config-field-wide"><span>图片 URL</span><input value={mapUrlInput} onChange={(event) => setMapUrlInput(event.target.value)} placeholder="https://..." /></label>
            <button type="button" className="ghost-button" onClick={applyMapUrl}>使用 URL</button>
            <label className="ghost-button upload-button"><span>上传底图</span><input type="file" accept="image/*" onChange={handleMapFileChange} /></label>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>缩放</span><input type="range" min="0.25" max="6" step="0.01" value={mapTransform.scale} onChange={(event) => setMapTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>X 偏移</span><input type="range" min="-1200" max="1200" step="1" value={mapTransform.offsetX} onChange={(event) => setMapTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Y 偏移</span><input type="range" min="-900" max="900" step="1" value={mapTransform.offsetY} onChange={(event) => setMapTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>透明度</span><input type="range" min="0" max="1" step="0.01" value={mapTransform.opacity} onChange={(event) => setMapTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>亮度</span><input type="range" min="0.4" max="1.6" step="0.02" value={mapTransform.brightness} onChange={(event) => setMapTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">鼠标滚轮会缩放当前选中图层，直接在舞台上拖拽即可平移当前激活图层。</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>清洗轨迹图层</h2><span>{selectedTrack?.id ?? '未选择轨迹'}</span></div>
          <div className="editor-toggle-row">
            <button type="button" className={activeTransformLayer === 'tracks' ? 'route-chip active' : 'route-chip'} onClick={() => setActiveTransformLayer('tracks')}>操作轨迹</button>
            <button type="button" className="ghost-button" onClick={resetTrackView}>重置轨迹</button>
          </div>
          <div className="config-grid">
            <label className="config-field"><span>缩放</span><input type="range" min="0.25" max="6" step="0.01" value={trackTransform.scale} onChange={(event) => setTrackTransform((current) => ({ ...current, scale: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>X 偏移</span><input type="range" min="-1200" max="1200" step="1" value={trackTransform.offsetX} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetX: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>Y 偏移</span><input type="range" min="-900" max="900" step="1" value={trackTransform.offsetY} onChange={(event) => setTrackTransform((current) => ({ ...current, offsetY: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>透明度</span><input type="range" min="0" max="1" step="0.01" value={trackTransform.opacity} onChange={(event) => setTrackTransform((current) => ({ ...current, opacity: Number(event.target.value) }))} /></label>
            <label className="config-field"><span>亮度</span><input type="range" min="0.4" max="1.6" step="0.02" value={trackTransform.brightness} onChange={(event) => setTrackTransform((current) => ({ ...current, brightness: Number(event.target.value) }))} /></label>
          </div>
          <p className="traffic-note">舞台会展示全部清洗后的真实轨迹。被选中的 corridor 会以组的形式高亮，当前轨迹则会额外显示自己的高亮和可编辑点位句柄。</p>
        </div>

        <div className="editor-panel">
          <div className="editor-panel-head"><h2>导出</h2><span>{copyStatus || '就绪'}</span></div>
          <div className="export-actions">
            <button type="button" onClick={() => selectedTrack && handleCopy(`${selectedTrack.id} 已复制`, selectedTrackExportText)} disabled={!selectedTrack}>复制当前轨迹 JSON</button>
            <button type="button" onClick={() => selectedCorridor && handleCopy(`${selectedCorridor.corridorId} 已复制`, selectedCorridorExportText)} disabled={!selectedCorridor}>复制当前 corridor JSON</button>
            <button type="button" onClick={() => handleCopy('全部清洗轨迹已复制', fullTracksExportText)} disabled={!tracksFile}>复制全部清洗轨迹 JSON</button>
            <button type="button" className="ghost-button" onClick={resetSelectedTrack} disabled={!selectedTrack}>重置当前轨迹</button>
          </div>
          <p className="traffic-note">导出结果会保持清洗后真实轨迹 schema。RouteEditor 不再输出旧版 shared-geometry 结构。</p>
          <textarea readOnly value={selectedCorridorExportText} className="export-box export-box-compact" />
          <textarea readOnly value={fullTracksExportText} className="export-box" />
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div><strong>轨迹来源</strong><span>{tracksFile ? `main-corridor-tracks.json | ${tracksFile.corridorCount} 条 corridor | ${tracksFile.trackCount} 条轨迹` : '正在加载清洗轨迹...'}</span></div>
          <div><strong>光标</strong><span>{cursor ? `${cursor.lon.toFixed(6)}, ${cursor.lat.toFixed(6)} (${cursor.xPercent.toFixed(1)}%, ${cursor.yPercent.toFixed(1)}%)` : '请在地图上移动'}</span></div>
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
            {canvasSource ? <img src={canvasSource} alt="画布底图" className="editor-canvas-image" style={canvasStyle} /> : <div className="editor-stage-empty" style={canvasStyle}>画布底图已固定</div>}
          </div>

          <div className="editor-satellite-layer" style={mapLayerStyle}>
            {mapSource ? <img src={mapSource} alt="卫星底图" className="editor-satellite-image" /> : <div className="editor-stage-empty">没有卫星底图</div>}
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
                <span>{corridor.trackCount} 条轨迹</span>
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
                <span>标签</span>
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
            <div><strong>当前拖拽</strong><span>{activeTransformLayer === 'map' ? '卫星底图' : '清洗轨迹'}</span></div>
            <div><strong>当前 corridor</strong><span>{selectedCorridor?.corridorId ?? '无'}</span></div>
            <div><strong>当前轨迹</strong><span>{selectedTrack?.id ?? '无'}</span></div>
            <div><strong>已加载数据</strong><span>{corridorSummaries.length} 条 corridor / {tracks.length} 条轨迹</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}
