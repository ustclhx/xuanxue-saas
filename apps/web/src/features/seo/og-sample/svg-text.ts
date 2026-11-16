// 把图形组件的静态 SVG 标记拆成「只有线框与色块的 SVG」+「文字列表」（design D6 回退方案）。
// 构建期 OG 由 satori 排版、resvg 栅格化：satori 把 <img> 中的 SVG 原样交给 resvg，而 resvg 没有加载字体，
// 嵌入 SVG 里的 <text>（中韩文与拉丁字母都一样）不会绘制（tasks 8.1 预研，2026-11-16）。
// 因此 SVG 只保留线框与色块作为图片，文字按原坐标交给 satori 在外层绘制，使用分享图已登记的字体。
// 只解析 React renderToStaticMarkup 的输出格式（双引号属性、style 为 `name:value;` 串）。

export interface ChartTextRun {
  readonly text: string
  /** 与所在文字项不同时才给出 */
  readonly color?: string | undefined
  readonly weight?: number | undefined
  readonly size?: number | undefined
  /** viewBox 坐标中的水平偏移（tspan dx） */
  readonly dx?: number | undefined
}

export interface ChartTextItem {
  /** viewBox 坐标中的锚点与基线 */
  readonly x: number
  readonly y: number
  readonly anchor: 'start' | 'middle' | 'end'
  readonly size: number
  readonly color: string
  readonly weight?: number | undefined
  readonly runs: readonly ChartTextRun[]
}

export interface SplitChart {
  readonly size: { readonly width: number; readonly height: number }
  /** 去掉文字、读屏标题与页面类名后的 SVG 标记 */
  readonly shapes: string
  readonly texts: readonly ChartTextItem[]
}

const ATTR = /([\w:-]+)="([^"]*)"/g
const TEXT = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
const TSPAN = /<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g
const A11Y = /<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g
const ROOT_PAGE_ATTRS = /\s(?:class|style|role|aria-labelledby|data-chart)="[^"]*"/g

function attrs(source: string): Map<string, string> {
  return new Map([...source.matchAll(ATTR)].map(([, name = '', value = '']) => [name, value]))
}

function style(source: string | undefined): Map<string, string> {
  const result = new Map<string, string>()
  for (const part of (source ?? '').split(';')) {
    const index = part.indexOf(':')
    if (index > 0) result.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  return result
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
}

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity)
}

const num = (value: string | undefined) => {
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const anchorOf = (value: string | undefined): ChartTextItem['anchor'] =>
  value === 'middle' || value === 'end' ? value : 'start'

function parseText(attrSource: string, inner: string): ChartTextItem[] {
  const element = attrs(attrSource)
  const css = style(element.get('style'))
  const base = {
    x: num(element.get('x')) ?? 0,
    y: num(element.get('y')) ?? 0,
    anchor: anchorOf(element.get('text-anchor')),
    size: num(css.get('font-size')) ?? 16,
    color: css.get('fill') ?? '',
    weight: num(css.get('font-weight')),
  }
  const items: ChartTextItem[] = []
  let current: { x: number; y: number; runs: ChartTextRun[] } = { x: base.x, y: base.y, runs: [] }
  let y = base.y
  const flush = () => {
    if (current.runs.some((run) => run.text.trim())) items.push({ ...base, ...current })
  }
  let cursor = 0
  for (const match of inner.matchAll(TSPAN)) {
    const before = decode(inner.slice(cursor, match.index))
    if (before) current.runs.push({ text: before })
    cursor = (match.index ?? 0) + match[0].length
    const span = attrs(match[1] ?? '')
    const spanCss = style(span.get('style'))
    y += num(span.get('dy')) ?? 0
    const x = num(span.get('x'))
    // 带 x 的 tspan 是新起一行（如「需要出生時辰」两行排列）
    if (x !== undefined) {
      flush()
      current = { x, y, runs: [] }
    }
    current.runs.push({
      text: decode(match[2] ?? ''),
      color: spanCss.get('fill'),
      weight: num(spanCss.get('font-weight')),
      size: num(spanCss.get('font-size')),
      dx: num(span.get('dx')),
    })
  }
  const rest = decode(inner.slice(cursor))
  if (rest) current.runs.push({ text: rest })
  flush()
  return items
}

export function splitChartText(markup: string): SplitChart {
  const open = markup.match(/^\s*<svg\b[^>]*>/)
  if (!open) throw new Error('og-sample: chart markup is not an svg element')
  const root = attrs(open[0])
  const box = (root.get('viewBox') ?? '').split(/\s+/).map(Number)
  const width = box[2]
  const height = box[3]
  if (!width || !height) throw new Error('og-sample: chart markup has no viewBox size')
  const texts: ChartTextItem[] = []
  const body = markup
    .slice(open[0].length)
    .replace(A11Y, '')
    .replace(TEXT, (_, attrSource: string, inner: string) => {
      texts.push(...parseText(attrSource, inner))
      return ''
    })
  return {
    size: { width, height },
    shapes: open[0].replace(ROOT_PAGE_ATTRS, '') + body,
    texts,
  }
}

/** base64 data URI：satori 处理百分号编码的 SVG data URI 时会对非 Latin-1 字符报错 */
export function svgBase64Uri(markup: string): string {
  const bytes = new TextEncoder().encode(markup)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:image/svg+xml;base64,${btoa(binary)}`
}
