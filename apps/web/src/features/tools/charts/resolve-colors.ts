import { CHART_COLOR_SLOTS, type ChartColors, TOKEN_COLORS } from './colors.ts'

// 浏览器端颜色解析（openspec redesign-home-chart-visuals tasks 3.2，供分享图使用）：
// SVG 被当作图片栅格化时读不到页面的 CSS 变量，需要先把 `var(--token)` 换成实际颜色。
// 做法：在图形所在的元素内放一个探针，把颜色写进探针的 color，再读 getComputedStyle 的结果；
// 这样 var() 的嵌套引用、.dark / data-site 切换、color-mix 等都由浏览器按当前上下文求值。
// 只在用户点击「保存分享图」时调用，不在渲染路径中使用。

/** 在给定作用域内把一个 CSS 颜色值求值为实际颜色（如 `rgb(31, 28, 24)`）的函数 */
export type ColorProbe = (value: string) => string

/** 以 `scope`（通常是图形外框或结果区块）为上下文创建探针，用完需调用 dispose */
export function domColorProbe(scope: Element): { probe: ColorProbe; dispose: () => void } {
  const doc = scope.ownerDocument
  const view = doc.defaultView
  if (!view) throw new Error('domColorProbe 需要在浏览器文档中调用')
  const probe = doc.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.display = 'none'
  scope.appendChild(probe)
  return {
    probe: (value) => {
      probe.style.color = ''
      probe.style.color = value
      return view.getComputedStyle(probe).color
    },
    dispose: () => probe.remove(),
  }
}

/** 把颜色槽（默认 token）逐个解析为实际颜色；探针可注入，便于在非浏览器环境测试 */
export function resolveChartColors(
  probe: ColorProbe,
  colors: Partial<ChartColors> = TOKEN_COLORS,
): ChartColors {
  const merged = { ...TOKEN_COLORS, ...colors }
  return Object.fromEntries(
    CHART_COLOR_SLOTS.map((slot) => [slot, probe(merged[slot])]),
  ) as ChartColors
}

/** 便捷入口：以 scope 为上下文解析全部颜色槽 */
export function resolveChartColorsIn(scope: Element, colors?: Partial<ChartColors>): ChartColors {
  const { probe, dispose } = domColorProbe(scope)
  try {
    return resolveChartColors(probe, colors)
  } finally {
    dispose()
  }
}

/**
 * 把一段 SVG 标记中的 `var(--token)` 替换为解析后的颜色（克隆节点的 outerHTML、或 renderToStaticMarkup 的输出），
 * 只替换颜色槽对应的 token，其余 var()（如字体）原样保留。
 */
export function inlineTokenColors(markup: string, resolved: ChartColors): string {
  let out = markup
  for (const slot of CHART_COLOR_SLOTS) out = out.replaceAll(TOKEN_COLORS[slot], resolved[slot])
  return out
}
