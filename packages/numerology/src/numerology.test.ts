import { describe, expect, it } from 'vitest'
import {
  birthdayNumber,
  COMPATIBILITY_MATRIX,
  challenges,
  compatibility,
  lifePath,
  nameNumbers,
  normalizeName,
  numerologyChart,
  personalYear,
  personalYears,
  pinnacles,
  reduceNumber,
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

  it('lists consecutive personal years that match the single-year rule', () => {
    const years = personalYears(birthday, 2026, 5)
    expect(years.map((item) => item.year)).toEqual([2026, 2027, 2028, 2029, 2030])
    for (const item of years) {
      const single = personalYear(birthday, item.year)
      expect(item).toEqual({ year: item.year, value: single.value, master: single.master })
    }
    expect(() => personalYears(birthday, 2026, 0)).toThrow()
  })

  it('computes pinnacles and challenges with life-path based ages', () => {
    // 月 11→2、日 29→2、年 1987→7；生命灵数 11 的个位值 2，第一巅峰止于 34 岁
    expect(pinnacles(birthday)).toEqual([
      { value: 4, master: false, startAge: 0, endAge: 34 },
      { value: 9, master: false, startAge: 34, endAge: 43 },
      { value: 4, master: false, startAge: 43, endAge: 52 },
      { value: 9, master: false, startAge: 52, endAge: null },
    ])
    expect(challenges(birthday).map((item) => item.value)).toEqual([0, 5, 5, 5])
    // 5 + 6 = 11 保留为大师数；生命灵数 3，第一巅峰止于 33 岁
    const master = pinnacles({ year: 1990, month: 5, day: 6 })
    expect(master[0]).toEqual({ value: 11, master: true, startAge: 0, endAge: 33 })
    for (const date of [
      birthday,
      { year: 1999, month: 9, day: 1 },
      { year: 2000, month: 1, day: 9 },
    ])
      for (const item of challenges(date)) expect(item.value).toBeGreaterThanOrEqual(0)
    expect(Math.max(...challenges({ year: 2000, month: 1, day: 9 }).map((c) => c.value))).toBe(8)
  })
})
