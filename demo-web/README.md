# Port Traffic Demo Web

这个目录是网站前端的独立工作区，目的只有一个：把网站工程和论文代码、数据资料彻底隔离开。

## 目录边界

- `demo-web/`
  - 只放网站前端代码
  - 后续在这里运行 `npm`、`vite`、`gsd`
- `../代码依据/`
  - 论文算法代码与 notebook
  - 只作为口径参考，不在这里改网站代码
- `../文本支持/`
  - 论文正文与说明材料
- `../相关图片提取/`
  - 论文图像参考

## 已完成的隔离动作

- 初始化了独立的 `Vite + React + TypeScript` 前端项目
- 将根目录的静态卫星底图复制到 `public/static-port-map.jpg`
- 网站入口页已替换为项目专用的工作区说明页

## 开发命令

```bash
cd demo-web
npm run dev
```

```bash
cd demo-web
npm run build
```

```bash
cd demo-web
npm run lint
```

## 后续如果要跑 GSD

一定在 `demo-web/` 目录里执行，这样 GSD 会把它识别成网站子项目，而不是把整份论文代码一起当成 brownfield。

推荐流程：

```bash
cd demo-web
$gsd-new-project
```

## 当前素材入口

- 卫星底图：`public/static-port-map.jpg`
- 论文开工包：`../港口大屏Demo开工包.md`

## 建议的下一步

1. 在 `demo-web/` 内初始化 `.planning`
2. 按开工包把单页大屏骨架先搭出来
3. 再把时间片 JSON、图表和地图覆盖物补进去
