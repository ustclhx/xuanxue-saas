import { computeChart } from '@xuanxue/bazi'
import { computeZiwei } from '@xuanxue/bazi/ziwei'
import { describe, expect, it } from 'vitest'
import {
  ANNUAL_DATA_VERSION,
  chartSummary,
  READING_ANNUAL_YEARS,
  recomputeReading,
  ziweiSummary,
} from './catalog.ts'

// readings-prompt-v4-yearly tasks.md 3.1：v1–v3 沿用原摘要，v4（annual 数据档）追加逐年数据。
const NOW = new Date('2026-10-19T00:00:00Z')
const INPUT = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
} as const
const NUMEROLOGY = { year: 1987, month: 11, day: 29, name: 'Ada Lovelace' }
const WINDOW = [2026, 2027, 2028, 2029, 2030]

const base = (kind: string, raw: unknown) => recomputeReading(kind, raw, NOW, { profile: 'base' })
const annual = (kind: string, raw: unknown) =>
  recomputeReading(kind, raw, NOW, { profile: 'annual' })

describe('base 数据档（v1–v3）', () => {
  it('与原摘要逐字段一致', () => {
    expect(base('bazi-full', INPUT).result).toEqual(
      chartSummary(computeChart(INPUT, { referenceYear: 2026 })),
    )
    const ziwei = computeZiwei(INPUT)
    if (ziwei.status !== 'ok') throw new Error('expected chart')
    expect(base('ziwei-full', INPUT).result).toEqual(ziweiSummary(ziwei))
    expect(base('bazi-full', INPUT)).toMatchSnapshot('bazi-base')
    expect(base('ziwei-full', INPUT)).toMatchSnapshot('ziwei-base')
    expect(base('numerology-full', NUMEROLOGY)).toMatchSnapshot('numerology-base')
  })
})

describe('annual 数据档（v4）', () => {
  it('八字：含窗口内全部年份与大运补充，引擎版本带后缀，不含出生日期与城市', () => {
    expect(READING_ANNUAL_YEARS).toBe(5)
    const recomputed = annual('saju-full', INPUT)
    expect(recomputed.engineVersion).toMatch(new RegExp(`\\+${ANNUAL_DATA_VERSION}$`))
    const result = recomputed.result as {
      annual: { years: { year: number }[] }
      fortune: { decades: { branchTenGod: string; favorable: unknown }[] }
      shensha: { pillars: string[] }[]
    }
    expect(result.annual.years.map((y) => y.year)).toEqual(WINDOW)
    expect(result.fortune.decades.every((d) => d.branchTenGod && d.favorable)).toBe(true)
    expect(result.shensha.every((s) => s.pillars.length > 0)).toBe(true)
    const text = JSON.stringify(result)
    expect(text).not.toContain('1990')
    expect(text).not.toContain('taipei')
    expect(annual('saju-full', INPUT)).toEqual(recomputed)
  })

  it('紫微：含大限区间、当前大限与逐年流年四化', () => {
    const recomputed = annual('ziwei-full', INPUT)
    const result = recomputed.result as {
      horoscope: { years: { year: number; mutagens: unknown[] }[]; currentDecade: unknown }
      auxiliaryStars: unknown[]
    }
    expect(result.horoscope.years.map((y) => y.year)).toEqual(WINDOW)
    expect(result.horoscope.years.every((y) => y.mutagens.length === 4)).toBe(true)
    expect(result.horoscope.currentDecade).not.toBeNull()
    expect(result.auxiliaryStars).toHaveLength(12)
    expect(JSON.stringify(result)).not.toContain('1990')
    expect(annual('ziwei-full', INPUT)).toEqual(recomputed)
  })

  it('数字命理：逐年个人年、巅峰与挑战数，只标当前阶段，不含出生年份与姓名', () => {
    const recomputed = annual('numerology-full', NUMEROLOGY)
    expect(recomputed.engineVersion).toBe('numerology@2+years.1')
    const result = recomputed.result as {
      personalYear: { value: number }
      personalYears: { year: number; value: number }[]
      pinnacles: { current: boolean }[]
      challenges: { current: boolean }[]
    }
    expect(result.personalYears.map((y) => y.year)).toEqual(WINDOW)
    expect(result.personalYears[0]?.value).toBe(result.personalYear.value)
    // 2026 年满 39 岁：生命灵数 11 → 第一巅峰止于 34，处于第二阶段
    expect(result.pinnacles.map((p) => p.current)).toEqual([false, true, false, false])
    expect(result.challenges.map((p) => p.current)).toEqual([false, true, false, false])
    const text = JSON.stringify(result)
    expect(text).not.toContain('1987')
    expect(text).not.toContain('Ada')
  })
})
