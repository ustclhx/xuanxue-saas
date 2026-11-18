# v1 视觉规范

工具页 UI 以本文与 `prototypes/` 下四个原型为准（原型来源：Claude Design 画布 https://claude.ai/artifact/Ecb78NsaeTES55ybe1DB9J ，仅所有者可见；仓库内副本为 `.dc.html`，打开源码即可看到结构与内联样式）。

| 原型 | 页面 |
|---|---|
| `prototypes/Main.dc.html` | 东方站 `/zh-hant/` 八字排盤（桌面，7 个结果区块 + 订阅 + 解锁） |
| `prototypes/Manseryeok.dc.html` | 东方站 `/ko/` 만세력（手机，6 区块，신살·귀인·공망 加深） |
| `prototypes/LifePath.dc.html` | 西方站 `/` Life Path Number（桌面） |
| `prototypes/Tarot.dc.html` | 西方站 `/tarot/` 三张牌（手机，可交互翻牌） |

原型中的 `[方括号]` 是占位（品牌名、价格、引擎结果），实现时替换为真实数据；样例命盘 1990-05-15 10:30 台北男 = 庚午 辛巳 庚辰 辛巳，经 lunar-javascript 计算。

## 设计 token

2026-11-17 使用者确认方向 C · 素（Graphite）（`openspec/changes/refresh-visual-system-warm/design.md` D14，画布副本 `prototypes/warm-refresh/`）：两站中性色相同，浅色为纯白底加中性灰表面，层次靠色调与留白；主按钮为墨黑，链接与正文同色并加下划线；每站一个强调色，只用于小标记与大号字形。取代此前的「墨·纸·朱砂·金 / 夜蓝·星金」配色，以及 2026-11-14「东方站纯白底、卡片以边线区分」的做法（页面底仍为纯白，分层改为中性灰表面）。上方四个 v1 原型的布局仍可参考，颜色与字体以本节为准。

按站点切换（`data-site="east|west"` 挂在 `<html>`），深色主题在 `<html>` 上加 `.dark`，以 CSS 变量提供给 Tailwind theme（`apps/web/src/styles/brand.css`）。

两站共用的 token：

| token | 浅色 | 深色 |
|---|---|---|
| `--bg` | `#ffffff` | `#121315` |
| `--surface` | `#f4f4f5` | `#1c1d20` |
| `--surface-2` | `#eaeaec` | `#26282c` |
| `--ink` | `#16181b` | `#ececee` |
| `--ink-muted` | `#4c5055` | `#c4c6cb` |
| `--ink-subtle` | `#64686e` | `#9c9fa5` |
| `--line` | `#e1e2e5` | `#2f3136` |
| `--line-strong` | `#c9cbd0` | `#45484e` |
| `--field-border` | `#7c8086` | `#73777e` |
| `--primary` | `#16181b` | `#ececee` |
| `--primary-foreground` | `#ffffff` | `#121315` |
| `--accent-ink` | `#16181b` | `#ececee` |
| `--on-accent` | `#ffffff` | `#121315` |
| `--inverse` | `#16181b` | `#ececee` |
| `--on-inverse` | `#ffffff` | `#121315` |
| `--danger` | `#96493d` | `#d9988b` |
| `--on-danger` | `#ffffff` | `#121315` |
| `--wx-metal` | `#6e7480` | `#a7adb8` |
| `--wx-wood` | `#3e7d4f` | `#6fb583` |
| `--wx-water` | `#2e5e8c` | `#78a9dc` |
| `--wx-fire` | `#b8432f` | `#e58a6f` |
| `--wx-earth` | `#9a7438` | `#cfa35c` |

按站点不同的 token：

| token | 东方站浅色 | 东方站深色 | 西方站浅色 | 西方站深色 |
|---|---|---|---|---|
| `--accent` | `#2f5d50` | `#7fb8a4` | `#8a6a1c` | `#d2b15f` |
| `--illus` | `#9a9ea4` | `#6c7077` | `#a39a86` | `#7d7667` |

用法：

