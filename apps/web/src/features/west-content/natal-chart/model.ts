import type {
  ChartAspect,
  HouseSystem,
  NatalChart,
  PointKey,
  PointPosition,
  SignKey,
} from '@xuanxue/astro/chart'
import type { LocalDateTime, LocalTimeResolution } from '@xuanxue/astro/places'

/**
 * 三巨头与出生星盘的纯计算层（第 23 组）：表单值校验、按出生地历史时区换算、调用星历引擎、无时间态的跨座判断。
 * 引擎以参数传入（页面按需动态加载 `@xuanxue/astro/chart`，测试直接传模块），本文件只有类型导入，不进入入口包。
 * 免费结果在浏览器计算；付费详批与任何保存的结果以服务端复算为准（design 决策 19，协调者 2026-11-24）。
 */

export type ChartEngine = Pick<
  typeof import('@xuanxue/astro/chart'),
  | 'natalChart'
  | 'chartPositions'
  | 'moonSignsBetween'
  | 'findAspects'
  | 'PLANET_KEYS'
  | 'POINT_KEYS'
>
export type TimeEngine = Pick<
  typeof import('@xuanxue/astro/places'),
  'localToUtc' | 'utcOffsetSeconds'
>

export interface BirthPlace {
  readonly name: string
  readonly admin1: string
  /** ISO 3166-1 alpha-2 */
  readonly country: string
  readonly latitude: number
  readonly longitude: number
  readonly timeZone: string
}

export interface NatalInput {
  readonly year: number
  readonly month: number
  readonly day: number
  /** 不知道出生时间时为 null（按当地正午只给星座，不算上升、天顶与宫位） */
  readonly time: { readonly hour: number; readonly minute: number } | null
  readonly place: BirthPlace
  readonly houseSystem: HouseSystem
}

export type FieldErrorKey = 'date' | 'dateRange' | 'time' | 'place'

export interface NatalForm {
  /** DateField 的值 `YYYY-MM-DD` */
  readonly date: string
  /** TimeField 的值 `HH:MM` */
  readonly time: string
  readonly unknownTime: boolean
  readonly place: BirthPlace | null
  readonly houseSystem: string
}

export const MIN_YEAR = 1900

/** `today` 为访客当地日期 `YYYY-MM-DD`；出生日期须在 1900-01-01 与今天之间 */
export function parseNatalForm(
  form: NatalForm,
  today: string,
):
  | { readonly ok: true; readonly input: NatalInput }
  | {
      readonly ok: false
      readonly errors: Partial<Record<'date' | 'time' | 'place', FieldErrorKey>>
    } {
  const errors: Partial<Record<'date' | 'time' | 'place', FieldErrorKey>> = {}
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.date.trim())
  let year = 0
  let month = 0
  let day = 0
  if (!date) errors.date = 'date'
  else {
    year = Number(date[1])
    month = Number(date[2])
    day = Number(date[3])
    const check = new Date(Date.UTC(2000, month - 1, day))
    check.setUTCFullYear(year)
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) errors.date = 'date'
    else if (year < MIN_YEAR || form.date.trim() > today) errors.date = 'dateRange'
  }
  let time: NatalInput['time'] = null
  if (!form.unknownTime) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(form.time.trim())
    const hour = Number(match?.[1])
    const minute = Number(match?.[2])
    if (!match || hour > 23 || minute > 59) errors.time = 'time'
    else time = { hour, minute }
  }
  if (!form.place) errors.place = 'place'
  if (errors.date || errors.time || errors.place || !form.place) return { ok: false, errors }
  return {
    ok: true,
    input: {
      year,
      month,
      day,
      time,
      place: form.place,
      houseSystem: form.houseSystem === 'whole-sign' ? 'whole-sign' : 'placidus',
    },
  }
}

export interface ZonedMoment extends LocalTimeResolution {
  readonly local: LocalDateTime
  /** 该地当年的标准时偏移（取 1 月与 7 月中较小者）不同于当时偏移：夏令时 */
  readonly daylightSaving: boolean
}

function zoned(local: LocalDateTime, timeZone: string, engine: TimeEngine): ZonedMoment {
  const resolved = engine.localToUtc(local, timeZone)
  const january = engine.utcOffsetSeconds(Date.UTC(local.year, 0, 15, 12), timeZone)
  const july = engine.utcOffsetSeconds(Date.UTC(local.year, 6, 15, 12), timeZone)
  const standard = Math.min(january, july)
  return {
    ...resolved,
    local,
    daylightSaving: january !== july && resolved.offsetSeconds > standard,
  }
}

