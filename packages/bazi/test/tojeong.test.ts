import { TOJEONG_RULES_VERSION, type TojeongInput, tojeongGwae } from '@xuanxue/bazi/tojeong'
import { Lunar, Solar } from 'lunar-javascript'
import { assert, describe, expect, it } from 'vitest'
import { BaziInputError } from '../src/input.ts'

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const STEM_NUMBERS = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5]
const BRANCH_NUMBERS = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4]

function solarOfLunar(year: number, month: number, day: number) {
  const solar = Lunar.fromYmd(year, month, day).getSolar()
  return Solar.fromYmd(solar.getYear(), solar.getMonth(), solar.getDay())
}

function sumOfCycle(cycle: string) {
  const stem = STEM_NUMBERS[STEMS.indexOf(cycle.charAt(0))]
  const branch = BRANCH_NUMBERS[BRANCHES.indexOf(cycle.charAt(1))]
  if (stem === undefined || branch === undefined) throw new Error(`Invalid cycle: ${cycle}`)
  return stem + branch
}

/** 每个目标年只查一遍历表，月建按阴历月号独立排算。 */
function oracleFor(targetYear: number) {
  const yearCycle: string = solarOfLunar(targetYear, 1, 1).getLunar().getYearInGanZhi()
  const taeseNumber = sumOfCycle(yearCycle)
  const newYearStem = '丙戊庚壬甲'.charAt(STEMS.indexOf(yearCycle.charAt(0)) % 5)
  const calendar = Array.from({ length: 12 }, (_, index) => {
    const monthStem = STEMS.charAt((STEMS.indexOf(newYearStem) + index) % 10)
    const monthBranch = '寅卯辰巳午未申酉戌亥子丑'.charAt(index)
    const firstDay = solarOfLunar(targetYear, index + 1, 1)
    const monthDays = firstDay.next(29).getLunar().getDay() === 30 ? 30 : 29
    const dayNumbers = Array.from({ length: monthDays }, (_, offset) =>
      sumOfCycle(firstDay.next(offset).getLunar().getDayInGanZhi()),
    )
    return { monthDays, wolgeonNumber: sumOfCycle(monthStem + monthBranch), dayNumbers }
  })

  return (input: TojeongInput) => {
    const { year, month, day } = input.birth
    const solar =
      input.calendar === 'solar'
        ? Solar.fromYmd(year, month, day)
        : solarOfLunar(year, input.leapMonth ? -month : month, day)
    const lunar = solar.getLunar()
    const birthLunar = {
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      isLeapMonth: lunar.getMonth() < 0,
    }

    const targetMonth = calendar[birthLunar.month - 1]
    assert.isDefined(targetMonth)
    const { monthDays, wolgeonNumber, dayNumbers } = targetMonth
    const targetDay = birthLunar.day > monthDays ? 29 : birthLunar.day
    const targetLunar = { year: targetYear, month: birthLunar.month, day: targetDay }
    const iljinNumber = dayNumbers[targetDay - 1]
    assert.isDefined(iljinNumber)

    const countingAge = targetYear - birthLunar.year + 1
    const sang = ((countingAge + taeseNumber - 1) % 8) + 1
    const jung = ((monthDays + wolgeonNumber - 1) % 6) + 1
    const ha = ((targetDay + iljinNumber - 1) % 3) + 1
    return {
      birthLunar,
      targetLunar,
      countingAge,
      monthDays,
      taeseNumber,
      wolgeonNumber,
      iljinNumber,
      sang,
      jung,
      ha,
      gwae: Number(`${sang}${jung}${ha}`),
    }
  }
}

describe('tojeongGwae', () => {
  // 前两个见站点正文，其余三个由公开计算器原版客户端计算，出处及步骤见私有验收记录。
  it.each([
    ['lunar', 1990, 5, 5, false, 431],
    ['solar', 1990, 5, 17, false, 461],
    ['solar', 2000, 1, 1, false, 331],
    ['lunar', 2006, 7, 15, true, 463],
    ['lunar', 2000, 5, 30, false, 233],
  ] as const)(
    'matches public result for %s %i-%i-%i (leap month: %s)',
    (calendar, year, month, day, leapMonth, gwae) => {
      const result = tojeongGwae({ birth: { year, month, day }, calendar, leapMonth }, 2027)
      expect(result.gwae).toBe(gwae)
      expect(result.rulesVersion).toBe(TOJEONG_RULES_VERSION)
    },
  )

  it('agrees with an independent calendar and calculation for 1940–2010', {
    timeout: 30_000,
  }, () => {
    const oracle = oracleFor(2027)
    for (let year = 1940; year <= 2010; year++) {
      for (let month = 1; month <= 12; month++) {
        for (const day of [1, 15, 29]) {
          for (const calendar of ['solar', 'lunar'] as const) {
            if (
              calendar === 'solar' &&
              month === 2 &&
              day === 29 &&
              new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1
            ) {
              continue
            }
            const input = { birth: { year, month, day }, calendar }
            const { rulesVersion, ...result } = tojeongGwae(input, 2027)
            assert.deepEqual(result, oracle(input), `${calendar} ${year}-${month}-${day}`)
          }
        }
      }
    }
  })

  it('maps a lunar leap month to the ordinary month after converting a solar birth', () => {
    const solar = tojeongGwae({ calendar: 'solar', birth: { year: 2006, month: 9, day: 7 } }, 2027)
    const lunar = tojeongGwae(
      { calendar: 'lunar', birth: { year: 2006, month: 7, day: 15 }, leapMonth: true },
      2027,
    )
    expect(solar).toEqual(lunar)
    expect(solar.birthLunar).toEqual({ year: 2006, month: 7, day: 15, isLeapMonth: true })
    expect(solar.targetLunar).toEqual({ year: 2027, month: 7, day: 15 })
  })

  it('uses the ordinary birth month when the target year also has a leap month', () => {
    const input = { calendar: 'lunar', birth: { year: 2000, month: 6, day: 15 } } as const
    expect(tojeongGwae(input, 2025)).toMatchObject(oracleFor(2025)(input))
  })

  it('uses day 29 for both the day number and addition when the target month is short', () => {
    const input = { calendar: 'lunar', birth: { year: 2000, month: 5, day: 30 } } as const
    expect(tojeongGwae(input, 2027)).toMatchObject({
      monthDays: 29,
      targetLunar: { year: 2027, month: 5, day: 29 },
      iljinNumber: 13,
      ha: 3,
    })
  })

  it('rejects a nonexistent lunar leap month or day in the birth year', () => {
    expect(() =>
      tojeongGwae(
        { calendar: 'lunar', birth: { year: 2000, month: 5, day: 1 }, leapMonth: true },
        2027,
      ),
    ).toThrow(BaziInputError)
    expect(() =>
      tojeongGwae({ calendar: 'lunar', birth: { year: 2000, month: 6, day: 30 } }, 2027),
    ).toThrow(BaziInputError)
  })

  it('rejects a target year before the lunar birth year', () => {
    expect(() =>
      tojeongGwae({ calendar: 'solar', birth: { year: 2000, month: 5, day: 15 } }, 1999),
    ).toThrow(RangeError)
  })
})
