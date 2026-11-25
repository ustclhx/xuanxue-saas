import { apparentLongitude, normalizeDegrees, SIGN_KEYS, type SignKey } from './chart.ts'

/**
 * 逆行日历（openspec content-growth-v2-tools 第 25.2 项，design 决策 19「后续工具」）：
 * 水星至冥王星的停滞（station）时刻 = 地心视黄经日速度变号的瞬间。
 * 速度与 ./chart 同一口径（视黄经，含光行时、光行差与章动），先按天步进找变号区间，再二分到 1 秒。
 * 输出只含 key 与数值；构建期预计算，浏览器不加载本模块。
 */

export const RETROGRADE_PLANETS = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const
export type RetrogradePlanet = (typeof RETROGRADE_PLANETS)[number]
export type StationKind = 'retrograde' | 'direct'

export type Station = {
  planet: RetrogradePlanet
  /** retrograde：开始逆行（顺行转逆行）；direct：恢复顺行 */
  kind: StationKind
  utcMs: number
  /** 停滞时的视黄经（度） */
  longitude: number
}

export type RetrogradePeriod = {
  planet: RetrogradePlanet
  startMs: number
  endMs: number
  startLongitude: number
  endLongitude: number
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
// 速度用 ±1 小时中心差分（与 ./chart 相同）；截断误差对停滞时刻的影响远小于 1 秒。
const SPEED_STEP_MS = HOUR_MS
// 扫描步长：任何一颗行星的相邻两次停滞都相隔 ≥ 约 20 天，步长内不会出现两次变号。
const SCAN_STEP_DAYS: Record<RetrogradePlanet, number> = {
  mercury: 1,
  venus: 2,
  mars: 2,
  jupiter: 4,
  saturn: 4,
  uranus: 4,
  neptune: 4,
  pluto: 4,
}
const PRECISION_MS = 1_000

function signedDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

/** 视黄经日速度（度/日），负值为逆行。 */
export function longitudeSpeed(planet: RetrogradePlanet, utcMs: number): number {
  const before = apparentLongitude(planet, utcMs - SPEED_STEP_MS)
  const after = apparentLongitude(planet, utcMs + SPEED_STEP_MS)
  return signedDelta(before, after) / ((2 * SPEED_STEP_MS) / DAY_MS)
}

/** [startMs, endMs) 内某颗行星的全部停滞，按时间升序。 */
export function planetStations(
  planet: RetrogradePlanet,
  startMs: number,
  endMs: number,
): Station[] {
  if (!(endMs > startMs)) throw new RangeError('Station search end must follow its start')
  const step = SCAN_STEP_DAYS[planet] * DAY_MS
  const stations: Station[] = []
  let t0 = startMs
  let v0 = longitudeSpeed(planet, t0)
  while (t0 < endMs) {
    const t1 = Math.min(t0 + step, endMs)
    const v1 = longitudeSpeed(planet, t1)
    if (v0 > 0 !== v1 > 0) {
      let lo = t0
      let hi = t1
      let vlo = v0
      while (hi - lo > PRECISION_MS) {
        const mid = (lo + hi) / 2
        const vm = longitudeSpeed(planet, mid)
        if (vm > 0 === vlo > 0) {
          lo = mid
          vlo = vm
        } else {
          hi = mid
        }
      }
      const utcMs = Math.round((lo + hi) / 2 / PRECISION_MS) * PRECISION_MS
      if (utcMs >= startMs && utcMs < endMs)
        stations.push({
          planet,
          kind: v0 > 0 ? 'retrograde' : 'direct',
          utcMs,
          longitude: normalizeDegrees(apparentLongitude(planet, utcMs)),
        })
    }
    t0 = t1
    v0 = v1
  }
  return stations
}

/** 把相邻的「开始逆行 → 恢复顺行」配成逆行期；两端不完整的区间舍去。 */
export function retrogradePeriods(stations: readonly Station[]): RetrogradePeriod[] {
  const periods: RetrogradePeriod[] = []
  for (let i = 0; i + 1 < stations.length; i++) {
    const start = stations[i] as Station
    const end = stations[i + 1] as Station
    if (start.kind !== 'retrograde' || end.kind !== 'direct' || start.planet !== end.planet)
      continue
    periods.push({
      planet: start.planet,
      startMs: start.utcMs,
      endMs: end.utcMs,
      startLongitude: start.longitude,
      endLongitude: end.longitude,
    })
  }
  return periods
}

/** 逆行期间经过的星座：从开始逆行时的星座沿黄经倒退到恢复顺行时的星座。 */
export function retrogradeSigns(startLongitude: number, endLongitude: number): SignKey[] {
  const first = Math.floor(normalizeDegrees(startLongitude) / 30) % 12
  // 逆行弧长不超过约 30°，最多跨一个边界；这里按弧长逐座回退，兼容 0°白羊的回绕。
  const arc = normalizeDegrees(startLongitude - endLongitude)
  const offset = normalizeDegrees(startLongitude) - first * 30
  const crossings = arc > offset ? Math.ceil((arc - offset) / 30) : 0
  return Array.from(
    { length: crossings + 1 },
    (_, i) => SIGN_KEYS[(first - i + 12 * 12) % 12] as SignKey,
  )
}

export type RetrogradeBuildData = {
  buildDate: string
  /** 页面列出的两个年份：构建年与次年（设计稿 B7，随发版滚动）。 */
  years: [number, number]
  /** 停滞搜索区间 [searchStartMs, searchEndMs)：覆盖前一年至后两年，跨年的逆行期都完整。 */
  searchStartMs: number
  searchEndMs: number
  periods: RetrogradePeriod[]
}

function utcYearStart(year: number): number {
  return Date.UTC(year, 0, 1)
}

function buildYearOf(buildDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(buildDate)
  const ms = match ? Date.parse(`${buildDate}T00:00:00Z`) : Number.NaN
  if (!match || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== buildDate)
    throw new RangeError(`Invalid build date: ${buildDate}`)
  return Number(match[1])
}

/** 构建期预计算：构建年前一年 1 月 1 日至构建年后第三年 1 月 1 日（不含）的全部逆行期。 */
export function generateRetrogradeBuildData(buildDate: string): RetrogradeBuildData {
  const year = buildYearOf(buildDate)
  const searchStartMs = utcYearStart(year - 1)
  const searchEndMs = utcYearStart(year + 3)
  const periods = RETROGRADE_PLANETS.flatMap((planet) =>
    retrogradePeriods(planetStations(planet, searchStartMs, searchEndMs)),
  )
  return { buildDate, years: [year, year + 1], searchStartMs, searchEndMs, periods }
}

/** 13 个月：「下一次逆行」最远约 19 个月（金星），表须在任何一天之后至少还能覆盖到明年同期。 */
const COVERAGE_MONTHS = 13

/**
 * 覆盖期检查：当天所在年份必须是页面列出的年份之一，且停滞搜索区间在当天之后还剩 ≥13 个月。
 * 不满足时要求重新构建（年份滚动随发版生效）。
 */
export function assertRetrogradeCoverage(
  data: Pick<RetrogradeBuildData, 'years' | 'searchEndMs' | 'buildDate'>,
  asOfDate: string,
): void {
  const year = buildYearOf(asOfDate)
  if (!data.years.includes(year))
    throw new RangeError(
      `Retrograde table (built ${data.buildDate}) lists ${data.years.join(' and ')}; rebuild for ${year}`,
    )
  const asOf = new Date(`${asOfDate}T00:00:00Z`)
  const required = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth() + COVERAGE_MONTHS,
    asOf.getUTCDate(),
  )
  if (data.searchEndMs < required)
    throw new RangeError(
      `Retrograde table (built ${data.buildDate}) ends ${new Date(data.searchEndMs).toISOString().slice(0, 10)}; need coverage through ${new Date(required).toISOString().slice(0, 10)}`,
    )
}
