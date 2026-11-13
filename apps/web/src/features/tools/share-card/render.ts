import { resolveChartColorsIn } from '../charts/resolve-colors.ts'
import { type ChartFonts, prepareChartMarkup, viewBoxSize } from './chart-markup.ts'
import { CARD_HEIGHT, CARD_WIDTH, type CardFont, type DrawOp, layoutShareCard } from './layout.ts'
import type { ShareCardModel, ShareCardOptions } from './model.ts'

// 分享图生成（openspec redesign-home-chart-visuals design D5、tasks 7.2）：只在访客点击「保存分享图」后
// 经 import() 加载（结果出现后空闲时预取，便于离线生成），全部在浏览器本地完成，不发出携带结果或输入的请求。
// 7.1 预研结论：卡片文字用 Canvas 2D 绘制，可使用页面已加载的网页字体（东方站 Noto Serif TC / KR、
// 西方站 Cormorant Garamond），与设计稿一致；页面图形（紫微盘）克隆为 SVG，经 Image → Canvas 栅格化，
// 图中文字按字体栈回退到系统字体。

/**
 * 首页包检查的特征字符串（apps/web/scripts/check-home-bundle.mjs 的 SHARE_CARD_MARKER）：
 * 本模块须保留这一字面量，压缩后仍在产物中，检查据此确认分享图代码不在首页静态闭包里。
 */
export const SHARE_CARD_MARKER = 'xuanxue-share-card'

const FONT_WAIT_MS = 1500

function fail(reason: string): Error {
  return new Error(`${SHARE_CARD_MARKER}: ${reason}`)
}

/** 当前页面（含 data-site、.dark、:lang(ko)）下的站点字体栈 */
function siteFonts(scope: Element): ChartFonts {
  const style = getComputedStyle(scope)
  return {
    heading: style.getPropertyValue('--site-font-heading').trim() || 'serif',
    body: style.getPropertyValue('--site-font-body').trim() || 'sans-serif',
  }
}

/**
 * 等待卡片文字需要的网页字体分片加载（字体文件请求不含任何输入）；离线或超时时直接用回退字体，
 * 不影响生成。
 */
async function waitForFonts(fonts: ChartFonts, texts: Record<CardFont, string>): Promise<void> {
  if (!document.fonts?.load) return
  const loads = (['heading', 'body'] as const).map((font) =>
    document.fonts.load(`700 40px ${fonts[font]}`, texts[font] || 'A').catch(() => []),
  )
  await Promise.race([
    Promise.all(loads),
    new Promise((resolve) => window.setTimeout(resolve, FONT_WAIT_MS)),
  ])
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(fail('chart image failed to load'))
    image.src = url
  })
}

/** 克隆页面中已渲染的图形，整理为独立 SVG 后栅格化 */
async function chartImage(
  source: SVGSVGElement,
  options: Parameters<typeof prepareChartMarkup>[1],
): Promise<HTMLImageElement> {
  const markup = prepareChartMarkup(new XMLSerializer().serializeToString(source), options)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    return await loadImage(url)
  } finally {
    // 图片已解码，释放 blob URL
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, op: Extract<DrawOp, { op: 'rect' }>) {
  const r = Math.min(op.radius ?? 0, op.width / 2, op.height / 2)
  ctx.beginPath()
  ctx.moveTo(op.x + r, op.y)
  ctx.arcTo(op.x + op.width, op.y, op.x + op.width, op.y + op.height, r)
  ctx.arcTo(op.x + op.width, op.y + op.height, op.x, op.y + op.height, r)
  ctx.arcTo(op.x, op.y + op.height, op.x, op.y, r)
  ctx.arcTo(op.x, op.y, op.x + op.width, op.y, r)
  ctx.closePath()
}

function fontSpec(fonts: ChartFonts, font: CardFont, size: number, weight: number): string {
  return `${weight} ${size}px ${fonts[font]}`
}

