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

按站点切换（`data-site="east|west"` 挂在 `<html>`），以 CSS 变量提供给 Tailwind theme。

| token | 东方站（墨·纸·朱砂·金） | 西方站（夜蓝·星金） |
|---|---|---|
| `--bg` | `#F4EFE4` | `#11162A` |
| `--surface` | `#FFFDF8` | `#181F3A` |
| `--surface-2` | `#ECE5D6` | `#151B33` |
| `--ink` | `#1F1C18` | `#ECE7DA` |
| `--ink-muted` | `#4A443B` | `#C9C4B7` |
| `--ink-subtle` | `#6B6355` | `#B9B5AA` |
| `--line` | `#DCD3C1` | `#2A3150` |
| `--line-strong` | `#C9BEA8` | `#3A4266` |
| `--accent` | `#B8432F`（朱砂，主按钮） | `#E3C36F`（星金，主按钮，文字用 `--bg`） |
| `--accent-ink` | `#9E3A27`（链接） | `#E3C36F` |
| `--inverse` | `#1F1C18`（付费卡、日柱） | `#ECE7DA`（付费卡） |

五行色（两站共用，用于条形图与干支着色，配合文字标签，不只靠颜色区分）：金 `#6E7480`、木 `#3E7D4F`、水 `#2E5E8C`、火 `#B8432F`、土 `#9A7438`。

暗色模式：西方站本身为深色；东方站暗色以 `--bg:#1A1815`、`--surface:#24211C`、`--ink:#ECE5D6`、`--line:#3A352D` 为基准，朱砂提亮为 `#D0583F`。

## 字体

- 东方站：标题 `Noto Serif TC` / `Noto Serif KR`（Google Fonts，`display=swap`，只加载 500/700 且按语言只加载一种）；正文系统字体栈 `-apple-system, 'PingFang TC'|'Apple SD Gothic Neo', 'Noto Sans TC'|'Noto Sans KR', 'Microsoft JhengHei'|'Malgun Gothic', sans-serif`。
- 西方站：标题 `Cormorant Garamond` 600/700，正文 `Source Sans 3` 400/600。
- 禁止打包整套 CJK webfont；首屏 LCP 元素（H1）在字体未到时用 fallback 渲染。

## 布局与组件

- 间距 4/8 体系；内容最大宽度 1120px，左右 24px（手机 16px）；卡片圆角 12px，按钮/输入 8–10px，胶囊 999px。
- 所有可点元素 ≥ 44px；表单用真实 `<label>`、单选组用 `<fieldset>/<legend>`；结果区块是 `<section>` + `<h2>`，带锚点 id。
- 区块编号（①–⑦）只在东方站使用；西方站用大号数字 + 计算步骤。
- 付费卡使用 `--inverse` 反色块，位于订阅卡之后；两者都不得以弹窗出现，不得遮挡结果。
- 合规声明：结果区底部浅色条（`--surface-2`），三语文案见 `tool-pages` spec。
- 动效：只用 transform/opacity；`prefers-reduced-motion` 时改为淡入。
- 图标：内联描边 SVG（1.5px），不用 emoji。
