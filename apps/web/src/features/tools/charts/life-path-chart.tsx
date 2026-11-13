import type { BirthDate, NumberResult } from '@xuanxue/numerology'
import { m } from '../../../paraglide/messages.js'
import { ChartBox, ChartFrame, ChartText } from './chart-frame.tsx'
import { type ChartColors, chartColors } from './colors.ts'
import { layoutLifePath, partChain, totalText } from './layout/life-path.ts'
import { estimateTextWidth } from './layout/pillars.ts'

// 生命灵数推导图形（openspec redesign-home-chart-visuals tasks 6.1）：月、日、年三格逐步归约，
// 下排相加并以星金圆圈标出最终数字；大师数在格内或圆圈下写「保留 / Master number」。
// 等价文字内容为同卡片中的算式行（LifePathSteps）。

const PHASE_LABEL = {
  month: m.numerology_step_month,
  day: m.numerology_step_day,
  year: m.numerology_step_year,
} as const

export function LifePathChart({
  result,
  date,
  colors: overrides,
  className,
}: {
  result: NumberResult
  date: BirthDate
  colors?: Partial<ChartColors> | undefined
  className?: string | undefined
}) {
  const colors = chartColors(overrides)
  const layout = layoutLifePath(result, date)
  const { circle, total } = layout
  const formula = totalText(total)
  return (
    <ChartFrame
      name="life-path-reduction"
      size={layout.size}
      title={m.chart_numerology_reduction_title({
        steps: [
          ...layout.parts.map((part) => `${PHASE_LABEL[part.phase]()} ${partChain(part)}`),
          `${formula} ${total.value}`,
        ].join('; '),
        value: total.value,
      })}
      className={['max-w-xl', className].filter(Boolean).join(' ')}
    >
      {layout.parts.map((part) => {
        const cx = part.box.x + part.box.width / 2
        const chain = partChain(part)
        const lead = chain.slice(0, chain.length - String(part.value).length)
        const leadWidth = estimateTextWidth(lead, layout.chainSize)
        const valueWidth = estimateTextWidth(String(part.value), layout.chainSize)
        const start = cx - (leadWidth + valueWidth) / 2
        return (
          <g key={part.phase} data-phase={part.phase} data-value={part.value}>
            <ChartBox box={part.box} stroke={colors.line} radius={12} />
            <ChartText
              x={cx}
              y={part.box.y + 34}
              color={colors.inkSubtle}
              size={20}
              textAnchor="middle"
            >
              {PHASE_LABEL[part.phase]()}
            </ChartText>
            <ChartText x={start} y={part.box.y + 74} color={colors.ink} size={layout.chainSize}>
              {lead}
              <tspan style={{ fill: colors.accent, fontWeight: 600 }}>{part.value}</tspan>
            </ChartText>
            {part.kept && (
              <ChartText
                x={cx}
                y={part.box.y + 100}
                color={colors.inkSubtle}
                size={20}
                textAnchor="middle"
              >
                {m.numerology_step_kept()}
              </ChartText>
            )}
          </g>
        )
      })}
      <ChartText
        x={circle.cx - circle.r - 18}
        y={layout.totalBaseline}
        color={colors.ink}
        size={layout.chainSize}
        textAnchor="end"
        data-total={total.sum}
      >
        {formula}
      </ChartText>
      <circle
        cx={circle.cx}
        cy={circle.cy}
        r={circle.r}
        style={{ fill: 'none', stroke: colors.accent, strokeWidth: 3 }}
      />
      <ChartText
        x={circle.cx}
        y={circle.cy + 20}
        color={colors.accent}
        size={56}
        font="heading"
        weight={600}
        textAnchor="middle"
        data-life-path={total.value}
      >
        {total.value}
      </ChartText>
      {total.master && (
        <ChartText
          x={circle.cx - circle.r - 18}
          y={layout.totalBaseline + 34}
          color={colors.inkSubtle}
          size={20}
          textAnchor="end"
        >
          {m.numerology_master()}
        </ChartText>
      )}
    </ChartFrame>
  )
}