function drawText(
  ctx: CanvasRenderingContext2D,
  fonts: ChartFonts,
  op: Extract<DrawOp, { op: 'text' }>,
) {
  ctx.font = fontSpec(fonts, op.font, op.size, op.weight)
  ctx.fillStyle = op.color
  ctx.textBaseline = 'alphabetic'
  if (!op.tracking) {
    ctx.textAlign = op.align
    ctx.fillText(op.text, op.x, op.y)
    return
  }
  // 带字距的文字逐字绘制（Canvas letterSpacing 在部分浏览器不可用）
  const chars = [...op.text]
  const widths = chars.map((char) => ctx.measureText(char).width)
  const total = widths.reduce((sum, w) => sum + w, 0) + op.tracking * (chars.length - 1)
  let x = op.align === 'center' ? op.x - total / 2 : op.align === 'right' ? op.x - total : op.x
  ctx.textAlign = 'left'
  chars.forEach((char, index) => {
    ctx.fillText(char, x, op.y)
    x += (widths[index] ?? 0) + (op.tracking ?? 0)
  })
}

/**
 * 生成 1080×1350 PNG。`scope` 为结果区域内的元素（用于解析颜色与字体、查找要克隆的图形）。
 * 任一步失败抛出错误，由调用方显示失败提示与重试。
 */
export async function generateShareCard(
  model: ShareCardModel,
  options: ShareCardOptions,
  scope: Element,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw fail('canvas 2d context unavailable')
  const colors = resolveChartColorsIn(scope)
  const fonts = siteFonts(scope)

  let source: SVGSVGElement | null = null
  if (model.body.kind === 'chart') {
    // 页面同时输出手机与桌面两种版式（按断点只显示一张），取第一张（手机版式字号更大，适合竖版图）
    source = scope.ownerDocument.querySelector<SVGSVGElement>(
      `svg[data-chart="${model.body.chart}"]`,
    )
    if (!source) throw fail('chart not found')
  }
  const chartSize = source ? viewBoxSize(source.outerHTML) : undefined

  const measure = (text: string, size: number, font: CardFont, weight: number) => {
    ctx.font = fontSpec(fonts, font, size, weight)
    return ctx.measureText(text).width
  }
  const draft = layoutShareCard(model, options, {
    colors,
    measure,
    chartSize: chartSize ?? undefined,
  })
  const texts: Record<CardFont, string> = { heading: '', body: '' }
  for (const op of draft) if (op.op === 'text') texts[op.font] += op.text
  await waitForFonts(fonts, texts)
  // 字体加载后宽度可能变化，重新排版
  const ops = layoutShareCard(model, options, {
    colors,
    measure,
    chartSize: chartSize ?? undefined,
  })

  for (const op of ops) {
    if (op.op === 'rect') {
      roundRect(ctx, op)
      if (op.fill) {
        ctx.fillStyle = op.fill
        ctx.fill()
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke
        ctx.lineWidth = op.lineWidth ?? 1
        ctx.setLineDash(op.dashed ? [12, 9] : [])
        ctx.stroke()
        ctx.setLineDash([])
      }
    } else if (op.op === 'line') {
      ctx.beginPath()
      ctx.moveTo(op.x1, op.y1)
      ctx.lineTo(op.x2, op.y2)
      ctx.strokeStyle = op.stroke
      ctx.lineWidth = op.width
      ctx.stroke()
    } else if (op.op === 'circle') {
      ctx.beginPath()
      ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2)
      ctx.strokeStyle = op.stroke
      ctx.lineWidth = op.width
      ctx.stroke()
    } else if (op.op === 'text') {
      drawText(ctx, fonts, op)
    } else if (op.op === 'chart' && source) {
      // 按 2 倍目标尺寸栅格化，缩放绘制时保持清晰
      const image = await chartImage(source, {
        colors,
        fonts,
        includeBirth: options.includeBirth,
        width: Math.round(op.width * 2),
        height: Math.round(op.height * 2),
      })
      ctx.drawImage(image, op.x, op.y, op.width, op.height)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch {
      // 画布被污染或不支持导出
      resolve(null)
    }
  })
  if (!blob) throw fail('canvas export failed')
  return blob
}
