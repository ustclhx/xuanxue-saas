// 出生地与历史时区：地名来自 GeoNames cities15000（CC BY 4.0）构建的静态切片，时差由运行时的 Intl（IANA tzdb）求得，不查数据库。

export type LocalDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export type LocalTimeResolution = {
  utcMs: number
  /** 该时刻的 UTC 偏移（秒）。地方平时（LMT）可能不是整分钟。 */
  offsetSeconds: number
  /**
   * ok：唯一时刻；ambiguous：夏令时结束时重复的一小时，取较早时刻；
   * nonexistent：夏令时开始或改时区跳过的时间，按跳变前偏移换算（等同把钟拨快后的时刻）。
   */
  status: 'ok' | 'ambiguous' | 'nonexistent'
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let result = formatters.get(timeZone)
  if (!result) {
    result = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, result)
  }
  return result
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone === '') return false
  try {
    formatter(timeZone)
    return true
  } catch {
    return false
  }
}

/** utcMs 时刻在 timeZone 的 UTC 偏移（秒）。 */
export function utcOffsetSeconds(utcMs: number, timeZone: string): number {
  // Intl 只到秒，先截掉毫秒再比较，偏移才是整秒。
  const whole = Math.floor(utcMs / 1000) * 1000
  const parts: Record<string, string> = {}
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(whole)))
    parts[type] = value
  const year = Number(parts.year) * (parts.era === 'BC' || parts.era === 'B' ? -1 : 1)
  const local = Date.UTC(
    0,
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  // Date.UTC 会把 0–99 年当成 1900 年代，用 setUTCFullYear 写回真实年份。
  const date = new Date(local)
  date.setUTCFullYear(year)
  return Math.round((date.getTime() - whole) / 1000)
}

function wallClockMs({ year, month, day, hour, minute }: LocalDateTime): number {
  const date = new Date(Date.UTC(2000, month - 1, day, hour, minute))
  date.setUTCFullYear(year)
  const valid =
    Number.isInteger(year) &&
    Number.isInteger(minute) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  if (!valid) throw new RangeError('Invalid local date or time')
  // 2000 年作为中间值避免 Date.UTC 的两位年份映射；setUTCFullYear 可能改动闰日，上面已核对。
  return date.getTime()
}

/** 出生地当地时间按当时的历史时差与夏令时换算为 UTC。 */
export function localToUtc(local: LocalDateTime, timeZone: string): LocalTimeResolution {
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${timeZone}`)
  const wall = wallClockMs(local)
  const day = 86_400_000
  // 一天内最多一次跳变：用前后各一天的偏移作为候选，凡能自洽者即为该墙钟时间对应的时刻。
  const before = utcOffsetSeconds(wall - day, timeZone)
  const candidates = new Set([
    before,
    utcOffsetSeconds(wall, timeZone),
    utcOffsetSeconds(wall + day, timeZone),
  ])
  const matches: { utcMs: number; offsetSeconds: number }[] = []
  for (const offset of candidates) {
    const utcMs = wall - offset * 1000
    if (utcOffsetSeconds(utcMs, timeZone) === offset) matches.push({ utcMs, offsetSeconds: offset })
  }
  matches.sort((a, b) => a.utcMs - b.utcMs)
  const first = matches[0]
  if (first) return { ...first, status: matches.length > 1 ? 'ambiguous' : 'ok' }
  return { utcMs: wall - before * 1000, offsetSeconds: before, status: 'nonexistent' }
}

// ---------------------------------------------------------------------------
// 地名切片
// ---------------------------------------------------------------------------

/** 切片格式版本；改动结构时同时改静态资源路径中的版本号。 */
export const PLACE_DATA_VERSION = 1
export const PLACE_SLICE_KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const PLACE_ATTRIBUTION = Object.freeze({
  source: 'GeoNames',
  url: 'https://www.geonames.org/',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
})

/** [名称, 一级行政区, ISO 国家代码, 纬度, 经度, 时区下标]，按人口降序排列。 */
export type PlaceRow = [
  name: string,
  admin1: string,
  country: string,
  latitude: number,
  longitude: number,
  timeZone: number,
]

export type PlaceSlice = {
  v: number
  key: string
  /** 本切片用到的 IANA 时区。 */
  tz: string[]
  places: PlaceRow[]
}

export type Place = {
  name: string
  admin1: string
  /** ISO 3166-1 alpha-2，页面用 Intl.DisplayNames 本地化。 */
  country: string
  latitude: number
  longitude: number
  timeZone: string
}

/** 去掉变音符、统一大小写与标点，用于前缀匹配。 */
export function normalizePlaceName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\p{M}\p{Lm}]/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/þ/g, 'th')
    .replace(/ə/g, 'a')
    .replace(/ı/g, 'i')
    .replace(/[đð]/g, 'd')
    .replace(/[ł]/g, 'l')
    .replace(/[ø]/g, 'o')
    .replace(/[æ]/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** 查询或地名所在的切片 key；首字符不是 a–z 时返回 null。 */
export function placeSliceKey(value: string): string | null {
  const first = normalizePlaceName(value).charAt(0)
  return first >= 'a' && first <= 'z' ? first : null
}

export type PlaceSearch = (query: string, limit?: number) => Promise<Place[]>

/**
 * 地名自动补全。load 由调用方提供（页面 fetch 静态切片，测试读本地文件），每个切片只加载一次。
 * 排序：名称完全相同优先，其余按人口（切片内顺序）。
 */
export function createPlaceSearch(load: (key: string) => Promise<PlaceSlice>): PlaceSearch {
  const cache = new Map<string, Promise<{ slice: PlaceSlice; names: string[] }>>()
  return async (query, limit = 8) => {
    const needle = normalizePlaceName(query)
    const key = placeSliceKey(needle)
    if (!key || needle.length < 2) return []
    let entry = cache.get(key)
    if (!entry) {
      entry = load(key).then((slice) => {
        if (slice.v !== PLACE_DATA_VERSION || slice.key !== key)
          throw new Error(`Unexpected place slice ${slice.key} v${slice.v}`)
        return { slice, names: slice.places.map(([name]) => normalizePlaceName(name)) }
      })
      // 加载失败不缓存，允许下次重试。
      entry.catch(() => cache.delete(key))
      cache.set(key, entry)
    }
    const { slice, names } = await entry
    const exact: Place[] = []
    const prefix: Place[] = []
    for (let i = 0; i < names.length && exact.length < limit; i++) {
      const name = names[i] as string
      if (!name.startsWith(needle)) continue
      const [placeName, admin1, country, latitude, longitude, tzIndex] = slice.places[i] as PlaceRow
      const place = {
        name: placeName,
        admin1,
        country,
        latitude,
        longitude,
        timeZone: slice.tz[tzIndex] as string,
      }
      ;(name === needle ? exact : prefix).push(place)
    }
    return [...exact, ...prefix].slice(0, limit)
  }
}
