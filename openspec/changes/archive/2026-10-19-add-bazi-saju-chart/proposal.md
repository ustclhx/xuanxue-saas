# Proposal

## Why

台湾「八字排盤」（60,500）与韩国「만세력」（135,000）是 v1 流量最大的两个入口，季节峰在 12 月到 2 月（`doc/design.md` §1、§2 P1/P2、TASK-02）。两地计算体系相同，只是文案与少量本地惯例不同，应共用一个排盘引擎、一套页面组件。

## What Changes

- 新增纯 TypeScript 排盘引擎包 `@xuanxue/bazi`：国历/农历（含闰月）输入、历史时区与夏令时、可选真太阳时、四柱、十神、五行强弱、身强身弱、喜用神（参考）、大运/流年、神煞（空亡、桃花、贵人等）、八字重量；「不知道时辰」输出三柱结果。
- 新增紫微斗数基础命盘（十二宫与主星），与八字共用排盘表单组件，只切换引擎。
- 东方站页面：`/zh-hant/`（八字排盤首页，Title 按设计文档）、`/zh-hant/紫微斗數排盤/`、`/zh-hant/命盤查詢/`；`/ko/`（만세력首页）、`/ko/사주궁합/`（双人궁합）。
- 长尾概念页（每种语言 8 页）：大運、喜用神、五行、身強身弱、空亡、神煞、八字重量、十神 / 대운、용신、오행、신강신약、공망、신살、일주、십신；每页嵌入同一排盘组件并锚定到对应结果区块。

## Capabilities

### New Capabilities
- `bazi-chart`: 八字/사주排盘的计算规则与输出内容，包括时间换算、各结果项的定义与无时辰时的行为。
- `eastern-tool-pages`: 东方站排盘类页面（首页工具、紫微、命盘查询、궁합、长尾概念页）的内容结构与互链。

### Modified Capabilities
（无）

## Impact

- 新包 `packages/bazi`（依赖 `tyme4ts` 与 `iztro`，MIT），`scripts/check-deps.rules.json` 增加规则。
- `apps/web`：`features/tools/bazi/`、东方站路由、`messages/<locale>/bazi.json`。
- 依赖 `add-dual-site-foundation` 的站点路由与工具页外壳（tasks 1.x、4.2）。
