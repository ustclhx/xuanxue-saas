import type { ZiweiChart } from '@xuanxue/bazi/ziwei'
import { m } from '../../../paraglide/messages.js'
import { BRANCH_HANZI, formatDateTime, STEM_HANZI } from '../bazi/glyphs.ts'
import {
  BRIGHTNESS_LABEL,
  CLASS_LABEL,
  label,
  MUTAGEN_LABEL,
  PALACE_LABEL,
  STAR_LABEL,
} from '../bazi/ziwei-labels.ts'
import { ChartBox, ChartFrame, ChartText } from './chart-frame.tsx'
import { type ChartColors, chartColors } from './colors.ts'
import { estimateTextWidth } from './layout/pillars.ts'
import {
  layoutZiwei,
  type ZiweiMetrics,
  type ZiweiPalaceCell,
  type ZiweiVariant,
} from './layout/ziwei.ts'

// 紫微十二宫盘图形（openspec redesign-home-chart-visuals tasks 5.1）：宫内上方列主星（亮度、四化），
// 下方为宫名与宫干支；命宫朱砂粗框并标「命宮」，身宫标「身宮」；中宫只写五行局、排盘时间与命身宫位置，不含姓名。
// 手机与平板为整盘等比缩放的 compact 版（「紫微盘手机版」画布：整盘缩放 + 宫位列表），lg 以上为 wide 版；
// 完整内容见图形下方的宫位列表。

type OkChart = Extract<ZiweiChart, { status: 'ok' }>

function Tag({
  x,
  y,
  text,
  fill,
  color,
  v,
}: {
  x: number
  y: number
  text: string
  fill: string
  color: string
  v: ZiweiMetrics
}) {
  const width = estimateTextWidth(text, v.small) + v.tagPad * 2
  return (
    <>
      <ChartBox
        box={{ x, y: y - v.small, width, height: v.small + v.tagPad + 1 }}
        fill={fill}
        radius={v.tagPad}
      />
      <ChartText x={x + v.tagPad} y={y - 2} color={color} size={v.small}>
        {text}
      </ChartText>
    </>
  )
}

function PalaceCell({
  cell,
  colors,
  v,
}: {
  cell: ZiweiPalaceCell
  colors: ChartColors
  v: ZiweiMetrics
}) {
  const { box, palace, isSoul, isBody } = cell
  const PAD = v.pad
  const STAR = v.star
  const SMALL = v.small
  const left = box.x + PAD
  const bottom = box.y + box.height - PAD
  return (
    <g data-palace={palace.key} data-soul={isSoul || undefined} data-body={isBody || undefined}>
      <ChartBox box={box} fill={colors.surface} stroke={colors.line} />
      {palace.majorStars.length === 0 ? (
        <ChartText x={left} y={box.y + PAD + STAR} color={colors.inkSubtle} size={SMALL}>
          {m.bazi_ziwei_empty()}
        </ChartText>
      ) : (
        palace.majorStars.map((star, index) => {
          const y = box.y + PAD + STAR + index * (STAR + v.lineGap)
          const name = STAR_LABEL[star.star]()
          const brightness = star.brightness ? label(BRIGHTNESS_LABEL, star.brightness) : ''
          const nameWidth = estimateTextWidth(name, STAR)
          const mutagenX =
            left +
            nameWidth +
            (brightness ? estimateTextWidth(brightness, SMALL) + v.tagPad : v.tagPad / 2)
          return (
            <g key={star.star}>
              <ChartText x={left} y={y} color={colors.accentInk} size={STAR} font="heading">
                {name}
                {brightness && (
                  <tspan dx={v.tagPad / 2} style={{ fill: colors.inkSubtle, fontSize: SMALL }}>
                    {brightness}
                  </tspan>
                )}
              </ChartText>
              {star.mutagen && (
                <Tag
                  x={mutagenX}
                  y={y}
                  text={MUTAGEN_LABEL[star.mutagen]()}
                  fill={colors.surface2}
                  color={colors.accentInk}
                  v={v}
                />
              )}
            </g>
          )
        })
      )}
      {(isSoul || isBody) && (
        <g>
          {isSoul && (
            <Tag
              x={left}
              y={bottom - v.name - v.tagPad * 2}
              text={m.bazi_ziwei_soul()}
              fill={colors.accent}
              color={colors.onAccent}
              v={v}
            />
          )}
          {isBody && (
            <Tag
              x={
                isSoul ? left + estimateTextWidth(m.bazi_ziwei_soul(), SMALL) + v.tagPad * 4 : left
              }
              y={bottom - v.name - v.tagPad * 2}
              text={m.bazi_ziwei_body()}
              fill={colors.inverse}
              color={colors.onInverse}
              v={v}
            />
          )}
        </g>
      )}
      <ChartText x={left} y={bottom} color={colors.ink} size={v.name} weight={600}>
        {PALACE_LABEL[palace.key]()}
      </ChartText>
      <ChartText
        x={box.x + box.width - PAD}
        y={bottom}
        color={colors.inkSubtle}
        size={SMALL}
        textAnchor="end"
        font="heading"
      >
        {STEM_HANZI[palace.stem]}
        {BRANCH_HANZI[palace.branch]}
      </ChartText>
    </g>
  )
}

