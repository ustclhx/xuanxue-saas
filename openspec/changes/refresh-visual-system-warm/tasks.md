# Tasks

> **执行约定**
> - **负责人**：
>   - 【Claude】设计稿、视觉与 UI 实现、复杂开发与评审；
>   - 【Codex】简单改动、浏览器核对（截图、Lighthouse、度量）与部署；
>   - 【用户】决策与确认；
>   - 【协调者】设计关卡登记、合并顺序与外部动作的执行安排。
> - **worktree 与波次**：每个带 `WT-x` 标记的组一个 worktree（`orca worktree create --base-branch origin/main`）、一个 PR。
>   - 波次 0：第 1 组（设计稿关卡）与第 2 组（基线，不涉及 UI）可同时进行；
>   - **第 1 组 1.5 完成前，第 3–9 组不得开工**（`ui-design` 关卡，原型索引须有对应行与副本）；
>   - 波次 A：第 3 组（token 与主题）先合并；随后第 4、5 组并行（都依赖 3）；
>   - 波次 B：第 6、7、8、9 组页面组并行，依赖 3、4、5 全部合并；
>   - 第 10 组是集成验收与发布。
>   - `separate-landing-homepage` 的实现（其第 3 组起）依赖本 change 第 3、4、5 组合并。
> - **共享文件冲突点**（合并时按 `docs/09-parallel-plan.md` §3 处理）：
>   - `apps/web/src/styles/brand.css`、`docs/design/visual-system.md`：只由第 3 组修改；之后的 token 调整回到协调者；
>   - `scripts/check-ui.allow.local.json` 的 `pendingReplacement`、`apps/web/scripts/check-type-roles.allow.json`：各组只删除自己文件的条目，冲突时合并两边的删除；
>   - `apps/web/messages/<locale>/*.json`：本 change 不改文案（声明位置变化不改文字）；如需新增界面文案（导航按钮、主题切换），只追加到 `site.json` 一类既有命名空间，由第 4 组负责；
>   - `apps/web/src/routes/index.tsx`、`features/marketing/home-hub/`：不在本 change 修改，归 `separate-landing-homepage`；
>   - `features/tools/bazi/birth-fields.tsx`：只由第 5 组修改（`add-birth-profiles-daily-horoscope` 6.x 也改它，由协调者安排先后）。
> - **不涉及**：迁移、密钥、Stripe 价格、外部配置。验收证据写入 `EVIDENCE_DIR`，PR 只引用；部署与外部验收不在 PR 中预先勾选。

## 1. 设计稿与视觉方向（协调者主导；需使用者本人确认）

依赖：无。产出：原型索引行与副本，是第 3–9 组的开工条件。冲突点：`docs/design/prototypes/` 只由协调者修改。

- [x] 1.1 【协调者】按 `ui-design` 第 1–2 步记录判断（§8.1「建立或改变视觉方向」「改变导航方式或信息层级」→ 需要设计稿）、页面清单（design.md D1 表）、可用组件与 token 来源，写入 design.md D1 下方。验证：记录存在，`openspec validate refresh-visual-system-warm --strict` 通过
- [x] 1.2 【Claude】按 `ui-design` 第 3 步，在 Design 画布产出「视觉方向」画板：四套色板与对比度标注、字号六角色取值（营销作用域与应用区）、区块节奏与阅读宽度、控件与色调分层样例；同一画布绘制两站线描插画集（东方墨线 + 朱印、西方金色细线，各 4–6 个母题，SVG）。规范外 token（`--band`、`--illus-*` 等）单列变更提议。验证：画布链接可打开，四套色板均标出正文 / 链接 / 主按钮 / 焦点环对比度
- [x] 1.3 【Claude】在同一画布产出「共享组件」与「代表页面」画板（design.md D1 表，桌面 1440 / 手机 390 × 浅 / 深，西方站浅色为默认态），并与 `separate-landing-homepage` 1.2 的落地页画板放在同一画布。验证：画板矩阵完整
- [x] 1.4 【用户】确认视觉方向、插画与各画板，并答复 design.md Open Questions 1–6（默认方案可整体采纳）。验证：使用者在会话中明确确认，原话记录；OQ 结论写回 design.md
- [x] 1.5 【协调者】保存画布副本到 `docs/design/prototypes/warm-refresh/`（`*.dc.html` 与 `canvas.json`），在 `docs/design/prototypes/README.md` 每个页面 / 画板登记一行（所属 change 填本 change 或 `separate-landing-homepage`），给 2026-11-14 各行加备注「视觉 token 由 refresh-visual-system-warm 取代，布局仍有效」；在 design.md 追加「原型索引」小节与已确认的 token / 组件提议（取值表）。验证：索引行与副本文件存在并提交

