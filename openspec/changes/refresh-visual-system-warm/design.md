# Design

## Context

动机见 proposal.md，量化依据见调研简报（仓库外 `~/workspace/xuanxue-saas-evidence/landing-redesign-research/brief.md` §B）。与做法相关的现状：

- **token**：`apps/web/src/styles/brand.css` 按 `<html data-site>` 提供站点 token，并映射到模板 shadcn 变量与 `--surface-1…8`。东方站浅色 `--bg` 与 `--surface` 均为 `#ffffff`（2026-11-14 确认），`--surface-2` 为 `#f5f2ec`；东方站 `.dark` 有完整暗色基准。西方站只有一套深色值（`:root[data-site="west"]`，`color-scheme: dark`），`--surface-4…8` 的提亮混色写在 `:root[data-site="west"], :root.dark[data-site="east"]` 上。
- **「西方站固定深色」的假设分布**（本 change 必须逐一改掉）：
  - `features/site/theme.ts` 的 `SITE_THEME_SCRIPT`：西方站始终加 `dark` 类；`routes/__root.tsx` 在 `themeInitScript()` 之后执行它。
  - `features/theme/theme-toggle.tsx`、`site-settings.tsx`：西方站返回 `null`。
  - `features/share-cards/share-cards.sites.ts`：西方站分享卡配色写死深色（东方站写死纯白）。
  - `apps/web/scripts/brand-tokens.ts`：`BrandTheme = 'east-light' | 'east-dark' | 'west'`，OG 样例图形与其测试 `brand-tokens.test.ts` 按「西方站固定深色」解析。
  - `apps/web/scripts/og-images.ts`：注释与取色「东方站浅色、西方站深色」。
  - `features/tools/charts/`：颜色经 `var(--token)`，本身不假设主题，但 `chart-visuals` spec 与 `routes/dev/charts.tsx` 的说明写「西方站深色」。
  - e2e：`theme.spec.ts`「西方站始终为深色」、`floating-controls.spec.ts`（西方站「只有英语与深色主题，两个控件都不渲染」、`[data-slot="theme-toggle"].fixed` 定位）、`reading-chat.spec.ts`（西方站截图时直接切换 `dark` 类）、`site-header.test.tsx`（西方站不渲染设置行）。
  - 文档：`docs/design/visual-system.md`「西方站本身为深色」、`brand.css` 头部注释。
- **主题切换位置**：`features/theme/root-document.tsx` 在 md 及以上渲染浮动 `ThemeToggle`（`fixed right-4 bottom-4`），手机端由页脚 `SiteSettings` 行代替；调研中 1440 宽时浮动控件与内容重叠。
- **字号**：模板角色 `text-display/title/subtitle/body/caption/micro` 的默认值面向应用界面（display 28px、title 16px、body 14px，见 `packages/ui/src/styles/globals.css` 的 `--fs-*`）；`apps/web/src` 中 25 个文件用了角色类，109 个文件用了 Tailwind 原始字号（`text-sm/lg/2xl` 等），东方站首页渲染出 11 种字号，西方站 15 种。
- **待替换清单**：`scripts/check-ui.allow.local.json` 的 `pendingReplacement` 共 38 个文件、166 处任意值工具类，外加 `form.tsx` 的原生 `<select>`（`SelectField`，用于 `bazi/birth-fields.tsx` 出生地、`readings/optin-card.tsx`、`routes/dev/tools.tsx`）与一处 `browser-dialog`、一处颜色字面量。
- **页头**：`features/marketing/site-header.tsx` 在手机端把 6 个导航项折到第二行（约 150px）；`features/site/header-menu.tsx` 用原生 `<details>` 实现下拉，不依赖水合（模板 0.5.4 起首页水合推迟到首帧之后）。
- **合规声明**：`features/tools/disclaimer.tsx` 由 `tool-page.tsx` 等渲染为 `--surface-2` 整宽色条，首页上它紧跟表单。
- **性能门槛**：`redesign-home-chart-visuals` 10.1 的最终 Lighthouse 基线（六页 LCP 中位数约 1.7–2.0 s，CLS < 0.002，证据 `final-10/template-0.5.4`）；`template.config.ts` 的 `homeScriptGzipBudget: 352174`；`check-critical-css.mjs` 在手机 / 桌面 × 浅 / 深下比对关键样式与完整样式截图。

