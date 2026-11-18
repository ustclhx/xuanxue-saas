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

- 两站获得简洁、安静的统一视觉：方向 C · 素（Graphite），两站浅色均为纯白底 + 中性灰分层、深色可选，西方站浅色为默认，每站一套线描插画（取值见 D14）。
- 把调研原则写成可测规则（字号种数、区块间距、首屏 CTA 数、页头单行），用 Playwright 度量测试守住。
- 清掉触及文件中的规范违例（原生 `<select>`、任意值工具类），不新增例外。
- 先出设计稿并经使用者确认，再按页面并行实现；性能、对比度与关键样式检查不退化。

**Non-Goals:**

- 不改信息架构与 URL：首页拆为落地页、工具迁往关键词 URL 由 `separate-landing-homepage` 负责（同一设计会话出稿）。
- 不改五行色的语义（木火土金水各一色，只用于图表并配文字标签）；深色主题另补一组提亮值（D14）。字体家族在设计稿评审中已改为无衬线粗体标题（东方 Noto Sans TC / KR，西方 Manrope），见 D14，属本 change 范围。
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
token 取值以使用者 2026-11-17 确认的方向 C 为准（D14）；提案阶段的纸色 / 羊皮纸初稿值已作废，记录在文末「已取代的配色方案」。
确认后由协调者写 `brand.css` 与 `docs/design/visual-system.md`，并在本文件追加「原型索引」小节引用索引行。

**推翻 2026-11-14 决定的记录**：2026-11-14 使用者在 `redesign-home-chart-visuals` 画布确认时把东方站浅色主底改为纯白（`docs/design/prototypes/README.md` 原话「把东方站的整体主体配色换成纯白的吧」「确认白底」）。2026-11-17 使用者基于调研先改为纸色方向，随后在设计稿评审中改回纯白底、并选定方向 C（中性灰分层，D14）。新画布确认后，原型索引中 2026-11-14 各行保留，备注「视觉 token 由 refresh-visual-system-warm 取代，布局仍有效」；`visual-system.md` 的 token 表注明变更日期与原因。

### D1a 设计稿关卡记录（`ui-design` 第 1–2 步，任务 1.1）

- **判断**：`docs/design-system.md` §8.1「建立或改变视觉方向」「改变导航方式或信息层级」均适用，需要设计稿并经使用者本人确认。
- **页面清单**：本节 D1 表的全部页面；本次画布实际出稿的画板见文末「原型索引」，未单独出稿的页面（`/ko/만세력`、`/ko/사주궁합`、紫微、塔罗、每日页、法律页与博客、应用区今日面板、东方站 `/en` 入口页）套用画布中的工具页、`Prose` 与共享组件模式，实现时按副本的 token 与组件对照截图。
- **可用组件**：`@xuanxue/ui` 现有组件（Button、Input、Select、Tabs、Sheet、Dropdown、Card 等）；`@xuanxue/ui/project` 目前为空，新增组件见 D14「组件提议」。
- **token 来源**：设计系统 https://claude.ai/artifact/Vq91QmAGachtxReBdSH5oc（`project/tokens.json`，副本 `docs/design/prototypes/warm-refresh/ds/xuanxueds/tokens.json`）与画布共用样式 `docs/design/prototypes/warm-refresh/site.css`。

### D2 token 结构：沿用现有名称，补主题维度

- 继续用 `--bg/--surface/--surface-2/--ink*/--line*/--accent*/--inverse` 这组名称，组件与图形不需改引用。
- 新增项目 token（已确认，取值见 D14）：`--primary` / `--on-primary`（主按钮，与 `--accent` 分开）、`--field-border`（输入框线）、`--illus`（插画线条，中性灰）、`--danger` / `--on-danger`（只用于错误态与删除类操作）。色带直接用 `--surface-2`，不再新增 `--band`；插画的印章 / 星用 `--accent`，不再拆 `--illus-line` / `--illus-accent`。新增 token 同时写入 `@theme inline` 映射为工具类。
- 西方站拆为 `:root[data-site="west"]`（浅色，`color-scheme: light`）与 `:root.dark[data-site="west"]`（深色）；`--surface-4…8` 的提亮混色改挂在 `:root.dark[data-site]` 上，浅色两站按模板「靠阴影分层」。
- `brand-tokens.ts` 的主题改为 `east-light | east-dark | west-light | west-dark`，对比度测试覆盖四套（正文、弱化文字、链接、主按钮文字、焦点环），沿用 `brand-tokens.test.ts` 的解析方式。