## 2. 基线（WT-baseline，【Codex】，可与第 1 组同时进行）

依赖：无。冲突点：无代码改动（只产出证据）。

- [x] 2.1 【Codex】在 main 本地生产预览上按调研 `capture.cjs` 重新采集两站首页、`/zh-hant/紫微斗數排盤`、`/numerology-calculator`、两站定价页的密度指标（首屏 CTA 数、首屏文字元素数、字号种数、手机屏数、页头高度），并按 `redesign-home-chart-visuals` 10.1 的 Lighthouse 命令测基线（同六页 + 两站定价页，各三次取中位数）。验证：`$EVIDENCE_DIR/warm-refresh/baseline/` 下有指标 JSON 与报告，PR 或 Orca 卡片列出中位数

## 3. token 与主题机制（WT-tokens，【Claude】）

依赖：1.5。冲突点：`brand.css`、`visual-system.md`、`features/site/theme.ts`、`features/theme/*`、`share-cards.sites.ts`、`scripts/brand-tokens.ts`、`scripts/og-images.ts`、`e2e/theme.spec.ts`、`e2e/floating-controls.spec.ts` 只由本组修改。

- [x] 3.1 按 design.md D2 与 D14 改写 `brand.css`：两站浅色（纯白底、中性灰表面）与深色、西方站浅色（`:root[data-site="west"]`）与深色（`:root.dark[data-site="west"]`）、新增 token（`primary`、`on-primary`、`field-border`、`illus`、`danger`、`on-danger`、深色五行色）与 `@theme inline` 映射、焦点环改为文字色、`--surface-4…8` 混色改挂 `.dark`，以及 D5 的营销作用域字号覆盖（`--text-*`，桌面 / 手机两档，作用域属性名与第 4 组约定）；同步改写 `docs/design/visual-system.md` 的 token 表、暗色模式段落与「2026-11-14 纯白」决定的变更记录。验证：`pnpm check:ui` 通过；`visual-system.md` 表中取值与 `brand.css` 一致
- [x] 3.2 `scripts/brand-tokens.ts` 改为四套主题，扩展 `brand-tokens.test.ts`：四套主题的正文、弱化文字、链接、主按钮文字对比度 ≥ 4.5:1，焦点环对页面底与主按钮 ≥ 3:1。验证：测试通过，故意改低一个值时失败
- [x] 3.3 按 D3 改主题机制：`SITE_THEME_SCRIPT` 改为站点默认主题脚本（西方站未保存选择时为浅色）、`ThemeToggle` 与 `SiteSettings` 去掉西方站 `null`；按 D4 关闭浮动主题切换，页脚设置行在桌面也显示。更新 `theme.spec.ts`（西方站首次访问为浅色、选择深色后刷新首帧为深色、显示切换控件）、`floating-controls.spec.ts`、`site-header.test.tsx`、`reading-chat.spec.ts` 中的西方站假设。验证：上述测试通过；`pnpm --filter @xuanxue/web test` 通过
- [x] 3.4 按 D11 更新 `share-cards.sites.ts` 两站配色与 `og-images.ts` 取色（各站默认主题，OQ2），增加单测断言分享卡配色与 `brand.css` 解析值一致。验证：`pnpm --filter @xuanxue/web build` 生成的东 / 西默认分享图与样例 OG 图各一张存入 `EVIDENCE_DIR` 并与画布对照
- [x] 3.5 `check-critical-css.mjs` 截图矩阵加入西方站浅色与深色。验证：在本组分支的生产预览上运行通过
- [x] 3.6 按 D14 更换字体：东方站 Noto Sans TC / KR（标题 700、正文 400 / 500），西方站 Manrope（400 / 500 / 700），经 `@fontsource` 自托管并由 `siteFontScript` 按站点与语言加载；移除 Noto Serif 与 Cormorant Garamond、Source Sans 3 的依赖与样式表；重新计算 `brand.css` 中 fallback `@font-face` 的度量；更新 `visual-system.md`「字体」。验证：页面无第三方字体请求（e2e smoke）；两站首页 CLS 中位数不高于 2.1 基线；`pnpm check:singletons`、`pnpm build` 通过

## 4. 共享外壳组件（WT-shell，【Claude】）

依赖：3。冲突点：`packages/ui/src/project/`（新增 `Section`、`Prose` 并导出）、`features/marketing/marketing-shell.tsx`、`site-header.tsx`、`site-footer.tsx`、`features/site/header-menu.tsx`、`account-menu.tsx`、`features/i18n/language-controls.tsx`、`features/tools/disclaimer.tsx`、新增 `apps/web/scripts/check-type-roles.mjs` 与允许名单、新增 `e2e/visual-rules.spec.ts` 只由本组修改。

