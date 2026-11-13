import { describe, expect, it } from 'vitest'
import {
  birthdayNumber,
  COMPATIBILITY_MATRIX,
  compatibility,
  lifePath,
  nameNumbers,
  normalizeName,
  numerologyChart,
  personalDay,
  personalMonth,
  personalYear,
  reduceNumber,
  universalDay,
} from './index.ts'

const birthday = { year: 1987, month: 11, day: 29 }
describe('numerology', () => {
  it('preserves master numbers at every reduction and exposes the specified life path equation', () => {
    for (const value of [11, 22, 33])
      expect(reduceNumber(value)).toMatchObject({ value, master: true, steps: [] })
    expect(reduceNumber(199)).toMatchObject({ value: 1, master: false })
    const result = lifePath(birthday)
    expect(result.value).toBe(11)
    expect(result.steps.filter((step) => step.phase === 'total')).toEqual([
      { phase: 'total', operands: [11, 11, 7], result: 29 },
      { phase: 'total', operands: [2, 9], result: 11 },
    ])
    expect(result.steps.filter((step) => step.phase === 'year').map((step) => step.result)).toEqual(
      [25, 7],
    )
    expect(birthdayNumber({ ...birthday, day: 22 }).value).toBe(22)
  })
  it('uses the caller-provided local year across New Year and validates calendar dates', () => {
    expect(personalYear(birthday, 2026).value).toBe(5) // 11 + 11 + 1 = 23 → 5
    expect(personalYear(birthday, 2027)).toMatchObject({ value: 33, master: true }) // 11 + 11 + 11
    expect(() => lifePath({ year: 1900, month: 2, day: 29 })).toThrow()
    expect(lifePath({ year: 2000, month: 2, day: 29 }).value).toBe(6)
    expect(() => reduceNumber(-1)).toThrow()
  })
  it('reduces personal year components separately and preserves the master total', () => {
    expect(personalYear({ year: 1987, month: 9, day: 9 }, 2029)).toEqual({
      value: 22,
      master: true,
      steps: [
        { phase: 'year', operands: [2, 0, 2, 9], result: 13 },
        { phase: 'year', operands: [1, 3], result: 4 },
        { phase: 'total', operands: [9, 9, 4], result: 22 },
      ],
    })
  })
  it('normalizes accents and applies Pythagorean letter values', () => {
    expect(normalizeName('Hélène Dupont')).toBe('HELENE DUPONT')
    const result = nameNumbers('Hélène Dupont')
    expect([result.expression.value, result.soulUrge.value, result.personality.value]).toEqual([
      4, 6, 7,
    ])
  })
  it('treats Y as a vowel only when neither adjacent letter in its word is a vowel', () => {
    expect(nameNumbers('Lynn').soulUrge.value).toBe(7)
    expect(nameNumbers('Maya').soulUrge.value).toBe(2)
    expect(nameNumbers('Yale').soulUrge.value).toBe(6)
    expect(nameNumbers('Y A').soulUrge.value).toBe(8)
  })
  it('keeps date results when a name is unsupported or omitted', () => {
    const invalid = numerologyChart(birthday, 2027, '王小明')
    expect(invalid.lifePath.value).toBe(11)
    expect(invalid.name).toBeNull()
    expect(invalid.nameError).toMatchObject({ field: 'name', code: 'INVALID_NAME' })
    expect(numerologyChart(birthday, 2027).nameError).toBeNull()
    expect(() => normalizeName('A1')).toThrow()
  })
  it('returns a stable symmetric 12×12 compatibility grade and explanation key', () => {
    expect(COMPATIBILITY_MATRIX).toHaveLength(12)
    for (const [i, row] of COMPATIBILITY_MATRIX.entries()) {
      expect(row).toHaveLength(12)
      for (const [j, grade] of row.entries()) expect(grade).toBe(COMPATIBILITY_MATRIX[j]?.[i])
    }
    const first = { year: 2000, month: 1, day: 7 }
    const second = { year: 2000, month: 1, day: 2 }
    expect(compatibility(first, second)).toMatchObject({
      left: { value: 1 },
      right: { value: 5 },
      level: 'high',
      explanationKey: 'numerology.compatibility.1-5',
    })
    expect(compatibility(second, first).level).toBe('high')
  })
})

