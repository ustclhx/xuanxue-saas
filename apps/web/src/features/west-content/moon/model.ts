import type { MoonDay, MoonPhaseKey, MoonQuarterEvent, MoonQuarterKey } from '@xuanxue/astro/moon'

/**
 * 月相页的纯计算（openspec content-growth-v2-tools 决策 11）：只在构建期预计算的表上「按日期选行」与按时区换算，
 * 服务端与浏览器共用，不引入 astronomy-engine（只有类型来自 @xuanxue/astro/moon）。
 */
export type { MoonDay, MoonPhaseKey, MoonQuarterEvent, MoonQuarterKey }

export interface MoonTable {
  /** 第一行对应的 UTC 日期 `YYYY-MM-DD` */
  readonly startDate: string
  readonly days: readonly MoonDay[]
  /** 主要月相，按时间升序 */
  readonly events: readonly MoonQuarterEvent[]
}

export interface CivilMonth {
  readonly year: number
  readonly month: number
}

const DAY_MS = 86_400_000
/** 平均朔望月（天）：月龄过半之前为盈，之后为亏 */
export const SYNODIC_DAYS = 29.530589
export const UTC = 'UTC'

export function dateKeyOf(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

export function parseDateKey(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const ms = Date.parse(`${key}T00:00:00Z`)
  return Number.isFinite(ms) && dateKeyOf(ms) === key ? ms : null
}

export function addDays(key: string, days: number): string {
  return dateKeyOf((parseDateKey(key) ?? 0) + days * DAY_MS)
}

export function daysBetween(from: string, to: string): number {
  return Math.round(((parseDateKey(to) ?? 0) - (parseDateKey(from) ?? 0)) / DAY_MS)
}

const zonedFormats = new Map<string, Intl.DateTimeFormat>()
function zonedFormat(timeZone: string) {
  let format = zonedFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    zonedFormats.set(timeZone, format)
  }
  return format
}

