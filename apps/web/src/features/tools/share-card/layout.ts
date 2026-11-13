import type { ChartColors } from '../charts/colors.ts'
import type { ShareCardModel, ShareCardOptions, ShareCardPillar } from './model.ts'

// 分享图版式（「分享图」画布 ShareCard.dc.html，540×675 半尺寸预览 → 实际 1080×1350，数值均 ×2）。
// 纯函数：模型 + 颜色 + 文字测量 → 绘制指令列表；不访问浏览器 API，单元测试直接断言输出的文字。
// 绘制由 render.ts 在 Canvas 2D 上执行（design D5 预研结论：文字用 Canvas 绘制，可用页面已加载的网页字体）。
// 出生日期只有 options.includeBirth 为真时才出现在指令中；模型中本就没有姓名与出生地。

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350
const PAD = 72
const INNER = CARD_WIDTH - PAD * 2

export type CardFont = 'heading' | 'body'

export type DrawOp =
  | {
      op: 'rect'
      x: number
      y: number
      width: number
      height: number
      radius?: number
      fill?: string
      stroke?: string
      lineWidth?: number
      dashed?: boolean
    }
  | { op: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { op: 'circle'; cx: number; cy: number; r: number; stroke: string; width: number }
  | {
      op: 'text'
      text: string
      x: number
      y: number
      size: number
      font: CardFont
      weight: number
      color: string
      align: 'left' | 'center' | 'right'
      /** 字距（px），西方站「MY LIFE PATH」 */
      tracking?: number
      /** 标记出生日期，测试与绘制据此识别 */
      role?: 'birth'
    }
  /** 页面图形（紫微盘等）栅格化后放入的区域，保持宽高比居中 */
  | { op: 'chart'; x: number; y: number; width: number; height: number }

/** 文字宽度测量：浏览器中由 Canvas measureText 提供，测试中用估算 */
export type Measure = (text: string, size: number, font: CardFont, weight: number) => number

export interface CardEnv {
  colors: ChartColors
  measure: Measure
  /** 克隆图形的 viewBox 尺寸（body.kind 为 chart 时需要） */
  chartSize?: { width: number; height: number } | undefined
}

// CJK 与韩文按字断行，拉丁文字按词断行
const TOKEN = /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]|[^\sᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-￯]+|\s+/g