function nextDay({ year, month, day }: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  // 出生年份 ≥ 1900，Date.UTC 不会把年份当成两位数
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

/** 当天跨座的点：从哪个星座到哪个星座、在何时（UTC） */
export interface SignChange {
  readonly signs: readonly SignKey[]
  readonly atMs: number
}

export type NatalResult =
  | {
      readonly kind: 'timed'
      readonly input: NatalInput
      readonly moment: ZonedMoment
      readonly chart: NatalChart
    }
  | {
      readonly kind: 'untimed'
      readonly input: NatalInput
      /** 当地正午 */
      readonly moment: ZonedMoment
      readonly positions: Record<PointKey, PointPosition>
      /** 当地这一天内换了星座的点（太阳、月亮与行星），供「X 或 Y」显示 */
      readonly changes: Partial<Record<PointKey, SignChange>>
      /** 不含月亮（正午时刻的月亮误差可达 ±7°） */
      readonly aspects: readonly ChartAspect[]
    }

/** 用二分法找到 [lo, hi] 内某点的星座变化时刻（精确到 30 秒） */
function crossing(engine: ChartEngine, key: PointKey, lo: number, hi: number): number {
  const signAt = (ms: number) => engine.chartPositions(ms)[key].sign
  const start = signAt(lo)
  let a = lo
  let b = hi
  while (b - a > 30_000) {
    const mid = Math.floor((a + b) / 2)
    if (signAt(mid) === start) a = mid
    else b = mid
  }
  return b
}

export function computeNatal(
  input: NatalInput,
  chartEngine: ChartEngine,
  timeEngine: TimeEngine,
): NatalResult {
  const { year, month, day, place } = input
  if (input.time) {
    const moment = zoned({ year, month, day, ...input.time }, place.timeZone, timeEngine)
    const chart = chartEngine.natalChart({
      utcMs: moment.utcMs,
      latitude: place.latitude,
      longitude: place.longitude,
      houseSystem: input.houseSystem,
    })
    return { kind: 'timed', input, moment, chart }
  }
  const moment = zoned({ year, month, day, hour: 12, minute: 0 }, place.timeZone, timeEngine)
  const start = timeEngine.localToUtc(
    { year, month, day, hour: 0, minute: 0 },
    place.timeZone,
  ).utcMs
  const end =
    timeEngine.localToUtc({ ...nextDay({ year, month, day }), hour: 0, minute: 0 }, place.timeZone)
      .utcMs - 1
  const positions = chartEngine.chartPositions(moment.utcMs)
  const first = chartEngine.chartPositions(start)
  const last = chartEngine.chartPositions(end)
  const changes: Partial<Record<PointKey, SignChange>> = {}
  for (const key of chartEngine.POINT_KEYS) {
    if (key === 'moon') continue
    const from = first[key].sign
    const to = last[key].sign
    if (from !== to)
      changes[key] = { signs: [from, to], atMs: crossing(chartEngine, key, start, end) }
  }
  // 月亮一天最多走约 15°，最多跨一次座；仍用引擎的 moonSignsBetween 列出全部可能
  const moonSigns = chartEngine.moonSignsBetween(start, end)
  if (moonSigns.length > 1)
    changes.moon = { signs: moonSigns, atMs: crossing(chartEngine, 'moon', start, end) }
  const withoutMoon = chartEngine.PLANET_KEYS.filter((key) => key !== 'moon')
  return {
    kind: 'untimed',
    input,
    moment,
    positions,
    changes,
    aspects: chartEngine.findAspects(positions, withoutMoon),
  }
}

// ---------------------------------------------------------------------------
// 元素与模式
// ---------------------------------------------------------------------------

export type ElementKey = 'fire' | 'earth' | 'air' | 'water'
export type ModalityKey = 'cardinal' | 'fixed' | 'mutable'
const ELEMENTS: readonly ElementKey[] = ['fire', 'earth', 'air', 'water']
const MODALITIES: readonly ModalityKey[] = ['cardinal', 'fixed', 'mutable']
export const SIGN_ORDER: readonly SignKey[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
]
export const elementOf = (sign: SignKey) => ELEMENTS[SIGN_ORDER.indexOf(sign) % 4] as ElementKey
export const modalityOf = (sign: SignKey) => MODALITIES[SIGN_ORDER.indexOf(sign) % 3] as ModalityKey

/** 十颗行星的元素与模式计数（降序）；不确定星座的点（无时间态跨座）不计入 */
export function balance(signs: readonly SignKey[]): {
  elements: { key: ElementKey; count: number }[]
  modalities: { key: ModalityKey; count: number }[]
} {
  const count = <K extends string>(keys: readonly K[], of: (sign: SignKey) => K) =>
    keys
      .map((key) => ({ key, count: signs.filter((sign) => of(sign) === key).length }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
  return { elements: count(ELEMENTS, elementOf), modalities: count(MODALITIES, modalityOf) }
}

// ---------------------------------------------------------------------------
// 格式化（en）
// ---------------------------------------------------------------------------

/** 星座内度数写成 `24°18′`；分向下取整，避免 29°59.6′ 显示成 30°00′ */
export function formatDegree(degree: number): string {
  // 加极小量抵消浮点误差（4.1° 应为 4°06′，不是 4°05′）
  const total = Math.floor(degree * 60 + 1e-7)
  const whole = Math.floor(total / 60)
  const minutes = total % 60
  return `${whole}°${String(minutes).padStart(2, '0')}′`
}

export const formatOrb = formatDegree

export function formatOffset(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+'
  const abs = Math.abs(seconds)
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const rest = abs % 60
  if (abs === 0) return 'UTC'
  if (rest) return `UTC${sign}${hours}:${pad(minutes)}:${pad(rest)}`
  return minutes ? `UTC${sign}${hours}:${pad(minutes)}` : `UTC${sign}${hours}`
}

const pad = (value: number) => String(value).padStart(2, '0')

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lon}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function formatClock(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:${pad(minute)} ${suffix}`
}

export function formatLocalDate({
  year,
  month,
  day,
}: Pick<LocalDateTime, 'year' | 'month' | 'day'>) {
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/** 某 UTC 时刻在出生地的钟面时间（`2:40 AM`） */
export function formatZonedClock(utcMs: number, timeZone: string, engine: TimeEngine): string {
  const local = new Date(utcMs + engine.utcOffsetSeconds(utcMs, timeZone) * 1000)
  return formatClock(local.getUTCHours(), local.getUTCMinutes())
}

export function formatUtc(utcMs: number): string {
  const date = new Date(utcMs)
  const day = formatLocalDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
  return `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

export function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`
}

export const capitalize = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)