### D3 西方站主题机制

- 删除 `SITE_THEME_SCRIPT` 的「西方站强制 dark」，改为「站点默认主题」脚本 `siteThemeScript`，排在模板 `themeInitScript` **之前**：西方站的访客第一次到访、还没有保存过主题选择时，把选择写为浅色（默认浅色，不跟随系统，见 OQ1），并记一个「已写入默认值」的标记；之后访客改选深色或跟随系统都照常生效，不再写回。
  - 实现时发现不能只在首帧移除 `dark` 类：模板把「没有保存的选择」一律当作跟随系统，水合后的 `useTheme` 订阅会再按系统偏好设置一次类名，系统为深色的访客会在水合后被切回深色。因此改为写入一次默认选择，首帧与水合后一致。
  - 存储不可用时不处理，按模板的跟随系统降级。存储键从模板导出的 `THEME_STORAGE_KEY` 读取，不复制字面量，不修改模板文件。东方站不写入，未保存选择时仍跟随系统。
- `ThemeToggle`、`SiteSettings` 去掉西方站 `return null`。主题存储按域名隔离，两站互不影响。
- `brand.css` 头部注释、`visual-system.md`「暗色模式」段落改写。

### D4 主题切换移入页面流

`root-document.tsx` 关闭浮动主题切换（`floatingControls`），桌面与手机都在页脚设置行显示主题切换，手机导航面板中再放一个入口。`floating-controls.spec.ts` 改为断言「没有浮动主题控件、页脚设置行可用」；悬浮 AI 入口（目前关闭）不受影响。

### D5 字号角色：营销作用域覆盖，原始字号清零

- 模板 `--fs-*` 面向应用界面，营销页需要更大的 display / title。做法：在 `brand.css` 中按营销外壳作用域（`MarketingShell` 根元素上的 `data-surface="marketing"`）覆盖模板的 `--fs-*` / `--lh-*`，桌面与手机两档用媒体查询。
  - 实现时核对：模板用 `@theme inline` 定义 `--text-*`，工具类直接引用 `var(--fs-*)`，所以要覆盖的是 `--fs-*` 而不是 `--text-*`（本条原设想相反，实测不生效）。
  - 六个角色与类名：display → `text-display`，title → `text-title`，heading → `text-subtitle`，lead → `text-lead`（项目在 `brand.css` 的 `@theme` 中新增），body → `text-body`，caption → `text-caption`；作用域内 `text-micro` 与 caption 同值。取值见 D14 字号表。应用区不覆盖，沿用模板默认。
- 新增项目检查 `apps/web/scripts/check-type-roles.mjs` 并纳入 web 的 `check`：`apps/web/src`（不含 `routes/dev/`、测试）中出现 `text-(xs|sm|base|lg|xl|[2-9]xl)` 时报错；过渡期允许名单写在同目录 JSON，按页面组清空，本 change 结束时名单为空。
- Playwright 度量测试 `e2e/visual-rules.spec.ts`：对两站首页、代表工具页、定价页统计可见文字节点的计算字号种数（≤ 6）、首屏按钮与按钮样式链接数（≤ 3，主按钮 1）、首屏文字元素数（≤ 12）、相邻顶层区块间距（桌面 96–128、手机 64–72）、手机页头高度（≤ 64）、段落正文字号（≥ 16）。这些数字与 `site-visual-system` spec 一一对应。

### D6 区块容器与阅读宽度

在 `packages/ui/src/project/` 新增 `Section`（`tone: 'plain' | 'band'`，统一垂直间距 `py-16 lg:py-24 xl:py-32` 一类的标准刻度，具体以设计稿为准）与 `Prose`（`max-w-2xl`，CJK 行高）两个组件，营销页与工具页长文统一使用。模板 `sections/*.tsx`（`Steps`、`ProductMatrix`、`Stats`）不改源码，外包一层 `Section`。

### D7 页头与导航

