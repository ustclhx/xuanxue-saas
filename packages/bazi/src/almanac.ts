import {
  EarthBranch,
  HeavenStem,
  LunarDay,
  SixtyCycle,
  SolarDay,
  SolarTerm,
  type SolarTime,
} from 'tyme4ts'
import { BRANCHES, type Branch, branchIndex, STEMS, type Stem } from './constants.ts'
import { type DailyDate, type DayPillar, dayPillarOf } from './daily.ts'

/** 黄历规则或输出结构变化时递增，独立于排盘与每日运势版本。 */
export const ALMANAC_RULES_VERSION = '1.1.0'

const CHINA_OFFSET_MINUTES = 480
const LICHUN_INDEX = 3
const ZODIAC_FIRST_YEAR = 1924
const ZODIAC_LAST_YEAR = 2043

type AlmanacTime = DailyDate & { hour: number; minute: number; second: number }
type Festival = { calendar: 'solar' | 'lunar'; index: number }
type SeasonDay = { phaseIndex: number; dayIndex: number }

export type AlmanacDay = DayPillar & {
  monthBranch: Branch
  /** 年柱（以立春换年）与月柱（以节换月）的六十甲子序号（甲子 = 0），黄历页首的年、月、日三柱使用。 */
  yearCycleIndex: number
  monthCycleIndex: number
  /** tyme4ts TwelveStar、Ecliptic、Zodiac 与 Direction 的序号。 */
  twelveStarIndex: number
  eclipticIndex: number
  clashZodiacIndex: number
  ominousDirectionIndex: number
  /** 按 UTC+8 的民用日标记交节日。 */
  solarTerm: { index: number; beginsToday: boolean }
  festivals: Festival[]
  /** tyme4ts 节令阶段与阶段内天数均从 0 起算。梅雨阶段 0 为入梅到出梅前，1 为出梅日。 */
  dogDays: SeasonDay | null
  nineDays: SeasonDay | null
  plumRain: SeasonDay | null
}

export type AlmanacMonth = {
  rulesVersion: string
  year: number
  month: number
  days: AlmanacDay[]
  /** 公历月内的两个节气，交节时刻按 UTC+8 表示。 */
  solarTerms: { index: number; time: AlmanacTime }[]
  monthBranchChanges: { date: DailyDate; from: Branch; to: Branch }[]
  lunarMonthStarts: Pick<AlmanacDay, 'date' | 'lunar'>[]
}

function dateOf(day: SolarDay | SolarTime): DailyDate {
  return { year: day.getYear(), month: day.getMonth(), day: day.getDay() }
}

function timeOf(time: SolarTime): AlmanacTime {
  return {
    ...dateOf(time),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond(),
  }
}

function solarTermOf(solar: SolarDay): AlmanacDay['solarTerm'] {
  let term = solar.getTerm()
  let start = term.getJulianDay().getSolarTime().getSolarDay()
  // 历史日期的历书日偶尔与精算时刻跨日。节气按精算日展示，建除仍沿用日柱的历书规则。
  if (solar.isBefore(start)) {
    term = term.next(-1)
    start = term.getJulianDay().getSolarTime().getSolarDay()
  } else {
    const next = term.next(1)
    const nextStart = next.getJulianDay().getSolarTime().getSolarDay()
    if (!solar.isBefore(nextStart)) {
      term = next
      start = nextStart
    }
  }
  return { index: term.getIndex(), beginsToday: solar.equals(start) }
}

/** 使用民用日期计算日柱；展示层按语言解释各项序号。 */
export function almanacDay(date: DailyDate): AlmanacDay {
  const day = dayPillarOf(date)
  const solar = SolarDay.fromYmd(date.year, date.month, date.day)
  const cycleDay = solar.getSixtyCycleDay()
  const branch = cycleDay.getSixtyCycle().getEarthBranch()
  const twelveStar = cycleDay.getTwelveStar()
  const solarFestival = solar.getFestival()
  const lunarFestival = solar.getLunarDay().getFestival()
  const festivals: Festival[] = []
  if (solarFestival) festivals.push({ calendar: 'solar', index: solarFestival.getIndex() })
  if (lunarFestival) festivals.push({ calendar: 'lunar', index: lunarFestival.getIndex() })
  const dog = solar.getDogDay()
  const nine = solar.getNineDay()
  const plumRain = solar.getPlumRainDay()
  return {
    ...day,
    rulesVersion: ALMANAC_RULES_VERSION,
    monthBranch: BRANCHES[cycleDay.getMonth().getEarthBranch().getIndex()] as Branch,
    yearCycleIndex: cycleDay.getYear().getIndex(),
    monthCycleIndex: cycleDay.getMonth().getIndex(),
    twelveStarIndex: twelveStar.getIndex(),
    eclipticIndex: twelveStar.getEcliptic().getIndex(),
    clashZodiacIndex: branch.getOpposite().getZodiac().getIndex(),
    ominousDirectionIndex: branch.getOminous().getIndex(),
    solarTerm: solarTermOf(solar),
    festivals,
    dogDays: dog && { phaseIndex: dog.getDog().getIndex(), dayIndex: dog.getDayIndex() },
    nineDays: nine && { phaseIndex: nine.getNine().getIndex(), dayIndex: nine.getDayIndex() },
    plumRain: plumRain && {
      phaseIndex: plumRain.getPlumRain().getIndex(),
      dayIndex: plumRain.getDayIndex(),
    },
  }
}

