type RouteEditorStatusScreenProps = {
  tracksDataError: string
}

export function RouteEditorStatusScreen({ tracksDataError }: RouteEditorStatusScreenProps) {
  const isUnavailable = Boolean(tracksDataError)

  return (
    <main className="route-editor-shell route-editor-status-shell">
      <aside className="editor-sidebar">
        <div className="editor-panel editor-status-panel">
          <p className="editor-kicker">{isUnavailable ? '航路数据不可用' : '正在准备航路工作区'}</p>
          <h1>{isUnavailable ? 'corridor 数据不可用' : '正在加载已校验的 corridor 数据'}</h1>
          <p className="editor-copy">
            {isUnavailable
              ? '由于精选的 main-corridor 载荷缺失或格式异常，RouteEditor 在启用编辑和导出前就已停止。'
              : 'RouteEditor 正在校验已提交的 main-corridor 载荷，只有通过后才会开放 corridor 查看、编辑与导出。'}
          </p>
        </div>

        <div className="editor-panel editor-status-panel">
          <div className="editor-panel-head">
            <h2>runtime 来源</h2>
            <span>{isUnavailable ? '不可用' : '检查中'}</span>
          </div>
          <div className="editor-meta-grid">
            <div>
              <small>期望产物</small>
              <strong>public/data/main-corridor-tracks.json</strong>
            </div>
            <div>
              <small>契约路径</small>
              <strong>/data/main-corridor-tracks.json</strong>
            </div>
          </div>
          <p className="traffic-note">
            {isUnavailable
              ? '在 corridor 载荷通过校验之前，编辑、选择和 JSON 导出都会保持禁用。'
              : '只有当精选 corridor 载荷通过共享 runtime 契约边界后，编辑器才会真正打开。'}
          </p>
        </div>

        <div className="editor-panel editor-status-panel">
          <div className="editor-panel-head">
            <h2>{isUnavailable ? '契约详情' : '状态详情'}</h2>
            <span>{isUnavailable ? '阻塞中' : '加载中'}</span>
          </div>
          <p className={isUnavailable ? 'editor-warning editor-warning-static' : 'traffic-note editor-status-note'}>
            {tracksDataError || '在编辑工作区可用前，系统会先校验 corridor 摘要、轨迹归属、点数量与点位 geometry。'}
          </p>
        </div>
      </aside>

      <section className="editor-canvas-shell">
        <div className="editor-toolbar">
          <div>
            <strong>工作区</strong>
            <span>{isUnavailable ? '不可用' : '正在准备已校验数据'}</span>
          </div>
          <div>
            <strong>编辑面板</strong>
            <span>{isUnavailable ? '已锁定' : '等待 corridor 载荷'}</span>
          </div>
        </div>

        <div className="editor-status-stage">
          <div className="editor-status-stage-copy">
            <span>{isUnavailable ? '没有可编辑的 corridor 数据' : '校验进行中'}</span>
            <strong>{isUnavailable ? '在数据修复前，RouteEditor 将保持暂停。' : '正在用已提交数据构建 corridor 工作区。'}</strong>
            <p>
              {isUnavailable
                ? '请修复或替换精选 main-corridor 载荷，然后刷新页面以恢复编辑器。'
                : '在 runtime loader 确认 corridor 文件结构有效前，舞台区域会保持禁用。'}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
