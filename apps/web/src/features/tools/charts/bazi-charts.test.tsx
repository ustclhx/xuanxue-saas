import { type BirthInput, computeChart } from '@xuanxue/bazi'
import { describe, expect, it, vi } from 'vitest'
import { ElementsChart } from './elements-chart.tsx'
import { elementValueText } from './layout/elements.ts'
import { PILLAR_ORDER } from './layout/pillars.ts'
import { PillarsChart } from './pillars-chart.tsx'
import { renderChartMarkup } from './render-static.ts'
import { SAMPLE_BAZI_PILLARS } from './samples.ts'

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
const chart = (input: Partial<BirthInput> = {}) =>
  computeChart({ ...SAMPLE, ...input }, { referenceYear: 2026 })

const COLOR_LITERAL = /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '')

/** 各柱 `<g data-pillar>` 的顺序与其中天干地支字形（单元测试环境无 DOM，按标记解析） */
function pillarsOf(html: string) {
  return [...html.matchAll(/<g data-pillar="(\w+)"([^>]*)>([\s\S]*?)<\/g>/g)].map(
    ([, key, attrs = '', body = '']) => ({
      key,
      glyphs: [...body.matchAll(/data-glyph="\w+"[^>]*>([^<]+)</g)].map((m) => m[1]).join(''),
      text: stripTags(body),
      day: attrs.includes('data-day-master'),
    }),
  )
}

/** 五行行：data-element 与该行文字 */
function elementsOf(html: string) {
  return [...html.matchAll(/<g data-element="(\w+)">([\s\S]*?)<\/g>/g)].map(
    ([, element, body = '']) => ({
      element,
      text: stripTags(body),
    }),
  )
}

describe('四柱图形', () => {
  it('繁中样例 1990-05-15 10:30 台北男：年月日時为庚午、辛巳、庚辰、辛巳，日柱有日主标记', () => {
    messages.locale = 'zh-Hant'
    const html = renderChartMarkup(<PillarsChart pillars={chart().pillars} locale="zh-Hant" />)
    const pillars = pillarsOf(html)
    expect(pillars.map((p) => [p.key, p.glyphs])).toEqual([
      ['year', '庚午'],
      ['month', '辛巳'],
      ['day', '庚辰'],
      ['hour', '辛巳'],
    ])
    const day = pillars.find((p) => p.key === 'day')
    expect(day?.day).toBe(true)
    expect(day?.text).toContain('日主')
    expect(pillars.filter((p) => p.day)).toHaveLength(1)
    // 每个字都有五行文字：庚 金、午 火
    expect(pillars[0]?.text).toMatch(/庚.*金.*午.*火/s)
    expect(html).toMatch(/^<svg [^>]*role="img"/)
    expect(html).toContain('四柱命盤：年柱 庚午、月柱 辛巳、日柱 庚辰、時柱 辛巳；日主 庚')
    expect(html).not.toMatch(COLOR_LITERAL)
  })

  it('韩语按시·일·월·연排列，并写韩文读音', () => {
    messages.locale = 'ko'
    const html = renderChartMarkup(<PillarsChart pillars={chart().pillars} locale="ko" />)
    expect(pillarsOf(html).map((p) => p.key)).toEqual([...PILLAR_ORDER.korean])
    expect(html).toContain('경 · 금')
    expect(html).toContain('사주팔자: 시주 辛巳, 일주 庚辰, 월주 辛巳, 연주 庚午')
  })

  it('时辰未知时时柱不绘制干支，显示需要时辰', () => {
    messages.locale = 'zh-Hant'
    const html = renderChartMarkup(
      <PillarsChart pillars={chart({ time: null }).pillars} locale="zh-Hant" />,
    )
    const hour = pillarsOf(html).find((p) => p.key === 'hour')
    expect(hour?.glyphs).toBe('')
    expect(hour?.text.replace(/\s/g, '')).toContain('需要出生時辰')
    expect(html).toContain('時柱 需要出生時辰')
  })

  it('图形与引擎同源：首页样例常量等于引擎计算结果', () => {
    expect(SAMPLE_BAZI_PILLARS).toEqual(chart().pillars)
  })
})

describe('五行分布图形', () => {
  it('五个五行都有文字标签，数值为引擎的个数与占比', () => {
    messages.locale = 'zh-Hant'
    const { elements } = chart().strength
    const html = renderChartMarkup(<ElementsChart elements={elements} />)
    const rows = elementsOf(html)
    expect(rows).toHaveLength(5)
    const byElement = Object.fromEntries(rows.map((row) => [row.element, row.text]))
    const label = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' } as const
    for (const stat of elements)
      expect(byElement[stat.element]).toBe(`${label[stat.element]}${elementValueText(stat)}`)
    // 按加权分数从高到低：金在最上
    expect(rows[0]?.element).toBe('metal')
    expect(html).toContain('五行分佈（個數 · 占比）：金 4 · 55.9%')
  })
})