- 页头导航收敛为 ≤ 5 项：东方站「排盤工具 ▾、每日運勢、定價」+ 语言 + 账户；西方站「Tools ▾、Number of the Day、Pricing」+ 账户。工具下拉列出 `toolsForLocale` 的条目。
- 手机：单行页头（标志、导航按钮、语言、账户），导航面板沿用 `HeaderMenu` 的 `<details>` 方案（服务端输出完整结构，水合前即可展开，符合首帧后水合），而不是依赖水合的 Radix `Sheet`；面板内含主题切换。键盘与焦点行为补测试。
- 实现记录（第 4 组）：博客、指南与文档的入口从页头移到页脚（页头只剩工具下拉、每日运势、定价、语言、账户）；页脚链接为常见问题、博客、指南、文档与四个法律页，定价与注册入口不在页脚重复。手机导航面板含工具、每日运势、定价、主题切换与语言；登录入口是页头同一行的账户图标，面板内不重复（画布面板中另列了「登入」）。`Section` / `Prose` 的演示在项目自有的开发路由 `/dev/shell`，没有改模板的 `/dev/ui` 预览页。
- 「延伸閱讀」等重复链接块从首页移除（首页结构由 `separate-landing-homepage` 规定），工具页内链矩阵保留但放在结果与长文之后。

### D8 插画：画布绘制、内联 SVG 交付

- 在 D1 画布中以 SVG 绘制插画集；确认后把各母题的 SVG 源码转为组件，放 `apps/web/src/features/illustrations/{east,west}/*.tsx`。
- 线条 `stroke="currentColor"`、点缀 `fill="currentColor"`，颜色由外层 token 工具类（线条 `text-illus`，东方站印章与西方站星 `text-accent`）决定；不写颜色字面量，`check:ui` 无需例外。
- 装饰图 `aria-hidden="true"`；固定 `width/height` 或 `aspect-ratio`，不引起 CLS；首屏插画不得成为 LCP 元素（体积小、位于 H1 之后的视觉层，H1 仍是 LCP）。
- 体积：单个母题压缩后约 ≤ 4KB，只在用到的页面内联；首页包预算不放宽（SVG 是 HTML，不计入脚本预算，但计入 HTML 体积，Lighthouse 复测覆盖）。
- 东方站「天干纹理」类大面积纹理以低不透明度（token 控制）的 SVG 实现，不用位图。

### D9 合规声明移出阅读流

`Disclaimer` 改为 caption 字号的说明文字，放在结果区底部、样例报告下方与页脚；删除首页与工具页表单之后的整宽色条。文案与三语内容不变，`tool-pages`「合规声明」场景仍成立。

### D10 原生 `<select>` 替换

`SelectField` 改用 `@xuanxue/ui` 的 `Select`（按 `docs/design-system.md` §4.1 Select 一节：`value/name/required/disabled` 放 `Select`，`id/aria-*` 放 `SelectTrigger`，`onChange` 改 `onValueChange`，`SelectItem` 带连续 `index`）。保持：表单提交与 `#r=` 分享恢复读到同一值（`name` 生成的隐藏输入）、`<label>` 关联、错误提示 `aria-describedby`。e2e 中的 `selectOption` 调用改用现有 `e2e/select.ts` 辅助函数。替换后删除 `check-ui.allow.local.json` 中 `form.tsx` 的 `native-select` 条目。

### D11 分享卡、OG 与图形

- `share-cards.sites.ts`（服务端渲染、无法读 CSS 变量，已有颜色字面量例外）：两站都取默认主题（浅色，方向 C）的值（OQ2）。单测断言与 `brand.css` 解析结果一致（`brand-tokens.ts` 增加对分享卡配色的比对）。
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

### D14 已确认的视觉方向：C · 素（Graphite）

使用者 2026-11-17 在色彩方向研究（https://claude.ai/artifact/2BrLjMQvgSp7Hva7cZydky）中选定方向 C，原话「两站都选C吧」；此前否定米色与深红（「浅色系统放弃全部近似于米色和深红色的设计，这个颜色在ai里用的太多了」）。画布确认原话见「原型索引」。本节取值是 `brand.css` 与 `docs/design/visual-system.md` 的依据。

**主题命名**：东方站浅色 / 深色、西方站浅色 / 深色（干支日 · Light / Dark，Arcanumber · Light / Dark）；不再使用「纸 / 墨 / 羊皮纸 / Night」。西方站未保存选择时固定浅色（OQ1）。

**颜色 token**（两站中性色相同，只有 `accent` 与 `illus` 不同）：

