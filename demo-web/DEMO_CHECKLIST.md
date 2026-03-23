# Demo Checklist

面向演示人员的快速检查清单。目标是用最少步骤确认首页和 RouteEditor 都可以稳定展示。

## 演示前 5 分钟

1. 进入目录：

```bash
cd demo-web
```

2. 如果是第一次运行或刚更新依赖：

```bash
npm install
```

3. 运行统一校验：

```bash
npm run verify
```

4. 启动演示站点：

```bash
npm run preview
```

5. 在浏览器检查两个页面：

- Dashboard: `http://localhost:4173/`
- RouteEditor: `http://localhost:4173/route-editor.html`

## 现场要确认的内容

- 首页地图、时间线和右侧面板能正常加载
- RouteEditor 能正常显示 corridor 列表和轨迹
- 页面使用的是仓库内已提交的 `public/data` 数据，而不是现场临时生成的数据
- 浏览器控制台没有阻塞演示的报错

## 如果 `npm run verify` 没通过

- 先看 [`README.md`](./README.md) 的“排障”部分
- 不要在演示前临时切换到 `代码依据/` 重新生成数据
- 如果只是需要快速确认页面能打开，优先排查依赖安装、端口占用和本地 Node 版本
