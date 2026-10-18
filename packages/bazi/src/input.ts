import { LunarMonth, LunarYear, SolarDay } from 'tyme4ts'
import { type CityId, isCityId } from './cities.ts'

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

export type Gender = 'male' | 'female'

export type BirthLocation =
  | { city: CityId }
  /** 不在内置城市表时手选 UTC 偏移（分钟，不含夏令时）；真太阳时需要经度。 */
  | { utcOffsetMinutes: number; longitude?: number }

export type BirthInput = {
  calendar: 'solar' | 'lunar'
  year: number
  month: number
  day: number
  /** 仅农历：是否闰月。 */
  isLeapMonth?: boolean
  /** null 表示「不知道时辰」。 */
  time: { hour: number; minute: number } | null
  gender: Gender
  location: BirthLocation
  /** 真太阳时，默认关闭。 */
  trueSolarTime?: boolean
}

export type InputField =
  | 'calendar'
  | 'year'
  | 'month'
  | 'day'
  | 'leapMonth'
  | 'time'
  | 'gender'
  | 'location'
  | 'trueSolarTime'

export type InputIssueCode =
  | 'required'
  | 'out_of_range'
  | 'invalid_date'
  | 'leap_month_not_exist'
  | 'longitude_required'

export type InputIssue = { field: InputField; code: InputIssueCode }

/** 字段级输入错误；页面按 field + code 渲染本语言提示。 */
export class BaziInputError extends Error {
  override readonly name = 'BaziInputError'
  readonly code = 'BAZI_INVALID_INPUT'
  readonly issues: InputIssue[]

  constructor(issues: InputIssue[]) {
    super(`Invalid birth input: ${issues.map((i) => `${i.field}:${i.code}`).join(', ')}`)
    this.issues = issues
  }
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

/** 农历闰月以负数月份表示，与 tyme4ts 一致。 */
function lunarIssue(input: BirthInput): InputIssue | null {
  const leap = input.isLeapMonth === true
  if (leap && LunarYear.fromYear(input.year).getLeapMonth() !== input.month) {
    return { field: 'leapMonth', code: 'leap_month_not_exist' }
  }
  const days = LunarMonth.fromYm(input.year, leap ? -input.month : input.month).getDayCount()
  return input.day > days ? { field: 'day', code: 'invalid_date' } : null
}

export function validateInput(input: BirthInput): InputIssue[] {
  const issues: InputIssue[] = []
  if (input.calendar !== 'solar' && input.calendar !== 'lunar') {
    issues.push({ field: 'calendar', code: 'required' })
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    issues.push({ field: 'gender', code: 'required' })
  }
  if (!isInt(input.year) || input.year < MIN_YEAR || input.year > MAX_YEAR) {
    issues.push({ field: 'year', code: 'out_of_range' })
  }
  if (!isInt(input.month) || input.month < 1 || input.month > 12) {
    issues.push({ field: 'month', code: 'out_of_range' })
  }
  if (!isInt(input.day) || input.day < 1 || input.day > 31) {
    issues.push({ field: 'day', code: 'out_of_range' })
  }
  if (input.time !== null) {
    const { hour, minute } = input.time ?? {}
    if (!isInt(hour) || hour < 0 || hour > 23 || !isInt(minute) || minute < 0 || minute > 59) {
      issues.push({ field: 'time', code: 'out_of_range' })
    }
  }
  const location = input.location
  let longitude: number | undefined
  if (location !== null && typeof location === 'object' && 'city' in location) {
    if (!isCityId(location.city)) issues.push({ field: 'location', code: 'required' })
    else longitude = 0
  } else if (location !== null && typeof location === 'object' && 'utcOffsetMinutes' in location) {
    const offset = location.utcOffsetMinutes
    const lon = location.longitude
    if (!isInt(offset) || offset < -12 * 60 || offset > 14 * 60) {
      issues.push({ field: 'location', code: 'out_of_range' })
    }
    if (lon !== undefined && (typeof lon !== 'number' || !(lon >= -180 && lon <= 180))) {
      issues.push({ field: 'location', code: 'out_of_range' })
    } else {
      longitude = lon
    }
  } else {
    issues.push({ field: 'location', code: 'required' })
  }
  if (input.trueSolarTime === true && input.time !== null && longitude === undefined) {
    issues.push({ field: 'trueSolarTime', code: 'longitude_required' })
  }
  if (issues.some((i) => ['calendar', 'year', 'month', 'day'].includes(i.field))) return issues

  if (input.calendar === 'lunar') {
    const issue = lunarIssue(input)
    if (issue) issues.push(issue)
  } else if (input.isLeapMonth === true) {
    issues.push({ field: 'leapMonth', code: 'leap_month_not_exist' })
  } else if (
    input.day > SolarDay.fromYmd(input.year, input.month, 1).getSolarMonth().getDayCount()
  ) {
    issues.push({ field: 'day', code: 'invalid_date' })
  }
  return issues
}

export function assertValidInput(input: BirthInput): void {
  const issues = validateInput(input)
  if (issues.length > 0) throw new BaziInputError(issues)
}
