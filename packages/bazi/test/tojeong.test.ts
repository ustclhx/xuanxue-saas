import { TOJEONG_RULES_VERSION, type TojeongInput, tojeongGwae } from '@xuanxue/bazi/tojeong'
import { Lunar, Solar } from 'lunar-javascript'
import type { SolarDay } from 'tyme4ts'
import { assert, describe, expect, it } from 'vitest'
import type { LunarDate } from '../src/chart.ts'
import { BaziInputError } from '../src/input.ts'
import { koreanLunarDate, koreanLunarMonths } from '../src/korean-lunar.ts'
import kasi2027 from './fixtures/tojeong-kasi-2027.json'

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

const dangi = new Intl.DateTimeFormat('en-u-ca-dangi', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function koreanBirth(input: TojeongInput): LunarDate {
  const { year, month, day } = input.birth
  if (input.calendar === 'lunar') return { year, month, day, isLeapMonth: input.leapMonth === true }
  // UTC 只用于把公历年月日交给 ICU；dangi 用韩国历法换算该民用日。
  const parts = Object.fromEntries(
    dangi
      .formatToParts(new Date(Date.UTC(year, month - 1, day)))
      .map(({ type, value }) => [type, value]),
  )
  const lunarMonth = parts.month as string
  return {
    year: Number(parts.relatedYear),
    month: Number.parseInt(lunarMonth, 10),
    day: Number(parts.day),
    isLeapMonth: lunarMonth.endsWith('bis'),
  }
}

function chineseBirth(input: TojeongInput): LunarDate {
  const { year, month, day } = input.birth
  const solar =
    input.calendar === 'solar'
      ? Solar.fromYmd(year, month, day)
      : solarOfLunar(year, input.leapMonth ? -month : month, day)
  const lunar = solar.getLunar()
  return {
    year: lunar.getYear(),
    month: Math.abs(lunar.getMonth()),
    day: lunar.getDay(),
    isLeapMonth: lunar.getMonth() < 0,
  }
}

/** 目标年分别以 KASI 和 lunar-javascript 为准，月建按阴历月号独立排算。 */
function oracleFor2027(birthDate: (input: TojeongInput) => LunarDate, useKasi: boolean) {
  const targetYear = kasi2027.lunarYear
  const yearCycle: string = solarOfLunar(targetYear, 1, 1).getLunar().getYearInGanZhi()
  const taeseNumber = sumOfCycle(yearCycle)
  const newYearStem = '丙戊庚壬甲'.charAt(STEMS.indexOf(yearCycle.charAt(0)) % 5)
  const calendar = kasi2027.months.map(({ solar, days }, index) => {
    const monthStem = STEMS.charAt((STEMS.indexOf(newYearStem) + index) % 10)
    const monthBranch = '寅卯辰巳午未申酉戌亥子丑'.charAt(index)
    const [year, month, day] = solar.split('-').map(Number)
    const firstDay = useKasi
      ? Solar.fromYmd(year, month, day)
      : solarOfLunar(targetYear, index + 1, 1)
    const monthDays = useKasi ? days : firstDay.next(29).getLunar().getDay() === 30 ? 30 : 29
    const dayNumbers = Array.from({ length: monthDays }, (_, offset) =>
      sumOfCycle(firstDay.next(offset).getLunar().getDayInGanZhi()),
    )
    return { monthDays, wolgeonNumber: sumOfCycle(monthStem + monthBranch), dayNumbers }
  })

  return (input: TojeongInput) => {
    const birthLunar = birthDate(input)

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

function solarIso(date: SolarDay) {
  return new Date(Date.UTC(date.getYear(), date.getMonth() - 1, date.getDay()))
    .toISOString()
    .slice(0, 10)
}

describe('tojeongGwae', () => {
  it('matches every published KASI month start, month length, and leap status in 2027', () => {
    const { lunarYear, months, previousYearLastMonth, nextYearFirstMonth } = kasi2027
    const actual = koreanLunarMonths(lunarYear)
    expect(
      actual.map(({ month, firstDay, days, isLeapMonth }) => ({
        lunarMonth: month,
        solar: solarIso(firstDay),
        days,
        isLeapMonth,
      })),
    ).toEqual(months.map(({ source: _source, ...month }) => month))
    for (const { month, firstDay, days } of actual) {
      expect(koreanLunarDate(firstDay)).toEqual({
        year: lunarYear,
        month,
        day: 1,
        isLeapMonth: false,
      })
      expect(koreanLunarDate(firstDay.next(days - 1))).toEqual({
        year: lunarYear,
        month,
        day: days,
        isLeapMonth: false,
      })
    }
    const previous = koreanLunarMonths(previousYearLastMonth.lunarYear).at(-1)
    assert.isDefined(previous)
    expect(solarIso(previous.firstDay)).toBe(previousYearLastMonth.solar)
    expect(previous.days).toBe(previousYearLastMonth.days)
    expect(koreanLunarDate(previous.firstDay.next(previous.days - 1))).toEqual({
      year: previousYearLastMonth.lunarYear,
      month: previousYearLastMonth.lunarMonth,
      day: previousYearLastMonth.days,
      isLeapMonth: false,
    })
    const next = koreanLunarMonths(nextYearFirstMonth.lunarYear)[0]
    assert.isDefined(next)
    expect(solarIso(next.firstDay)).toBe(nextYearFirstMonth.solar)
    expect(next.days).toBe(nextYearFirstMonth.days)
  })

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

  it('agrees with ICU dangi and KASI in a 1940–2010 sample and measures the change from UTC+8', {
    timeout: 30_000,
  }, () => {
    const korean = oracleFor2027(koreanBirth, true)
    const chinese = oracleFor2027(chineseBirth, false)
    const counts = {
      solar: { samples: 0, birthDateChanges: 0, resultChanges: 0, gwaeChanges: 0 },
      lunar: { samples: 0, birthDateChanges: 0, resultChanges: 0, gwaeChanges: 0 },
    }
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
            const expected = korean(input)
            assert.deepEqual(result, expected, `${calendar} ${year}-${month}-${day}`)
            const previous = chinese(input)
            const stats = counts[calendar]
            stats.samples++
            if (JSON.stringify(expected.birthLunar) !== JSON.stringify(previous.birthLunar)) {
              stats.birthDateChanges++
            }
            if (JSON.stringify(expected) !== JSON.stringify(previous)) stats.resultChanges++
            if (result.gwae !== previous.gwae) stats.gwaeChanges++
          }
        }
      }
    }
    expect(counts).toEqual({
      solar: { samples: 2503, birthDateChanges: 83, resultChanges: 443, gwaeChanges: 442 },
      lunar: { samples: 2556, birthDateChanges: 0, resultChanges: 426, gwaeChanges: 426 },
    })
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
    // KASI：2028 平五月 5 月 24 日起 30 天，闰五月 6 月 23 日起 29 天。
    const input = { calendar: 'lunar', birth: { year: 2000, month: 5, day: 15 } } as const
    expect(tojeongGwae(input, 2028)).toMatchObject({
      targetLunar: { year: 2028, month: 5, day: 15 },
      monthDays: 30,
      iljinNumber: sumOfCycle(Solar.fromYmd(2028, 6, 7).getLunar().getDayInGanZhi()),
    })
  })

  it('validates a Korean leap month when the Chinese leap month number differs', () => {
    // KASI：2012-04-21 为闰三月初一，UTC+8 则在四月置闰。
    const birth = { year: 2012, month: 3, day: 1 }
    const lunar = tojeongGwae({ calendar: 'lunar', birth, leapMonth: true }, 2027)
    expect(lunar.birthLunar).toEqual({ ...birth, isLeapMonth: true })
    expect(
      tojeongGwae({ calendar: 'solar', birth: { year: 2012, month: 4, day: 21 } }, 2027),
    ).toEqual(lunar)
    expect(() =>
      tojeongGwae({ calendar: 'lunar', birth: { ...birth, month: 4 }, leapMonth: true }, 2027),
    ).toThrow(BaziInputError)
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