## Goals / Non-Goals

**Goals:**

- 两站获得「温暖、简洁」的统一视觉：东方站纸色、西方站羊皮纸浅色默认 + 深色可选，每站一套线描插画。
- 把调研原则写成可测规则（字号种数、区块间距、首屏 CTA 数、页头单行），用 Playwright 度量测试守住。
- 清掉触及文件中的规范违例（原生 `<select>`、任意值工具类），不新增例外。
- 先出设计稿并经使用者确认，再按页面并行实现；性能、对比度与关键样式检查不退化。

**Non-Goals:**

- 不改信息架构与 URL：首页拆为落地页、工具迁往关键词 URL 由 `separate-landing-homepage` 负责（同一设计会话出稿）。
- 不改字体家族（东方 Noto Serif TC/KR + 系统无衬线，西方 Cormorant Garamond + Source Sans 3）与五行色；如设计稿需要调整，作为变更提议单列确认。
- 不修改模板拥有的 `packages/ui/src/components`、`packages/ui/src/styles`；不改邮件模板配色。
- 不重画命盘图形与分享图版式（`redesign-home-chart-visuals` 已确认），只让它们适配新 token 与西方站浅色。

## Decisions

### D1 设计稿关卡与共享设计会话

由协调者按 `ui-design` 第 1–5 步完成（第 3 步「改变视觉方向」适用）。一个 Design 画布、两组画板，`separate-landing-homepage` 的落地页在同一会话中出稿，保证两站首页直接用新 token 与插画画出：

| 画布 | 画板 |
|---|---|
| 视觉方向 | 四套色板（东浅 / 东深 / 西浅羊皮纸 / 西深）及对比度标注；字号六角色在营销页与应用区的取值；区块节奏与阅读宽度示意；按钮、输入、Select、卡片、色调分层样例；两站插画集（每站 4–6 个线描母题：东方阴阳、四柱格、天干纹理、朱印；西方星、数字字形、牌面线框） |
| 共享组件 | 页头（桌面、手机单行 + 展开导航面板）、页脚（含主题切换与声明）、区块容器（素色 / 色带）、工具卡、合规声明小字 |
| 代表页面 | 工具页（`/zh-hant/紫微斗數排盤`、`/ko/사주궁합`、`/numerology-calculator`、`/tarot`）含结果与图形；定价页；应用区今日面板与报告页；法律页 / 博客文章；每日运势页；东方站 `/en` 入口页 |
| 落地页（`separate-landing-homepage`） | 东方站 `/zh-hant`、`/ko`，西方站 `/`，以及迁移后的工具页 `/zh-hant/八字排盤`、`/ko/만세력`、`/life-path-number` |

状态矩阵：每页桌面 1440 / 手机 390 × 浅 / 深；西方站浅色为默认态。套用现有模式的内页只画正常态与一个异常态。
token 取值的起点（只作画布初稿，以确认结果为准）：东方站浅色 `--bg` 约 `#FAF6EF`、`--surface` `#FFFFFF`、色带 `#F5EFE4`；西方站浅色 `--bg` 取羊皮纸米色、`--ink` 取深墨蓝、金色只用于主按钮与数字，作文字的 `--accent-ink` 取加深的古铜色以满足 4.5:1；西方站深色把底色从 `#11162A` 柔化为约 `#151A2E`，色带约 `#1B1F33`。
确认后由协调者写 `brand.css` 与 `docs/design/visual-system.md`，并在本文件追加「原型索引」小节引用索引行。

**推翻 2026-11-14 决定的记录**：2026-11-14 使用者在 `redesign-home-chart-visuals` 画布确认时把东方站浅色主底改为纯白（`docs/design/prototypes/README.md` 原话「把东方站的整体主体配色换成纯白的吧」「确认白底」）。2026-11-17 使用者基于调研改为回到纸色、以色调分层。新画布确认后，原型索引中 2026-11-14 各行保留，备注「视觉 token 由 refresh-visual-system-warm 取代，布局仍有效」；`visual-system.md` 的 token 表注明变更日期与原因。

### D2 token 结构：沿用现有名称，补主题维度

