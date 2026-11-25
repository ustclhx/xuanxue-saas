import type { SignKey } from '@xuanxue/astro/chart'
import type { RetrogradePlanet } from '@xuanxue/astro/retrograde'
import { zonedDateKey, zonedParts } from '../moon/model.ts'

/**
 * 逆行日历的纯计算（openspec content-growth-v2-tools 25.2）：只在构建期预计算的逆行期表上按时区选行与换算，
 * 服务端与浏览器共用，不引入 astronomy-engine（只有类型来自 @xuanxue/astro）。
 */
export type { RetrogradePlanet, SignKey }

export const PLANET_ORDER: readonly RetrogradePlanet[] = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]

export interface RetroPeriod {
  readonly planet: RetrogradePlanet
  /** 开始逆行（停滞）的 UTC 时刻 */
  readonly startMs: number
  /** 恢复顺行（停滞）的 UTC 时刻 */
  readonly endMs: number
  /** 逆行期间经过的星座，从开始逆行时所在的星座起 */
  readonly signs: readonly SignKey[]
}

export interface RetroData {
  readonly buildDate: string
  /** 页面列出的两个年份（构建年与次年） */
  readonly years: readonly number[]
  readonly searchStartMs: number
  readonly searchEndMs: number
  readonly periods: readonly RetroPeriod[]
}

const byPlanet = (data: RetroData, planet: RetrogradePlanet) =>
  data.periods.filter((period) => period.planet === planet)

/** 当地日历年内（按当地日期）与该年有交集的逆行期 */
export function yearPeriods(
  data: RetroData,
  planet: RetrogradePlanet,
  year: number,
  timeZone: string,
): RetroPeriod[] {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  return byPlanet(data, planet).filter(
    (period) =>
      zonedDateKey(period.startMs, timeZone) <= last &&
      zonedDateKey(period.endMs, timeZone) >= first,
  )
}

/** 该年之后第一次开始的逆行期（当地日期在次年及以后） */
export function nextAfterYear(
  data: RetroData,
  planet: RetrogradePlanet,
  year: number,
  timeZone: string,
): RetroPeriod | undefined {
  const last = `${year}-12-31`
  return byPlanet(data, planet).find((period) => zonedDateKey(period.startMs, timeZone) > last)
}

/** 此刻正在逆行的行星（按行星顺序） */
export function activePeriods(data: RetroData, nowMs: number): RetroPeriod[] {
  return PLANET_ORDER.flatMap((planet) =>
    byPlanet(data, planet).filter((period) => period.startMs <= nowMs && nowMs < period.endMs),
  )
}

export function isActive(period: RetroPeriod, nowMs: number): boolean {
  return period.startMs <= nowMs && nowMs < period.endMs
}

/** 此刻之后第一次开始的逆行期 */
export function nextPeriod(
  data: RetroData,
  planet: RetrogradePlanet,
  nowMs: number,
): RetroPeriod | undefined {
  return byPlanet(data, planet).find((period) => period.startMs > nowMs)
}

/** 此刻之前最近一次结束的逆行期 */
export function lastPeriod(
  data: RetroData,
  planet: RetrogradePlanet,
  nowMs: number,
): RetroPeriod | undefined {
  return byPlanet(data, planet)
    .filter((period) => period.endMs <= nowMs)
    .at(-1)
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

function dayOfYear(key: string): number {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number]
  return (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000
}

/**
 * 时间条的位置：按当地日期在该年中的比例（0 = 1 月 1 日之初，1 = 12 月 31 日之末）。
 * 区间按整日计（开始日与结束日都算进去），跨年的部分截到年界。
 */
export function yearSpan(
  period: Pick<RetroPeriod, 'startMs' | 'endMs'>,
  year: number,
  timeZone: string,
): { start: number; end: number } {
  const days = isLeap(year) ? 366 : 365
  const position = (key: string, end: boolean) => {
    const keyYear = Number(key.slice(0, 4))
    if (keyYear < year) return 0
    if (keyYear > year) return 1
    return (dayOfYear(key) + (end ? 1 : 0)) / days
  }
  return {
    start: position(zonedDateKey(period.startMs, timeZone), false),
    end: position(zonedDateKey(period.endMs, timeZone), true),
  }
}

/** 今天在该年中的位置（当地日期的正中）；不在该年时为 undefined */
export function todayPosition(nowMs: number, year: number, timeZone: string): number | undefined {
  const key = zonedDateKey(nowMs, timeZone)
  if (Number(key.slice(0, 4)) !== year) return undefined
  return (dayOfYear(key) + 0.5) / (isLeap(year) ? 366 : 365)
}

const MONTH_ABBR = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const MONTH_FULL =
  'January February March April May June July August September October November December'.split(' ')

/** 「Feb 26, 2026」 */
export function dateWithYear(utcMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(utcMs, timeZone)
  return `${MONTH_ABBR[month - 1]} ${day}, ${year}`
}

/** 「Dec 10」（与今天同年时）或「Feb 8, 2027」 */
export function dateRelative(utcMs: number, nowMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(utcMs, timeZone)
  const same = zonedParts(nowMs, timeZone).year === year
  return same ? `${MONTH_ABBR[month - 1]} ${day}` : `${MONTH_ABBR[month - 1]} ${day}, ${year}`
}

/** 「February 9, 2027」 */
export function dateLong(utcMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(utcMs, timeZone)
  return `${MONTH_FULL[month - 1]} ${day}, ${year}`
}

/** 两个当地日期相差的天数 */
export function daysUntil(utcMs: number, nowMs: number, timeZone: string): number {
  const to = zonedDateKey(utcMs, timeZone)
  const from = zonedDateKey(nowMs, timeZone)
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** 某个时刻的当地日期是否仍在表所列的两个年份之内 */
export function inListedYears(data: RetroData, nowMs: number, timeZone: string): boolean {
  return data.years.includes(zonedParts(nowMs, timeZone).year)
}
