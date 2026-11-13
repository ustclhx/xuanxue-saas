import type { Branch, PillarKey, Pillars, Stem } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { BRANCH_HANGUL, ganzhi, STEM_HANGUL, STEM_HANZI } from '../bazi/glyphs.ts'
import { ELEMENT_LABEL, PILLAR_LABEL, TEN_GOD_LABEL } from '../bazi/labels.ts'
import { ChartBox, ChartFrame, ChartText } from './chart-frame.tsx'
import { type ChartColors, chartColors, ELEMENT_SLOTS } from './colors.ts'
import { estimateTextWidth, type GlyphCell, layoutPillars, PILLAR_ORDER } from './layout/pillars.ts'

// 四柱命盘图形（openspec redesign-home-chart-visuals tasks 4.1，「命盘图形」画布 ① 四柱命盤）。
// 天干地支格底色为 surface-2，日柱反色并在十神行写「日主」；每个字下方写五行名并配五行色圆点，
// 颜色只作辅助。等价文字内容为页面中随后的藏干十神表（HiddenStemsTable）或命盘表格。

export type PillarsLocale = 'zh-Hant' | 'zh-Hans' | 'ko'

const DOT = 6
const LABEL_SIZE = 22

function GlyphBox({
  cell,
  isDay,
  reading,
  colors,
}: {
  cell: GlyphCell
  isDay: boolean
  /** 韩语页在五行名前加韩文读音，如「경 · 금」 */
  reading: string | null
  colors: ChartColors
}) {
  const { box } = cell
  const fg = isDay ? colors.onInverse : colors.ink
  const label = reading
    ? `${reading} · ${ELEMENT_LABEL[cell.element]()}`
    : ELEMENT_LABEL[cell.element]()
  const cx = box.x + box.width / 2
  const groupWidth = DOT * 2 + 8 + estimateTextWidth(label, LABEL_SIZE)
  const start = cx - groupWidth / 2
  const labelY = box.y + box.height - 24
  return (
    <>
      <ChartBox
        box={box}
        fill={isDay ? colors.inverse : colors.surface2}
        stroke={isDay ? colors.inverse : colors.line}
        radius={14}
      />
      <ChartText
        x={cx}
        y={box.y + 76}
        color={fg}
        size={60}
        font="heading"
        textAnchor="middle"
        data-glyph={cell.key}
      >
        {cell.glyph}
      </ChartText>
      <circle
        cx={start + DOT}
        cy={labelY - LABEL_SIZE * 0.36}
        r={DOT}
        style={{ fill: colors[ELEMENT_SLOTS[cell.element]] }}
      />
      <ChartText x={start + DOT * 2 + 8} y={labelY} color={fg} size={LABEL_SIZE}>
        {label}
      </ChartText>
    </>
  )
}

/** 读屏用的四柱摘要：「年柱 庚午、月柱 辛巳、日柱 庚辰、時柱 辛巳」 */
export function pillarsSummary(pillars: Pillars, order: readonly PillarKey[]): string {
  return order
    .map((key) => {
      const pillar = pillars[key]
      const value = pillar ? ganzhi(pillar.stem, pillar.branch) : m.bazi_requires_hour()
      return `${PILLAR_LABEL[key]()} ${value}`
    })
    .join(m.chart_bazi_list_separator())
}

