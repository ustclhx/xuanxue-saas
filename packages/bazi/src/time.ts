import { LunarDay } from 'tyme4ts'
import { CITIES } from './cities.ts'
import type { BirthInput } from './input.ts'
import { wallToUtc, zoneOffsetAt } from './zones.ts'

export type DateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export type BirthTime = {
  /** 国历出生日期（农历输入已换算）。 */
  solarDate: { year: number; month: number; day: number }
  /** 访客填写的当地钟表时间；不知道时辰为 null。 */
  clock: DateTimeParts | null
  /** 出生时刻（UTC 毫秒）；不知道时辰时取当地 12:00。 */
  utcMs: number
  offsetSeconds: number
  standardOffsetSeconds: number
  dst: boolean
  /** 去掉夏令时后的当地标准时间。 */
  standard: DateTimeParts
  /** 真太阳时（开启且有时辰时）。 */
  trueSolar: DateTimeParts | null
  trueSolarCorrectionMinutes: number | null
  /** 日柱、时柱实际使用的时间：真太阳时或当地标准时间。 */
  used: DateTimeParts
  /** 出生时刻的北京时间（UTC+8），用于与 tyme4ts 的节气时刻比较。 */
  beijing: DateTimeParts
}

const MINUTE = 60_000
const BEIJING_OFFSET = 8 * 3600

export function partsOf(ms: number): DateTimeParts {
  const d = new Date(ms)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  }
}

/**
 * 均时差（分钟），NOAA 近似公式，误差约 ±0.5 分钟。
 * 结果按分钟取整后才参与排盘，避免不同 JS 引擎三角函数末位差异影响结果。
 */
export function equationOfTime(utcMs: number): number {
  const d = new Date(utcMs)
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((utcMs - startOfYear) / 86_400_000)
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (d.getUTCHours() - 12) / 24)
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  )
}

/** 出生信息 → 排盘所用各种时间。调用前须先通过 validateInput。 */
export function resolveBirthTime(input: BirthInput): BirthTime {
  const solarDate =
    input.calendar === 'lunar'
      ? (() => {
          const s = LunarDay.fromYmd(
            input.year,
            input.isLeapMonth === true ? -input.month : input.month,
            input.day,
          ).getSolarDay()
          return { year: s.getYear(), month: s.getMonth(), day: s.getDay() }
        })()
      : { year: input.year, month: input.month, day: input.day }

  const hour = input.time?.hour ?? 12
  const minute = input.time?.minute ?? 0
  // 当地钟表时间按 UTC 编码，便于与偏移相加减
  const wall = Date.UTC(solarDate.year, solarDate.month - 1, solarDate.day, hour, minute)
  const location = input.location

  let utcMs: number
  let offset: number
  let std: number
  let longitude: number | undefined
  if ('city' in location) {
    const city = CITIES[location.city]
    utcMs = wallToUtc(city.zone, wall)
    ;({ offset, std } = zoneOffsetAt(city.zone, utcMs))
    longitude = city.longitude
  } else {
    offset = location.utcOffsetMinutes * 60
    std = offset
    utcMs = wall - offset * 1000
    longitude = location.longitude
  }

  const standard = partsOf(utcMs + std * 1000)
  let trueSolar: DateTimeParts | null = null
  let correction: number | null = null
  if (input.trueSolarTime === true && input.time !== null && longitude !== undefined) {
    // 真太阳时 = UTC + 经度 × 4 分钟 + 均时差；修正量取整到分钟
    const solarMs = utcMs + longitude * 4 * MINUTE + equationOfTime(utcMs) * MINUTE
    const rounded = Math.round((solarMs - utcMs - std * 1000) / MINUTE)
    correction = rounded
    trueSolar = partsOf(utcMs + std * 1000 + rounded * MINUTE)
  }

  return {
    solarDate,
    clock: input.time === null ? null : partsOf(wall),
    utcMs,
    offsetSeconds: offset,
    standardOffsetSeconds: std,
    dst: offset !== std,
    standard,
    trueSolar,
    trueSolarCorrectionMinutes: correction,
    used: trueSolar ?? standard,
    beijing: partsOf(utcMs + BEIJING_OFFSET * 1000),
  }
}
