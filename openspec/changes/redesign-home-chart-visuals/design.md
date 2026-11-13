# Design

## Context

动机见 proposal.md。与做法相关的现状：

- **首页即工具**：`apps/web/src/routes/index.tsx` 按语言懒加载 `BaziHome`（zh-Hant / zh-Hans）、`ManseryeokHome`（ko）、`LifePathHome`（en），只在西方站长文缺失时回退到模板 `TemplateHome`。主词、Title、H1 由 `eastern-tool-pages`「首页主词工具页」与 `numerology-pages`「首页」规定，首页靠这些词获得搜索流量。
- **模板 0.3.0 区块**：`features/marketing/sections/` 下 `Stats`（数据背书，无数值不渲染）、`Steps`、`ProductMatrix`（编号卡片，图片可选）都只接收属性；`template.config.ts` 的 `marketing.stats/steps/products` 按语言而不是按站点配置，本项目目前留空。悬浮 `AiEntry` 由 `site.marketing.aiEntry` 控制，目前关闭。
- **结果展示**：八字四柱是 `bazi/chart-parts.tsx` 的 HTML 卡片（`PillarCard`）、五行是条形图，紫微是 `ziwei-page.tsx` 的 CSS 网格（`PalaceCell`），数字命理图表是 `numerology/chart.tsx` 的 `DigitGrid`。计算全部在浏览器内完成（`tool-pages`「首屏零等待出结果」）。
- **分享**：结果分享链接是 `#r=` 片段（`features/tools/share.ts`），服务端看不到结果，因此**无法按访客结果生成服务端 OG 图**。OG 图在构建期由 `apps/web/scripts/og-images.ts`（`cf-workers-og`：satori + resvg-wasm）为每个公开页生成，字体为 Noto Sans SC/KR 子集。
- **主题**：`apps/web/src/styles/brand.css` 按 `<html data-site>` 提供 token；东方站有浅色与 `.dark`，西方站固定深色。五行色两站共用。视觉方向与 token 以 `docs/design/visual-system.md` 为准。
- **性能门槛**：`apps/web/scripts/check-home-bundle.mjs` 只检查 `dist/client/index.html`（西方站首页）的静态脚本闭包是否含阅读器 / Markdown 代码，并打印 gzip 总量，没有预算。2026-10-19 的本地 Lighthouse 预检（`docs/runbooks/evidence/perf-audit/2026-10-19.md`）中六页 LCP 中位数都超过 2.5 s，西方三页 CLS 超过 0.1，所以「不退化」以改版前重新测得的基线为准。
- **合规**：免费工具与免费结果只写「依传统规则计算、仅供娱乐、不预测未来」；样例详批、定价入口属于 AI 详批语境，写「AI 辅助、仅供娱乐、不预测未来」；AI 不作为标题卖点。

## Goals / Non-Goals

**Goals:**

- 首页增加枢纽区块而不牺牲主词、预渲染、首屏速度与布局稳定。
- 一套图形组件同时服务结果页、首页样例、构建期 OG 与浏览器分享图，颜色只有 brand.css 一个来源。
- 先出设计稿并经使用者确认，再并行实现。

**Non-Goals:**

- 不改排盘、数字命理或详批的计算与内容；不新增详批类型、提示词或 AI 调用。
- 不做服务端按结果生成的分享图，不新增运行时 OG 路由。
- 不做塔罗分享图、报告页 PDF 版式重做、每日运势页本身（由每日运势 change 负责）。
- 不改模板拥有的 `packages/ui/src/components`、`packages/ui/src/styles` 与 `sections/*.tsx` 源码。

## Decisions

### D1 首页保持工具优先，枢纽区块放在工具之后

首屏仍是 H1 + 表单；枢纽区块位于工具结果之后、FAQ 之前（与西方站长文的相对位置由设计稿定）。
备选：改成枢纽型首页、工具迁往独立 URL。否决理由：首页承接「免費八字排盤」「만세력」「life path number」等主词，迁移会改变 Title/H1 与内链结构，需要 301 与重新收录，风险高于收益；该方案若被选中需修订 specs 与 tasks（见 Open Questions 1）。

### D2 枢纽区块由项目模块组装，复用模板区块组件、不走 template.config

新增项目自有模块 `apps/web/src/features/marketing/home-hub/`：

