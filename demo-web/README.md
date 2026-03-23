# demo-web

`demo-web` 是当前对外演示的网站项目，包含两个入口：

- 首页 Dashboard：历史 AIS 回放 + 离线模型结果展示
- `RouteEditor`：已清洗主航道轨迹查看与微调页面

本阶段的运行基线以仓库中已提交的 `public/data/` 数据为准，目的是让开发者和演示人员在 Windows 环境下都能稳定安装、运行、校验和演示。`代码依据/` 是后续数据溯源和再加工的来源，但当前阶段不要求先从原始数据重新生成网站数据。

## Quick Start

### 1. 进入目录

```bash
cd demo-web
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动首页 Dashboard

```bash
npm run dev
```

默认入口：

- `http://localhost:5173/`

### 4. 启动 RouteEditor

```bash
npm run editor
```

默认入口：

- `http://localhost:5173/route-editor.html`

如果你已经通过 `npm run dev` 启动了 Vite，也可以直接在同一个服务里手动打开 `/route-editor.html`。

## Quality Gate

### 单项命令

- `npm run lint`：运行 ESLint
- `npm run test`：运行轻量 smoke test
- `npm run build`：执行 TypeScript build + Vite build

### 统一校验命令

```bash
npm run verify
```

`verify` 会依次运行：

1. `npm run lint`
2. `npm run test`
3. `npm run build`

当前 Phase 1 的目标是：

- lint 没有 error
- test 可以真实运行并通过
- build 可以稳定通过

## Runtime Data Baseline

当前网站运行依赖这些已提交数据文件：

- `public/data/ais-playback.json`
- `public/data/flow-forecast.json`
- `public/data/dataset-catalog.json`
- `public/data/shared-geometry.json`
- `public/data/main-corridor-tracks.json`

这些文件已经足够支持当前阶段的演示和开发基线。

## 数据来源说明

- `public/data/`：当前阶段直接运行所依赖的提交数据
- `代码依据/`：原始研究资料、中间文件、模型权重等来源背景

当前阶段不要求通过 `代码依据/` 重新生成 `public/data/` 才能启动网站。完整的数据再生成与清洗链路属于后续 Phase 4 的范围。

## 排障

### `npm install` 失败

- 先确认使用的是较新的 Node.js 版本
- 建议在 Windows PowerShell 或命令提示符中执行
- 如果有旧的 `node_modules/`，先删除后重装

### `npm run lint` 失败

- Phase 1 已将当前阻塞性 lint error 作为必须修复项
- 如果新增 lint 报错，先回看本次改动是否引入了新的 Hook 依赖问题或 effect 同步问题

### `npm run test` 失败

- smoke test 会检查关键入口文件和已提交 JSON 数据
- 优先确认 `public/data/` 中的数据文件没有被误删或损坏

### `npm run build` 失败

- 先确认 `npm install` 已成功
- 再确认没有手动改坏 `src/` 下的入口文件或类型定义

### 页面能打开，但数据没显示

- 优先检查浏览器控制台
- 再确认 `public/data/` 中 JSON 文件仍然存在
- 当前阶段默认使用已清洗和已提交的数据，不建议在演示前临时切换到原始数据链路

## 与演示相关的额外材料

- 演示前检查清单：[`DEMO_CHECKLIST.md`](./DEMO_CHECKLIST.md)