- 继续用 `--bg/--surface/--surface-2/--ink*/--line*/--accent*/--inverse` 这组名称，组件与图形不需改引用。
- 新增少量项目 token（以设计稿为准，预计）：`--band`（交替区块的色带底，东方站纸色上的暖带、西方站浅色上的米色带）、`--illus-line` / `--illus-accent`（插画线条与朱印 / 金色点缀）。新增 token 同时写入 `@theme inline` 映射为工具类（如 `bg-band`、`text-illus-line`）。
- 西方站拆为 `:root[data-site="west"]`（浅色羊皮纸，`color-scheme: light`）与 `:root.dark[data-site="west"]`（深色）；`--surface-4…8` 的提亮混色改挂在 `:root.dark[data-site]` 上，浅色两站按模板「靠阴影分层」。
- `brand-tokens.ts` 的主题改为 `east-light | east-dark | west-light | west-dark`，对比度测试覆盖四套（正文、弱化文字、链接、主按钮文字、焦点环），沿用 `brand-tokens.test.ts` 的解析方式。

### D3 西方站主题机制

- 删除 `SITE_THEME_SCRIPT` 的「西方站强制 dark」，改为「站点默认主题」脚本：访客没有保存过主题选择时，西方站移除 `dark` 类（默认浅色，不跟随系统，见 OQ1）；保存过选择时完全交给模板 `themeInitScript` 的结果。脚本读取的存储键与模板 `themeInitScript` 相同（实现时从模板导出读取，不复制字面量），不修改模板文件。
- `ThemeToggle`、`SiteSettings` 去掉西方站 `return null`。主题存储按域名隔离，两站互不影响。
- `brand.css` 头部注释、`visual-system.md`「暗色模式」段落改写。

### D4 主题切换移入页面流

`root-document.tsx` 关闭浮动主题切换（`floatingControls`），桌面与手机都在页脚设置行显示主题切换，手机导航面板中再放一个入口。`floating-controls.spec.ts` 改为断言「没有浮动主题控件、页脚设置行可用」；悬浮 AI 入口（目前关闭）不受影响。

### D5 字号角色：营销作用域覆盖，原始字号清零

- 模板 `--fs-*` 面向应用界面，营销页需要更大的 display / title。做法：在 `brand.css` 中按营销外壳作用域（`MarketingShell` 根元素上的 `data-surface="marketing"` 之类的属性）覆盖 Tailwind 的 `--text-*` 变量（不是 `--fs-*`：`@theme` 中 `--text-display: var(--fs-display)` 在 `:root` 求值，后代覆盖 `--fs-*` 不生效），桌面与手机两档用媒体查询。目标取值以设计稿为准，初稿：display 48–56 / 手机 34–36，title 28–32，subtitle 20，body 17（CJK 行高 1.7–1.8），caption 14，micro 12。应用区不覆盖，沿用模板默认。
- 新增项目检查 `apps/web/scripts/check-type-roles.mjs` 并纳入 web 的 `check`：`apps/web/src`（不含 `routes/dev/`、测试）中出现 `text-(xs|sm|base|lg|xl|[2-9]xl)` 时报错；过渡期允许名单写在同目录 JSON，按页面组清空，本 change 结束时名单为空。
- Playwright 度量测试 `e2e/visual-rules.spec.ts`：对两站首页、代表工具页、定价页统计可见文字节点的计算字号种数（≤ 6）、首屏按钮与按钮样式链接数（≤ 3，主按钮 1）、首屏文字元素数（≤ 12）、相邻顶层区块间距（桌面 96–128、手机 64–72）、手机页头高度（≤ 64）、段落正文字号（≥ 16）。这些数字与 `site-visual-system` spec 一一对应。

### D6 区块容器与阅读宽度

在 `packages/ui/src/project/` 新增 `Section`（`tone: 'plain' | 'band'`，统一垂直间距 `py-16 lg:py-24 xl:py-32` 一类的标准刻度，具体以设计稿为准）与 `Prose`（`max-w-2xl`，CJK 行高）两个组件，营销页与工具页长文统一使用。模板 `sections/*.tsx`（`Steps`、`ProductMatrix`、`Stats`）不改源码，外包一层 `Section`。

### D7 页头与导航

