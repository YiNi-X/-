# demo-web

`demo-web` 是本项目第一版的唯一对外交付面。

第一版目标已经收口为一条单一工作流：

- 历史船舶轨迹来自固定窗口的 AIS 回放
- 流量预测来自离线 STGCN 推理结果
- 主页面和路线编辑器都直接读取 `demo-web/public/data/` 下的数据契约
- 生成、校验、构建、部署都只在 `demo-web/` 内执行

## 当前数据范围

- AIS 回放窗口：`2020-01-01 00:00` 到 `2020-01-03 00:00`
- 时间粒度：`5` 分钟
- 播放帧数：`577`
- 预测模式：离线 `STGCN` 递归推理，按小时推理后插值到 `5` 分钟播放轴

## 目录说明

- `public/data/shared-geometry.json`
  - 航路蓝图、标签锚点、热点锚点、热点与航路映射
- `public/data/model-config.json`
  - `n_his`、`n_pred`、节点顺序、邻接矩阵、scaler 参数和推理元信息
- `public/data/ais-playback.json`
  - AIS 回放契约
- `public/data/flow-forecast.json`
  - 预测契约和每帧 narrative
- `public/data/dataset-catalog.json`
  - 数据集选择器的共享目录
- `scripts/generate_first_version_data.py`
  - 第一版离线数据生成入口
- `scripts/compare_clustered_ais_with_web_dataset.py`
  - 辅助对比脚本
- `scripts/extract_main_corridors_from_clustered_ais.py`
  - 辅助航路摘要脚本

## 开发与生成

先进入 `demo-web/`：

```bash
cd demo-web
```

安装依赖：

```bash
npm install
```

重新生成第一版数据：

```bash
npm run generate:data
```

启动主页面：

```bash
npm run dev
```

启动路线编辑器：

```bash
npm run editor
```

运行静态检查：

```bash
npm run lint
```

构建生产包：

```bash
npm run build
```

本地预览：

```bash
npm run preview
```

## 路线编辑器工作流

- 路线编辑器入口：`/route-editor.html`
- 编辑结果统一导出为共享几何 JSON
- 校准完成后，目标文件是 `public/data/shared-geometry.json`
- 编辑器会读取同一份 `ais-playback.json` 作为 AIS 参考底图

## 辅助分析脚本

在 `demo-web/` 内执行：

```bash
python scripts/compare_clustered_ais_with_web_dataset.py
python scripts/extract_main_corridors_from_clustered_ais.py
```

这些脚本是辅助验证，不参与线上页面运行。

## 页面说明

- 主页面会显式说明：轨迹来自历史 AIS，预测来自离线模型推理，页面仍是演示版而不是生产业务系统
- `scenarioPacks` 只保留静态展示常量，不再承担运行时帧数据职责
- 数据集选择器、URL 参数和 `localStorage` 记忆逻辑仍然保留

## 部署

- 保持现有 Vercel 部署结构不变
- 部署根目录就是 `demo-web`
- 部署前建议按顺序执行：

```bash
npm run generate:data
npm run lint
npm run build
```

## 外部依赖说明

离线生成脚本会读取仓库根目录下的研究依据文件，例如：

- `../代码依据/流量预测/save/model_0.pt`
- `../代码依据/流量预测/相关性矩阵0.csv`
- `../代码依据/流量预测/grid_mmsi_count（流量数据）.csv`

这些材料属于生成输入，不改变 `demo-web` 作为唯一交付面的定位。
