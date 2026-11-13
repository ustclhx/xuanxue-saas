# Tasks

> 并行约定：每组一个 worktree（`orca worktree create --base-branch origin/main`），共享文件规则见 `docs/09-parallel-plan.md` §3。
> 依赖与冲突点写在组标题下。外部动作（合并、staging / 生产部署）需使用者授权，单列在第 10 组。
> 本 change 不新增迁移、密钥或 Stripe 价格。验收证据写入 `EVIDENCE_DIR`，PR 只引用。
> **第 1 组完成前，第 3–9 组不得开工**（`ui-design` 关卡）；第 2 组不涉及 UI，可先行。

## 1. 设计稿与产品决策（协调者；需使用者本人确认）

依赖：无。产出：原型索引行与副本，是第 3–9 组的开工条件。冲突点：`docs/design/prototypes/`、`brand.css`、`visual-system.md` 只由协调者修改。

- [ ] 1.1 向使用者确认 design.md Open Questions 1–6、8（首页形态、每日运势入口、视觉方向、背书数值、分享图选项、AI 入口、样例详批），把答复与原话写回 design.md；若选择枢纽型首页（OQ1），先修订 specs 与本文件再继续。验证：design.md 的 Open Questions 每项都有「已定」结论，`openspec validate redesign-home-chart-visuals --strict` 通过
- [ ] 1.2 按 `ui-design` 第 1–2 步记录判断（§8.1「增删或重排页面的顶层区块」「新增页面模式」→ 需要设计稿）、页面清单、数据来源与可用组件 / token。验证：判断与清单写入 design.md D8 下方
- [ ] 1.3 OQ3 选择刷新视觉时，按 `ui-design` 第 3 步索取参考并发布 Design System 镜像，使用者确认后写 `brand.css` 与 `visual-system.md`；沿用现有 token 时跳过并注明。验证：`pnpm check:ui` 通过，或 design.md 注明跳过
- [ ] 1.4 在 Design 画布产出「首页 · 东方站」「首页 · 西方站」两张画布，按 design.md D8 的画板矩阵，规范外需求单列变更提议。验证：画布链接可打开、画板矩阵完整
- [ ] 1.5 在 Design 画布产出「命盘图形」「分享图」画布（含紫微手机端方案 OQ7、打印预览、时辰未知态、生成失败态、样例 OG 图）。验证：画布链接可打开、画板矩阵完整
- [ ] 1.6 把四张画布发给使用者确认，按意见修改直至使用者在会话中明确确认；保存 `docs/design/prototypes/<画布>/*.dc.html` 与 `canvas.json` 副本，在 `docs/design/prototypes/README.md` 每个页面 / 画板登记一行（所属 change 填本 change），在 design.md 追加「原型索引」小节引用索引行，已确认的 token / 组件提议写入 design.md。验证：索引行与副本文件存在，副本提交到 PR

## 2. 基线与性能门槛（worktree W0，可在第 1 组期间进行）

依赖：无。冲突点：`apps/web/scripts/check-home-bundle.mjs` 及其测试只由本组修改。

- [x] 2.1 在 main 的本地生产预览上按 `docs/runbooks/evidence/perf-audit/2026-10-19.md` 的 `lighthouse@13.5.0` 命令测量基线（西方站 `/`、`/zh-hant`、`/zh-hans`、`/ko`、`/zh-hant/紫微斗數排盤`、`/numerology-chart`，各三次取中位数），并保存各首页预渲染 HTML 的 head（canonical、hreflang、robots、JSON-LD 类型）作为对照。验证：`$EVIDENCE_DIR/home-redesign/baseline/` 下有报告与 head 快照，PR 描述列出中位数
- [x] 2.2 扩展 `check-home-bundle.mjs`：检查西方站与东方站各语言首页的预渲染 HTML；新增分享图模块的禁止标记；新增每页 gzip 预算（= 2.1 时 main 的实测值 × 1.10，写为常量并注明来源）。验证：`check-home-bundle.test.ts` 覆盖多页面、禁止标记与超预算失败；`pnpm --filter @xuanxue/web build` 打印各页结果并通过
- [x] 2.3 新增首页 head 对照测试：断言各语言首页的 canonical、hreflang、x-default、robots 与 JSON-LD 类型与 2.1 快照一致。验证：测试在 main 上通过，并在 PR 中说明后续组修改首页时必须保持通过

## 3. 图形基础（worktree W1）

依赖：1.6。冲突点：新建 `apps/web/src/features/tools/charts/` 与 `apps/web/messages/<locale>/chart-common.json`，其他组只在自己的子文件中扩展。