| 区块 | 组件 | 数据来源 |
|---|---|---|
| 工具矩阵 | 模板 `ProductMatrix`（编号卡片）或项目卡片网格，以设计稿为准 | `features/tools/registry.ts`，按站点与当前语言过滤 `nav !== false` 的工具 |
| 样例详批 | 项目组件：样例图形 + 章节大纲 + 样例段落 + 「示例」标记 + 解锁价 | `features/readings/catalog.ts` 的 sections 与样例段落；图形用 D3 组件渲染虚构样例命盘 |
| 每日运势入口 | 项目卡片 | `add-birth-profiles-daily-horoscope` 登记的公开每日运势页（工具注册表或其公开页清单，以该 change 实现为准）；未登记即不渲染 |
| 三步流程 | 模板 `Steps` | 项目文案：排盘 → 看免费结果 → 解锁详批 / 订阅 |
| 定价入口 | 项目组件 | 构建期价格快照（`features/marketing/pricing-snapshot.ts` / `pricing-read.ts`），与定价页同源 |
| 信任背书 | 事实列表；有带来源的数值时才用模板 `Stats` | 项目常量（事实），数值需来源与日期 |

`template.config.ts` 的 `marketing.stats/steps/products` 继续留空：它按语言而非站点配置，且会影响模板 `TemplateHome` 回退页；首页路由是项目文件，直接传属性更清楚。文案放 `apps/web/messages/<locale>/home-hub.json`。
备选：填 `template.config.ts` 并让首页读配置。否决理由：站点维度表达不了、链接与价格需要从注册表与快照派生，写死在配置里会和定价页漂移。

### D3 图形组件：纯布局函数 + SVG 组件，颜色以属性传入

新增 `apps/web/src/features/tools/charts/`：

- `layout/*.ts`：纯函数，把引擎结果（`BaziChart`、紫微盘、生命灵数推导、数字计数）转成几何与文字列表；不计算命理、不访问浏览器 API；单元测试直接断言坐标与文字。
- `*.tsx`：只把布局画成 `<svg viewBox>`，固定宽高比；`role="img"` + `<title>`/`aria-labelledby`；文字一律 `<text>`，五行同时写文字标签。
- **颜色**：组件接收 `colors` 映射，默认值是 `var(--token)` 字符串，页面内随 `data-site` 与 `.dark` 自动切换；分享图在浏览器内用 `getComputedStyle` 解析为实际颜色；OG 构建脚本解析 `brand.css` 得到颜色。源码里不出现颜色字面量，`check:ui` 无需例外，brand.css 是唯一来源。
- **打印**：在 `chart-print.css`（或现有全局样式的 `@media print` 段）中把图形 token 指向浅底深字，结果区块 `break-inside: avoid`。
- 原 HTML 卡片与表格中承担「等价文字内容」的部分（如藏干十神表、宫位星曜列表）保留，满足 `chart-visuals`「图形无障碍」；纯装饰的重复部分以设计稿为准删除。

备选：用 Canvas 或第三方图表库。否决理由：服务端与构建期都要渲染、需要读屏与打印、命盘不是数据图表，库只会增加首页包体积。

### D4 紫微盘在手机上的可读性

十二宫盘以 4×4 外圈 + 中宫的 SVG 绘制，viewBox 按 358px 可用宽度设计，最小字号折算不低于 11px；主星超出时宫内只列主星，辅星与完整列表在图形下方的宫位列表中（同时作为等价文字内容）。具体是「整盘缩放」还是「手机端盘 + 列表」由设计稿给出并经使用者确认（Open Questions 7）。

### D5 分享图在浏览器本地生成

