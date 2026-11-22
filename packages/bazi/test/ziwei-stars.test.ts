import { describe, expect, it } from 'vitest'
import { BRANCHES, type Branch } from '../src/constants.ts'
import type { BirthInput } from '../src/input.ts'
import { computeZiwei, MAJOR_STARS, majorStarFacts, ziweiHoroscope } from '../src/ziwei.ts'

const sample: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}

describe('紫微十四主星事实表', () => {
  it('按主星顺序保留 iztro 数据，补齐有依据的字段并保留有分歧的阴阳', () => {
    const facts = majorStarFacts()
    expect(facts.map(({ star }) => star)).toEqual(MAJOR_STARS)
    expect(facts.find(({ star }) => star === 'ziwei')).toMatchObject({
      group: 'ziwei',
      element: 'earth',
      polarity: 'yin',
    })
    expect(facts.find(({ star }) => star === 'tianfu')).toMatchObject({
      group: 'tianfu',
      element: 'earth',
      polarity: 'yang',
    })
    expect(facts.find(({ star }) => star === 'taiyang')).toMatchObject({
      element: 'fire',
      polarity: 'yang',
    })
    expect(facts.find(({ star }) => star === 'qisha')).toMatchObject({
      element: 'metal',
      polarity: null,
    })
    expect(facts.filter(({ polarity }) => polarity === null).map(({ star }) => star)).toEqual([
      'tanlang',
      'tianxiang',
      'tianliang',
      'qisha',
      'pojun',
    ])
  })

  it('十干四化与排盘一致，紫微在乙年化科、壬年化权', () => {
    const facts = majorStarFacts()
    const ziwei = facts.find(({ star }) => star === 'ziwei')
    expect(ziwei?.mutagens).toEqual([
      { stem: 'yi', mutagen: 'ke' },
      { stem: 'ren', mutagen: 'quan' },
    ])

    const horoscope = ziweiHoroscope(sample, { startYear: 1990, years: 10 })
    if (horoscope.status !== 'ok') throw new Error('expected horoscope')
    for (const { stem, mutagens } of horoscope.years) {
      for (const fact of facts) {
        expect(fact.mutagens.find((row) => row.stem === stem)?.mutagen).toBe(
          mutagens.find((row) => row.star === fact.star)?.mutagen,
        )
      }
    }
  })

  it('十二种紫微落宫下的庙旺、主星落宫及同宫星与排盘一致', () => {
    const facts = new Map(majorStarFacts().map((fact) => [fact.star, fact]))
    const ziweiBranches: Branch[] = []
    // 这些日期在固定时辰的样例命盘里恰好覆盖紫微的十二种落宫。
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14]) {
      const chart = computeZiwei({ ...sample, day })
      if (chart.status !== 'ok') throw new Error('expected chart')
      const ziweiPalace = chart.palaces.find((p) => p.majorStars.some((s) => s.star === 'ziwei'))
      if (!ziweiPalace) throw new Error('expected Ziwei palace')
      const ziweiBranch = ziweiPalace.branch
      ziweiBranches.push(ziweiBranch)

      for (const { branch, majorStars } of chart.palaces) {
        for (const { star, brightness } of majorStars) {
          const fact = facts.get(star)
          expect(fact?.brightness.find((row) => row.branch === branch)?.brightness).toBe(brightness)
          expect(fact?.coLocations.find((row) => row.ziweiBranch === ziweiBranch)).toEqual({
            ziweiBranch,
            branch,
            stars: majorStars.filter((other) => other.star !== star).map((other) => other.star),
          })
        }
      }
    }
    expect(ziweiBranches.toSorted()).toEqual(BRANCHES.toSorted())
  })
})
