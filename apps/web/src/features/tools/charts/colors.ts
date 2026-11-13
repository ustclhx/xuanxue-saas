// 图形着色约定（openspec redesign-home-chart-visuals design D3）：图形组件只接收「颜色槽」，
// 默认值是 `var(--token)`，在页面中随 <html data-site> 与 .dark 自动切换；
// 分享图在浏览器内把它们解析为实际颜色（resolve-colors.ts），OG 构建脚本从 brand.css 解析（scripts/brand-tokens.ts）。
// brand.css 是唯一的颜色来源，本模块与图形源码中不出现颜色字面量。

/** 颜色槽 → brand.css 中的 token 名。槽位名与 token 一一对应，具体视觉用哪个槽由设计稿决定 */
export const CHART_TOKENS = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  ink: '--ink',
  inkMuted: '--ink-muted',
  inkSubtle: '--ink-subtle',
  line: '--line',
  lineStrong: '--line-strong',
  accent: '--accent',
  accentInk: '--accent-ink',
  onAccent: '--on-accent',
  inverse: '--inverse',
  onInverse: '--on-inverse',
  wood: '--wx-wood',
  fire: '--wx-fire',
  earth: '--wx-earth',
  metal: '--wx-metal',
  water: '--wx-water',
} as const

export type ChartColorSlot = keyof typeof CHART_TOKENS
/** 每个槽位的颜色值：页面内为 `var(--token)`，分享图与 OG 中为解析后的实际颜色 */
export type ChartColors = Record<ChartColorSlot, string>

/** 五行与颜色槽的对应；五行在图形中必须同时有文字标签，不能只靠颜色区分 */
export const ELEMENT_SLOTS = {
  wood: 'wood',
  fire: 'fire',
  earth: 'earth',
  metal: 'metal',
  water: 'water',
} as const satisfies Record<string, ChartColorSlot>

export const CHART_COLOR_SLOTS = Object.keys(CHART_TOKENS) as ChartColorSlot[]

/** 页面内的默认颜色：全部指向 CSS 变量 */
export const TOKEN_COLORS: ChartColors = Object.fromEntries(
  CHART_COLOR_SLOTS.map((slot) => [slot, `var(${CHART_TOKENS[slot]})`]),
) as ChartColors

/** 合并调用方传入的颜色（分享图、OG 传入解析后的值），未给出的槽位使用 token */
export function chartColors(overrides?: Partial<ChartColors>): ChartColors {
  return { ...TOKEN_COLORS, ...overrides }
}
