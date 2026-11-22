import { Lunar, LunarUtil, Solar } from 'lunar-javascript'
import { Direction, Duty, Ecliptic, Sound, TwelveStar, Zodiac } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import {
  ALMANAC_RULES_VERSION,
  almanacDay,
  almanacMonth,
  nayinTable,
  terrainTable,
  zodiacBoundaries,
  zodiacYears,
} from '../src/almanac.ts'
import { BRANCHES, type Branch, STEMS, type Stem } from '../src/constants.ts'
import { DUTY_KEYS } from '../src/daily.ts'
import { BaziInputError } from '../src/input.ts'

const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const ganZhi = ({ stem, branch }: { stem: Stem; branch: Branch }) =>
  `${STEM_HANZI[STEMS.indexOf(stem)]}${BRANCH_HANZI[BRANCHES.indexOf(branch)]}`

describe('黄历', () => {
  it('2026 全年逐日的建除、十二神与冲煞与 lunar-javascript 一致', () => {
    for (let month = 1; month <= 12; month++) {
      const { days } = almanacMonth(2026, month)
      const expectedCount = new Date(Date.UTC(2026, month, 0)).getUTCDate()
      expect(days.map(({ date }) => date.day)).toEqual(
        Array.from({ length: expectedCount }, (_, i) => i + 1),
      )
      for (const row of days) {
        const date = `2026-${month}-${row.date.day}`
        const lunar = Solar.fromYmd(2026, month, row.date.day).getLunar()
        expect(Duty.fromIndex(DUTY_KEYS.indexOf(row.duty)).getName(), date).toBe(lunar.getZhiXing())
        expect(TwelveStar.fromIndex(row.twelveStarIndex).getName(), date).toBe(
          lunar.getDayTianShen(),
        )
        expect(Ecliptic.fromIndex(row.eclipticIndex).getName(), date).toBe(
          lunar.getDayTianShenType(),
        )
        expect(Zodiac.fromIndex(row.clashZodiacIndex).getName(), date).toBe(
          lunar.getDayChongShengXiao(),
        )
        expect(Direction.fromIndex(row.ominousDirectionIndex).getName(), date).toBe(
          lunar.getDaySha(),
        )
      }
    }
  })

  it('固定 2026-11-22 为庚子日、白虎（黑道）、冲马煞南', () => {
    const day = almanacDay({ year: 2026, month: 11, day: 22 })
    expect(day).toMatchObject({
      rulesVersion: ALMANAC_RULES_VERSION,
      stem: 'geng',
      branch: 'zi',
      twelveStarIndex: 6,
      eclipticIndex: 1,
      clashZodiacIndex: 6,
      ominousDirectionIndex: 8,
    })
  })

  it('月表列出交节时刻、月建变化与农历月界，并保留交节日的重复建除', () => {
    const june = almanacMonth(2026, 6)
    expect(june.days).toHaveLength(30)
    expect(june.solarTerms).toEqual([
      { index: 11, time: { year: 2026, month: 6, day: 5, hour: 23, minute: 48, second: 21 } },
      { index: 12, time: { year: 2026, month: 6, day: 21, hour: 16, minute: 24, second: 30 } },
    ])
    expect(june.monthBranchChanges).toEqual([
      { date: { year: 2026, month: 6, day: 5 }, from: 'si', to: 'wu' },
    ])
    expect(june.lunarMonthStarts).toEqual([
      {
        date: { year: 2026, month: 6, day: 15 },
        lunar: { year: 2026, month: 5, day: 1, isLeapMonth: false },
      },
    ])
    expect(june.days.slice(3, 5).map(({ duty }) => duty)).toEqual(['ding', 'ding'])
    expect(june.days[4]?.solarTerm).toEqual({ index: 11, beginsToday: true })
  })

  it('节令与春节按引擎序号输出', () => {
    expect(almanacDay({ year: 2026, month: 6, day: 11 }).plumRain).toEqual({
      phaseIndex: 0,
      dayIndex: 0,
    })
    expect(almanacDay({ year: 2026, month: 7, day: 8 }).plumRain).toEqual({
      phaseIndex: 1,
      dayIndex: 0,
    })
    expect(almanacDay({ year: 2026, month: 7, day: 20 }).dogDays).toEqual({
      phaseIndex: 0,
      dayIndex: 5,
    })
    expect(almanacDay({ year: 2026, month: 12, day: 25 }).nineDays).toEqual({
      phaseIndex: 0,
      dayIndex: 3,
    })
    expect(almanacDay({ year: 2026, month: 2, day: 17 }).festivals).toContainEqual({
      calendar: 'lunar',
      index: 0,
    })
  })

  it('精算时刻与历书日跨日时，逐日的交节标记和月表时刻一致', () => {
    const september = almanacMonth(1927, 9)
    expect(september.solarTerms[0]).toMatchObject({ index: 17, time: { day: 9 } })
    expect(september.days[7]?.solarTerm).toEqual({ index: 16, beginsToday: false })
    expect(september.days[8]?.solarTerm).toEqual({ index: 17, beginsToday: true })
  })

  it('月表保留闰月初一，非法年月沿用日期错误', () => {
    expect(almanacMonth(2023, 3).lunarMonthStarts).toContainEqual({
      date: { year: 2023, month: 3, day: 22 },
      lunar: { year: 2023, month: 2, day: 1, isLeapMonth: true },
    })
    expect(() => almanacMonth(2026, 13)).toThrow(BaziInputError)
  })
})

