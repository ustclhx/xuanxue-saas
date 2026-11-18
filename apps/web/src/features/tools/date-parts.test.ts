import { describe, expect, it } from 'vitest'
import {
  dateValueComplete,
  joinDateParts,
  joinTimeParts,
  splitDateValue,
  splitTimeValue,
} from './date-parts.ts'
import { parseBirthDate } from './numerology/calc.ts'

describe('日期分段', () => {
  it('齐全有效时补零为 YYYY-MM-DD，可被原解析器接受并往返', () => {
    const value = joinDateParts({ year: '1987', month: '1', day: '9' })
    expect(value).toBe('1987-01-09')
    expect(parseBirthDate(value)).toEqual({ year: 1987, month: 1, day: 9 })
    expect(splitDateValue(value)).toEqual({ year: '1987', month: '01', day: '09' })
    expect(joinDateParts(splitDateValue('1990-05-15'))).toBe('1990-05-15')
    expect(joinDateParts({ year: ' 2000 ', month: '12', day: '31' })).toBe('2000-12-31')
  })

  it('全空为空串；不完整或越界时不会被 YYYY-MM-DD 解析器接受，且能还原各段', () => {
    expect(joinDateParts({ year: '', month: '', day: '' })).toBe('')
    for (const parts of [
      { year: '199', month: '5', day: '15' },
      { year: '1990', month: '13', day: '15' },
      { year: '1990', month: '5', day: '32' },
      { year: '1990', month: '0', day: '15' },
      { year: '0000', month: '5', day: '15' },
      { year: '1990', month: '', day: '15' },
      { year: '1990', month: 'x', day: '15' },
    ]) {
      const value = joinDateParts(parts)
      expect(parseBirthDate(value)).toBeNull()
      expect(splitDateValue(value)).toEqual(parts)
    }
    expect(dateValueComplete(joinDateParts({ year: '1990', month: '', day: '15' }))).toBe(false)
    expect(dateValueComplete(joinDateParts({ year: '1990', month: '13', day: '15' }))).toBe(true)
  })

  it('无法识别的值视为空', () => {
    expect(splitDateValue('')).toEqual({ year: '', month: '', day: '' })
    expect(splitDateValue('1990/05/15')).toEqual({ year: '', month: '', day: '' })
  })
})

describe('时间分段', () => {
  const TIME = /^(\d{2}):(\d{2})$/
  it('齐全有效时补零为 HH:MM 并往返', () => {
    expect(joinTimeParts({ hour: '7', minute: '5' })).toBe('07:05')
    expect(joinTimeParts({ hour: '0', minute: '00' })).toBe('00:00')
    expect(joinTimeParts({ hour: '23', minute: '59' })).toBe('23:59')
    expect(splitTimeValue('10:30')).toEqual({ hour: '10', minute: '30' })
    expect(joinTimeParts(splitTimeValue('09:30'))).toBe('09:30')
  })

  it('全空为空串；缺分钟或越界时不匹配 HH:MM，且能还原各段', () => {
    expect(joinTimeParts({ hour: '', minute: '' })).toBe('')
    for (const parts of [
      { hour: '10', minute: '' },
      { hour: '24', minute: '00' },
      { hour: '10', minute: '60' },
      { hour: '', minute: '30' },
    ]) {
      const value = joinTimeParts(parts)
      expect(value).not.toMatch(TIME)
      expect(splitTimeValue(value)).toEqual(parts)
    }
    expect(splitTimeValue('garbage')).toEqual({ hour: '', minute: '' })
  })
})
