/**
 * 每日运势的「今日」（add-birth-profiles-daily-horoscope design D8）。
 *
 * - 服务端与缓存按站点语言的参考时区确定参考日期：繁简中文 UTC+8，韩语 UTC+9，英语 America/New_York；
 * - 浏览器水合后用访客本地日期校正，不同则在本地重算；
 * - 日界一律采用民用 00:00，不以 23:00 子初换日。
 *
 * 只依赖 Intl，不引用引擎或运行时模块，页面、缓存函数与测试共用。
 */

export interface CivilDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

/** 参考时区；繁简中文都用 UTC+8（台北与北京同为 UTC+8 且无夏令时） */
export const DAILY_TIME_ZONES = {
  'zh-Hant': 'Asia/Taipei',
  'zh-Hans': 'Asia/Taipei',
  ko: 'Asia/Seoul',
  en: 'America/New_York',
} as const

export type DailyLocale = keyof typeof DAILY_TIME_ZONES

export function isDailyLocale(locale: string): locale is DailyLocale {
  return Object.hasOwn(DAILY_TIME_ZONES, locale)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function zonedParts(now: Date, timeZone: string) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

/** 某时区在 `now` 时刻的公历日期 */
export function dateInZone(now: Date, timeZone: string): CivilDate {
  const { year, month, day } = zonedParts(now, timeZone)
  return { year, month, day }
}

/** 站点语言的参考日期 */
export function referenceDate(locale: DailyLocale, now = new Date()): CivilDate {
  return dateInZone(now, DAILY_TIME_ZONES[locale])
}

/** 距参考时区当日结束（下一个 00:00）的秒数，至少 1 秒 */
export function secondsUntilDayEnd(locale: DailyLocale, now = new Date()): number {
  const { hour, minute, second } = zonedParts(now, DAILY_TIME_ZONES[locale])
  return Math.max(1, 86_400 - (hour * 3600 + minute * 60 + second))
}

/** 浏览器所在时区的公历日期（水合后调用） */
export function browserDate(now = new Date()): CivilDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

export function sameDate(a: CivilDate, b: CivilDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** `YYYY-MM-DD`，缓存键与结构化数据使用 */
export function dateKey(date: CivilDate): string {
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`
}

export function parseDateKey(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day))
  return check.getUTCMonth() === date.month - 1 && check.getUTCDate() === date.day ? date : null
}

/** 自 1970-01-01 起的天数：文案按日期确定性轮换的种子 */
export function dayNumber(date: CivilDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000)
}

/** 两个日期相差的天数（b − a） */
export function daysBetween(a: CivilDate, b: CivilDate): number {
  return dayNumber(b) - dayNumber(a)
}

/** 按语言格式化的长日期（含星期），日期按 UTC 构造，避免运行环境时区改变星期 */
export function formatLongDate(date: CivilDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)))
}

/** 不含星期的日期（页面 title） */
export function formatDate(date: CivilDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)))
}

/** 不含年份与星期的短日期（今日面板标题） */
export function formatShortDate(date: CivilDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)))
}