- [x] 4.1 按 D5 在 `MarketingShell` 根元素输出 3.1 约定的营销作用域属性，使 3.1 的字号覆盖生效；新增 `check-type-roles.mjs` 纳入 web `check`，生成过渡允许名单（当前全部含原始字号的文件）。验证：脚本单测覆盖命中、允许名单与 `routes/dev` 排除；`pnpm check` 通过
- [x] 4.2 在 `packages/ui/src/project/` 新增 `Section`（素色 / 色带）与 `Prose`，加入 `/dev/ui` 预览。验证：组件测试与预览页在 390px 无横向滚动；`pnpm check:deps` 通过
- [x] 4.3 按 D7 重做页头与页脚：导航 ≤ 5 项（工具下拉）、手机单行页头 + `<details>` 导航面板（含主题切换）、页脚设置行与合规声明；按 D9 把 `Disclaimer` 改为说明文字样式。验证：组件测试覆盖导航项数、面板键盘 / Esc / 焦点返回；390 / 1440 × 两站 × 浅 / 深截图与「共享组件」副本对照存入 `EVIDENCE_DIR`
- [x] 4.4 新建 `e2e/visual-rules.spec.ts`（D5 的度量：字号种数、首屏按钮数与文字元素数、区块间距、页头高度、正文字号），先以 `test.fixme` 登记尚未改版的页面，各页面组完成时逐页启用。验证：已启用页面在本地离线 e2e 中通过
- [x] 4.5 清理本组文件在 `check-ui.allow.local.json` 与 `check-type-roles` 允许名单中的条目。验证：`pnpm check:ui`、`pnpm check` 通过且相应条目已删除

## 5. 表单控件与插画（WT-forms-illus，【Claude】）

依赖：3。冲突点：`features/tools/form.tsx`、`features/tools/bazi/birth-fields.tsx`、`features/readings/optin-card.tsx`、`routes/dev/tools.tsx`、`e2e/select.ts` 及调用 `selectOption` 的 e2e、新增 `features/illustrations/` 只由本组修改。

- [ ] 5.1 按 D10 把 `SelectField` 改用 `@xuanxue/ui` 的 `Select`，调整 `birth-fields.tsx`（出生地）、`optin-card.tsx`、`routes/dev/tools.tsx`；`reading-optin.spec.ts`、`reading-unlock.spec.ts` 改用 `e2e/select.ts`；删除 `form.tsx` 的 `native-select` 例外。验证：`pnpm check:ui` 不再报原生 `<select>`；八字表单提交、`#r=` 分享恢复、optin 提交的现有单测与 e2e 通过
- [ ] 5.2 按设计稿重做表单控件样式（输入、单选组、复选框、Select 的尺寸与色调），出生信息表单的进阶字段（真太阳时、出生地）默认收起，满足 `tool-pages`「工具页紧凑布局」的手机首屏可提交。验证：390×844 下 `/zh-hant/紫微斗數排盤` 与 `/ko/사주궁합` 首屏可见提交按钮（Playwright 断言）；组件测试覆盖收起 / 展开与已填值保留
- [ ] 5.3 按 D8 把确认的插画转为 `features/illustrations/{east,west}/*.tsx`（`currentColor`、token 工具类、`aria-hidden`、固定宽高比），加入 `/dev/ui` 预览。验证：`pnpm check:ui` 无颜色字面量；预览页两站 × 浅 / 深截图与副本对照；单个组件 SSR 输出 gzip ≤ 4KB（单测断言）

## 6. 东方站工具页（WT-pages-east，【Claude】）

依赖：3、4、5。冲突点：`features/tools/bazi/`（除 `bazi-home.tsx`、`manseryeok-home.tsx`、`birth-fields.tsx`）、`features/tools/tool-page.tsx`、`tool-links.tsx`、`reading-guide.tsx`、`faq.tsx`、`features/tools/charts/`（仅样式适配）、`routes/八字/`、`routes/사주/`、`routes/$slug.tsx`（仅样式；`separate-landing-homepage` 也改它，后合并方 rebase）。

- [ ] 6.1 紫微、命盤查詢、사주궁합、概念页按新 token、`Section`、字号角色与紧凑布局改版；长文与内链矩阵移到结果之后；替换原始字号与任意值。验证：`visual-rules.spec.ts` 启用这些页面并通过；`pnpm check`、相关单测与 e2e 通过；本组条目从两份允许名单删除
- [ ] 6.2 【Codex】按副本对照截图（390 / 1440 × 浅 / 深 + 打印预览），axe 检查无新增问题。验证：截图与 axe 结果存入 `EVIDENCE_DIR`，差异逐项列给 6.1 负责人修正或记为使用者确认的偏离