- 页头导航收敛为 ≤ 5 项：东方站「排盤工具 ▾、每日運勢、定價」+ 语言 + 账户；西方站「Tools ▾、Number of the Day、Pricing」+ 账户。工具下拉列出 `toolsForLocale` 的条目。
- 手机：单行页头（标志、导航按钮、语言、账户），导航面板沿用 `HeaderMenu` 的 `<details>` 方案（服务端输出完整结构，水合前即可展开，符合首帧后水合），而不是依赖水合的 Radix `Sheet`；面板内含主题切换。键盘与焦点行为补测试。
- 「延伸閱讀」等重复链接块从首页移除（首页结构由 `separate-landing-homepage` 规定），工具页内链矩阵保留但放在结果与长文之后。

### D8 插画：画布绘制、内联 SVG 交付

- 在 D1 画布中以 SVG 绘制插画集；确认后把各母题的 SVG 源码转为组件，放 `apps/web/src/features/illustrations/{east,west}/*.tsx`。
- 线条 `stroke="currentColor"`、点缀 `fill="currentColor"`，颜色由外层 token 工具类（`text-illus-line`、`text-illus-accent`）决定；不写颜色字面量，`check:ui` 无需例外。
- 装饰图 `aria-hidden="true"`；固定 `width/height` 或 `aspect-ratio`，不引起 CLS；首屏插画不得成为 LCP 元素（体积小、位于 H1 之后的视觉层，H1 仍是 LCP）。
- 体积：单个母题压缩后约 ≤ 4KB，只在用到的页面内联；首页包预算不放宽（SVG 是 HTML，不计入脚本预算，但计入 HTML 体积，Lighthouse 复测覆盖）。
- 东方站「天干纹理」类大面积纹理以低不透明度（token 控制）的 SVG 实现，不用位图。

### D9 合规声明移出阅读流

`Disclaimer` 改为 caption 字号的说明文字，放在结果区底部、样例报告下方与页脚；删除首页与工具页表单之后的整宽色条。文案与三语内容不变，`tool-pages`「合规声明」场景仍成立。

### D10 原生 `<select>` 替换

`SelectField` 改用 `@xuanxue/ui` 的 `Select`（按 `docs/design-system.md` §4.1 Select 一节：`value/name/required/disabled` 放 `Select`，`id/aria-*` 放 `SelectTrigger`，`onChange` 改 `onValueChange`，`SelectItem` 带连续 `index`）。保持：表单提交与 `#r=` 分享恢复读到同一值（`name` 生成的隐藏输入）、`<label>` 关联、错误提示 `aria-describedby`。e2e 中的 `selectOption` 调用改用现有 `e2e/select.ts` 辅助函数。替换后删除 `check-ui.allow.local.json` 中 `form.tsx` 的 `native-select` 条目。

### D11 分享卡、OG 与图形

- `share-cards.sites.ts`（服务端渲染、无法读 CSS 变量，已有颜色字面量例外）：东方站改为新的纸色值；西方站取默认主题（羊皮纸浅色）的值（OQ2）。单测断言与 `brand.css` 解析结果一致（`brand-tokens.ts` 增加对分享卡配色的比对）。
- `og-images.ts` 的样例图形与默认分享图按各站默认主题取色。
- 结果分享图（`features/tools/share-card/`）已按页面当前主题解析颜色，西方站浅色 / 深色都需补截图对照。
- `chart-visuals` spec 的「图形主题与打印」改为覆盖西方站浅色与深色（本 change 的 delta）。

### D12 性能、对比度与关键样式

- Lighthouse 按 `redesign-home-chart-visuals` 10.1 同一命令与页面复测，口径沿用：各页 LCP 中位数不高于该基线的 110%，CLS 中位数 < 0.1。
- `homeScriptGzipBudget` 不改；插画、`Section` 等均无客户端状态，不增加水合闭包。
- `check-critical-css.mjs` 的截图矩阵加入西方站浅色（默认）与深色，东方站保持浅 / 深。
- 新增或修改的公开页与组件不查库（Neon 缩容到零），每日运势条等数据由构建期或边缘计算提供。

### D13 页面应用顺序与所有权

