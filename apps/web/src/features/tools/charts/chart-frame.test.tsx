import { describe, expect, it } from 'vitest'
import { ChartBox, ChartFrame, ChartLine, ChartText } from './chart-frame.tsx'
import { CHART_TOKENS, chartColors, TOKEN_COLORS } from './colors.ts'
import { renderChartMarkup, svgDataUri } from './render-static.ts'

const COLOR_LITERAL = /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i

function sample(description?: string) {
  const colors = chartColors()
  return (
    <ChartFrame
      name="sample"
      size={{ width: 320, height: 200 }}
      title="四柱命盤：庚午年 辛巳月 庚辰日 辛巳時"
      description={description}
      background={colors.surface}
    >
      <ChartBox box={{ x: 8, y: 8, width: 80, height: 120 }} stroke={colors.line} radius={6} />
      <ChartLine from={{ x: 0, y: 150 }} to={{ x: 320, y: 150 }} stroke={colors.lineStrong} />
      <ChartText x={48} y={60} color={colors.ink} size={28} textAnchor="middle">
        庚
      </ChartText>
      <ChartText x={48} y={96} color={colors.metal} size={12} textAnchor="middle">
        金
      </ChartText>
    </ChartFrame>
  )
}

describe('图形外框', () => {
  it('服务端输出 role="img"、title 与 aria-labelledby，带 viewBox 与固定宽高比', () => {
    const html = renderChartMarkup(sample())
    expect(html).toMatch(/^<svg [^>]*role="img"/)
    expect(html).toContain('viewBox="0 0 320 200"')
    expect(html).toContain('width="320" height="200"')
    expect(html).toContain('aspect-ratio:320 / 200')
    expect(html).toContain('data-chart="sample"')
    expect(html).toContain('class="chart-frame ')
    const titleId = html.match(/<title id="([^"]+)">四柱命盤：庚午年/)?.[1]
    expect(titleId).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${titleId}"`)
    expect(html).not.toContain('<desc')
  })

  it('有说明时 desc 同样被 aria-labelledby 引用', () => {
    const html = renderChartMarkup(sample('完整內容見下方表格'))
    const descId = html.match(/<desc id="([^"]+)">完整內容見下方表格<\/desc>/)?.[1]
    expect(descId).toBeTruthy()
    expect(html).toMatch(new RegExp(`aria-labelledby="[^"]+ ${descId}"`))
  })

  it('默认颜色全部来自 token，输出中没有颜色字面量；文字为 <text>', () => {
    const html = renderChartMarkup(sample())
    expect(html).not.toMatch(COLOR_LITERAL)
    expect(html).toContain(`fill:${TOKEN_COLORS.surface}`)
    expect(html).toContain(`fill:var(${CHART_TOKENS.ink})`)
    expect(html).toContain('fill:var(--wx-metal)')
    expect(html).toContain('font-family:var(--site-font-body)')
    expect(html.match(/<text /g)).toHaveLength(2)
  })

  it('相同输入的静态渲染结果一致，可作为 OG / 分享图的 SVG 来源', () => {
    expect(renderChartMarkup(sample())).toBe(renderChartMarkup(sample()))
    expect(svgDataUri('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
  })

  it('传入的颜色覆盖对应槽位，其余槽位仍为 token', () => {
    const colors = chartColors({ ink: 'CanvasText' })
    expect(colors.ink).toBe('CanvasText')
    expect(colors.line).toBe('var(--line)')
  })
})
