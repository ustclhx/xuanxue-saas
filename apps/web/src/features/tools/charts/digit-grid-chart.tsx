import { m } from '../../../paraglide/messages.js'
import { ChartBox, ChartFrame, ChartText } from './chart-frame.tsx'
import { type ChartColors, chartColors } from './colors.ts'
import { DIGIT_GRID_SIZE, layoutDigitGrid } from './layout/digit-grid.ts'

// 出生数字网格图形（tasks 6.2）：出现的数字为浅底星金字并写次数，缺失的数字为虚线框与「—」。
// 可读名称逐个列出 1–9 的次数；等价文字（缺失 / 重复数字）由页面的 ChartFacts 给出。
export function DigitGridChart({
  counts,
  caption,
  colors: overrides,
}: {
  counts: Record<number, number>
  caption: string
  colors?: Partial<ChartColors> | undefined
}) {
  const colors = chartColors(overrides)
  const cells = layoutDigitGrid(counts)
  const summary = [...cells]
    .sort((a, b) => a.digit - b.digit)
    .map((cell) => m.numerology_chart_digit({ digit: cell.digit, count: cell.count }))
    .join(', ')
  return (
    <ChartFrame
      name="digit-grid"
      size={DIGIT_GRID_SIZE}
      title={m.chart_numerology_grid_title({ caption, digits: summary })}
      className="max-w-xs"
    >
      {cells.map((cell) => {
        const cx = cell.box.x + cell.box.width / 2
        return (
          <g
            key={cell.digit}
            data-digit={cell.digit}
            data-count={cell.count}
            data-missing={cell.missing || undefined}
          >
            <ChartBox
              box={cell.box}
              {...(cell.missing ? {} : { fill: colors.surface2 })}
              stroke={cell.missing ? colors.line : colors.lineStrong}
              radius={10}
              dashed={cell.missing}
            />
            <ChartText
              x={cx}
              y={cell.box.y + 22}
              color={colors.inkSubtle}
              size={14}
              textAnchor="middle"
            >
              {cell.digit}
            </ChartText>
            <ChartText
              x={cx}
              y={cell.box.y + cell.box.height / 2 + cell.markSize * 0.4}
              color={cell.missing ? colors.inkSubtle : colors.accent}
              size={cell.markSize}
              font="heading"
              textAnchor="middle"
            >
              {cell.marks}
            </ChartText>
            <ChartText
              x={cx}
              y={cell.box.y + cell.box.height - 10}
              color={colors.inkSubtle}
              size={13}
              textAnchor="middle"
            >
              ×{cell.count}
            </ChartText>
          </g>
        )
      })}
    </ChartFrame>
  )
}