点击「保存分享图」时按需 `import()` 分享图模块：克隆页面中已渲染的图形节点，内联解析后的颜色，套入卡片 SVG 框架（站名、网址、合规声明、可选出生日期），经 `Image` → `Canvas` 栅格化为 PNG；支持 `navigator.canShare({ files })` 时提供系统分享，否则下载。默认尺寸 1080×1350（4:5）。
SVG 作为图像时不能使用页面网页字体，卡片文字用系统字体栈；第一个实现任务先做技术预研，在 iOS Safari、Android Chrome、桌面 Chrome/Safari/Firefox 上验证中韩文字形与导出。预研不通过时改为 Canvas 2D 直接绘制文字（可用 `document.fonts` 中已加载的网页字体），图形部分仍用 SVG 栅格化。
备选：服务端按结果生成。否决理由：需要把出生信息发到服务器，违反 `#r=` 片段不出浏览器的设计，也增加 Worker CPU 与 wasm 体积。备选：浏览器内跑 satori。否决理由：wasm 与字体体积过大。
备选：模板 0.4.1 的运行时分享卡片（`/share-card/<type>/<token>.png`）。否决理由：须先把结果持久化到服务端换取令牌，与「出生资料不上传」相悖；本 change 的结果分享图仍在浏览器本地生成，不接入运行时分享卡片。

**预研结论（tasks 7.1，2026-11-14）**：本机（macOS）Playwright Chromium 153、Google Chrome 157、WebKit 26.6（Safari 内核）、Firefox 155 上，
「SVG → Image → Canvas → PNG」的繁体、简体、韩文字形与导出均正常，但 SVG 作图片时读不到页面网页字体（按字体栈回退到系统字体）；
Canvas 2D `fillText` 可使用页面已加载的网页字体。据此采用：卡片文字与版式用 Canvas 2D 绘制（东方站 Noto Serif TC / KR、西方站 Cormorant Garamond 等页面字体，
先等待 `document.fonts.load`，超时或离线时用回退字体），只有克隆的页面图形（紫微盘）经 SVG 栅格化；韩文由页面字体与系统字体覆盖，不需要另载 Noto Sans KR。
卡片颜色随页面当前主题解析（东方站深色模式下生成深色卡片）。iOS Safari 与 Android Chrome 实机未测，并入 10.3 staging 手机实机验收。

### D6 OG 图在构建期加入样例图形

`og-images.ts` 对首页、八字 / 紫微 / 命盤查詢 / 만세력、Life Path 与数字图表工具页使用新的样例模板：标题 + 站名 + 用 D3 组件 `renderToStaticMarkup` 生成的样例图形（作为 SVG data URI 嵌入）+「示例」角标。其余页面沿用现有模板。resvg 渲染嵌入 SVG 中的 CJK 文字需要字体，预研同 D5 一起做；不通过时样例图形中的文字改由 satori 在外层排版，SVG 只画线框与色块。分享链接带 `#r=` 时预览图天然与工具页相同。

### D7 性能与包体积门槛

- `check-home-bundle.mjs` 改为检查所有语言首页的预渲染 HTML（西方站 `index.html`，东方站 `zh-hant`、`zh-hans`、`ko` 下的 `index.html`），新增禁止标记：分享图模块的特征字符串；新增按页面的 gzip 预算，预算 = 改版前在 main 上测得的值 × 1.10，写在脚本常量中并在提高时需在 PR 中说明。
- 枢纽区块为静态内容，不引入新的客户端状态（模板 `ProductMatrix` 的图片失败状态只在使用图片时存在；工具矩阵若用图标应为内联 SVG，不额外请求图片）。样例图形是内联 SVG、固定宽高比，位于首屏之下，不成为 LCP 元素。
- LCP / CLS 基线：沿用 2026-10-19 预检的 `lighthouse@13.5.0` 命令与参数，本地生产预览，每页三次取中位数；改版前后各测一轮，证据写入 `EVIDENCE_DIR`。

### D8 设计稿关卡

由协调者按 `ui-design` 第 1–5 步完成；worker 只在原型索引已有对应行时开工。画布与画板：

| 画布 | 画板 |
|---|---|
| 首页 · 东方站 | `/zh-hant` 桌面 1440 / 手机 390 × 浅 / 深；`/ko` 手机浅色；异常态：运势页未上线、无可售方案（手机浅色） |
| 首页 · 西方站 | `/` 桌面 / 手机（深色；西方站无浅色模式，画布注明）；异常态：无可售方案 |
| 命盘图形 | 四柱 + 五行（繁中、韩语柱序）、时辰未知态、紫微十二宫（桌面 / 手机）、生命灵数推导（含大师数）、数字网格；东方站浅 / 深、西方站深色、打印预览 |
| 分享图 | 东方站 / 西方站各一张，含与不含出生日期；生成失败提示（手机浅色）；样例 OG 图（东 / 西） |

