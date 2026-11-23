import { LunarDay, LunarMonth, LunarYear, type SixtyCycle, SolarDay } from 'tyme4ts'
import type { LunarDate } from './chart.ts'
import type { DailyDate } from './daily.ts'
import { BaziInputError, MAX_YEAR, MIN_YEAR } from './input.ts'

/** 土亭秘诀先天数规则，与其他排盘规则独立版本化。 */
export const TOJEONG_RULES_VERSION = '1.0.0'

export type TojeongInput = {
  birth: DailyDate
  calendar: 'solar' | 'lunar'
  /** 仅用于阴历输入，先验证出生当年的闰月。 */
  leapMonth?: boolean
}

export type TojeongResult = {
  rulesVersion: typeof TOJEONG_RULES_VERSION
  sang: number
  jung: number
  ha: number
  /** 三卦依次为百、十、个位。 */
  gwae: number
  birthLunar: LunarDate
  /** 目标年计算所用的平月日期，月小无三十时取廿九。 */
  targetLunar: DailyDate
  countingAge: number
  monthDays: number
  taeseNumber: number
  wolgeonNumber: number
  iljinNumber: number
}

function birthLunarDate({
  birth: { year, month, day },
  calendar,
  leapMonth,
}: TojeongInput): LunarDate {
  if (calendar !== 'solar' && calendar !== 'lunar') {
    throw new BaziInputError([{ field: 'calendar', code: 'required' }])
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new BaziInputError([{ field: 'year', code: 'out_of_range' }])
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new BaziInputError([{ field: 'month', code: 'out_of_range' }])
  }
  const isLeapMonth = leapMonth === true
  if (isLeapMonth && (calendar === 'solar' || LunarYear.fromYear(year).getLeapMonth() !== month)) {
    throw new BaziInputError([{ field: 'leapMonth', code: 'leap_month_not_exist' }])
  }

  const signedMonth = isLeapMonth ? -month : month
  const monthDays =
    calendar === 'lunar'
      ? LunarMonth.fromYm(year, signedMonth).getDayCount()
      : SolarDay.fromYmd(year, month, 1).getSolarMonth().getDayCount()
  if (!Number.isInteger(day) || day < 1 || day > monthDays) {
    throw new BaziInputError([{ field: 'day', code: 'invalid_date' }])
  }
  if (calendar === 'lunar') return { year, month, day, isLeapMonth }

  const lunar = SolarDay.fromYmd(year, month, day).getLunarDay()
  const lunarMonth = lunar.getLunarMonth()
  return {
    year: lunarMonth.getYear(),
    month: lunarMonth.getMonth(),
    day: lunar.getDay(),
    isLeapMonth: lunarMonth.isLeap(),
  }
}

function cycleNumber(cycle: SixtyCycle): number {
  // 天干从甲、己起为 9 至 5，地支从子、午起为 9 至 4。
  const stemNumber = 9 - (cycle.getHeavenStem().getIndex() % 5)
  const branchNumber = 9 - (cycle.getEarthBranch().getIndex() % 6)
  return stemNumber + branchNumber
}

/** 以 tyme4ts 的 UTC+8 阴阳历及民用日界计算土亭秘诀三卦。 */
export function tojeongGwae(input: TojeongInput, targetYear: number): TojeongResult {
  const birthLunar = birthLunarDate(input)
  if (
    !Number.isInteger(targetYear) ||
    targetYear < MIN_YEAR ||
    targetYear > MAX_YEAR ||
    targetYear < birthLunar.year
  ) {
    throw new RangeError('Invalid Tojeong target year')
  }

  const month = birthLunar.month
  // 目标年始终使用同一月号的平月，月建按阴历月号推算。
  const targetMonth = LunarMonth.fromYm(targetYear, month)
  const monthDays = targetMonth.getDayCount()
  const day = Math.min(birthLunar.day, monthDays)
  const targetDay = LunarDay.fromYmd(targetYear, month, day)
  const countingAge = targetYear - birthLunar.year + 1
  const taeseNumber = cycleNumber(targetMonth.getLunarYear().getSixtyCycle())
  const wolgeonNumber = cycleNumber(targetMonth.getSixtyCycle())
  const iljinNumber = cycleNumber(targetDay.getSixtyCycle())

  const sang = (countingAge + taeseNumber) % 8 || 8
  const jung = (monthDays + wolgeonNumber) % 6 || 6
  const ha = (day + iljinNumber) % 3 || 3
  return {
    rulesVersion: TOJEONG_RULES_VERSION,
    sang,
    jung,
    ha,
    gwae: sang * 100 + jung * 10 + ha,
    birthLunar,
    targetLunar: { year: targetYear, month, day },
    countingAge,
    monthDays,
    taeseNumber,
    wolgeonNumber,
    iljinNumber,
  }
}
