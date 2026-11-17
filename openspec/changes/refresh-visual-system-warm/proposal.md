# Proposal

## Why

使用者反馈两站 UI「太满、太密」。2026-11-17 的调研（仓库外证据 `xuanxue-saas-evidence/landing-redesign-research/brief.md`，含竞品与本站截图、密度指标）给出量化依据：东方站首页桌面首屏 28 个文字元素、8 个类按钮元素、11 种字号，手机首屏 0 个 CTA；西方站首页 15 种字号、手机 10.8 屏；2026-11-14 东方站主底改为纯白后，`--bg` 与 `--surface` 同色，只能靠 1px 边线分隔，形成「格子表」质感，暖意消失；西方站全站深蓝 + 金色，没有任何暖色线索。对照组（Co–Star、FateMaster、ziwei.pub、OpenFate）每屏 1–4 个文字块、7–9 种字号，靠色调、留白与单一插画风格营造「温暖、简洁」。

本 change 把两站视觉统一刷新为简洁、安静的观感，并把调研中的版式原则写成可检查的规则。提案阶段设想的是「温暖」的纸色与羊皮纸；2026-11-17 设计稿评审中使用者否定了米色与深红，选定方向 C · 素（Graphite）：纯白底、中性灰分层、墨黑主按钮、无衬线粗体标题（design.md D14）。change 名称沿用。

## What Changes

- **两站改用中性色分层**：浅色页面底为纯白，卡片与面板为中性灰表面，层次靠色调与留白区分，1px 边线只留给输入框与可交互卡片；主按钮为墨黑，强调色只作小标记（东方站松绿、西方站黄铜）。2026-11-14「东方站浅色主底纯白」的页面底保留，但「底与表面同色、靠边线分隔」的做法被取代。东方站深色主题保留并同步调整。
- **西方站新增浅色主题并设为默认，深色可切换**：西方站从「只有深色」改为浅色（默认）/ 深色 / 跟随系统三种，主题切换控件在西方站显示。代码与规格中「西方站固定深色」的假设逐一改掉（主题脚本、主题切换、`brand.css`、OG 与分享卡配色、图形配色、e2e、视觉规范文档）。
- **字体**：标题改为无衬线粗体，每站一个家族（东方站 Noto Sans TC / KR，西方站 Manrope），仍自托管。
- **插画系统**：每站一套线描风格（中性灰线条；东方站松绿印章，西方站黄铜星），在设计稿阶段于 Design 画布中绘制，以内联 SVG 交付，颜色只经 token，不请求外部资源。
- **版式原则落地**：每屏一个任务；营销页首屏类按钮元素不超过 3 个、主按钮 1 个；页面只用模板六个字号角色（`text-display` … `text-micro`），替换现有 Tailwind 原始字号；桌面区块间距 96–128px、手机 64–72px，正文阅读宽度收窄；同一链接在一屏内只出现一次；页头导航不超过 5 项，手机页头为单行（导航收进抽屉）；合规声明移出阅读流（结果区底部小字与页脚），不再以全宽色条出现在表单之后；工具页紧凑（H1、简介、表单，手机首屏可见提交按钮，长 SEO 文案放在结果之后）；主题切换不再浮动遮挡正文。
- **修复规范违例**：`apps/web/src/features/tools/form.tsx` 的 `SelectField` 渲染原生 `<select>`（`AGENTS.md` 禁止，`scripts/check-ui.allow.local.json` 中登记为待替换），改用 `@xuanxue/ui` 的 `Select`；同时清理本 change 触及文件在 `pendingReplacement` 中的任意值工具类。
- **保持不变的门槛**：只用 `@xuanxue/ui` 组件与 token（不写死颜色与任意值）；两站两种主题均满足 WCAG AA；LCP / CLS 不劣于 `redesign-home-chart-visuals` 10.1 最终基线；`homeScriptGzipBudget` 不放宽；关键样式截图比对（`check-critical-css.mjs`）覆盖新增的西方站浅色；新增公开页与组件不查库（Neon 缩容到零基线）。
- **第一阶段为设计稿**：按 `ui-design` 技能在 Design 画布产出视觉方向（token 板、两站插画）与代表页面画板（含 `separate-landing-homepage` 的落地页），经使用者本人确认、保存离线副本并登记原型索引后，才开始任何实现任务。

## Capabilities

### New Capabilities

- `site-visual-system`: 两站的视觉方向与可检查的版式规则——主题与默认值、色调分层、对比度、字号角色、区块节奏、首屏密度、页头与导航、插画、主题切换位置。

### Modified Capabilities

- `tool-pages`: 「合规声明」明确位置（结果区底部与页脚，不以全宽色条打断阅读流）；新增「工具页紧凑布局」。
- `chart-visuals`: 「图形主题与打印」从「西方站深色」扩展为西方站浅色与深色（该 capability 由 `redesign-home-chart-visuals` 引入，归档顺序见 design.md）。

## Impact

- 代码：`apps/web/src/styles/brand.css`（两站四套 token）；`apps/web/src/features/site/theme.ts`（`SITE_THEME_SCRIPT`）、`features/theme/theme-toggle.tsx`、`site-settings.tsx`；`features/marketing/site-header.tsx`、`site-footer.tsx`、`features/site/header-menu.tsx`；`features/tools/form.tsx`、`tool-page.tsx`、`reading-guide.tsx`；`features/marketing/home-hub/`、`pricing-page.tsx`、`legal-page.tsx`、`rich-content.tsx`、`east-english/page.tsx`；`features/tools/bazi/*`、`numerology/*`、`tarot/*` 页面组件；`features/readings/report-page.tsx`、`unlock-card.tsx`；`features/share-cards/share-cards.sites.ts`；`apps/web/scripts/brand-tokens.ts`、`og-images.ts`、`check-critical-css.mjs`；`apps/web/e2e/theme.spec.ts`、`floating-controls.spec.ts` 等；新建 `features/illustrations/`（内联 SVG）。
- 设计与文档：`docs/design/visual-system.md` 重写 token 表与原则；`docs/design/prototypes/` 新增画布副本与索引行；`scripts/check-ui.allow.local.json` 删除已替换的条目。
- 模板边界：不修改 `packages/ui/src/components`、`packages/ui/src/styles`；缺组件时在 `packages/ui/src/project/` 补。
- 数据与外部：不新增表、迁移、密钥、依赖或外部请求；邮件模板不使用站点配色，不受影响（实施时复核）。
- 关联：`separate-landing-homepage` 的落地页在同一设计会话中出稿，实现排在本 change 的 token 与共享组件合并之后。
