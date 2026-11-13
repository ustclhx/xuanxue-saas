import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CHART_COLOR_SLOTS,
  CHART_TOKENS,
  type ChartColors,
} from '../src/features/tools/charts/colors.ts'

// 构建期 brand.css 颜色解析（openspec redesign-home-chart-visuals tasks 3.2，供 og-images.ts 的样例图形使用）：
// OG 由 satori / resvg 在构建期渲染，读不到 CSS 变量，因此从 brand.css 本身解析各主题下的 token 实际值，
// 再映射到图形颜色槽，保证 OG、页面与分享图的颜色只有 brand.css 一个来源。
// 只解析本文件用到的几个选择器块；var() 引用递归展开，无法静态求值的值（如 color-mix）原样返回。

export const BRAND_CSS_PATH = fileURLToPath(new URL('../src/styles/brand.css', import.meta.url))

/** 需要渲染的主题：东方站浅色 / 深色，西方站（固定深色） */
export type BrandTheme = 'east-light' | 'east-dark' | 'west'

// 每个主题按顺序叠加的选择器块，后者覆盖前者，与浏览器中的层叠一致
const THEME_SELECTORS: Record<BrandTheme, string[]> = {
  'east-light': [':root[data-site]', ':root[data-site="east"]'],
  'east-dark': [':root[data-site]', ':root[data-site="east"]', ':root.dark[data-site="east"]'],
  west: [':root[data-site]', ':root[data-site="west"]'],
}

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 收集每个选择器（含逗号分隔的组合）中的自定义属性声明；同一选择器出现多次时按出现顺序合并 */
export function parseCustomProperties(css: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>()
  for (const [, selectorText = '', body = ''] of stripComments(css).matchAll(
    /([^{}@]+)\{([^{}]*)\}/g,
  )) {
    const declarations = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    if (declarations.length === 0) continue
    for (const selector of selectorText
      .split(',')
      .map((part) => part.trim().replace(/\s+/g, ' '))) {
      const map = blocks.get(selector) ?? new Map<string, string>()
      for (const [, name = '', value = ''] of declarations) map.set(name, value.trim())
      blocks.set(selector, map)
    }
  }
  return blocks
}

/** 某个主题下全部自定义属性的最终值（var() 已展开） */
export function themeProperties(css: string, theme: BrandTheme): Map<string, string> {
  const blocks = parseCustomProperties(css)
  const merged = new Map<string, string>()
  for (const selector of THEME_SELECTORS[theme]) {
    for (const [name, value] of blocks.get(selector) ?? []) merged.set(name, value)
  }
  const resolve = (value: string, depth: number): string =>
    depth > 10
      ? value
      : value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (match, name: string, fallback) => {
          const next = merged.get(name) ?? fallback
          return next === undefined ? match : resolve(next.trim(), depth + 1)
        })
  return new Map([...merged].map(([name, value]) => [name, resolve(value, 0)]))
}

/** 图形颜色槽在某主题下的实际颜色（小写十六进制，与 brand.css 书写一致） */
export function brandChartColors(theme: BrandTheme, css = readBrandCss()): ChartColors {
  const properties = themeProperties(css, theme)
  return Object.fromEntries(
    CHART_COLOR_SLOTS.map((slot) => {
      const value = properties.get(CHART_TOKENS[slot])
      if (!value) throw new Error(`brand.css 在 ${theme} 主题下缺少 ${CHART_TOKENS[slot]}`)
      return [slot, value]
    }),
  ) as ChartColors
}

export function readBrandCss(): string {
  return readFileSync(BRAND_CSS_PATH, 'utf8')
}
