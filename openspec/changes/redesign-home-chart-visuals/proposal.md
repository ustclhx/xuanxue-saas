# Proposal

## Why

两站首页目前只有一个工具（东方站八字排盤 / 만세력，西方站 Life Path 计算器）加长文，访客看不到站内其他工具、详批长什么样、价格与每日运势入口；2026-10-30 体验复测（`docs/ux-review/2026-10-30/`）指出竞品漏斗「算完即可看到报告与付费入口」，而我方首页没有承接。结果页的命盘仍是文字卡片和表格，没有可辨识、可分享的图形，分享出去的链接预览只有站名加标题。模板 0.3.0 已经提供营销区块（数据背书、三步流程、产品矩阵、悬浮 AI 入口），现在可以复用它们，改版首页并补上命盘图形与分享卡片。

## What Changes

- 两站首页在保留「工具即首页」（Title、H1、首屏表单、主词不变）的前提下，在工具与结果之后增加枢纽区块：工具矩阵、样例详批 / 分享卡片展示、每日运势入口（依赖每日运势页上线）、定价与订阅入口、信任背书（只用可核实的事实或带来源的数值）。区块复用模板 `Stats`、`Steps`、`ProductMatrix` 组件，数据来自项目自有的站点数据（工具注册表、详批 catalog、构建期价格快照），不查库。
- 新增命盘图形：八字四柱与五行分布、紫微十二宫盘、数字命理（生命灵数推导与数字网格）的 SVG 图形。图形为纯渲染组件，可在服务端与构建期渲染，带文字替代与表格等价内容，适配东方站浅色 / 深色、西方站深色，以及打印。
- 新增分享卡片：结果页提供「保存分享图」，在浏览器本地生成竖版 PNG（图形 + 站点品牌 + 合规声明，不含姓名，出生日期默认不出现），可下载或调用系统分享。工具页构建期 OG 图加入样例命盘图形。
- 首页与工具页的性能、预渲染与 SEO 设门槛：首页包检查扩展到东方站语言首页并设 gzip 预算；LCP / CLS 不劣于改版前基线；预渲染 HTML 仍含 H1、表单标签与区块说明；Title / H1 / canonical / hreflang / 结构化数据不变。
- 第一阶段为设计稿：按 `ui-design` 技能在 Design 画布产出两站首页与命盘图形、分享卡片设计稿，经使用者本人确认并登记原型索引后才开始实现。

## Capabilities

### New Capabilities

- `home-hub`: 两站首页工具区之后的枢纽区块（工具矩阵、样例详批、每日运势入口、定价入口、信任背书）的内容来源、显示条件与性能、预渲染约束。
- `chart-visuals`: 八字、紫微、数字命理结果的 SVG 图形展示，含无障碍等价内容、主题与打印适配、服务端可渲染。
- `share-cards`: 结果分享图的本地生成、内容与隐私边界，以及工具页 OG 图中的样例图形。

### Modified Capabilities

- `eastern-tool-pages`: 「首页主词工具页」补充工具区之后的枢纽区块，并要求结果区块以图形加文字呈现。
- `numerology-pages`: 「首页」补充工具区之后的枢纽区块，并要求结果显示推导图形。

## Impact

- 代码：`apps/web/src/routes/index.tsx`（首页组装）；`apps/web/src/features/marketing/`（新增项目自有首页枢纽模块，复用 `sections/stats.tsx`、`steps.tsx`、`product-matrix.tsx`）；`apps/web/src/features/tools/`（新增图形模块，改 `bazi/chart-parts.tsx`、`bazi/ziwei-page.tsx`、`numerology/chart.tsx` 与生命灵数结果）；`apps/web/scripts/og-images.ts`（OG 样例图形）；`apps/web/scripts/check-home-bundle.mjs`（扩展页面与预算）；`apps/web/messages/<locale>/` 按并行线拆分新增 `home-hub.json`、`chart-common.json`、`chart-bazi.json`、`chart-ziwei.json`、`chart-numerology.json`、`share-card.json`。
- 设计：`docs/design/prototypes/` 新增确认后的画布副本与索引行；如有 token 变更提议，确认后写入 `apps/web/src/styles/brand.css` 与 `docs/design/visual-system.md`。
- 依赖：不新增运行时依赖；OG 继续使用构建期 `cf-workers-og`。分享图用浏览器原生 Canvas，按需加载。
- 数据与外部：不新增表、迁移、密钥或 Stripe 价格；首页与图形不查数据库，符合 Neon 缩容到零的基线。
- 关联：每日运势入口依赖 `add-birth-profiles-daily-horoscope` 的公开每日运势页；定价入口中的订阅价随 `enable-subscriptions-daily-credits` 上架自动出现；样例详批复用 `product-improve-ai-content-20261030` 已落地的 catalog 样例段落。