describe('daily numbers', () => {
  const birth = { year: 1990, month: 5, day: 15 }
  it('exposes personal year, month and day steps for 5/15 on 2026-11-13', () => {
    const result = personalDay(birth, { year: 2026, month: 11, day: 13 })
    // 个人年：5 + (1+5=6) + (2026→10→1) = 12 → 3
    expect(result.personalYear).toMatchObject({ value: 3 })
    expect(result.personalYear.steps.filter((s) => s.phase === 'total')).toEqual([
      { phase: 'total', operands: [5, 6, 1], result: 12 },
      { phase: 'total', operands: [1, 2], result: 3 },
    ])
    // 个人月：3 + 11（主数月份保留）= 14 → 5
    expect(result.personalMonth.value).toBe(5)
    expect(result.personalMonth.steps).toEqual([
      { phase: 'total', operands: [3, 11], result: 14 },
      { phase: 'total', operands: [1, 4], result: 5 },
    ])
    // 个人日：5 + (1+3=4) = 9
    expect(result).toMatchObject({ value: 9, master: false })
    expect(result.steps).toEqual([
      { phase: 'day', operands: [1, 3], result: 4 },
      { phase: 'total', operands: [5, 4], result: 9 },
    ])
    expect(personalMonth(birth, { year: 2026, month: 11 }).value).toBe(5)
  })
  it('uses the caller-provided local date instead of the server clock', () => {
    // 服务端 UTC 已是 11 月 14 日，调用方传入访客本地 11 月 13 日
    expect(personalDay(birth, { year: 2026, month: 11, day: 13 }).value).toBe(9)
    expect(personalDay(birth, { year: 2026, month: 11, day: 14 }).value).toBe(1)
    // 跨年时个人年随本地年份变化
    expect(personalDay(birth, { year: 2026, month: 12, day: 31 }).personalYear.value).toBe(3)
    expect(personalDay(birth, { year: 2027, month: 1, day: 1 }).personalYear.value).toBe(22)
  })
  it('keeps 11 and 22 as master numbers but reduces 33 for daily numbers', () => {
    expect(personalDay(birth, { year: 2026, month: 11, day: 6 })).toMatchObject({
      value: 11,
      master: true,
    })
    expect(personalDay(birth, { year: 2026, month: 8, day: 11 })).toMatchObject({
      value: 22,
      master: true,
    })
    // 个人年 33（1987-11-29 在 2027 年）+ 11 月 = 44 → 8
    expect(personalMonth({ year: 1987, month: 11, day: 29 }, { year: 2027, month: 11 }).value).toBe(
      8,
    )
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        const value = personalDay(birth, { year: 2026, month, day }).value
        expect(value <= 9 || value === 11 || value === 22).toBe(true)
      }
    }
  })
  it('computes the universal day with steps', () => {
    const result = universalDay({ year: 2026, month: 11, day: 13 })
    expect(result).toMatchObject({ value: 7, master: false })
    expect(result.steps).toEqual([
      { phase: 'year', operands: [2, 0, 2, 6], result: 10 },
      { phase: 'year', operands: [1, 0], result: 1 },
      { phase: 'day', operands: [1, 3], result: 4 },
      { phase: 'total', operands: [1, 11, 4], result: 16 },
      { phase: 'total', operands: [1, 6], result: 7 },
    ])
    // 2026 → 1，2 月 + 1 + 8 日 = 11
    expect(universalDay({ year: 2026, month: 2, day: 8 })).toMatchObject({
      value: 11,
      master: true,
    })
    expect(() => universalDay({ year: 2026, month: 2, day: 30 })).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE' }),
    )
  })
})
