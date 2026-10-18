import { describe, expect, it } from 'vitest'
import {
  birthdayNumber,
  COMPATIBILITY_MATRIX,
  compatibility,
  lifePath,
  nameNumbers,
  normalizeName,
  numerologyChart,
  personalYear,
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
    expect(personalYear(birthday, 2026).value).toBe(5) // 11 + 29 + 2026 = 2066 → 14 → 5
    expect(personalYear(birthday, 2027).value).toBe(6) // 11 + 29 + 2027 = 2067 → 15 → 6
    expect(() => lifePath({ year: 1900, month: 2, day: 29 })).toThrow()
    expect(lifePath({ year: 2000, month: 2, day: 29 }).value).toBe(6)
    expect(() => reduceNumber(-1)).toThrow()
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
