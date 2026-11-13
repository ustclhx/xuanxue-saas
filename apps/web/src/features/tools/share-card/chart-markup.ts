import type { ChartColors } from '../charts/colors.ts'
import { inlineTokenColors } from '../charts/resolve-colors.ts'

// 把页面中克隆出的图形 SVG（XMLSerializer 输出）整理成可独立栅格化的 SVG（design D5）：
// - SVG 作为图片时读不到页面 CSS 变量与网页字体：颜色 token 换成解析后的实际颜色，字体变量换成字体栈
//   （网页字体在图片中不可用，按字体栈回退到系统字体；7.1 预研确认中韩文字形正常）；
// - 未勾选「显示出生日期」时移除带 data-birth 的文字（紫微盘中宫的出生时间）；
// - 去掉页面专用的 class / style / 读屏标题，按目标像素尺寸设置 width / height。
// 纯字符串处理，单元测试可直接用服务端渲染的图形标记验证。

export interface ChartFonts {
  heading: string
  body: string
}

export interface PrepareChartOptions {
  colors: ChartColors
  fonts: ChartFonts
  includeBirth: boolean
  width: number
  height: number
}

const BIRTH_TEXT = /<text\b[^>]*\bdata-birth=(?:"[^"]*"|'[^']*')[^>]*>[\s\S]*?<\/text>/g
const A11Y_TEXT = /<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g
const ROOT_PAGE_ATTRS = /\s(?:class|style|width|height|role|aria-labelledby)=(?:"[^"]*"|'[^']*')/g

/** 字体栈放进以双引号分隔的 style 属性，栈内的引号改为单引号 */
function attrSafe(stack: string): string {
  return stack.replaceAll('"', "'").replaceAll('&', '&amp;').replaceAll('<', '&lt;')
}

export function prepareChartMarkup(markup: string, options: PrepareChartOptions): string {
  const open = markup.match(/^\s*<svg\b[^>]*>/)
  if (!open) throw new Error('xuanxue-share-card: chart markup is not an svg element')
  let root = open[0].replace(ROOT_PAGE_ATTRS, '')
  if (!/\sxmlns=/.test(root)) root = root.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  root = root.replace(/\s*\/?>$/, ` width="${options.width}" height="${options.height}">`)
  let inner = markup.slice(open[0].length).replace(A11Y_TEXT, '')
  if (!options.includeBirth) inner = inner.replace(BIRTH_TEXT, '')
  inner = inlineTokenColors(inner, options.colors)
    .replaceAll('var(--site-font-heading)', attrSafe(options.fonts.heading))
    .replaceAll('var(--site-font-body)', attrSafe(options.fonts.body))
  return root + inner
}

/** 读取 viewBox 的宽高（克隆图形的固有宽高比） */
export function viewBoxSize(markup: string): { width: number; height: number } | null {
  const match = markup.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/)
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}
