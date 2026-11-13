import { createFileRoute, notFound } from '@tanstack/react-router'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { ChartBox, ChartFrame, ChartText } from '../../features/tools/charts/chart-frame.tsx'
import { type ChartColorSlot, chartColors } from '../../features/tools/charts/colors.ts'
import { gridCells, insetBox } from '../../features/tools/charts/layout/geometry.ts'
import { m } from '../../paraglide/messages.js'

// 图形外框演示（openspec redesign-home-chart-visuals tasks 3.3），只在本地开发服务器可用。
// 东方站：`http://east.localhost:<WEB_PORT>/zh-hant/dev/charts`（可用右下角主题切换看深色与打印预览）；
// 西方站：`http://west.localhost:<WEB_PORT>/dev/charts`。
// 演示的是外框、颜色槽与布局函数的接入方式，不是最终视觉；样例干支为固定值，不代表排盘引擎。
export const Route = createFileRoute('/dev/charts')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({
    meta: [{ title: 'Chart frame demo' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ChartsDemoPage,
})

const SIZE = { width: 640, height: 360 }
const SAMPLE: {
  pillar: string
  stem: string
  branch: string
  element: string
  slot: ChartColorSlot
}[] = [
  { pillar: '年', stem: '庚', branch: '午', element: '金 / 火', slot: 'metal' },
  { pillar: '月', stem: '辛', branch: '巳', element: '金 / 火', slot: 'metal' },
  { pillar: '日', stem: '庚', branch: '辰', element: '金 / 土', slot: 'metal' },
  { pillar: '時', stem: '辛', branch: '巳', element: '金 / 火', slot: 'metal' },
]

function ChartsDemoPage() {
  const colors = chartColors()
  const cells = gridCells(insetBox({ x: 0, y: 0, ...SIZE }, 24), 4, 1, 16)
  return (
    <MarketingShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <h1 className="m-0 font-heading text-3xl text-ink">Chart frame demo</h1>
        <p className="m-0 text-ink-muted">
          ChartFrame + colors.ts slots + layout/geometry.ts. Resize to 390px: the chart scales with
          a fixed aspect ratio and the page must not scroll horizontally.
        </p>
        <figure className="m-0 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <ChartFrame
            name="demo-pillars"
            size={SIZE}
            title="四柱命盤（示例）：庚午年 辛巳月 庚辰日 辛巳時"
            description={m.chart_equivalent_hint()}
            background={colors.surface}
          >
            {cells.map((cell, index) => {
              const pillar = SAMPLE[index]
              if (!pillar) return null
              const x = cell.x + cell.width / 2
              return (
                <g key={pillar.pillar}>
                  <ChartBox
                    box={cell}
                    stroke={index === 2 ? colors.accent : colors.line}
                    strokeWidth={index === 2 ? 3 : 1}
                    radius={12}
                  />
                  <ChartText
                    x={x}
                    y={cell.y + 110}
                    color={colors[pillar.slot]}
                    size={72}
                    font="heading"
                    textAnchor="middle"
                  >
                    {pillar.stem}
                  </ChartText>
                  <ChartText
                    x={x}
                    y={cell.y + 210}
                    color={colors.ink}
                    size={72}
                    font="heading"
                    textAnchor="middle"
                  >
                    {pillar.branch}
                  </ChartText>
                  <ChartText
                    x={x}
                    y={cell.y + 280}
                    color={colors.inkMuted}
                    size={22}
                    textAnchor="middle"
                  >
                    {pillar.element}
                  </ChartText>
                </g>
              )
            })}
            <ChartText
              x={SIZE.width - 32}
              y={20}
              color={colors.inkSubtle}
              size={16}
              textAnchor="end"
            >
              {m.chart_sample_badge()}
            </ChartText>
          </ChartFrame>
          <figcaption className="text-ink-subtle text-sm">{m.chart_equivalent_hint()}</figcaption>
        </figure>
        <table className="w-full border-collapse text-left text-ink">
          <thead>
            <tr>
              <th className="border-line border-b py-2">柱</th>
              <th className="border-line border-b py-2">干</th>
              <th className="border-line border-b py-2">支</th>
              <th className="border-line border-b py-2">五行</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE.map((pillar) => (
              <tr key={pillar.pillar}>
                <td className="border-line border-b py-2">{pillar.pillar}</td>
                <td className="border-line border-b py-2">{pillar.stem}</td>
                <td className="border-line border-b py-2">{pillar.branch}</td>
                <td className="border-line border-b py-2">{pillar.element}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MarketingShell>
  )
}