先 token 与共享组件（含 Select、Section、页头页脚、插画组件、度量测试骨架），合并后各页面组并行；每个页面组只改自己的页面文件与对应的 `pendingReplacement` 条目、`check-type-roles` 允许名单条目（按文件删行，冲突时合并两边删除）。首页（`routes/index.tsx`、`features/marketing/home-hub/`）不在本 change 的页面组内，由 `separate-landing-homepage` 在新 token 上直接实现，避免同一文件改两遍。

## Risks / Trade-offs

- [西方站默认浅色改变老访客观感、与深蓝品牌印象不一致] → 深色保留且可切换并记忆；favicon、页头标志沿用夜蓝星金；上线后观察跳出率与主题切换埋点（如有）。
- [金色在羊皮纸上对比度不足] → 金色只作主按钮底（深色字）与大号数字，链接与小字用加深古铜色 `--accent-ink`；token 对比度测试守住。
- [营销作用域覆盖 `--text-*` 与模板升级冲突] → 只在项目 `brand.css` 中覆盖，模板同步不碰；`template-sync` 时复核 `globals.css` 中 `--text-*` 定义方式是否变化。
- [109 个文件的原始字号替换工作量大、易与并行 change 冲突] → 按页面组拆分、允许名单过渡；与其他进行中的 change（`add-birth-profiles-daily-horoscope`、`adopt-subject-chat-readings`、`enable-subscriptions-daily-credits`）在同一文件上冲突时，由协调者安排先后，后合并的一方 rebase。
- [关闭浮动主题切换后桌面访客找不到切换] → 页脚设置行 + 手机导航面板；设计稿确认位置。
- [`<details>` 导航面板的可访问性不如对话框] → 补键盘、Esc、焦点返回测试；若设计稿要求整屏面板再评估 `Sheet`（需水合）并记录取舍。
- [插画体积与 CLS] → 体积上限、固定宽高比、Lighthouse 复测。
- [`chart-visuals` 的 MODIFIED 依赖其主规格存在] → 见 Migration Plan 的归档顺序。

## Migration Plan

无数据迁移、密钥或外部配置。

1. 第 1 组设计稿确认、写 token 与视觉规范（协调者）。
2. 第 2 组基线可与设计稿同时进行；第 3 组 token 与主题机制合并后，第 4、5 组共享外壳、表单与插画并行；三者合并到 main 后，第 6–9 组页面组并行。
3. `separate-landing-homepage` 的首页与工具迁移在本 change 第 3、4、5 组合并后开始实现（见该 change 的 tasks）。
4. 经 staging 两站浅 / 深验收后随常规版本发布（合并与发布需使用者授权）。回滚：回退对应 PR 并重新部署；主题偏好存储键不变，回滚后访客已保存的选择仍有效（西方站回到强制深色）。
5. **归档顺序**：`redesign-home-chart-visuals` 必须先归档（`chart-visuals` 主规格由它创建），本 change 才能归档；`openspec validate --strict` 已通过，但 archive 会在目标规格不存在时拒绝 MODIFIED。

## Open Questions

> 2026-11-17 使用者决定：下列问题采用各条默认值；西方站未保存主题时**固定浅色**（不跟随系统）。展示字号、插画母题等在设计稿评审时确定。

1. **西方站默认主题是否跟随系统**：本设计按使用者「浅色羊皮纸为默认」理解为「未保存选择时一律浅色」；若希望「跟随系统、系统深色时显示深色」，只改 D3 的默认脚本与 spec 场景。
2. **西方站 OG 与服务端分享卡用浅色还是深色**：默认取站点默认主题（羊皮纸浅色）；深蓝在社交信息流中辨识度更高，可选择保留深色。
3. **页头导航项**：东方站是否保留「塔羅」「紫微斗數」为一级导航，还是全部收进「排盤工具 ▾」（默认收进，导航 ≤ 5 项）。
4. **字号取值与营销作用域**：营销页 display / title 的最终值、是否让应用区标题也用较大的 title（默认应用区不变）。
5. **插画母题清单**：每站 4–6 个母题的具体选择（初稿见 D1），以及东方站是否使用天干纹理（低不透明度）作为首屏背景。
6. **度量规则是否进 CI**：`e2e/visual-rules.spec.ts` 默认纳入离线 e2e；若运行时间或波动不可接受，改为 PR 手动运行并在 PR 描述贴结果。
