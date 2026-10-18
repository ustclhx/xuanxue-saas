import { describe, expect, it } from 'vitest'
import { BaziInputError, type BirthInput, computeChart, ENGINE_VERSION } from '../src/index.ts'

const sample: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}
const options = { referenceYear: 2026 }
const gz = (p: { stem: string; branch: string } | null) => (p ? `${p.stem}-${p.branch}` : null)

describe('computeChart', () => {
  it('回归首例 1990-05-15 10:30 台北男', () => {
    const c = computeChart(sample, options)
    expect([c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour].map(gz)).toEqual([
      'geng-wu',
      'xin-si',
      'geng-chen',
      'xin-si',
    ])
    expect(c.dayMaster).toBe('geng')
    expect(c.fortune.forward).toBe(true)
    expect(c.fortune.startAfter.years).toBe(7)
    expect(c.fortune.startAfter.months).toBe(3)
    expect(c.fortune.decades).toHaveLength(10)
    expect(c.fortune.decades[0]).toMatchObject({ stem: 'ren', branch: 'wu', startYear: 1997 })
    expect(c.fortune.decades[0]?.years).toHaveLength(10)
    const dayKong = c.shensha.find((s) => s.key === 'kongWang' && s.basis === 'dayPillar')
    expect(dayKong?.targets).toEqual(['shen', 'you'])
    expect(c.weight).toMatchObject({ status: 'ok', liang: 4, qian: 4 })
    expect(c.time.lunar).toEqual({ year: 1990, month: 4, day: 21, isLeapMonth: false })
    expect(c.engineVersion).toBe(ENGINE_VERSION)
  })

  it('十神与藏干：日柱天干为日主，其余天干与藏干带十神', () => {
    const c = computeChart(sample, options)
    expect(c.pillars.day.tenGod).toBeNull()
    expect(c.pillars.year.tenGod).toBe('biJian')
    expect(c.pillars.month.tenGod).toBe('jieCai')
    expect(c.pillars.month.hiddenStems).toEqual([
      { stem: 'bing', qi: 'main', tenGod: 'qiSha' },
      { stem: 'geng', qi: 'middle', tenGod: 'biJian' },
      { stem: 'wu', qi: 'residual', tenGod: 'pianYin' },
    ])
  })

  it('当前流年按 referenceYear 计算并定位所在大运', () => {
    const c = computeChart(sample, options)
    expect(c.currentYear).toMatchObject({ year: 2026, stem: 'bing', branch: 'wu', decadeIndex: 2 })
    const before = computeChart(sample, { referenceYear: 1992 })
    expect(before.currentYear.decadeIndex).toBeNull()
  })

  it('不知道时辰：输出三柱，依赖时柱的项标注需要出生时辰', () => {
    const c = computeChart({ ...sample, time: null }, options)
    expect(c.hourKnown).toBe(false)
    expect([c.pillars.year, c.pillars.month, c.pillars.day].map(gz)).toEqual([
      'geng-wu',
      'xin-si',
      'geng-chen',
    ])
    expect(c.pillars.hour).toBeNull()
    expect(c.weight).toEqual({ status: 'requiresHour', parts: { year: 9, month: 9, day: 10 } })
    expect(c.shensha.every((s) => s.requiresHour && !s.pillars.includes('hour'))).toBe(true)
    expect(c.strength.elements.reduce((a, e) => a + e.count, 0)).toBe(6)
    expect(c.fortune.approximate).toBe(true)
    expect(c.time.clock).toBeNull()
  })

  it('同一输入逐字段相同并带版本号（服务端复算）', () => {
    const a = JSON.stringify(computeChart(sample, options))
    const b = JSON.stringify(computeChart(JSON.parse(JSON.stringify(sample)), options))
    expect(a).toBe(b)
    expect(JSON.parse(a).engineVersion).toBe(ENGINE_VERSION)
  })

  it('非法输入抛出带字段的 BaziInputError', () => {
    try {
      computeChart({ ...sample, calendar: 'lunar', year: 2021, isLeapMonth: true }, options)
      throw new Error('should throw')
    } catch (error) {
      expect(error).toBeInstanceOf(BaziInputError)
      expect((error as BaziInputError).issues).toEqual([
        { field: 'leapMonth', code: 'leap_month_not_exist' },
      ])
    }
  })

  it('立春前一分钟年柱取上一年', () => {
    // 1985 立春 02-04 05:11:47（北京时间）
    const before = computeChart(
      { ...sample, year: 1985, month: 2, day: 4, time: { hour: 5, minute: 10 } },
      options,
    )
    const after = computeChart(
      { ...sample, year: 1985, month: 2, day: 4, time: { hour: 5, minute: 13 } },
      options,
    )
    expect(gz(before.pillars.year)).toBe('jia-zi')
    expect(gz(after.pillars.year)).toBe('yi-chou')
  })
})