| token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `bg` | `#ffffff` | `#121315` | 页面底；`surface` 面板上的输入框填充 |
| `surface` | `#f4f4f5` | `#1c1d20` | 承载单个对象：工具表单、工具卡、样例报告 |
| `surface-2` | `#eaeaec` | `#26282c` | 色带（今日条、一行价格）、hover、chips、图表格 |
| `ink` | `#16181b` | `#ececee` | 标题与正文；焦点环 |
| `ink-muted` | `#4c5055` | `#c4c6cb` | 说明文字 |
| `ink-subtle` | `#64686e` | `#9c9fa5` | 小字、声明、元信息 |
| `line` | `#e1e2e5` | `#2f3136` | 列表行与页脚顶部细线（装饰） |
| `field-border` | `#7c8086` | `#73777e` | 输入框与 Select 外框 |
| `primary` / `on-primary` | `#16181b` / `#ffffff` | `#ececee` / `#121315` | 主按钮底与文字 |
| `accent-ink` | `#16181b` | `#ececee` | 链接，与正文同色并始终加下划线 |
| `accent`（东方站，松绿） | `#2f5d50` | `#7fb8a4` | 印章、当前导航标记、工具卡字形、日主高亮 |
| `accent`（西方站，黄铜） | `#8a6a1c` | `#d2b15f` | 数字字形、星 |
| `illus`（东 / 西） | `#9a9ea4` / `#a39a86` | `#6c7077` / `#7d7667` | 插画线条，纯装饰 |
| `danger` / `on-danger` | `#96493d` / `#ffffff` | `#d9988b` / `#121315` | 只用于表单错误与删除类操作 |
| 五行（木 火 土 金 水） | `#3e7d4f` `#b8432f` `#9a7438` `#6e7480` `#2e5e8c` | `#6fb583` `#e58a6f` `#cfa35c` `#a7adb8` `#78a9dc` | 只作图表圆点与条形并配文字标签 |

界面中不出现米色、奶油色、赤陶色或品牌红，不用渐变。`accent` 只用于小标记与大号字形（≥ 3:1），不作正文色或按钮底。

**对比度**（在 `bg` / `surface` / `surface-2` 上；`brand-tokens.test.ts` 按此断言）：

| 组合 | 浅色 | 深色 | 要求 |
|---|---|---|---|
| `ink` | 17.79 / 16.18 / 14.81 | 15.76 / 14.29 / 12.51 | 4.5 |
| `ink-muted` | 8.12 / 7.39 / 6.76 | 10.88 / 9.86 / 8.64 | 4.5 |
| `ink-subtle` | 5.60 / 5.10 / 4.66 | 7.01 / 6.35 / 5.57 | 4.5 |
| `on-primary` 对 `primary` | 17.79 | 15.76 | 4.5 |
| `field-border` | 3.97 / 3.61 / 3.30 | 4.13 / 3.75 / 3.28 | 3 |
| 东方站 `accent` | 7.49 / 6.82 / 6.24 | 8.23 / 7.46 / 6.53 | 3 |
| 西方站 `accent` | 5.05 / 4.59 / 4.20 | 9.02 / 8.18 / 7.17 | 3 |
| `danger` 文字 | 6.33 / 5.76 / 5.27 | 7.80 / 7.07 / 6.20 | 4.5 |
| `on-danger` 对 `danger` | 6.33 | 7.80 | 4.5 |

`illus` 在浅色下低于 3:1（东 2.69、西 2.79），只用于装饰线条与对读屏隐藏的插画字形，不承载需要阅读的文字。

**焦点环**：2px `ink`，外移 3px，环与控件之间露出页面底色；黑色主按钮上同样可见。焦点环对页面底 17.79（浅）/ 15.76（深）。

**字体**（取代「不改字体家族」）：每站一个家族，标题为无衬线粗体。

| | 东方站 | 西方站 |
|---|---|---|
| 家族 | Noto Sans TC（韩语 Noto Sans KR），标题 700、正文 400 | Manrope，标题 700、正文 400 |
| display | 44 / 56（手机 32 / 42） | 52 / 58（手机 36 / 42） |
| title | 28 / 38（手机 24 / 32） | 32 / 40（手机 26 / 34） |
| heading | 20 / 30 | 21 / 30 |
| lead | 18 / 32 | 19 / 30 |
| body | 16 / 28 | 17 / 28 |
| caption | 13 / 20 | 13 / 20 |

按钮与导航用 body 字号、500 字重；西方站 display 与 title 字距 -0.02em。字体仍自托管（`@fontsource`，不请求第三方域名）；更换家族后 `brand.css` 的 fallback `@font-face` 度量须重新计算（`visual-system.md`「字体」）。命盘内的大字（四柱干支、Life Path 数字）用 display，小盘用 title，仍在六角色内。

**间距与形状**：区块间距 112（手机 64），标题到内容 40（手机 32），卡片内边距 32（手机 24），阅读宽度 720，页宽 1120，页面边距桌面 32 / 手机 20；圆角 6（输入）/ 14（对象）/ pill（按钮）；阴影只用于工具表单面板与展开的菜单，深色主题无阴影。圆角与阴影只在营销与工具页生效，应用区默认不变。