/** 中宫与读屏摘要共用：「水二局 · 命宮在巳 · 身宮在申」 */
export function ziweiCenterText(chart: OkChart): string {
  return m.bazi_ziwei_center({
    class: label(CLASS_LABEL, chart.fiveElementsClass),
    soul: BRANCH_HANZI[chart.soulPalaceBranch],
    body: BRANCH_HANZI[chart.bodyPalaceBranch],
  })
}

/** compact 与 wide 两张图同时输出，按断点只显示一张（隐藏的一张为 display:none，不进入读屏） */
export function ZiweiChartGraphic({
  chart,
  colors,
}: {
  chart: OkChart
  colors?: Partial<ChartColors> | undefined
}) {
  return (
    <>
      <ZiweiBoard chart={chart} colors={colors} variant="compact" className="max-w-3xl lg:hidden" />
      <ZiweiBoard
        chart={chart}
        colors={colors}
        variant="wide"
        className="hidden max-w-4xl lg:block"
      />
    </>
  )
}

export function ZiweiBoard({
  chart,
  colors: overrides,
  variant,
  className,
}: {
  chart: OkChart
  colors?: Partial<ChartColors> | undefined
  variant: ZiweiVariant
  className?: string | undefined
}) {
  const colors = chartColors(overrides)
  const layout = layoutZiwei(chart.palaces, chart.soulPalaceBranch, chart.bodyPalaceBranch, variant)
  const v = layout.metrics
  const soul = layout.cells.find((cell) => cell.isSoul)
  const cx = layout.center.x + layout.center.width / 2
  const cy = layout.center.y + layout.center.height / 2
  const line = v.small * 1.6
  return (
    <ChartFrame
      name="ziwei-palaces"
      size={layout.size}
      title={m.chart_ziwei_title({ center: ziweiCenterText(chart) })}
      description={m.chart_ziwei_equivalent_hint()}
      className={className}
    >
      {layout.cells.map((cell) => (
        <PalaceCell key={cell.palace.key} cell={cell} colors={colors} v={v} />
      ))}
      <ChartBox box={layout.center} fill={colors.surface2} stroke={colors.line} />
      <ChartText
        x={cx}
        y={cy - line}
        color={colors.ink}
        size={v.title}
        font="heading"
        textAnchor="middle"
      >
        {label(CLASS_LABEL, chart.fiveElementsClass)}
      </ChartText>
      <ChartText
        x={cx}
        y={cy + v.small * 0.5}
        color={colors.inkMuted}
        size={v.small}
        textAnchor="middle"
      >
        {formatDateTime(chart.used)}
      </ChartText>
      <ChartText
        x={cx}
        y={cy + v.small * 0.5 + line}
        color={colors.inkMuted}
        size={v.small}
        textAnchor="middle"
      >
        {m.chart_ziwei_center_palaces({
          soul: BRANCH_HANZI[chart.soulPalaceBranch],
          body: BRANCH_HANZI[chart.bodyPalaceBranch],
        })}
      </ChartText>
      {/* 命宫粗框最后绘制，避免被相邻宫位的细线覆盖 */}
      {soul && (
        <ChartBox
          box={{
            x: soul.box.x + v.soulStroke / 2,
            y: soul.box.y + v.soulStroke / 2,
            width: soul.box.width - v.soulStroke,
            height: soul.box.height - v.soulStroke,
          }}
          stroke={colors.accent}
          strokeWidth={v.soulStroke}
        />
      )}
    </ChartFrame>
  )
}