export function almanacMonth(year: number, month: number): AlmanacMonth {
  // 先通过每日入口校验年月，沿用同一日期范围与错误类型。
  const firstDay = almanacDay({ year, month, day: 1 })
  const dayCount = SolarDay.fromYmd(year, month, 1).getSolarMonth().getDayCount()
  const days = [firstDay]
  const monthBranchChanges: AlmanacMonth['monthBranchChanges'] = []
  let previousBranch = firstDay.monthBranch
  for (let day = 2; day <= dayCount; day++) {
    const result = almanacDay({ year, month, day })
    days.push(result)
    if (result.monthBranch !== previousBranch) {
      monthBranchChanges.push({ date: result.date, from: previousBranch, to: result.monthBranch })
      previousBranch = result.monthBranch
    }
  }
  const lunarMonthStarts = days
    .filter(({ lunar }) => lunar.day === 1)
    .map(({ date, lunar }) => ({ date, lunar }))

  // 每月先交节、后交中气；十二月的中气冬至由 next 跨到下一节气年。
  const firstTerm = SolarTerm.fromIndex(year, month * 2 - 1)
  const solarTerms = [firstTerm, firstTerm.next(1)].map((term) => ({
    index: term.getIndex(),
    time: timeOf(term.getJulianDay().getSolarTime()),
  }))
  return {
    rulesVersion: ALMANAC_RULES_VERSION,
    year,
    month,
    days,
    solarTerms,
    monthBranchChanges,
    lunarMonthStarts,
  }
}

export type ZodiacBoundary = {
  year: number
  branch: Branch
  /** 立春的绝对时刻，可转为任意固定偏移后与出生日期比较。 */
  lichunEpochMs: number
  /** 春节是农历换年的公历日期，不随立春的显示偏移换算。 */
  lunarNewYear: DailyDate
}

type NayinRow = { cycleIndex: number; stem: Stem; branch: Branch; nayinIndex: number }

export type ZodiacYear = NayinRow & {
  year: number
  lichun: AlmanacTime
  lunarNewYear: DailyDate
}

function nayinOf(cycle: SixtyCycle): NayinRow {
  return {
    cycleIndex: cycle.getIndex(),
    stem: STEMS[cycle.getHeavenStem().getIndex()] as Stem,
    branch: BRANCHES[cycle.getEarthBranch().getIndex()] as Branch,
    nayinIndex: cycle.getSound().getIndex(),
  }
}

function boundaryOf(year: number, branch: Branch): ZodiacBoundary {
  const spring = SolarTerm.fromIndex(year, LICHUN_INDEX).getJulianDay().getSolarTime()
  const time = timeOf(spring)
  return {
    year,
    branch,
    lichunEpochMs:
      Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second) -
      CHINA_OFFSET_MINUTES * 60_000,
    lunarNewYear: dateOf(LunarDay.fromYmd(year, 1, 1).getSolarDay()),
  }
}

/** 只需将数据送到浏览器即可比较边界。甲子年 1924 为范围的起点。 */
export function zodiacBoundaries(): ZodiacBoundary[] {
  return Array.from({ length: ZODIAC_LAST_YEAR - ZODIAC_FIRST_YEAR + 1 }, (_, index) =>
    boundaryOf(ZODIAC_FIRST_YEAR + index, BRANCHES[index % BRANCHES.length] as Branch),
  )
}

export function zodiacYears(
  branch: Branch,
  { utcOffsetMinutes = CHINA_OFFSET_MINUTES }: { utcOffsetMinutes?: number } = {},
): ZodiacYear[] {
  if (!Number.isInteger(utcOffsetMinutes) || Math.abs(utcOffsetMinutes) > 14 * 60) {
    throw new RangeError('Invalid UTC offset in minutes')
  }
  const rows: ZodiacYear[] = []
  for (
    let year = ZODIAC_FIRST_YEAR + branchIndex(branch);
    year <= ZODIAC_LAST_YEAR;
    year += BRANCHES.length
  ) {
    const { lichunEpochMs, lunarNewYear } = boundaryOf(year, branch)
    const local = new Date(lichunEpochMs + utcOffsetMinutes * 60_000)
    rows.push({
      ...nayinOf(SixtyCycle.fromIndex(year - ZODIAC_FIRST_YEAR)),
      year,
      lichun: {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth() + 1,
        day: local.getUTCDate(),
        hour: local.getUTCHours(),
        minute: local.getUTCMinutes(),
        second: local.getUTCSeconds(),
      },
      lunarNewYear,
    })
  }
  return rows
}

export function nayinTable(): NayinRow[] {
  return Array.from({ length: 60 }, (_, index) => nayinOf(SixtyCycle.fromIndex(index)))
}

/** 十干按甲至癸排列，每行依子至亥排列，值为 tyme4ts Terrain 序号。 */
export function terrainTable(): { stem: Stem; terrainByBranch: Record<Branch, number> }[] {
  return STEMS.map((stem, index) => {
    const heavenStem = HeavenStem.fromIndex(index)
    return {
      stem,
      terrainByBranch: Object.fromEntries(
        BRANCHES.map((branch, i) => [
          branch,
          heavenStem.getTerrain(EarthBranch.fromIndex(i)).getIndex(),
        ]),
      ) as Record<Branch, number>,
    }
  })
}
