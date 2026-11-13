import type { ElementStat } from '@xuanxue/bazi'
import { m } from '../../../paraglide/messages.js'
import { ELEMENT_LABEL } from '../bazi/labels.ts'
import { ChartBox, ChartFrame, ChartText } from './chart-frame.tsx'
import { type ChartColors, chartColors, ELEMENT_SLOTS } from './colors.ts'
import { layoutElements } from './layout/elements.ts'

// 五行分布图形（tasks 4.2）：每行写五行名与「个数 · 占比」，条形只作辅助；
// 图形的可读名称列出全部五行与数值，作为等价文字内容。
export function ElementsChart({
  elements,
  colors: overrides,
}: {
  elements: readonly ElementStat[]
  colors?: Partial<ChartColors> | undefined
}) {
  const colors = chartColors(overrides)
  const layout = layoutElements(elements)
  const summary = layout.rows
    .map((row) => `${ELEMENT_LABEL[row.element]()} ${row.value}`)
    .join(m.chart_bazi_list_separator())
  return (
    <ChartFrame
      name="bazi-elements"
      size={layout.size}
      title={m.chart_bazi_elements_title({ elements: summary })}
      className="max-w-xl"
    >
      {layout.rows.map((row) => (
        <g key={row.element} data-element={row.element}>
          <ChartText x={layout.nameX} y={row.baseline} color={colors.ink} size={24} font="heading">
            {ELEMENT_LABEL[row.element]()}
          </ChartText>
          <ChartBox box={row.track} fill={colors.surface2} radius={row.track.height / 2} />
          {row.fill.width > 0 && (
            <ChartBox
              box={row.fill}
              fill={colors[ELEMENT_SLOTS[row.element]]}
              radius={row.fill.height / 2}
            />
          )}
          <ChartText
            x={layout.valueX}
            y={row.baseline}
            color={colors.inkMuted}
            size={20}
            textAnchor="end"
          >
            {row.value}
          </ChartText>
        </g>
      ))}
    </ChartFrame>
  )
}
