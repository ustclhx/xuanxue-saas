import { type BirthDate, lifePath } from '@xuanxue/numerology'
import { describe, expect, it, vi } from 'vitest'
import { birthDigits, digitCounts, lifePathLines } from '../numerology/calc.ts'
import { DigitGridChart } from './digit-grid-chart.tsx'
import { layoutLifePath, partChain, totalText } from './layout/life-path.ts'
import { LifePathChart } from './life-path-chart.tsx'
import { renderChartMarkup } from './render-static.ts'

const messages = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '')

/** 找生命灵数为 22 的日期（与 calc.ts exampleDateFor 相同思路） */
function dateFor(value: number): BirthDate {
  const cursor = new Date(Date.UTC(1980, 0, 1))
  for (;;) {
    const date = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    }
    if (lifePath(date).value === value) return date
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

describe('生命灵数推导图形', () => {
  it('1990-05-15：05 → 5、15 → 6、1990 → 19 → 10 → 1，5 + 6 + 1 = 12 → 3', () => {
    const date = { year: 1990, month: 5, day: 15 }
    const result = lifePath(date)
    const layout = layoutLifePath(result, date)
    expect(layout.parts.map(partChain)).toEqual(['05 → 5', '15 → 6', '1990 → 19 → 10 → 1'])
    expect(totalText(layout.total)).toBe('5 + 6 + 1 = 12 →')
    expect(layout.total.value).toBe(3)
    // 与 calc.ts 的算式行同源：各部分的最终值一致
    const lines = lifePathLines(result, date)
    for (const part of layout.parts) {
      const line = lines.find((l) => l.phase === part.phase)
      expect(line?.text.endsWith(String(part.value))).toBe(true)
    }
    const html = renderChartMarkup(<LifePathChart result={result} date={date} />)
    expect(html).toMatch(/^<svg [^>]*role="img"/)
    expect(html).toContain('data-life-path="3"')
    // 格子不超出 viewBox
    const last = layout.parts.at(-1)
    expect((last?.box.x ?? 0) + (last?.box.width ?? 0)).toBeLessThanOrEqual(layout.size.width)
  })

  it('大师数 22 停在 22，不再归约为 4', () => {
    const date = dateFor(22)
    const result = lifePath(date)
    expect(result.master).toBe(true)
    const layout = layoutLifePath(result, date)
    expect(layout.total.value).toBe(22)
    const html = renderChartMarkup(<LifePathChart result={result} date={date} />)
    expect(html).toContain('data-life-path="22"')
    expect(html).not.toContain('data-life-path="4"')
    expect(stripTags(html)).toContain('Master number')
  })
})

describe('出生数字网格图形', () => {
  it('计数与缺失标记来自 digitCounts', () => {
    const counts = digitCounts(birthDigits({ year: 1990, month: 5, day: 15 }))
    const html = renderChartMarkup(<DigitGridChart counts={counts} caption="Birth date grid" />)
    const cells = [
      ...html.matchAll(
        /<g data-digit="(\d)" data-count="(\d+)"( data-missing="true")?>([\s\S]*?)<\/g>/g,
      ),
    ].map(([, digit, count, missing, body = '']) => ({
      digit: Number(digit),
      count: Number(count),
      missing: Boolean(missing),
      text: stripTags(body),
    }))
    expect(cells).toHaveLength(9)
    for (const cell of cells) {
      expect(cell.count).toBe(counts[cell.digit])
      expect(cell.missing).toBe(counts[cell.digit] === 0)
      expect(cell.text).toContain(cell.missing ? '—' : String(cell.digit).repeat(cell.count))
    }
    // 15·05·1990：1、5、9 各两次，其余缺失
    expect(
      cells
        .filter((c) => !c.missing)
        .map((c) => c.digit)
        .sort(),
    ).toEqual([1, 5, 9])
    expect(html).toContain('Birth date grid: Digit 1: 2 times')
  })
})