视觉沿用 `docs/design/visual-system.md` 的 token、字体与五行色；新增颜色、字号或组件在画布旁单列「token / 组件变更提议」，确认后由协调者写入 `brand.css` 与 `visual-system.md`。确认后在本文件追加「原型索引」小节，只引用 `docs/design/prototypes/README.md` 的行，不重复链接与原话。

## Risks / Trade-offs

- [首页变长稀释主词相关性或拖慢首屏] → 枢纽区块在工具之后、全部静态预渲染；Title/H1/head 前后对比测试；包体积预算与 Lighthouse 前后对照。
- [SVG 在手机上字太小] → D4 的最小字号约束与「图形 + 列表」方案；390px 截图对照设计稿。
- [分享图在部分浏览器缺字或导出失败] → D5 预研与回退方案；失败时提示重试，不影响结果与分享链接。
- [OG 构建中 resvg 无法渲染嵌入 SVG 的中文] → D6 回退为外层 satori 排字。
- [样例详批被误读为对个人的预测] → 标「示例」、使用虚构命盘与 catalog 中经使用者审定的段落（3.2 审定前不渲染样例区块）、附 AI 详批声明。
- [每日运势 change（`add-birth-profiles-daily-horoscope`）延后] → 入口按公开页登记条件渲染，首页可先上线。
- [与 `add-birth-profiles-daily-horoscope` 在出生信息表单（`bazi/birth-fields.tsx`）与首页上冲突] → 本 change 不改表单组件；首页路由只由第 9 组修改，两边按合并顺序 rebase。
- [定价入口的订阅价依赖 `enable-subscriptions-daily-credits`] → 只读构建期价格快照，订阅未上架时自动只显示积分包。
- [颜色在三个渲染环境不一致] → 只从 brand.css 取值；OG 脚本加单测断言解析出的颜色与 brand.css 一致。

## Migration Plan

无数据迁移、密钥或外部配置。按 tasks 分批合并到 main，经 staging 验收后随常规版本发布到生产（合并与发布需使用者授权）。回滚：回退对应 PR 并重新部署；构建期 OG 图随部署回退。上线后在 Search Console 观察两站首页的展示与排名两周。

## Open Questions

1. **首页形态**：保持工具优先（D1 默认）还是改为枢纽型首页？选后者需修订 home-hub、eastern-tool-pages、numerology-pages 的 spec 与任务，须在设计稿开始前确定。
2. **每日运势入口**：首页是否展示；放在工具矩阵一格、独立区块还是首屏下方小条；运势页未上线时首页是否先发（默认隐藏入口、先发）。
3. **视觉方向**：沿用现有 token（默认），还是借改版刷新视觉（需使用者提供参考，走 `ui-design` 第 3 步）；西方站是否增加浅色模式（默认否）。
4. **信任背书数值**：是否展示「累计排盘次数」等数值；若展示，来源（分析平台导出还是数据库）与更新方式（构建期快照，不在请求时查库）。默认不展示数值。
5. **分享图**：是否允许加入出生日期（默认关、可勾选）；是否加二维码或短链；尺寸 4:5 还是同时提供 9:16。
6. **悬浮 AI 入口**：两站是否开启模板 `aiEntry`（东方站 Chat 曾无可用模型；默认关闭）。
7. **紫微手机端**：整盘缩放还是「盘 + 宫位列表」（D4），以设计稿确认为准。
8. **样例详批选择**：首页展示哪种详批（东方站八字或紫微，西方站 Life Path 或塔罗），样例命盘是否沿用 1990-05-15 10:30 台北男。

## 决策记录（2026-11-13，使用者确认）

使用者审阅后确认：本 change 的 Open Questions 全部采用设计中的默认/推荐方案；需要使用者审阅的文案与样例按本 change 的默认方案执行，上线前的验收截图仍按 tasks 留证。

## 原型索引（2026-11-14）

设计稿经使用者确认，见 `docs/design/prototypes/README.md` 中所属 change 为本 change 的各行（副本在 `docs/design/prototypes/roadmap/`）。确认时同时变更品牌 token：东方站浅色 `--bg`、`--surface` 改为 `#ffffff`，`--surface-2` 改为 `#f5f2ec`（已写入 `apps/web/src/styles/brand.css` 与 `docs/design/visual-system.md`）。
