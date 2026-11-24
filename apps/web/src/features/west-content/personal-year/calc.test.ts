import { personalYears } from '@xuanxue/numerology'
import { describe, expect, it } from 'vitest'
import {
  chainText,
  digitRoot,
  exampleFor,
  nineYearCycle,
  personalYearOf,
  stepView,
} from './calc.ts'
import { PERSONAL_YEAR_NUMBERS } from './paths.ts'

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing value')
  return value
}

const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// 详批逐年个人年数（readings-prompt-v4-yearly）用的就是 personalYears；出生年不影响结果
const readingValue = (month: number, day: number, year: number) =>
  personalYears({ year: 2000, month, day }, year, 1)[0]?.value

describe('personal year calculator', () => {
  it('matches the per-year personal year used by the numerology reading for every birthday', () => {
    for (const year of [1900, 1999, 2025, 2026, 2027, 2028, 2033, 2100])
      DAYS.forEach((days, i) => {
        for (let day = 1; day <= days; day++) {
          const result = personalYearOf({ month: i + 1, day, year })
          expect(result?.engine.value).toBe(readingValue(i + 1, day, year))
          expect(result?.value).toBe(digitRoot(result?.engine.value ?? 0))
        }
      })
  })

  it('reduces to 1–9 and agrees with adding every digit at once', () => {
    for (let month = 1; month <= 12; month++)
      for (let day = 1; day <= (DAYS[month - 1] ?? 0); day++) {
        const result = personalYearOf({ month, day, year: 2027 })
        const digits = `${month}${day}2027`.split('').map(Number)
        expect(result?.value).toBe(digitRoot(digits.reduce((a, b) => a + b, 0)))
        expect(PERSONAL_YEAR_NUMBERS).toContain(result?.value)
      }
  })

  it('shows the board example step by step (July 14, 2027 → 5)', () => {
    const result = personalYearOf({ month: 7, day: 14, year: 2027 })
    expect(result?.value).toBe(5)
    const view = stepView(must(result))
    expect(view.parts.map((part) => [part.input, chainText(part.chain), part.value])).toEqual([
      [7, '', 7],
      [14, '1 + 4 = 5', 5],
      [2027, '2 + 0 + 2 + 7 = 11', 11],
    ])
    expect(view.total).toMatchObject({ operands: [7, 5, 11], result: 23 })
    expect(chainText(view.reduce)).toBe('2 + 3 = 5')
    expect(view.root).toBeNull()
  })

  it('reads a master-number total as its root digit and keeps the engine value', () => {
    // 2 月 9 日、2027：2 + 9 + 11 = 22，引擎保留主数 22，本页读作 4
    const result = personalYearOf({ month: 2, day: 9, year: 2027 })
    expect(result?.engine).toMatchObject({ value: 22, master: true })
    expect(result?.value).toBe(4)
    expect(stepView(must(result)).root).toMatchObject({ operands: [2, 2], result: 4 })
  })

  it('builds the nine-year cycle around the result', () => {
    const result = must(personalYearOf({ month: 7, day: 14, year: 2027 }))
    const cycle = nineYearCycle(result)
    expect(cycle.map((entry) => entry.year)).toEqual([
      2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031,
    ])
    for (const entry of cycle)
      expect(personalYearOf({ month: 7, day: 14, year: entry.year })?.value).toBe(entry.value)
  })

  it('accepts February 29 and rejects impossible dates and years', () => {
    expect(personalYearOf({ month: 2, day: 29, year: 2027 })?.value).toBeDefined()
    expect(personalYearOf({ month: 2, day: 30, year: 2027 })).toBeNull()
    expect(personalYearOf({ month: 4, day: 31, year: 2027 })).toBeNull()
    expect(personalYearOf({ month: 13, day: 1, year: 2027 })).toBeNull()
    expect(personalYearOf({ month: 7, day: 14, year: 1899 })).toBeNull()
    expect(personalYearOf({ month: 7, day: 14, year: 2101 })).toBeNull()
  })

  it('finds a non-master example birthday for every number', () => {
    for (const year of [2026, 2027, 2028])
      for (const value of PERSONAL_YEAR_NUMBERS) {
        const example = exampleFor(value, year)
        expect(example.value).toBe(value)
        expect(example.engine.value).toBe(value)
      }
  })
})