export function PillarsChart({
  pillars,
  locale,
  order,
  colors: overrides,
  className,
}: {
  pillars: Pillars
  locale: PillarsLocale
  /** 默认按语言：繁简年月日時、韩语시일월연 */
  order?: readonly PillarKey[]
  colors?: Partial<ChartColors>
  className?: string
}) {
  const colors = chartColors(overrides)
  const ko = locale === 'ko'
  const keys = order ?? (ko ? PILLAR_ORDER.korean : PILLAR_ORDER.chinese)
  const layout = layoutPillars(pillars, keys)
  const { rows } = layout
  const dayMaster = pillars.day
  const rowLabel = (text: string, row: keyof typeof rows) => (
    <ChartText
      x={layout.labelX}
      y={rows[row].baseline}
      color={colors.inkSubtle}
      size={LABEL_SIZE}
      textAnchor="end"
    >
      {text}
    </ChartText>
  )
  return (
    <ChartFrame
      name="bazi-pillars"
      size={layout.size}
      title={m.chart_bazi_pillars_title({
        pillars: pillarsSummary(pillars, keys),
        dayMaster: STEM_HANZI[dayMaster.stem],
      })}
      description={m.chart_equivalent_hint()}
      className={['max-w-2xl', className].filter(Boolean).join(' ')}
    >
      {rowLabel(m.bazi_ten_gods(), 'tenGod')}
      {rowLabel(m.bazi_stem_row(), 'stem')}
      {rowLabel(m.bazi_branch_row(), 'branch')}
      {rowLabel(m.bazi_hidden_stems(), 'hidden')}
      {layout.columns.map((column) => (
        <g key={column.key} data-pillar={column.key} data-day-master={column.isDay || undefined}>
          <ChartText
            x={column.x}
            y={rows.header.baseline}
            color={column.isDay ? colors.ink : colors.inkSubtle}
            size={24}
            weight={column.isDay ? 600 : undefined}
            textAnchor="middle"
          >
            {PILLAR_LABEL[column.key]()}
          </ChartText>
          <ChartText
            x={column.x}
            y={rows.tenGod.baseline}
            color={column.isDay ? colors.accentInk : colors.inkMuted}
            size={24}
            weight={column.isDay ? 600 : undefined}
            textAnchor="middle"
          >
            {column.tenGod === 'dayMaster'
              ? m.bazi_day_master()
              : column.tenGod
                ? TEN_GOD_LABEL[column.tenGod]()
                : '—'}
          </ChartText>
          {column.stem && (
            <GlyphBox
              cell={column.stem}
              isDay={column.isDay}
              reading={ko ? STEM_HANGUL[column.stem.key as Stem] : null}
              colors={colors}
            />
          )}
          {column.branch && (
            <GlyphBox
              cell={column.branch}
              isDay={false}
              reading={ko ? BRANCH_HANGUL[column.branch.key as Branch] : null}
              colors={colors}
            />
          )}
          {column.placeholder && (
            <>
              <ChartBox
                box={column.placeholder}
                stroke={colors.lineStrong}
                strokeWidth={2}
                radius={14}
                dashed
              />
              <RequiresHour
                x={column.x}
                y={column.placeholder.y + column.placeholder.height / 2}
                width={column.placeholder.width}
                colors={colors}
              />
            </>
          )}
          <ChartText
            x={column.x}
            y={rows.hidden.baseline}
            color={colors.inkMuted}
            size={LABEL_SIZE}
            font="heading"
            textAnchor="middle"
          >
            {column.hidden.length ? column.hidden.join(' ') : '—'}
          </ChartText>
        </g>
      ))}
    </ChartFrame>
  )
}

/** 时辰未知：在合并的占位框中竖排写「需要出生時辰」，不绘制虚构的干支 */
function RequiresHour({
  x,
  y,
  width,
  colors,
}: {
  x: number
  y: number
  width: number
  colors: ChartColors
}) {
  const text = m.bazi_requires_hour()
  const size = LABEL_SIZE
  const fits = estimateTextWidth(text, size) <= width - 16
  // 放不下一行时拆成两行：有空格（韩文）按最接近中间的空格断开，否则按字数对半（中文不需要断词）
  const chars = [...text]
  const spaces = chars.flatMap((char, index) => (char === ' ' ? [index] : []))
  const half = Math.ceil(chars.length / 2)
  const cut = spaces.length
    ? spaces.reduce((best, index) =>
        Math.abs(index - half) < Math.abs(best - half) ? index : best,
      )
    : half
  const lines = fits ? [text] : [chars.slice(0, cut).join(''), chars.slice(cut).join('')]
  return (
    <ChartText
      x={x}
      y={y - ((lines.length - 1) * size * 1.4) / 2}
      color={colors.inkSubtle}
      size={size}
      textAnchor="middle"
    >
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? size * 0.36 : size * 1.4}>
          {line.trim()}
        </tspan>
      ))}
    </ChartText>
  )
}
