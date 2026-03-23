# 服务外包网站设计

本仓库当前的可交付主体是 [demo-web](./demo-web/README.md)：一个基于历史 AIS 数据、离线模型结果和已清洗航道数据的演示网站。

当前阶段的运行基线以 `demo-web/public/data/` 中已提交的数据为准，目标是让开发者和演示人员都能在 Windows 环境下稳定跑起首页和 RouteEditor。`代码依据/` 仍然是数据来源背景，但本阶段不要求从原始数据重新生成网站数据才能运行。

## 你应该先看哪里

- 开发和本地运行入口：[`demo-web/README.md`](./demo-web/README.md)
- 演示前检查清单：[`demo-web/DEMO_CHECKLIST.md`](./demo-web/DEMO_CHECKLIST.md)
- GSD 项目背景：[`\.planning/PROJECT.md`](./.planning/PROJECT.md)

## 当前阶段的统一校验命令

进入 `demo-web/` 后运行：

```bash
npm run verify
```

它会顺序执行：

- `npm run lint`
- `npm run test`
- `npm run build`

## 仓库结构

- `demo-web/`：当前对外演示网站，包含首页和 RouteEditor
- `代码依据/`：原始或中间研究资料来源，本阶段不作为运行必需前置
- `.planning/`：GSD 规划与阶段背景

## 当前范围说明

- 当前网站的使命是展示算法和模型如何在网页中呈现，而不是接入实时 AIS。
- 本阶段不新增产品功能，重点是让现有演示在 fresh machine 上可安装、可运行、可检查、可交付。
