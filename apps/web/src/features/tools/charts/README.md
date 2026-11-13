# 命盘图形基础（`features/tools/charts/`）

openspec `redesign-home-chart-visuals` design D3 / tasks 3。八字（第 4 组）、紫微（第 5 组）、数字命理（第 6 组）、
分享图（第 7 组）与样例 OG（第 8 组）都在这里的约定上扩展。具体视觉（字号、线宽、配色槽选用、版式）以
`docs/design/prototypes/` 中已确认的「命盘图形」「分享图」画布为准，本目录只提供结构与可替换的接口。

## 目录与命名

| 位置 | 内容 | 归属 |
|---|---|---|
| `layout/geometry.ts` | 通用几何：`Box`、`gridCells`、`insetBox`、字号折算 | 第 3 组 |
| `layout/<图形>.ts` | 纯布局函数：引擎结果 → 坐标与文字列表，例如 `layout/pillars.ts`、`layout/ziwei.ts`、`layout/life-path.ts`、`layout/digit-grid.ts` | 各图形组 |
| `chart-frame.tsx` | `ChartFrame` 外框与 `ChartText` / `ChartBox` / `ChartLine` 基础元素、`CHART_FONTS` | 第 3 组 |
| `<图形>-chart.tsx` | 只把布局画成 SVG，例如 `pillars-chart.tsx` | 各图形组 |
| `colors.ts` | 颜色槽 `CHART_TOKENS`、`chartColors()` | 第 3 组 |
| `resolve-colors.ts` | 浏览器端把 `var(--token)` 解析为实际颜色（分享图） | 第 3 组 |
| `render-static.ts` | `renderChartMarkup`（服务端 / 构建期静态渲染）与 `svgDataUri` | 第 3 组 |
| `chart-print.css` | 打印时在图形外框内改为浅底深字（经 `styles/app.css` 引入） | 第 3 组 |
| `apps/web/scripts/brand-tokens.ts` | 构建期从 `brand.css` 解析各主题颜色（OG） | 第 3 组 |

布局函数不计算命理（只消费引擎 / `calc.ts` 的结果）、不访问浏览器 API；单元测试直接断言坐标与文字。
组件不得自行推算干支、星曜或数字，图形与同页文字区块必须来自同一个计算结果。

## 接入方式

```tsx
import { ChartBox, ChartFrame, ChartText } from '../charts/chart-frame.tsx'
import { type ChartColors, chartColors } from '../charts/colors.ts'
import { layoutPillars } from '../charts/layout/pillars.ts' // 由第 4 组实现

export function PillarsChart({ chart, colors: overrides }: { chart: BaziChart; colors?: Partial<ChartColors> }) {
  const colors = chartColors(overrides) // 页面内为 var(--token)；分享图 / OG 传入解析后的颜色
  const layout = layoutPillars(chart)
  return (
    <ChartFrame name="bazi-pillars" size={layout.size} title={layout.title} description={m.chart_equivalent_hint()}>
      {layout.cells.map((cell) => (
        <ChartBox key={cell.id} box={cell.box} stroke={colors.line} />
      ))}
    </ChartFrame>
  )
}
```

- **外框**：`ChartFrame` 输出 `<svg viewBox>` + width/height 属性 + `aspect-ratio`，宽度随容器缩放、不引起布局位移；
  `role="img"`，`title` 必填（当前语言的图形名称与摘要），`description` 可选，两者经 `aria-labelledby` 关联。
- **等价文字内容**：图形之后保留表格或列表（藏干十神表、宫位列表、`ChartFacts` 等）；图形内文字一律 `<text>`，
  五行同时写文字标签，不只靠颜色区分。图形内若有可交互元素，须可键盘操作并有可见焦点。
- **颜色**：只用 `colors.<槽位>`，源码中不写颜色字面量（`pnpm check:ui` 会拦截）。槽位与 `brand.css` token 一一对应，
  新增颜色需求先在设计稿中提出 token 变更，由协调者写入 `brand.css` 与 `docs/design/visual-system.md`。
- **字体**：`ChartText font="body|heading"` 对应站点字体变量；分享图 / OG 拿到标记后替换 `CHART_FONTS` 的两个值。
- **打印**：外框带 `chart-frame` 类，`chart-print.css` 在 `@media print` 下把外框内的 token 改为 `Canvas` / `CanvasText`，
  并避免跨页拆开。打印配色以设计稿的打印预览为准，可直接在该文件中调整。
- **最小字号**：用 `minViewBoxFont(size, 358, 11)` 求 viewBox 中需要的字号（紫微手机端，design D4）。
- **文案**：通用文案在 `messages/<locale>/chart-common.json`（`chart_sample_badge`、`chart_equivalent_hint`）；
  各图形组用自己的 `chart-bazi.json`、`chart-ziwei.json`、`chart-numerology.json`，`share-card.json` 归第 7 组。

## 分享图与 OG 中的颜色

```ts
// 浏览器（分享图）：以结果区块为上下文解析，再把克隆的 SVG 中的 token 换成实际颜色
const colors = resolveChartColorsIn(svgElement)
const markup = inlineTokenColors(svgElement.outerHTML, colors)

// 构建期（OG）：直接从 brand.css 取颜色，渲染时作为 colors 传入
const colors = brandChartColors('east-light') // 'east-light' | 'east-dark' | 'west'
const markup = renderChartMarkup(<PillarsChart chart={sample} colors={colors} />)
```

分享图模块必须按需 `import()`，并在源码中保留 `SHARE_CARD_MARKER`（`apps/web/scripts/check-home-bundle.mjs`）
的字面量，首页包检查据此确认它不在首页静态闭包里。

## 命令

```sh
# 图形基础与 brand.css 解析的单元测试
pnpm --filter @xuanxue/web exec vitest run --project unit src/features/tools/charts scripts/brand-tokens.test.ts
# 颜色字面量检查
pnpm check:ui
# 预览页（只在本地开发服务器可用）：东方站 http://east.localhost:<WEB_PORT>/zh-hant/dev/charts，西方站 http://west.localhost:<WEB_PORT>/dev/charts
pnpm --filter @xuanxue/web dev
```