- [x] 3.1 建立 `charts/` 模块骨架：图形外框组件（`viewBox` 固定宽高比、`role="img"`、`<title>` 与可选描述、`colors` 属性默认 `var(--token)`）、打印样式（浅底深字、`break-inside: avoid`）与服务端渲染测试工具（`renderToStaticMarkup` 输出快照）。验证：单元测试断言外框在服务端输出 `role="img"` 与标题，且源码通过 `pnpm check:ui`（无颜色字面量）
- [x] 3.2 实现浏览器端颜色解析工具（从 `getComputedStyle` 把 `var(--token)` 解析为实际颜色，供分享图使用）与构建期 brand.css 解析工具（供 OG 使用，放 `apps/web/scripts/`）。验证：单元测试断言 brand.css 解析出的东方站浅 / 深与西方站颜色等于 `visual-system.md` 表中的值
- [x] 3.3 在 `/dev/ui` 或项目预览页加入图形外框示例，记录各图形组的接入方式到 `apps/web/src/features/tools/charts/README.md`（布局函数 / 组件 / 颜色 / 文案命名空间约定）。验证：README 中的示例命令可运行，预览页在 390px 无横向滚动

## 4. 八字与만세력图形（worktree W2）

依赖：3。冲突点：`bazi/chart-parts.tsx`、`bazi/bazi-home.tsx`、`bazi/manseryeok-home.tsx`、`bazi/mingpan-page.tsx` 只由本组修改；文案 `chart-bazi.json`。

- [x] 4.1 实现四柱布局函数与 SVG 组件（天干地支、五行文字标签、日主标记、十神；繁中 / 简体按年月日時、韩语按시일월연；时辰未知态）。验证：单元测试以样例 1990-05-15 10:30 台北男断言输出庚午、辛巳、庚辰、辛巳与日主标记，韩语柱序正确，时辰未知时不绘制时柱干支
- [x] 4.2 实现五行分布 SVG（数值与文字标签并列），替换或补充现有条形图，保留藏干十神表作为等价文字内容。验证：单元测试断言五个五行都有文字标签且数值与 `ElementBars` 数据一致；`bazi.test.tsx` 现有用例通过
- [x] 4.3 接入 `/zh-hant`、`/zh-hans`、`/ko` 首页与命盤查詢页，按设计稿对照截图（390 / 1440 × 东方站浅 / 深 + 打印预览）。验证：截图存入 `EVIDENCE_DIR` 并与副本逐画板对照；axe 或 Playwright 无障碍检查无新增问题；2.2、2.3 检查通过

## 5. 紫微十二宫图形（worktree W3）

依赖：3。冲突点：`bazi/ziwei-page.tsx` 只由本组修改；文案 `chart-ziwei.json`。

- [x] 5.1 实现十二宫布局函数与 SVG 组件（地支方位、宫名、宫干支、主星亮度与四化、命宫 / 身宫标记、中宫出生摘要不含姓名），手机端按 1.6 确认的方案（OQ7）。验证：单元测试断言十二宫方位与引擎结果一致、命宫与身宫标记存在、中宫不含姓名字段
- [x] 5.2 接入紫微页，保留宫位列表作为等价文字内容。验证：390px 下无横向滚动、最小字号折算 ≥ 11px（Playwright 计算 `getBoundingClientRect`）；截图与副本对照存入 `EVIDENCE_DIR`；现有紫微 e2e 通过

## 6. 数字命理图形（worktree W4）

依赖：3。冲突点：`numerology/chart.tsx`、`numerology/life-path-calculator.tsx`、`numerology/home.tsx` 只由本组修改；文案 `chart-numerology.json`。

- [x] 6.1 实现生命灵数推导 SVG（逐步求和、大师数 11 / 22 / 33 保留）。验证：单元测试断言大师数 22 的样例停在 22，普通样例的步骤与 `calc.ts` 输出一致
- [x] 6.2 实现数字网格 SVG（1–9 出现次数、缺失数字标记），替换 `DigitGrid` 的视觉部分并保留 `ChartFacts` 文字。验证：单元测试断言计数与缺失标记；`full-calculator.test.tsx` 等现有用例通过
- [x] 6.3 接入西方站首页与 `/numerology-chart`，截图对照（390 / 1440 深色 + 打印预览）。验证：截图存入 `EVIDENCE_DIR`；2.2、2.3 检查通过

## 7. 结果分享图（worktree W5）

依赖：3（7.1 可在 3 合并后立即开始）；7.3 依赖 4、5、6 合并。冲突点：`features/tools/share-link.tsx` 与新模块 `features/tools/share-card/` 只由本组修改；文案 `share-card.json`。

- [ ] 7.1 技术预研：用 3.1 的外框与一个样例图形，验证「克隆 SVG → 内联颜色 → Image → Canvas → PNG」在 iOS Safari、Android Chrome、桌面 Chrome / Safari / Firefox 的中韩文字形与导出；不通过时按 design.md D5 改为 Canvas 2D 绘字。验证：各浏览器导出图存入 `EVIDENCE_DIR`，结论写入 PR 与 design.md D5
- [ ] 7.2 实现按需加载的分享图模块：卡片框架（图形、站名与网址、合规声明、可选出生日期勾选，默认不含）、1080×1350 PNG、`navigator.share` 文件分享与下载回退、失败提示与重试。验证：单元测试断言默认输出不含出生日期 / 姓名 / 出生地文本；Playwright 断言生成期间无携带输入的网络请求、离线可生成；2.2 的禁止标记检查通过
- [ ] 7.3 在八字、만세력、紫微、生命灵数结果的分享操作旁接入「保存分享图」。验证：四类结果各生成一张，与「分享图」画布副本对照，截图存入 `EVIDENCE_DIR`