- `--bg` 是页面底，也是 `--surface` 面板上输入框的填充；`--surface` 承载单个对象（工具表单、工具卡、样例报告）；`--surface-2` 是色带、悬停与图表格。区块不加整圈边框。
- `--primary` / `--primary-foreground` 是主按钮（类名 `bg-primary`、`bg-brand` / `text-on-brand`）。`--accent-ink` 是链接色，与正文同色，带链接色类名（`text-brand-ink`）的 `<a>` / `<button>` 自动加下划线。
- `--accent` 是站点强调色（东方站松绿、西方站黄铜；类名 `text-mark`、`bg-mark` / `text-on-mark`）：印章、当前导航标记、工具卡字形、日主高亮、数字字形与星。不作正文色或按钮底。
- `--illus` 只用于插画线条与对读屏隐藏的插画字形，对比度低于 3:1，不承载需要阅读的文字。
- `--line` 是装饰细线；`--line-strong` 用于可交互卡片与表格；输入框与 Select 外框用 `--field-border`（≥ 3:1）。
- `--danger` / `--on-danger`（模板的 `--destructive`）只用于错误态与删除类操作。
- 焦点环为 2px `--ink`，外移后与控件之间露出页面底色。
- `--inverse` 反色块内，主按钮与链接自动反过来取色（`brand.css` 的 `.bg-inverse`）。
- 五行色只作图表圆点与条形，配合文字标签，不只靠颜色区分；火色不作品牌或界面色。
- 界面不使用米色、奶油色、赤陶色、品牌红或渐变。

对比度（`apps/web/scripts/brand-tokens.test.ts` 断言）：正文、弱化文字、小字、链接、主按钮文字与错误文字在 `--bg` / `--surface` / `--surface-2` 上均 ≥ 4.5:1；输入框线、强调色与焦点环 ≥ 3:1。

主题：两站都有浅色、深色与跟随系统三种选择，切换控件在页脚设置行（不再浮动）。西方站首次到访默认浅色、不跟随系统（`features/site/theme.ts` 的 `siteThemeScript` 写入一次默认选择）；东方站未保存选择时跟随系统。

## 字体

字体全部自托管（`@fontsource/*`，按 unicode-range 分片、`font-display: swap`），**不请求 Google Fonts 等第三方域名**：e2e smoke 断言页面无外部请求，也避免欧盟站点的第三方字体隐私问题。

标题为无衬线粗体，每站一个家族（方向 C；取代 Noto Serif、Cormorant Garamond 与 Source Sans 3）：

- 东方站：标题 `Noto Sans TC` / `Noto Sans KR` 700（按语言只引入一种，CJK 分片按需下载），fallback 为度量对齐的本机黑体（`PingFang TC` / `Apple SD Gothic Neo`）再落到系统无衬线；正文用系统字体栈 `-apple-system, 'PingFang TC'|'Apple SD Gothic Neo', 'Noto Sans TC'|'Noto Sans KR', 'Microsoft JhengHei'|'Malgun Gothic', sans-serif`，不下载正文字重（CJK 正文字体分片会在首屏下载上百 KB）。
- 西方站：标题与正文都用 `Manrope`（400 / 500 / 700）；fallback 为度量匹配的 Arial（Linux 上为度量兼容的 Liberation Sans），再落到系统无衬线。
- **字体样式表不阻塞首屏**：根布局 `<head>` 中的内联脚本（`features/site/theme.ts` 的 `siteFontScript`）插入本站本语言的 `@fontsource` 样式表，首屏先用 fallback 渲染，字体到达后按 `font-display: swap` 替换；换语言为整页导航，只在首次加载插入一次。未启用脚本时保持系统字体。
- **减少替换位移（CLS）**：`styles/brand.css` 中的 `* Fallback` `@font-face` 只引用 `local()` 本机字体，用 `size-adjust`、`ascent-override`、`descent-override`、`line-gap-override` 对齐自托管字体的度量（拉丁字体按字宽与纵向度量，CJK 全角字形只对齐纵向度量）。更换字体或字重时须重新计算这些数值。
- 首屏 LCP 元素（H1）在字体未到时用 fallback 渲染。
- 站点图标与页头标志：东方站阴阳圆，西方站四角星，SVG 与 32px PNG/ICO 放在 `public/images/favicon-<site>.*`，`/favicon.ico` 按 Host 重定向到本站图标。图稿本身未随方向 C 改色，如需调整另行确认。

## 布局与组件

- 间距 4/8 体系；内容最大宽度 1120px，左右 24px（手机 16px）；卡片圆角 12px，按钮/输入 8–10px，胶囊 999px。
- 所有可点元素 ≥ 44px；表单用真实 `<label>`、单选组用 `<fieldset>/<legend>`；结果区块是 `<section>` + `<h2>`，带锚点 id。
- 区块编号（①–⑦）只在东方站使用；西方站用大号数字 + 计算步骤。
- 付费卡位于订阅卡之后；两者都不得以弹窗出现，不得遮挡结果。
- 合规声明：结果区底部与页脚的 caption 小字，不用整宽色条；三语文案见 `tool-pages` spec。
- 动效：只用 transform/opacity；`prefers-reduced-motion` 时改为淡入。
- 图标：内联描边 SVG（1.5px），不用 emoji。
