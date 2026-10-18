# Proposal

## Why

英语是西方站的架构主版与内链中枢。`life path number`（90,500，KD 35.5，仍在上升期）可以用「聚焦首页正面对位大站内页」的打法切入（对标 `seventhlifepath.com`，`doc/design.md` §3、TASK-03）。法语站复用同一引擎，但要等法国本地搜索量重新核实后再做，所以 v1 只上英语。

## What Changes

- 新增纯 TypeScript 数字命理引擎 `@xuanxue/numerology`（毕达哥拉斯体系）：生命灵数、表达/命运数、灵魂数、人格数、生日数、个人年，大师数 11/22/33 的保留规则；姓名规范化（去重音符号，为法语预留）。
- 西方站首页 `/` 为 Life Path Number 计算器，同一页面下方还有 numerology calculator 工具区。
- 内页：`/numerology-calculator/`（全部数字）、`/numerology-chart/`、`/name-numerology/`、`/life-path-compatibility/`；12 个数字页 `/life-path-number/<1–9|11|22|33>/`；`/soul-urge-number/` 与 `/destiny-number/` 两个枢纽页。

## Capabilities

### New Capabilities
- `numerology`: 数字命理各项数字的计算规则、姓名处理与大师数规则。
- `numerology-pages`: 西方站数字命理页面（首页、计算器、图表、12 个数字页、相性页）的结构与互链。

### Modified Capabilities
（无）

## Impact

- 新包 `packages/numerology`（无运行时第三方依赖）；`apps/web` 的 `features/tools/numerology/`、西方站路由、`messages/en/numerology.json`。
- 依赖 `add-dual-site-foundation` 4.2（工具页外壳）与 2.3（`TOOL_ROUTES`）。