describe('生肖与八字表格', () => {
  it('1924–2043 的各年立春、春节、年干支和纳音与 lunar-javascript 一致', () => {
    const boundaries = zodiacBoundaries()
    const years = BRANCHES.flatMap((branch) => {
      const rows = zodiacYears(branch)
      expect(rows).toHaveLength(10)
      expect(rows.every((row) => row.branch === branch)).toBe(true)
      return rows
    }).sort((a, b) => a.year - b.year)
    expect(boundaries.map(({ year }) => year)).toEqual(
      Array.from({ length: 120 }, (_, i) => 1924 + i),
    )
    expect(years.map(({ year }) => year)).toEqual(boundaries.map(({ year }) => year))
    for (const [i, row] of years.entries()) {
      const { year, branch, lichun, lunarNewYear } = row
      const lunar = Solar.fromYmd(year, 2, 20).getLunar()
      const spring = lunar.getJieQiTable().立春
      const newYear = Lunar.fromYmd(year, 1, 1).getSolar()
      expect(lichun, String(year)).toEqual({
        year: spring.getYear(),
        month: spring.getMonth(),
        day: spring.getDay(),
        hour: spring.getHour(),
        minute: spring.getMinute(),
        second: spring.getSecond(),
      })
      expect(lunarNewYear, String(year)).toEqual({
        year: newYear.getYear(),
        month: newYear.getMonth(),
        day: newYear.getDay(),
      })
      expect(boundaries[i]).toEqual({
        year,
        branch,
        lichunEpochMs: Date.UTC(
          year,
          spring.getMonth() - 1,
          spring.getDay(),
          spring.getHour() - 8,
          spring.getMinute(),
          spring.getSecond(),
        ),
        lunarNewYear,
      })
      expect(ganZhi(row), String(year)).toBe(lunar.getYearInGanZhi())
      expect(Sound.fromIndex(row.nayinIndex).getName(), String(year)).toBe(lunar.getYearNaYin())
    }
  })

  it('立春时刻可用固定偏移换算，春节仍是原公历日', () => {
    const year2025 = (utcOffsetMinutes: number) =>
      zodiacYears('si', { utcOffsetMinutes }).find(({ year }) => year === 2025)
    expect(year2025(480)).toMatchObject({
      lichun: { year: 2025, month: 2, day: 3, hour: 22, minute: 10, second: 28 },
      lunarNewYear: { year: 2025, month: 1, day: 29 },
    })
    expect(year2025(540)).toMatchObject({
      lichun: { year: 2025, month: 2, day: 3, hour: 23, minute: 10, second: 28 },
      lunarNewYear: { year: 2025, month: 1, day: 29 },
    })
    expect(year2025(600)?.lichun).toMatchObject({ day: 4, hour: 0, minute: 10 })
  })

  it('六十甲子逐项匹配 lunar-javascript 纳音', () => {
    const rows = nayinTable()
    expect(rows).toHaveLength(60)
    expect(new Set(rows.map(ganZhi)).size).toBe(60)
    for (const [i, row] of rows.entries()) {
      expect(row.cycleIndex).toBe(i)
      expect(Sound.fromIndex(row.nayinIndex).getName(), ganZhi(row)).toBe(
        LunarUtil.NAYIN[ganZhi(row)],
      )
    }
  })

  it('十二长生按十干、十二支索引，阳干顺排与阴干逆排', () => {
    const rows = terrainTable()
    expect(rows.map(({ stem }) => stem)).toEqual(STEMS)
    for (const { terrainByBranch } of rows) {
      expect(Object.keys(terrainByBranch)).toEqual(BRANCHES)
      expect(new Set(Object.values(terrainByBranch)).size).toBe(12)
    }
    expect(rows[0]?.terrainByBranch).toMatchObject({ hai: 0, zi: 1 })
    expect(rows[1]?.terrainByBranch).toMatchObject({ wu: 0, si: 1 })
  })
})