## 7. 西方站工具页与塔罗、每日页（WT-pages-west，【Claude】）

依赖：3、4、5。冲突点：`features/tools/numerology/`（除 `home.tsx`）、`features/tools/tarot/`、`features/daily/` 页面组件、`routes/numerology-*.tsx`、`routes/life-path-*.tsx`、`routes/life-path-number/$number.tsx`、`routes/tarot/`、`routes/塔羅/` 等塔罗路由、`routes/daily-numerology.tsx` 与三个东方每日页路由。

- [ ] 7.1 数字命理工具页、12 个数字页、两个枢纽页、塔罗抽牌与牌义页、每日页按新视觉改版（西方站浅色默认、深色可切换；塔罗牌面与图形在两种主题下可读）。验证：`visual-rules.spec.ts` 启用并通过；`chart-visuals`「西方站浅色与深色」场景的对比度断言通过；本组条目从允许名单删除
- [ ] 7.2 【Codex】按副本对照截图（西方站 390 / 1440 × 浅 / 深，东方站塔罗与每日页 × 浅 / 深），axe 检查。验证：同 6.2

## 8. 定价、详批与应用区（WT-pages-commerce，【Claude】）

依赖：3、4、5。冲突点：`features/marketing/pricing-page.tsx`、`features/readings/`（`report-page.tsx`、`unlock-card.tsx`、`markdown.tsx`）、`features/app-shell/`、`routes/app/`、`routes/(auth)/`、`features/site/account-menu.tsx` 以外的应用区组件。与 `enable-subscriptions-daily-credits`、`adopt-subject-chat-readings` 在定价页与报告页上可能冲突，由协调者安排先后。

- [ ] 8.1 定价页、解锁卡、报告页、应用区（空间框架、今日面板、出生档案、报告列表）与认证页按新视觉改版；应用区沿用模板字号默认值，只换色调与间距。验证：`visual-rules.spec.ts` 启用定价页；应用区组件测试与 e2e 通过；本组条目从允许名单删除
- [ ] 8.2 【Codex】按副本对照截图（含登录后页面，用 e2e 夹具），axe 检查。验证：同 6.2

## 9. 内容页（WT-pages-content，【Claude】）

依赖：3、4、5。冲突点：`features/marketing/legal-page.tsx`、`rich-content.tsx`、`blog/`、`docs-layout.tsx`、`east-english/page.tsx`、`routes/faq.tsx`、`newsletter.tsx`、`waitlist.tsx`、`disclaimer.tsx`、404 页。

- [ ] 9.1 法律页、博客列表与文章、文档、FAQ、newsletter / waitlist、东方站 `/en` 入口页与 404 按新视觉改版，正文使用 `Prose`（≤ 720px、CJK 行高）。验证：`visual-rules.spec.ts` 启用法律页与博客文章；`legal-pages` 测试通过；本组条目从允许名单删除
- [ ] 9.2 【Codex】按副本对照截图，axe 检查。验证：同 6.2

## 10. 集成验收与发布（协调者；外部动作需使用者授权）

依赖：3–9 全部合并（`separate-landing-homepage` 的首页可同批验收）。

- [ ] 10.1 【Claude】确认 `check-type-roles` 允许名单为空、`check-ui.allow.local.json` 中本 change 触及文件无待替换条目、`visual-rules.spec.ts` 不再有 `fixme`。验证：三项检查结果写入 PR
- [ ] 10.2 【Codex】在 main 本地生产预览上按 2.1 同一方法复测 Lighthouse 与密度指标。验证：各页 LCP 中位数不高于 2.1 基线的 110%，CLS 中位数 < 0.1；`homeScriptGzipBudget` 检查通过；`check-critical-css.mjs` 四个主题组合通过；对照表存入 `EVIDENCE_DIR`
- [ ] 10.3 【Codex】数据库不可达时（本地停 PG）两站营销页与工具页完整显示；禁用 JavaScript 时页头导航面板可展开。验证：记录存入 `EVIDENCE_DIR`
- [ ] 10.4 【用户】审阅 10.1–10.3 证据与关键页面截图，确认上线。验证：使用者在会话中确认
- [ ] 10.5 【协调者】【需使用者授权】合并并部署 staging，两站浅 / 深逐项验收（含手机实机：主题切换、导航面板、Select、分享图）；随常规版本发布生产，确认 main 部署流水线成功与两站 `/api/health` 版本 SHA。验证：staging 验收与发布记录存入 `EVIDENCE_DIR`
- [ ] 10.6 【协调者】`redesign-home-chart-visuals` 归档后再归档本 change（`chart-visuals` 主规格须先存在）。验证：`openspec archive` 成功，主规格含「西方站浅色与深色」场景