## 8. 样例 OG 图（worktree W6）

依赖：4、6 合并（5 合并后补紫微页）。冲突点：`apps/web/scripts/og-images.ts` 只由本组修改。

- [ ] 8.1 为首页与八字 / 紫微 / 命盤查詢 / 만세력 / Life Path / 数字图表页新增样例 OG 模板（标题、站名、样例图形 data URI、「示例」角标），颜色取自 3.2 的 brand.css 解析；resvg 无法渲染嵌入中文时按 D6 回退。验证：`pnpm --filter @xuanxue/web build` 生成 `dist/client/og/` 对应 PNG，人工核对东 / 西各一张存入 `EVIDENCE_DIR`；`seo` 现有单元测试与 `seo.spec.ts` 通过
- [ ] 8.2 增加测试：带 `#r=` 的分享链接页面 `og:image` 与工具页相同，样例 OG 模板只用于登记页面。验证：单元测试通过

## 9. 首页枢纽区块（worktree W7，两站）

依赖：1.6、2；9.3 的样例图形依赖 4、6 合并（先用占位外框开发，合并后替换）；9.4 依赖 `add-birth-profiles-daily-horoscope` 的公开每日运势页登记（未登记时仅验证隐藏态）。冲突点：`apps/web/src/routes/index.tsx` 与 `features/marketing/home-hub/` 只由本组修改；文案 `home-hub.json`；不修改 `bazi/birth-fields.tsx`（`add-birth-profiles-daily-horoscope` 可能修改）。

- [ ] 9.1 实现 `home-hub/` 数据层：从工具注册表按站点与语言生成工具矩阵、从 catalog 取样例大纲与段落、从构建期价格快照取积分包与订阅价格、事实型背书常量（数值仅在 OQ4 确认来源后加入）。验证：单元测试断言 `/ko` 只含有韩语页面的工具、西方站不含东方工具与跨站域名、价格与定价页快照一致、无可售方案时不产出金额
- [ ] 9.2 按设计稿实现工具矩阵、三步流程（模板 `Steps`）、定价入口与信任背书区块，并在 `routes/index.tsx` 的工具区之后、FAQ 之前组装；样例详批区标「示例」并附 AI 详批声明，免费工具区不出现 AI 字样。验证：组件测试断言区块顺序与「示例」标记；`readings/compliance.ts` 检查样例文本；2.3 head 对照测试通过
- [ ] 9.3 接入样例详批区块的样例图形（4、6 的组件，虚构样例命盘）。验证：预渲染 HTML 含样例 SVG；禁用 JavaScript 请求首页仍含 H1、表单标签、枢纽区块文字
- [ ] 9.4 每日运势入口：当前站点与语言已登记公开每日运势页时渲染卡片，否则不渲染且无「即将开放」。验证：单元测试覆盖有 / 无两种状态
- [ ] 9.5 按设计稿对照截图（东方站 `/zh-hant` 桌面 / 手机 × 浅 / 深、`/ko` 手机浅色、西方站桌面 / 手机深色，以及异常态），确认 390px 无横向滚动。验证：截图存入 `EVIDENCE_DIR` 并逐画板对照；`pnpm check`、`pnpm check:deps`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过

## 10. 集成验收与发布（协调者；外部动作需使用者授权）

依赖：2–9 全部合并。

- [ ] 10.1 在 main 本地生产预览上按 2.1 同一方法复测 Lighthouse，对比基线。验证：各页 LCP、CLS 中位数不高于基线且 CLS < 0.1，对照表存入 `EVIDENCE_DIR`；不达标时回到对应组修复
- [ ] 10.2 SEO 与预渲染复核：2.3 对照测试、`seo.spec.ts`、禁用 JavaScript 抓取两站首页与工具页、数据库不可达时首页可用（本地停 PG 后访问预渲染页）。验证：结果记录在 PR 或证据目录
- [ ] 10.3 【需使用者授权】合并各 PR 并部署 staging，在 staging 两站按 home-hub、chart-visuals、share-cards 的场景逐项验收（含手机实机生成分享图）。验证：staging 验收记录存入 `EVIDENCE_DIR`
- [ ] 10.4 【需使用者授权】随常规版本发布到生产，确认 main 部署流水线成功与 `/api/health` 版本 SHA；上线两周内观察 Search Console 首页展示与排名。验证：发布记录与健康检查结果；观察结论写入项目日志