/** 按最大宽度断行；超过 maxLines 时截断并以省略号结尾 */
export function wrapText(
  text: string,
  maxWidth: number,
  width: (value: string) => number,
  maxLines = 3,
): string[] {
  const lines: string[] = []
  let current = ''
  for (const token of text.match(TOKEN) ?? []) {
    const next = current + token
    if (current && width(next.trimEnd()) > maxWidth) {
      lines.push(current.trimEnd())
      current = token.trimStart()
    } else {
      current = next
    }
  }
  if (current.trim()) lines.push(current.trimEnd())
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] ?? ''
  while (last && width(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

interface TextStyle {
  size: number
  font: CardFont
  weight: number
  color: string
  lineHeight: number
}

/** 多行文字：返回指令与最后一行基线 */
function paragraph(
  env: CardEnv,
  text: string,
  style: TextStyle,
  x: number,
  firstBaseline: number,
  maxWidth: number,
  align: 'left' | 'center',
  maxLines = 3,
): { ops: DrawOp[]; last: number } {
  const lines = wrapText(
    text,
    maxWidth,
    (value) => env.measure(value, style.size, style.font, style.weight),
    maxLines,
  )
  const ops: DrawOp[] = lines.map((line, index) => ({
    op: 'text',
    text: line,
    x,
    y: firstBaseline + index * style.lineHeight,
    size: style.size,
    font: style.font,
    weight: style.weight,
    color: style.color,
    align,
  }))
  return { ops, last: firstBaseline + Math.max(0, lines.length - 1) * style.lineHeight }
}

/** 页眉：左侧标题、右侧域名（两站相同结构，西方站标题字号更大） */
function header(model: ShareCardModel, env: CardEnv): DrawOp[] {
  const { colors } = env
  const west = model.site === 'west'
  return [
    {
      op: 'text',
      text: model.title,
      x: PAD,
      y: PAD + (west ? 44 : 38),
      size: west ? 48 : 40,
      font: 'heading',
      weight: 700,
      color: colors.ink,
      align: 'left',
    },
    {
      op: 'text',
      text: model.domain,
      x: CARD_WIDTH - PAD,
      y: PAD + (west ? 40 : 34),
      size: 24,
      font: 'body',
      weight: 400,
      color: colors.inkSubtle,
      align: 'right',
    },
  ]
}

/** 页脚（贴底）：分隔线、左侧网址口号、右侧隐私说明，最下方合规声明；返回分隔线的 y */
function footer(
  model: ShareCardModel,
  options: ShareCardOptions,
  env: CardEnv,
): { ops: DrawOp[]; top: number } {
  const { colors } = env
  const disclaimer = wrapText(
    model.disclaimer,
    INNER,
    (value) => env.measure(value, 20, 'body', 400),
    2,
  )
  const lastBaseline = CARD_HEIGHT - PAD
  const firstDisclaimer = lastBaseline - (disclaimer.length - 1) * 30
  const row = firstDisclaimer - 48
  const top = row - 26 - 32
  const ops: DrawOp[] = [
    { op: 'line', x1: PAD, y1: top, x2: CARD_WIDTH - PAD, y2: top, stroke: colors.line, width: 2 },
    {
      op: 'text',
      text: model.cta,
      x: PAD,
      y: row,
      size: 26,
      font: 'body',
      weight: 400,
      color: colors.inkMuted,
      align: 'left',
    },
    {
      op: 'text',
      text: options.includeBirth ? model.privacy.withBirth : model.privacy.withoutBirth,
      x: CARD_WIDTH - PAD,
      y: row,
      size: 24,
      font: 'body',
      weight: 400,
      color: colors.inkSubtle,
      align: 'right',
    },
    ...disclaimer.map(
      (line, index): DrawOp => ({
        op: 'text',
        text: line,
        x: PAD,
        y: firstDisclaimer + index * 30,
        size: 20,
        font: 'body',
        weight: 400,
        color: colors.inkSubtle,
        align: 'left',
      }),
    ),
  ]
  return { ops, top }
}

function birthOp(
  model: ShareCardModel,
  env: CardEnv,
  x: number,
  y: number,
  align: 'left' | 'center',
): DrawOp {
  return {
    op: 'text',
    text: model.birth,
    x,
    y,
    size: 24,
    font: 'body',
    weight: 400,
    color: env.colors.inkSubtle,
    align,
    role: 'birth',
  }
}

/** 东方站结论区：标题、一句结论、可选出生日期（左对齐） */
function eastSummary(
  model: ShareCardModel,
  options: ShareCardOptions,
  env: CardEnv,
  top: number,
): DrawOp[] {
  const { colors } = env
  const headlineY = top + 36
  const ops: DrawOp[] = [
    {
      op: 'text',
      text: model.headline,
      x: PAD,
      y: headlineY,
      size: 36,
      font: 'body',
      weight: 700,
      color: colors.ink,
      align: 'left',
    },
  ]
  let last = headlineY
  if (model.line) {
    const body = paragraph(
      env,
      model.line,
      { size: 28, font: 'body', weight: 400, color: colors.inkMuted, lineHeight: 42 },
      PAD,
      headlineY + 52,
      INNER,
      'left',
      2,
    )
    ops.push(...body.ops)
    last = body.last
  }
  if (options.includeBirth && model.birth) ops.push(birthOp(model, env, PAD, last + 48, 'left'))
  return ops
}

/** 东方站结论区的高度（与 eastSummary 的排布一致），图形区据此留出空间 */
function eastSummaryHeight(model: ShareCardModel, options: ShareCardOptions, env: CardEnv): number {
  const lines = model.line
    ? wrapText(model.line, INNER, (value) => env.measure(value, 28, 'body', 400), 2).length
    : 0
  return (
    36 + (lines > 0 ? 52 + (lines - 1) * 42 : 0) + (options.includeBirth && model.birth ? 48 : 0)
  )
}

/** 一柱的天干或地支格：日柱天干反色；时辰未知时为虚线空格 */
function glyphCell(
  env: CardEnv,
  x: number,
  y: number,
  width: number,
  glyph: string | null,
  reading: string | undefined,
  inverse: boolean,
): DrawOp[] {
  const { colors } = env
  const height = 168
  if (!glyph)
    return [
      {
        op: 'rect',
        x,
        y,
        width,
        height,
        radius: 20,
        stroke: colors.line,
        lineWidth: 2,
        dashed: true,
      },
      {
        op: 'text',
        text: '—',
        x: x + width / 2,
        y: y + height / 2 + 12,
        size: 36,
        font: 'body',
        weight: 400,
        color: colors.inkSubtle,
        align: 'center',
      },
    ]
  const fg = inverse ? colors.onInverse : colors.ink
  const ops: DrawOp[] = [
    {
      op: 'rect',
      x,
      y,
      width,
      height,
      radius: 20,
      fill: inverse ? colors.inverse : colors.surface2,
    },
    {
      op: 'text',
      text: glyph,
      x: x + width / 2,
      // 有韩文读音时字形上移，读音写在格内下方
      y: y + (reading ? 104 : 112),
      size: 80,
      font: 'heading',
      weight: 500,
      color: fg,
      align: 'center',
    },
  ]
  if (reading)
    ops.push({
      op: 'text',
      text: reading,
      x: x + width / 2,
      y: y + 146,
      size: 26,
      font: 'body',
      weight: 400,
      color: inverse ? colors.onInverse : colors.inkMuted,
      align: 'center',
    })
  return ops
}

function pillarsBody(
  pillars: ShareCardPillar[],
  env: CardEnv,
  top: number,
): { ops: DrawOp[]; bottom: number } {
  const gap = 20
  const columns = Math.max(1, pillars.length)
  const width = (INNER - gap * (columns - 1)) / columns
  const ops: DrawOp[] = []
  pillars.forEach((pillar, index) => {
    const x = PAD + index * (width + gap)
    ops.push({
      op: 'text',
      text: pillar.label,
      x: x + width / 2,
      y: top + 24,
      size: 24,
      font: 'body',
      weight: 400,
      color: env.colors.inkSubtle,
      align: 'center',
    })
    ops.push(...glyphCell(env, x, top + 40, width, pillar.stem, pillar.stemReading, pillar.day))
    ops.push(...glyphCell(env, x, top + 224, width, pillar.branch, pillar.branchReading, false))
  })
  return { ops, bottom: top + 392 }
}

/** 西方站生命灵数：居中的星金圆环与大号数字、主题词、一句摘要 */
function lifePathBody(
  model: ShareCardModel,
  value: number,
  master: string | null,
  options: ShareCardOptions,
  env: CardEnv,
): DrawOp[] {
  const { colors } = env
  const cx = CARD_WIDTH / 2
  const ops: DrawOp[] = []
  const eyebrowY = 204
  if (model.eyebrow)
    ops.push({
      op: 'text',
      text: model.eyebrow.toLocaleUpperCase(),
      x: cx,
      y: eyebrowY,
      size: 28,
      font: 'body',
      weight: 400,
      color: colors.inkSubtle,
      align: 'center',
      tracking: 3.4,
    })
  const cy = eyebrowY + 56 + 200
  ops.push({ op: 'circle', cx, cy, r: 200, stroke: colors.accent, width: 4 })
  ops.push({
    op: 'text',
    text: String(value),
    x: cx,
    y: cy + (value >= 10 ? 72 : 84),
    size: value >= 10 ? 200 : 240,
    font: 'heading',
    weight: 600,
    color: colors.accent,
    align: 'center',
  })
  let y = cy + 200
  if (master) {
    ops.push({
      op: 'text',
      text: master,
      x: cx,
      y: y + 48,
      size: 26,
      font: 'body',
      weight: 600,
      color: colors.accent,
      align: 'center',
    })
    y += 48
  }
  const headlineY = y + 56 + 52
  ops.push({
    op: 'text',
    text: model.headline,
    x: cx,
    y: headlineY,
    size: 64,
    font: 'heading',
    weight: 700,
    color: colors.ink,
    align: 'center',
  })
  const body = paragraph(
    env,
    model.line,
    { size: 30, font: 'body', weight: 400, color: colors.inkMuted, lineHeight: 46 },
    cx,
    headlineY + 64,
    860,
    'center',
    3,
  )
  ops.push(...body.ops)
  if (options.includeBirth && model.birth)
    ops.push(birthOp(model, env, cx, body.last + 52, 'center'))
  return ops
}

/** 完整版式：底色、页眉、主体、页脚 */
export function layoutShareCard(
  model: ShareCardModel,
  options: ShareCardOptions,
  env: CardEnv,
): DrawOp[] {
  const { colors } = env
  const ops: DrawOp[] = [
    { op: 'rect', x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT, fill: colors.bg },
    ...header(model, env),
  ]
  const foot = footer(model, options, env)
  const top = PAD + 88
  const { body } = model
  if (body.kind === 'pillars') {
    const pillars = pillarsBody(body.pillars, env, top)
    ops.push(...pillars.ops, ...eastSummary(model, options, env, pillars.bottom + 28))
  } else if (body.kind === 'life-path') {
    ops.push(...lifePathBody(model, body.value, body.master, options, env))
  } else {
    // 图形区：页眉与结论区之间的剩余空间，按图形宽高比缩放并水平居中
    const summary = eastSummaryHeight(model, options, env)
    const available = foot.top - 48 - summary - 40 - top
    const size = env.chartSize ?? { width: INNER, height: available }
    const scale = Math.min(INNER / size.width, available / size.height)
    const width = size.width * scale
    const height = size.height * scale
    ops.push({ op: 'chart', x: PAD + (INNER - width) / 2, y: top, width, height })
    ops.push(...eastSummary(model, options, env, top + height + 40))
  }
  ops.push(...foot.ops)
  return ops
}
