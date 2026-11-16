import type { JSX } from 'react'
import { projectFonts } from '../../share-cards/fonts.ts'
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, titleWeight } from '../../share-cards/layout.tsx'
import type { ShareCardBrand } from '../../share-cards/site.ts'
import { keepsWords, truncateText } from '../../share-cards/text.ts'
import type { ChartColors } from '../../tools/charts/colors.ts'
import { type ChartTextItem, type SplitChart, svgBase64Uri } from './svg-text.ts'

// 样例 OG 图版式（design D6、tasks 8.1），1200×630，satori 子集。
// 左栏沿用默认分享图（features/share-cards/layout.tsx）的品牌行、大标题与「品牌 · 标语」、域名行；
// 右栏为样例命盘卡片，右上角「示例」角标与首页样例命盘区块一致（「首页」画布：surface-2 底、ink-muted 字的胶囊）。
// 颜色全部取自 brand.css 解析出的图形颜色槽（scripts/brand-tokens.ts），本文件不写颜色字面量。

const PAD_X = 64
const PAD_Y = 56
const GAP = 40
const LEFT_WIDTH = 456
const PANEL_WIDTH = SHARE_CARD_WIDTH - PAD_X * 2 - LEFT_WIDTH - GAP
const PANEL_HEIGHT = SHARE_CARD_HEIGHT - PAD_Y * 2
const PANEL_PAD = 28
const BADGE_ROW = 40
const CHART_MAX = {
  width: PANEL_WIDTH - PANEL_PAD * 2,
  height: PANEL_HEIGHT - PANEL_PAD * 2 - BADGE_ROW,
}
const TITLE_SIZE = 56
const TITLE_LEADING = 68
// 居中 / 右对齐文字的定位盒宽度：远大于任何图形文字，satori 在盒内按对齐方式排字
const ANCHOR_SPAN = 1200

const FONT_FAMILY = ['Inter', 'Noto Sans SC', ...new Set(projectFonts.map((font) => font.name))]
  .map((name) => (name.includes(' ') ? `"${name}"` : name))
  .join(', ')

/**
 * 行高等于字号时基线距行顶的比例：Inter（升部 0.969、降部 0.242）约 0.86，
 * Noto Sans SC / KR（升部 1.16、降部 0.288）约 0.94。按文字是否含拉丁以外的字符选用。
 */
function baselineRatio(text: string): number {
  return /[^\u0020-\u024f\u2000-\u206f]/.test(text) ? 0.94 : 0.86
}

export interface OgSampleLayoutContent {
  readonly title: string
  /** 「品牌 · 标语」行 */
  readonly meta: string
  readonly brand: ShareCardBrand
  readonly host: string
  /** 当前语言的「示例」 */
  readonly badge: string
  readonly chart: SplitChart
}

function ChartText({ item, scale }: { item: ChartTextItem; scale: number }) {
  const size = item.size * scale
  const text = item.runs.map((run) => run.text).join('')
  const left = item.x * scale
  const position =
    item.anchor === 'middle'
      ? { left: left - ANCHOR_SPAN / 2, width: ANCHOR_SPAN, justifyContent: 'center' }
      : item.anchor === 'end'
        ? { left: left - ANCHOR_SPAN, width: ANCHOR_SPAN, justifyContent: 'flex-end' }
        : { left }
  return (
    <div
      style={{
        position: 'absolute',
        top: item.y * scale - size * baselineRatio(text),
        display: 'flex',
        alignItems: 'baseline',
        whiteSpace: 'pre',
        fontSize: size,
        lineHeight: 1,
        color: item.color,
        fontWeight: item.weight ?? 400,
        ...position,
      }}
    >
      {item.runs.map((run, index) => (
        <span
          // 同一文字项的分段按顺序排列，内容可能重复
          // biome-ignore lint/suspicious/noArrayIndexKey: 静态版式，顺序即身份
          key={index}
          style={{
            color: run.color ?? item.color,
            fontWeight: run.weight ?? item.weight ?? 400,
            fontSize: run.size === undefined ? size : run.size * scale,
            marginLeft: run.dx ? run.dx * scale : 0,
          }}
        >
          {run.text}
        </span>
      ))}
    </div>
  )
}

function SampleChart({ chart }: { chart: SplitChart }) {
  const scale = Math.min(
    CHART_MAX.width / chart.size.width,
    CHART_MAX.height / chart.size.height,
    // 小图形（数字网格）不放大太多，避免线宽显得过粗
    1.5,
  )
  const width = Math.round(chart.size.width * scale)
  const height = Math.round(chart.size.height * scale)
  return (
    <div style={{ position: 'relative', display: 'flex', width, height }}>
      <img
        src={svgBase64Uri(chart.shapes)}
        width={width}
        height={height}
        alt=""
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      {chart.texts.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 静态版式，顺序即身份
        <ChartText key={index} item={item} scale={scale} />
      ))}
    </div>
  )
}

export function ogSampleLayout(content: OgSampleLayoutContent, colors: ChartColors): JSX.Element {
  const title = truncateText(content.title, {
    maxWidth: 24,
    lineWidth: (LEFT_WIDTH / TITLE_SIZE) * 0.95,
    lines: 3,
  })
  const meta = truncateText(content.meta, { maxWidth: 26, lineWidth: LEFT_WIDTH / 24, lines: 2 })
  const wordBreak = (text: string) => (keepsWords(text) ? { wordBreak: 'keep-all' as const } : {})
  return (
    <div
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        display: 'flex',
        padding: `${PAD_Y}px ${PAD_X}px`,
        gap: GAP,
        background: colors.bg,
        color: colors.ink,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          width: LEFT_WIDTH,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 600,
              background: colors.accent,
              color: colors.onAccent,
            }}
          >
            {content.brand.initial ?? (Array.from(content.brand.name)[0] ?? '').toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 30, lineHeight: '36px', fontWeight: 600 }}>
            {content.brand.name}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'block',
              lineClamp: 3,
              fontSize: TITLE_SIZE,
              lineHeight: `${TITLE_LEADING}px`,
              fontWeight: titleWeight(title),
              letterSpacing: -TITLE_SIZE * 0.01,
              maxHeight: TITLE_LEADING * 3,
              overflow: 'hidden',
              ...wordBreak(title),
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'block',
              fontSize: 24,
              lineHeight: '34px',
              color: colors.inkSubtle,
              ...wordBreak(meta),
            }}
          >
            {meta}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 24,
            borderTop: `1px solid ${colors.line}`,
            fontSize: 24,
            lineHeight: '32px',
            fontWeight: 500,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 9999, background: colors.accent }} />
          <div style={{ display: 'flex' }}>{content.host}</div>
        </div>
      </div>
      <div
        style={{
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          padding: PANEL_PAD,
          borderRadius: 16,
          border: `1px solid ${colors.line}`,
          background: colors.surface,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', height: BADGE_ROW }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 32,
              padding: '0 16px',
              borderRadius: 9999,
              fontSize: 18,
              background: colors.surface2,
              color: colors.inkMuted,
            }}
          >
            {content.badge}
          </div>
        </div>
        <div
          style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <SampleChart chart={content.chart} />
        </div>
      </div>
    </div>
  )
}