/** 某一 UTC 时刻在指定时区的日历日期 `YYYY-MM-DD` */
export function zonedDateKey(utcMs: number, timeZone: string): string {
  const parts = Object.fromEntries(
    zonedFormat(timeZone)
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** 浏览器给出的 IANA 时区是否可用（不可用时页面按 UTC 显示并提示） */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function inTable(table: MoonTable, key: string): boolean {
  const index = daysBetween(table.startDate, key)
  return index >= 0 && index < table.days.length
}

/** 盈亏与照亮比例推出的中间相位（主要相位当天另由事件判定） */
export function intermediatePhase(illumination: number, ageDays: number): MoonPhaseKey {
  const waxing = ageDays < SYNODIC_DAYS / 2
  if (waxing) return illumination < 0.5 ? 'waxing-crescent' : 'waxing-gibbous'
  return illumination > 0.5 ? 'waning-gibbous' : 'waning-crescent'
}

export interface MoonDayView {
  readonly date: string
  readonly phase: MoonPhaseKey
  readonly illumination: number
  readonly ageDays: number
  /** 当地这一天内发生的主要月相 */
  readonly quarter: MoonQuarterEvent | null
}

/**
 * 按访客所在时区的日历日期选行。表按 UTC 日期排列：照亮比例与月龄取同一 UTC 日期的行，
 * 主要月相按事件时刻换算到当地日期后判定，避免跨日期变更线时把满月标在前后一天。
 */
export function moonDay(table: MoonTable, key: string, timeZone: string): MoonDayView | null {
  const row = table.days[daysBetween(table.startDate, key)]
  if (!row || !inTable(table, key)) return null
  const [rowPhase, illumination, ageDays] = row
  const quarter = table.events.find((event) => zonedDateKey(event.utcMs, timeZone) === key) ?? null
  const phase =
    quarter?.phase ?? (isQuarter(rowPhase) ? intermediatePhase(illumination, ageDays) : rowPhase)
  return { date: key, phase, illumination, ageDays, quarter }
}

function isQuarter(phase: MoonPhaseKey): phase is MoonQuarterKey {
  return (
    phase === 'new-moon' ||
    phase === 'first-quarter' ||
    phase === 'full-moon' ||
    phase === 'last-quarter'
  )
}

/** 此刻的月龄（天）：距上一次新月的时间；表外返回 null */
export function moonAgeAt(table: MoonTable, nowMs: number): number | null {
  let previous: MoonQuarterEvent | undefined
  for (const event of table.events) {
    if (event.utcMs > nowMs) break
    if (event.phase === 'new-moon') previous = event
  }
  return previous ? (nowMs - previous.utcMs) / DAY_MS : null
}

export function nextEvent(
  table: MoonTable,
  phase: MoonQuarterKey,
  afterMs: number,
): MoonQuarterEvent | null {
  return table.events.find((event) => event.phase === phase && event.utcMs >= afterMs) ?? null
}

/**
 * 月份页显示的年份（spec「月份页随时间滚动」）：该月份最近一次尚未结束的那个月。
 * 当月与之后的月份取今年，已过去的月份取明年。
 */
export function displayYear(month: number, today: CivilMonth): number {
  return month >= today.month ? today.year : today.year + 1
}

export function civilMonthOf(key: string): CivilMonth {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }
}

export function shiftMonth({ year, month }: CivilMonth, delta: number): CivilMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function monthDays({ year, month }: CivilMonth): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`)
}

/** 这个月有没有任何一天落在表内（`?year=` 只接受表能覆盖的年份） */
export function monthCovered(table: MoonTable, month: CivilMonth): boolean {
  return monthDays(month).some((key) => inTable(table, key))
}

export interface MonthCell {
  readonly date: string
  readonly day: number
  /** 表外的日子没有月相 */
  readonly view: MoonDayView | null
}

/** 月历格：第一行前补齐星期（`weekStart` 0 为周日开头，1 为周一开头，es 按西语习惯周一开头），供 7 列网格使用 */
export function monthGrid(
  table: MoonTable,
  month: CivilMonth,
  timeZone: string,
  weekStart: 0 | 1 = 0,
): { leading: number; cells: MonthCell[] } {
  const keys = monthDays(month)
  const leading = (new Date(`${keys[0]}T00:00:00Z`).getUTCDay() - weekStart + 7) % 7
  return {
    leading,
    cells: keys.map((date, i) => ({ date, day: i + 1, view: moonDay(table, date, timeZone) })),
  }
}

/** 当地日期落在该月的主要月相 */
export function monthEvents(
  table: MoonTable,
  { year, month }: CivilMonth,
  timeZone: string,
): MoonQuarterEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return table.events.filter((event) => zonedDateKey(event.utcMs, timeZone).startsWith(prefix))
}

export interface FullMoonRow {
  readonly utcMs: number
  /** 当地日期所在的公历月（1–12），决定传统月名 */
  readonly month: number
  readonly year: number
  readonly supermoon: boolean
  /** 同一当地公历月的第二次满月 */
  readonly blueMoon: boolean
}

/** 满月列表：月名与蓝月按当地公历月判定（UTC 首屏与引擎一致，换算后按访客时区重算） */
export function fullMoons(table: MoonTable, timeZone: string): FullMoonRow[] {
  const rows: FullMoonRow[] = []
  let previousMonth = ''
  for (const event of table.events) {
    if (event.phase !== 'full-moon') continue
    const key = zonedDateKey(event.utcMs, timeZone)
    const ym = key.slice(0, 7)
    rows.push({
      utcMs: event.utcMs,
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      supermoon: event.supermoon,
      blueMoon: ym === previousMonth,
    })
    previousMonth = ym
  }
  return rows
}

/**
 * 月相图的亮面路径（设计稿 Proposals「MoonPhase」，viewBox 140、半径 60）：外缘为半圆，
 * 明暗交界线是横半轴 |1 − 2k|·60 的半椭圆。北半球视角：盈月亮在右，亏月亮在左。
 * 返回 null 表示无亮面（新月），'full' 表示整圆。
 */
export function moonLitPath(illumination: number, waxing: boolean): string | null | 'full' {
  const k = Math.min(1, Math.max(0, illumination))
  if (k < 0.005) return null
  if (k > 0.995) return 'full'
  const rx = Math.round(Math.abs(1 - 2 * k) * 600) / 10
  const outer = waxing ? 1 : 0
  // 新月到半月为月牙（交界线朝亮边凸起），半月之后为凸月（交界线朝暗边凸起）
  const inner = k < 0.5 === waxing ? 0 : 1
  return `M70 10 A60 60 0 0 ${outer} 70 130 A${rx} 60 0 0 ${inner} 70 10 Z`
}

export function isWaxing(view: Pick<MoonDayView, 'ageDays'>): boolean {
  return view.ageDays < SYNODIC_DAYS / 2
}

const partFormats = new Map<string, Intl.DateTimeFormat>()
/** 某一 UTC 时刻在指定时区的年月日时分（数值，不依赖各运行环境 ICU 的文字格式，避免水合差异） */
export function zonedParts(utcMs: number, timeZone: string) {
  let format = partFormats.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
    partFormats.set(timeZone, format)
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date(utcMs)).map((part) => [part.type, Number(part.value)]),
  )
  const year = parts.year ?? 0
  const month = parts.month ?? 1
  const day = parts.day ?? 1
  return { year, month, day, hour: (parts.hour ?? 0) % 24, minute: parts.minute ?? 0 }
}

const MONTH_ABBR = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const MONTH_FULL =
  'January February March April May June July August September October November December'.split(' ')
const WEEKDAY_FULL = 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ')

/** 「Jan 22」 */
export function shortDate(utcMs: number, timeZone: string): string {
  const { month, day } = zonedParts(utcMs, timeZone)
  return `${MONTH_ABBR[month - 1]} ${day}`
}

/** 「3:17 AM」 */
export function clockTime(utcMs: number, timeZone: string): string {
  const { hour, minute } = zonedParts(utcMs, timeZone)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

/** 「Monday, November 23, 2026」（日历日期本身，不换算时区） */
export function longDate(key: string): string {
  const date = new Date(parseDateKey(key) ?? 0)
  return `${WEEKDAY_FULL[date.getUTCDay()]}, ${MONTH_FULL[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

/** 「January 22, 2027」 */
export function fullDate(utcMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(utcMs, timeZone)
  return `${MONTH_FULL[month - 1]} ${day}, ${year}`
}

// es（第 19.4 项）：西语日期写法「22 ene」「lunes, 23 de noviembre de 2026」「22 de enero de 2027」，时刻用 24 小时制
const ES_MONTHS =
  'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(
    ' ',
  )
const ES_WEEKDAYS = 'domingo lunes martes miércoles jueves viernes sábado'.split(' ')

/** 「22 ene」 */
export function shortDateEs(utcMs: number, timeZone: string): string {
  const { month, day } = zonedParts(utcMs, timeZone)
  return `${day} ${ES_MONTHS[month - 1]?.slice(0, 3)}`
}

/** 「03:17」 */
export function clockTimeEs(utcMs: number, timeZone: string): string {
  const { hour, minute } = zonedParts(utcMs, timeZone)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 「lunes, 23 de noviembre de 2026」（日历日期本身，不换算时区） */
export function longDateEs(key: string): string {
  const date = new Date(parseDateKey(key) ?? 0)
  return `${ES_WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${ES_MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`
}

/** 「22 de enero de 2027」 */
export function fullDateEs(utcMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(utcMs, timeZone)
  return `${day} de ${ES_MONTHS[month - 1]} de ${year}`
}
