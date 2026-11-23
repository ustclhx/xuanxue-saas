import {
  ApsisKind,
  Body,
  Illumination,
  MoonPhase,
  NextMoonQuarter,
  SearchLunarApsis,
  SearchMoonPhase,
  SearchMoonQuarter,
} from 'astronomy-engine'

const DAY_MS = 86_400_000
const QUARTER_KEYS = ['new-moon', 'first-quarter', 'full-moon', 'last-quarter'] as const

export type MoonQuarterKey = (typeof QUARTER_KEYS)[number]
export type MoonPhaseKey =
  | MoonQuarterKey
  | 'waxing-crescent'
  | 'waxing-gibbous'
  | 'waning-gibbous'
  | 'waning-crescent'

// 行号是相对起日的日偏移，构建产物无需为每行重复日期。
export type MoonDay = readonly [phase: MoonPhaseKey, illumination: number, ageDays: number]
export type MoonQuarterEvent =
  | { phase: Exclude<MoonQuarterKey, 'full-moon'>; utcMs: number }
  | { phase: 'full-moon'; utcMs: number; supermoon: boolean; blueMoon: boolean }

const FULL_MOON_NAMES = Object.freeze({
  1: 'wolf-moon',
  2: 'snow-moon',
  3: 'worm-moon',
  4: 'pink-moon',
  5: 'flower-moon',
  6: 'strawberry-moon',
  7: 'buck-moon',
  8: 'sturgeon-moon',
  9: 'corn-moon',
  10: 'hunters-moon',
  11: 'beaver-moon',
  12: 'cold-moon',
} as const)

/** 公历月份（1–12）对应的传统月名 key。 */
export function fullMoonNames() {
  return FULL_MOON_NAMES
}

function dateKey(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10)
}

function utcMidnight(date: string): number {
  const utcMs = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(utcMs) || dateKey(utcMs) !== date) {
    throw new RangeError(`Expected a valid UTC calendar date (YYYY-MM-DD): ${date}`)
  }
  return utcMs
}

function* quarters(start: number, end: number) {
  for (
    // 从边界之前开始搜索，再按 UTC 毫秒筛选，避免漏掉恰在起点的事件。
    let quarter = SearchMoonQuarter(new Date(start - 1000));
    quarter.time.date.getTime() < end;
    quarter = NextMoonQuarter(quarter)
  ) {
    const utcMs = quarter.time.date.getTime()
    // Astronomy Engine 的 MoonQuarter 契约保证 quarter 为 0–3。
    const phase = QUARTER_KEYS[quarter.quarter as 0 | 1 | 2 | 3]
    if (utcMs >= start) yield { phase, utcMs }
  }
}

function betweenQuarters(angle: number): MoonPhaseKey {
  if (angle < 90) return 'waxing-crescent'
  if (angle < 180) return 'waxing-gibbous'
  if (angle < 270) return 'waning-gibbous'
  return 'waning-crescent'
}

/** 按 UTC 日期连续排列。主要相位当天取事件时刻，其余日取 UTC 正午。 */
export function moonPhaseTable(startDate: string, days: number): MoonDay[] {
  const start = utcMidnight(startDate)
  if (!Number.isSafeInteger(days) || days < 0)
    throw new RangeError('Expected a nonnegative day count')
  if (days === 0) return []

  // 向前查一个完整朔望月，第一行也能得到从上次朔起算的月龄。
  const previousNewMoon = SearchMoonPhase(0, new Date(start), -32)
  if (!previousNewMoon) throw new Error(`No preceding new moon for ${startDate}`)
  let newMoonMs = previousNewMoon.date.getTime()

  const events = quarters(start, start + days * DAY_MS)
  let next = events.next()
  const rows: MoonDay[] = []
  for (let i = 0; i < days; i++) {
    const dayStart = start + i * DAY_MS
    const event = !next.done && next.value.utcMs < dayStart + DAY_MS ? next.value : undefined
    const sampleMs = event?.utcMs ?? dayStart + DAY_MS / 2
    if (event?.phase === 'new-moon') newMoonMs = sampleMs
    if (event) next = events.next()

    const sample = new Date(sampleMs)
    const phase = event?.phase ?? betweenQuarters(MoonPhase(sample))
    const illumination = Math.round(Illumination(Body.Moon, sample).phase_fraction * 1000) / 1000
    const ageDays = Math.round(((sampleMs - newMoonMs) / DAY_MS) * 100) / 100
    rows.push([phase, illumination, ageDays])
  }
  return rows
}

/** 返回 [startDate, endDate) 内的主要相位，UTC 时刻以 Unix 毫秒表示。 */
export function moonQuarterEvents(startDate: string, endDate: string): MoonQuarterEvent[] {
  const start = utcMidnight(startDate)
  const end = utcMidnight(endDate)
  if (end < start) throw new RangeError('Moon event end date precedes its start date')
  if (end === start) return []

  // 从 UTC 月初扫描，子区间内的第二次满月依然会标为蓝月。
  const monthStart = new Date(start).setUTCDate(1)
  let previousFullMoonMonth = ''
  const events: MoonQuarterEvent[] = []
  for (const { phase, utcMs } of quarters(monthStart, end)) {
    if (phase !== 'full-moon') {
      if (utcMs >= start) events.push({ phase, utcMs })
      continue
    }

    const month = dateKey(utcMs).slice(0, 7)
    const blueMoon = previousFullMoonMonth === month
    previousFullMoonMonth = month
    if (utcMs < start) continue

    // 采用 NASA 的「近地点前后约一天」口径，固定为 24 小时。
    const apsis = SearchLunarApsis(new Date(utcMs - DAY_MS))
    const supermoon =
      apsis.kind === ApsisKind.Pericenter && apsis.time.date.getTime() <= utcMs + DAY_MS
    events.push({ phase, utcMs, supermoon, blueMoon })
  }
  return events
}

function shiftCalendarMonth(utcMs: number, months: number): number {
  const date = new Date(utcMs)
  const day = date.getUTCDate()
  // 先定位目标月的末日，再把 29–31 日按目标月长度截断。
  date.setUTCMonth(date.getUTCMonth() + months + 1, 0)
  return date.setUTCDate(Math.min(day, date.getUTCDate()))
}

export type MoonBuildData = {
  startDate: string
  /** 不含此日。 */
  endDate: string
  days: MoonDay[]
  events: MoonQuarterEvent[]
}

/** 生成可直接序列化的 UTC 月相数据。buildDate 由调用方在构建开始时确定。 */
export function generateMoonBuildData(buildDate: string): MoonBuildData {
  const build = utcMidnight(buildDate)
  const start = shiftCalendarMonth(build, -1)
  const end = shiftCalendarMonth(build, 14)
  const startDate = dateKey(start)
  const endDate = dateKey(end)
  return {
    startDate,
    endDate,
    days: moonPhaseTable(startDate, (end - start) / DAY_MS),
    events: moonQuarterEvents(startDate, endDate),
  }
}

/** 构建时检查所用表的排他结束日，剩余不足 13 个公历月则要求重新生成。 */
export function assertMoonCoverage(endDate: string, asOfDate: string): void {
  const requiredEnd = shiftCalendarMonth(utcMidnight(asOfDate), 13)
  if (utcMidnight(endDate) < requiredEnd) {
    throw new RangeError(
      `Moon table ends at ${endDate}; need coverage through ${dateKey(requiredEnd)} (exclusive)`,
    )
  }
}
