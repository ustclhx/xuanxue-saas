import type { BirthInput } from '@xuanxue/bazi'
import { computeZiwei } from '@xuanxue/bazi/ziwei'
import { describe, expect, it, vi } from 'vitest'
import { renderedFontPx } from './layout/geometry.ts'
import { BRANCH_POSITION, layoutZiwei, ZIWEI_MIN_FONT, ZIWEI_SIZE } from './layout/ziwei.ts'
import { renderChartMarkup } from './render-static.ts'
import { ZiweiBoard, ZiweiChartGraphic } from './ziwei-chart.tsx'

const messages = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

const SAMPLE: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
  trueSolarTime: false,
}

function okChart() {
  const chart = computeZiwei(SAMPLE)
  if (chart.status !== 'ok') throw new Error('expected ok')
  return chart
}

describe('紫微十二宫图形', () => {
  it('十二宫按地支方位排布，与引擎宫位一一对应；中宫为 2×2', () => {
    const chart = okChart()
    const layout = layoutZiwei(chart.palaces, chart.soulPalaceBranch, chart.bodyPalaceBranch)
    expect(layout.cells).toHaveLength(12)
    const cellWidth = ZIWEI_SIZE.width / 4
    const cellHeight = ZIWEI_SIZE.height / 4
    for (const cell of layout.cells) {
      const [column, row] = BRANCH_POSITION[cell.palace.branch]
      expect([cell.box.x, cell.box.y]).toEqual([column * cellWidth, row * cellHeight])
    }
    // 巳在左上、申在右上、亥在右下、寅在左下
    expect(BRANCH_POSITION.si).toEqual([0, 0])
    expect(BRANCH_POSITION.shen).toEqual([3, 0])
    expect(BRANCH_POSITION.hai).toEqual([3, 3])
    expect(BRANCH_POSITION.yin).toEqual([0, 3])
    expect(new Set(layout.cells.map((c) => c.box.x * 10 + c.box.y)).size).toBe(12)
    expect(layout.center).toEqual({
      x: cellWidth,
      y: cellHeight,
      width: cellWidth * 2,
      height: cellHeight * 2,
    })
  })

  it('命宫与身宫有文字标记，中宫不含姓名字段，图形有可读名称', () => {
    messages.locale = 'zh-Hant'
    const chart = okChart()
    const html = renderChartMarkup(<ZiweiBoard chart={chart} variant="compact" />)
    expect(html.match(/data-palace="/g)).toHaveLength(12)
    // 按宫位切段（宫内还有嵌套的 <g>，不能用非贪婪的 </g> 匹配）
    const segments = html.split('<g data-palace=').slice(1)
    const soul = segments.find((segment) => segment.includes('data-soul="true"')) ?? ''
    const body = segments.find((segment) => segment.includes('data-body="true"')) ?? ''
    expect(soul).toContain('>命宮<')
    expect(body).toContain('>身宮<')
    expect(html).toMatch(/^<svg [^>]*role="img"/)
    expect(html).toContain('紫微斗數十二宮命盤：')
    expect(html).not.toMatch(/name|姓名/i)
    // 主星数与引擎一致（主星名为衬线字体的 <text>）
    const stars = chart.palaces.reduce((sum, palace) => sum + palace.majorStars.length, 0)
    expect(html.match(/font-size:30px;font-family:var\(--site-font-heading\)/g)).toHaveLength(stars)
  })

  it('手机结果卡约 332px 宽时最小字号折算不低于 11px', () => {
    expect(renderedFontPx(ZIWEI_SIZE, 332, ZIWEI_MIN_FONT)).toBeGreaterThanOrEqual(11)
    const html = renderChartMarkup(<ZiweiBoard chart={okChart()} variant="compact" />)
    const sizes = [...html.matchAll(/font-size:(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]))
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(ZIWEI_MIN_FONT)
  })

  it('页面同时输出手机版与桌面版，按断点只显示一张', () => {
    const html = renderChartMarkup(<ZiweiChartGraphic chart={okChart()} />)
    expect(html.match(/data-chart="ziwei-palaces"/g)).toHaveLength(2)
    expect(html).toMatch(/viewBox="0 0 716 616"[^>]*class="[^"]*lg:hidden/)
    expect(html).toMatch(/viewBox="0 0 880 480"[^>]*class="[^"]*hidden[^"]*lg:block/)
  })
})
