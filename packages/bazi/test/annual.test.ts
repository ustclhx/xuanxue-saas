import { Solar } from 'lunar-javascript'
import { describe, expect, it } from 'vitest'
import {
  annualOutlook,
  type BaziChart,
  type BirthInput,
  branchRelations,
  computeChart,
  decadeDetails,
  ganZhiRelations,
  isHarm,
  taiSuiOf,
} from '../src/index.ts'

const sample: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}
const window = { startYear: 2026, years: 5 }
const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const STEMS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui']
const BRANCHES = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai']

describe('relations', () => {
  it('地支关系与六害、太岁', () => {
    expect(branchRelations('zi', 'wu')).toEqual(['clash'])
    expect(branchRelations('wu', 'wu')).toEqual(['punish'])
    expect(branchRelations('zi', 'chou')).toEqual(['sixCombine'])
    expect(branchRelations('shen', 'chen')).toEqual(['triad'])
    expect(branchRelations('zi', 'wei')).toEqual(['harm'])
    expect(branchRelations('yin', 'shen')).toEqual(['clash', 'punish'])
    expect(isHarm(9, 10)).toBe(true) // 酉戌
    expect(isHarm(0, 6)).toBe(false)
    expect(ganZhiRelations({ stem: 'jia', branch: 'zi' }, { stem: 'ji', branch: 'chou' })).toEqual([
      'stemCombine',
      'sixCombine',
    ])
    expect(taiSuiOf('wu', 'wu')).toBe('zhi')
    expect(taiSuiOf('wu', 'zi')).toBe('chong')
    expect(taiSuiOf('wei', 'zi')).toBeNull()
  })
})

describe('annualOutlook', () => {
  it('逐年干支与 lunar-javascript（立春换年）一致，同一输入结果相同', () => {
    const chart = computeChart(sample, { referenceYear: 2026 })
    const outlook = annualOutlook(chart, window)
    expect(outlook.years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030])
    for (const y of outlook.years) {
      const gz: string = Solar.fromYmd(y.year, 7, 1).getLunar().getYearInGanZhiByLiChun()
      expect(
        `${STEM_HANZI[STEMS.indexOf(y.stem)]}${BRANCH_HANZI[BRANCHES.indexOf(y.branch)]}`,
      ).toBe(gz)
    }
    expect(annualOutlook(chart, window)).toEqual(outlook)
  })

  it('2026 丙午：庚午年柱值太岁且午午自刑，天干丙为七杀、地支藏干十神齐全', () => {
    const chart = computeChart(sample, { referenceYear: 2026 })
    const y2026 = annualOutlook(chart, window).years[0]
    expect(y2026).toMatchObject({
      stem: 'bing',
      branch: 'wu',
      elements: { stem: 'fire', branch: 'fire' },
      stemTenGod: 'qiSha',
      taiSui: 'zhi',
    })
    expect(y2026?.branchTenGods.map((h) => h.qi)).toEqual(['main', 'middle'])
    expect(y2026?.relations).toContainEqual({ with: 'year', type: 'punish' })
  })

  it('冲太岁：本命年支为子，2026 丙午与年柱六冲', () => {
    const chart = computeChart({ ...sample, year: 1984, month: 6 }, { referenceYear: 2026 })
    expect(chart.pillars.year.branch).toBe('zi')
    const y2026 = annualOutlook(chart, window).years[0]
    expect(y2026?.taiSui).toBe('chong')
    expect(y2026?.relations).toContainEqual({ with: 'year', type: 'clash' })
  })

  it('跨大运：窗口内进入下一步大运的年份标记为起始年', () => {
    const chart = computeChart(sample, { referenceYear: 2026 })
    const next = chart.fortune.decades.find((d) => d.startYear > 2026 && d.startYear <= 2030)
    expect(next).toBeDefined()
    const years = annualOutlook(chart, window).years
    const entered = years.find((y) => y.year === next?.startYear)
    expect(entered).toMatchObject({ decadeIndex: next?.index, decadeStart: true })
    expect(years[0]?.decadeIndex).toBe((next?.index ?? 0) - 1)
    expect(years[0]?.decadeStart).toBe(false)
  })

  it('无时辰：逐年关系不含时柱，并标注为估算', () => {
    const chart = computeChart({ ...sample, time: null }, { referenceYear: 2026 })
    const outlook = annualOutlook(chart, window)
    expect(outlook.approximate).toBe(true)
    expect(outlook.years.flatMap((y) => y.relations).some((r) => r.with === 'hour')).toBe(false)
  })

  it('喜忌标记与窗口参数校验', () => {
    const chart = computeChart(sample, { referenceYear: 2026 })
    for (const y of annualOutlook(chart, window).years) {
      expect(y.favorable.stem).toBe(
        chart.useful.favorable.includes(y.elements.stem) ? 'favorable' : 'unfavorable',
      )
    }
    expect(() => annualOutlook(chart, { startYear: 2026, years: 0 })).toThrow(RangeError)
    expect(() => annualOutlook(chart, { startYear: 2026, years: 21 })).toThrow(RangeError)
  })
})

describe('decadeDetails', () => {
  it('喜用为水、木时壬寅大运干支均为喜用，地支本气十神按日主计算', () => {
    const chart = computeChart(sample, { referenceYear: 2026 })
    const first = chart.fortune.decades[0] as BaziChart['fortune']['decades'][number]
    const modified: BaziChart = {
      ...chart,
      useful: {
        ...chart.useful,
        favorable: ['water', 'wood'],
        unfavorable: ['fire', 'earth', 'metal'],
      },
      fortune: { ...chart.fortune, decades: [{ ...first, stem: 'ren', branch: 'yin' }] },
    }
    // 日主庚金：寅本气甲木为偏财
    expect(decadeDetails(modified)).toEqual([
      { index: 0, branchTenGod: 'pianCai', favorable: { stem: 'favorable', branch: 'favorable' } },
    ])
    expect(decadeDetails(chart)).toHaveLength(10)
  })
})