**插画**：线条用中性灰 `illus`。东方站：同心环、一道弧线、十天干，松绿方印是唯一填充形；西方站：同心环、数字 1–9，四角星用黄铜描边。一页只出现一次（首页桌面 320px 在标题右侧，手机 168px 在标题上方）。

**组件提议（已随画布确认）**：`packages/ui/src/project/` 新增 `Section`、`Prose`、`ToolCard`、`Band`（今日条与一行价格共用）、分段切换（优先复用 Tabs / ThemeToggle）；`features/illustrations/` 的 Motif；改现有页头手机面板（`details`）与页脚设置行；八字表单重排（年 / 月 / 日三个 Select，曆法并入日期标签行，真太阳时与时区收进「進階選項」）。设计系统组件预览中的 14 / 15 / 28px 并入六角色（标签 caption、卡片说明 body、字形 title）。色带是页宽内的圆角条，不是整宽区块。

**版式决定（已随画布确认）**：首页每个工具只链接一次（样例块不放按钮，首屏次要链接为页内锚点）；声明只作 caption（结果区底部、样例下方、页脚）；表单错误用 `danger` 框线、图标与说明文字。

### D15 页面 title 规则

使用者 2026-11-17 要求「把内页的title都补好，最好每一个title都要带上这个网站的名字」。规则：内页为「<页面标题>｜干支日」（繁中、简中）、「<페이지 제목> | 간지데이」（韩语）、「<Page title> | Arcanumber」（英语）；首页站名在前（标题文案见 `separate-landing-homepage` design.md D3），不再追加站名。实现归 `separate-landing-homepage` 任务 2.6（`features/seo/metadata.ts` 的 `pageHead` 与未带站名的页面清单见该 change design.md D3a）。

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

2026-11-17 使用者决定各问题采用默认值，并在设计稿评审中补充了以下结论；本 change 没有遗留的开放问题。

1. **西方站默认主题**：未保存选择时固定浅色，不跟随系统。
2. **西方站 OG 与服务端分享卡**：取站点默认主题（浅色）。
3. **页头导航项**：工具全部收进「排盤工具 ▾ / Tools ▾」；东方站 5 项（工具、每日運勢、定價、语言、账户），西方站 4 项。
4. **字号取值**：见 D14；应用区沿用模板默认值。
5. **插画母题**：每站一个母题（D14「插画」），首屏不使用背景纹理。
6. **度量规则进 CI**：`e2e/visual-rules.spec.ts` 纳入离线 e2e。

## 原型索引

设计稿副本与确认记录登记在 `docs/design/prototypes/README.md`（「warm-refresh」各行，副本目录 `docs/design/prototypes/warm-refresh/`）。本 change 的行：共享组件（两站 × 浅 / 深）、定价页、报告页、状态（表单错误、结果载入、空结果）、token / 组件变更提议、页面 title 规则。落地页与迁移后的工具页画板登记在 `separate-landing-homepage` 名下。实现与验收以副本为准。

## 已取代的配色方案

以下方案在 2026-11-17 的设计会话中先后提出并被使用者否定，不再作为实现依据，保留记录以免重复提出：

| 方案 | 要点 | 结局 |
|---|---|---|
| 提案初稿：东方站纸色、西方站羊皮纸 | 浅色底 `#f6f0e4` / `#f4eee1`，朱红主按钮与朱印，西方站深蓝按钮 + 金色，衬线标题（Noto Serif TC、Cormorant Garamond） | 使用者评审：「浅色配色改成纯白的」 |
| 纯白底 + 暖色表面 | 底 `#ffffff`，表面 `#faf6ef` / `#f8f4ea`，色带 `#f1eadb` / `#eee7d6`，仍为朱红与金色 | 使用者否定：「浅色系统放弃全部近似于米色和深红色的设计，这个颜色在ai里用的太多了」 |
| 色彩方向研究 A · 墨青、B · 靛藍 | A：青瓷绿 / 午夜蓝；B：靛青 / 深海青；均保留衬线标题 | 未选；使用者选 C：「两站都选C吧」 |
| 2026-11-14 东方站纯白主底（`redesign-home-chart-visuals`） | `--bg` 与 `--surface` 同为 `#ffffff`，靠 1px 边线分隔 | 页面底仍为纯白，但分层改为中性灰表面；原型索引中该日各行备注「视觉 token 由 refresh-visual-system-warm 取代，布局仍有效」 |
