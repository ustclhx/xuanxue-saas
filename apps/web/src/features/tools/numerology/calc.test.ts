import { lifePath, nameNumbers, personalYear } from '@xuanxue/numerology'
import { describe, expect, it } from 'vitest'
import {
  birthDigits,
  chartSummary,
  digitCounts,
  exampleDateFor,
  formatBirthDate,
  formatLongDate,
  lifePathLines,
  nameLetters,
  parseBirthDate,
  rawTotal,
  reductionText,
} from './calc.ts'

describe('数字命理页面计算整理', () => {
  it('1987-11-29 的四行算式与原型一致（月 / 日保留大师数）', () => {
    const date = { year: 1987, month: 11, day: 29 }
    const lines = lifePathLines(lifePath(date), date)
    expect(lines.map((line) => [line.phase, line.text, line.kept])).toEqual([
      ['month', '11', true],
      ['day', '2 + 9 = 11', true],
      ['year', '1 + 9 + 8 + 7 = 25 → 2 + 5 = 7', false],
      ['total', '11 + 11 + 7 = 29 → 2 + 9 = 11', true],
    ])
  })

  it('解析 <input type="date"> 的值，格式不对返回 null', () => {
    expect(parseBirthDate('0987-02-03')).toEqual({ year: 987, month: 2, day: 3 })
    expect(formatBirthDate({ year: 987, month: 2, day: 3 })).toBe('0987-02-03')
    expect(parseBirthDate('1987-2-3')).toBeNull()
    expect(parseBirthDate(null)).toBeNull()
  })

  it('个人年与姓名数字的合计和归约', () => {
    const year = personalYear({ year: 1987, month: 11, day: 29 }, 2027)
    expect(reductionText(year)).toBe('11 + 29 + 2027 = 2067 → 2 + 0 + 6 + 7 = 15 → 1 + 5 = 6')
    const name = nameNumbers('Maya Chen')
    expect(rawTotal(name.soulUrge)).toBe(7)
    expect(rawTotal(name.expression)).toBe(
      nameLetters(name.normalized)
        .flat()
        .reduce((sum, letter) => sum + letter.value, 0),
    )
  })

  it('数字页样例日期的生命灵数等于该数字（含 22、33）', () => {
    for (const value of [1, 9, 11, 22, 33])
      expect(lifePath(exampleDateFor(value)).value).toBe(value)
    expect(formatLongDate({ year: 1987, month: 11, day: 29 })).toBe('29 November 1987')
  })

  it('数字分布图：0 不计入，统计缺失与最多的数字', () => {
    const counts = digitCounts(birthDigits({ year: 1987, month: 11, day: 29 }))
    expect(counts).toMatchObject({ 1: 3, 2: 1, 7: 1, 8: 1, 9: 2, 3: 0 })
    expect(chartSummary(counts)).toEqual({ missing: [3, 4, 5, 6], repeated: [1] })
  })
})
