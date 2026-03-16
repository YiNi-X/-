# demo-web

`demo-web` 是当前对外交付的前端演示项目，包含两个入口：

- 主页面：历史 AIS 回放 + 离线 STGCN 预测展示
- RouteEditor：真实清洗后主航道轨迹查看与校准页面

项目的数据、构建和部署都收敛在 `demo-web/` 内完成。

## 当前数据入口

- `public/data/ais-playback.json`
  - 主页面使用的 AIS 回放数据
- `public/data/flow-forecast.json`
  - 主页面使用的预测数据
- `public/data/model-config.json`
  - 预测模型配置与元信息
- `public/data/dataset-catalog.json`
  - 主页面数据集目录
- `public/data/shared-geometry.json`
  - 主页面使用的共享几何配置
- `public/data/main-corridor-tracks.json`
  - RouteEditor 使用的真实清洗后航道轨迹数据

## 脚本说明

- `scripts/generate_first_version_data.py`
  - 生成主页面需要的 AIS 回放、预测和共享几何数据
- `scripts/extract_main_corridors_from_clustered_ais.py`
  - 从聚类 AIS 结果中提取主航道，输出 RouteEditor 使用的真实清洗轨迹，以及 `analysis/` 下的结构化分析结果
- `scripts/stgcn_runtime.py`
  - 主页面预测相关运行时支持

## analysis 目录

`analysis/` 保留可复查的结构化分析结果：

- `*.csv`
- `*.json`

对比图、验收图等 `*.png` 视为可再生成产物，不纳入版本控制。

## 开发命令

先进入项目目录：

```bash
cd demo-web
```

安装依赖：

```bash
npm install
```

启动主页面：

```bash
npm run dev
```

启动 RouteEditor：

```bash
npm run editor
```

重新生成主页面数据：

```bash
npm run generate:data
```

重新提取真实清洗主航道：

```bash
python scripts/extract_main_corridors_from_clustered_ais.py
```

构建生产包：

```bash
npm run build
```

本地预览：

```bash
npm run preview
```

## RouteEditor 当前工作流

- 入口：`/route-editor.html`
- 主数据源：`public/data/main-corridor-tracks.json`
- 显示内容：真实清洗后的 `lat/lon` 航迹
- 页面保持等比例地理视口，不再依赖旧的代表线导出流程

## 部署

- 保持现有 Vercel 部署结构不变
- 部署根目录为 `demo-web`
- 建议部署前执行：

```bash
npm run build
```
