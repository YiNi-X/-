# Site Delivery Follow-ups

## Purpose
记录当前网站为了面向交付展示而未在 UI 中直接暴露的真实未完成项。

## Hidden From UI
- `CLUS-03` 的内部恢复说明已从网站移出。
  对外页面现在只展示真实的噪声池与分段统计，不再显示文件名、字节数、工作区路径、恢复清单或 `deferred/fallback` 口吻。
- 评估页、总览页、前瞻分析页中的 `artifact/path/lineage/notebook/optimizer` 类研发说明已从公开页面移出。
  当前站点只保留面向用户的来源摘要与模块关联说明。
- 预测页中的 `node-view`、证据资源、延后模型等开发态提示已从公开页面移出。
  当前站点只保留热点、节点桥接索引和证据摘要。

## Data / Algorithm Gaps
- 真实的 clustering noise re-clustering 导出仍未恢复为稳定的网站包。
  当前公开站点使用真实的噪声池统计作为补充视角，不展示未恢复的内部细节。
- 更完整的 forecast 节点级 runtime、模型配置扩展项和补充证据资源仍可继续打包。
  当前公开站点已改为展示现有桥接索引与证据摘要，不再暴露“未上线”提示。
- 面向内部审阅的深度 provenance / toolchain 说明仍可保留，但不应直接回到公开站点。

## Post-Delivery Tasks
- High: 恢复并验证 clustering noise re-clustering 的稳定导出链路，确认可生成网站可用的补充包。
- Medium: 继续打包 forecast 的节点级补充结果、模型配置扩展项与更深一层证据资源。
- Medium: 如需内部评审版，单独提供 reviewer-only 页面或文档，承接路径、工件、lineage、工具链细节。
- High: 正式部署前后做一次公开站点 smoke check，确认中文化后的文案、路由和布局都与当前交付版本一致。
