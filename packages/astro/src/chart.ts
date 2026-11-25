import { Body, Ecliptic, e_tilt, GeoVector, MakeTime, SiderealTime } from 'astronomy-engine'

const DEG = Math.PI / 180
const DAY_MS = 86_400_000
// 速度用中心差分；1 小时步长对月亮也足够平滑。
const SPEED_STEP_DAYS = 1 / 24
// 纬度超过此值时 Placidus 宫头在一天中的部分时段无解，按 design 决策 19 一律改用整宫制。
export const PLACIDUS_MAX_LATITUDE = 66

export const PLANET_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const
export const POINT_KEYS = [...PLANET_KEYS, 'meanNode'] as const
export const SIGN_KEYS = [
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
] as const

export type PlanetKey = (typeof PLANET_KEYS)[number]
export type PointKey = (typeof POINT_KEYS)[number]
export type SignKey = (typeof SIGN_KEYS)[number]
export type HouseSystem = 'placidus' | 'whole-sign'
export type AspectKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'

/** 主要相位与容许度（度）。页面须原样说明这组数值。 */
export const ASPECTS: readonly { key: AspectKey; angle: number; orb: number }[] = Object.freeze([
  { key: 'conjunction', angle: 0, orb: 8 },
  { key: 'sextile', angle: 60, orb: 6 },
  { key: 'square', angle: 90, orb: 8 },
  { key: 'trine', angle: 120, orb: 8 },
  { key: 'opposition', angle: 180, orb: 8 },
])

const BODIES: Record<PlanetKey, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
}

// 与 astronomy-engine 的可靠区间及参考样例范围一致；超出时不给结果，避免静默失准。
const MIN_UTC_MS = Date.UTC(1800, 0, 1)
const MAX_UTC_MS = Date.UTC(2400, 0, 1)

export type ZodiacPosition = {
  /** 回归黄道黄经，0 ≤ longitude < 360。 */
  longitude: number
  sign: SignKey
  /** 星座内度数，0 ≤ degree < 30。 */
  degree: number
}

export type PointPosition = ZodiacPosition & {
  /** 黄经日速度（度/日），负值为逆行。 */
  speed: number
  retrograde: boolean
}

export type ChartPoint = PointPosition & { house: number }

export type ChartAspect = {
  a: PointKey
  b: PointKey
  aspect: AspectKey
  /** 与精确相位角的差（度），越小越紧。 */
  orb: number
}

export type HouseResult = {
  system: HouseSystem
  requested: HouseSystem
  /** 请求 Placidus 但因高纬度改用整宫制。 */
  highLatitudeFallback: boolean
  /** 第 1–12 宫宫头黄经。 */
  cusps: number[]
}

export type NatalChart = {
  utcMs: number
  latitude: number
  longitude: number
  points: Record<PointKey, ChartPoint>
  ascendant: ZodiacPosition
  midheaven: ZodiacPosition
  houses: HouseResult
  aspects: ChartAspect[]
}

export type ChartInput = {
  utcMs: number
  latitude: number
  longitude: number
  houseSystem?: HouseSystem
}

export function normalizeDegrees(value: number): number {
  const result = value % 360
  return result < 0 ? result + 360 : result
}

export function zodiacPosition(longitude: number): ZodiacPosition {
  const lon = normalizeDegrees(longitude)
  // 浮点误差可能得到 359.999…→ 下标 12，取模保证落在 0–11。
  const index = Math.floor(lon / 30) % 12
  return { longitude: lon, sign: SIGN_KEYS[index] as SignKey, degree: lon - index * 30 }
}

function assertUtc(utcMs: number) {
  if (!Number.isFinite(utcMs) || utcMs < MIN_UTC_MS || utcMs >= MAX_UTC_MS)
    throw new RangeError('Chart time must be between 1800-01-01 and 2399-12-31 UTC')
}

function assertPlace(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    throw new RangeError('Latitude must be between -90 and 90 degrees')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    throw new RangeError('Longitude must be between -180 and 180 degrees')
}

function planetLongitude(body: Body, utcMs: number): number {
  // GeoVector 含光行时与光行差；Ecliptic 转到真黄道与真春分点（含章动），即通行星盘的视黄经。
  return Ecliptic(GeoVector(body, new Date(utcMs), true)).elon
}

/** 单颗行星的地心视黄经（与 chartPositions 同一口径），供逆行停滞搜索等逐点扫描使用。 */
export function apparentLongitude(planet: PlanetKey, utcMs: number): number {
  assertUtc(utcMs)
  return planetLongitude(BODIES[planet], utcMs)
}

function meanNodeLongitude(utcMs: number): number {
  // Meeus《Astronomical Algorithms》式 47.7（平黄道），再加黄经章动转到真春分点，与视黄经同一参考系。
  const time = MakeTime(new Date(utcMs))
  const t = time.tt / 36525
  const omega =
    125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441 - t ** 4 / 60616000
  return normalizeDegrees(omega + e_tilt(time).dpsi / 3600)
}

function signedDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

function pointPosition(longitudeAt: (utcMs: number) => number, utcMs: number): PointPosition {
  const step = SPEED_STEP_DAYS * DAY_MS
  const speed =
    signedDelta(longitudeAt(utcMs - step), longitudeAt(utcMs + step)) / (2 * SPEED_STEP_DAYS)
  return { ...zodiacPosition(longitudeAt(utcMs)), speed, retrograde: speed < 0 }
}

/** 十颗行星与平均月交点的视黄经。不需要出生地与出生时间以外的输入，可用于无时间星盘（按正午）。 */
export function chartPositions(utcMs: number): Record<PointKey, PointPosition> {
  assertUtc(utcMs)
  const result = {} as Record<PointKey, PointPosition>
  for (const key of PLANET_KEYS) {
    const body = BODIES[key]
    result[key] = pointPosition((ms) => planetLongitude(body, ms), utcMs)
  }
  result.meanNode = pointPosition(meanNodeLongitude, utcMs)
  return result
}

/** [startMs, endMs] 区间内月亮经过的全部星座，按顺序排列。区间不得超过 48 小时。 */
export function moonSignsBetween(startMs: number, endMs: number): SignKey[] {
  assertUtc(startMs)
  assertUtc(endMs)
  if (endMs < startMs || endMs - startMs > 2 * DAY_MS)
    throw new RangeError('Moon sign range must be ordered and at most 48 hours long')
  // 月亮从不逆行，日行约 11.8°–15.4°；48 小时可走近 31°，可能跨两个边界（起止星座之间夹一个整座）。
  // 按 6 小时步长累加黄经增量得到不回绕的终点黄经，再列出其间每个星座。
  const step = DAY_MS / 4
  const start = planetLongitude(Body.Moon, startMs)
  let travelled = 0
  let previous = start
  for (let t = startMs; t < endMs; ) {
    t = Math.min(t + step, endMs)
    const current = planetLongitude(Body.Moon, t)
    travelled += normalizeDegrees(current - previous)
    previous = current
  }
  const first = Math.floor(start / 30)
  const last = Math.floor((start + travelled) / 30)
  return Array.from({ length: last - first + 1 }, (_, i) => SIGN_KEYS[(first + i) % 12] as SignKey)
}

type Frame = { ramc: number; obliquity: number; latitude: number }

function frame(utcMs: number, latitude: number, longitude: number): Frame {
  const time = MakeTime(new Date(utcMs))
  // 地方视恒星时（格林尼治视恒星时 + 东经），与真黄赤交角一起决定上升与天顶。
  const ramc = normalizeDegrees(SiderealTime(time) * 15 + longitude)
  return { ramc, obliquity: e_tilt(time).tobl, latitude }
}

// 赤经为 alpha 的黄道点（黄纬 0）的黄经。
function eclipticFromRightAscension(alpha: number, obliquity: number): number {
  return normalizeDegrees(
    Math.atan2(Math.sin(alpha * DEG), Math.cos(alpha * DEG) * Math.cos(obliquity * DEG)) / DEG,
  )
}

function midheavenOf({ ramc, obliquity }: Frame): number {
  return eclipticFromRightAscension(ramc, obliquity)
}

function ascendantOf({ ramc, obliquity, latitude }: Frame): number {
  const r = ramc * DEG
  const e = obliquity * DEG
  return normalizeDegrees(
    Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(latitude * DEG) * Math.sin(e))) /
      DEG,
  )
}

/**
 * Placidus 宫头（第 11、12、2、3 宫）：按时间三分昼弧或夜弧迭代。
 * 赤纬使 |tanφ·tanδ| ≥ 1（拱极）时无解，返回 null。
 */
function placidusCusp(f: Frame, house: 11 | 12 | 2 | 3): number | null {
  const e = f.obliquity * DEG
  const tanLat = Math.tan(f.latitude * DEG)
  let lambda = eclipticFromRightAscension(
    f.ramc + { 11: 30, 12: 60, 2: 120, 3: 150 }[house],
    f.obliquity,
  )
  for (let i = 0; i < 100; i++) {
    const declination = Math.asin(Math.sin(e) * Math.sin(lambda * DEG))
    const x = tanLat * Math.tan(declination)
    if (Math.abs(x) >= 1) return null
    const ad = Math.asin(x) / DEG
    const dsa = 90 + ad
    const nsa = 90 - ad
    const alpha =
      house === 11
        ? f.ramc + dsa / 3
        : house === 12
          ? f.ramc + (2 * dsa) / 3
          : house === 2
            ? f.ramc + 180 - (2 * nsa) / 3
            : f.ramc + 180 - nsa / 3
    const next = eclipticFromRightAscension(alpha, f.obliquity)
    if (Math.abs(signedDelta(lambda, next)) < 1e-10) return next
    lambda = next
  }
  return null
}

function wholeSignCusps(ascendant: number): number[] {
  const first = Math.floor(normalizeDegrees(ascendant) / 30) * 30
  return Array.from({ length: 12 }, (_, i) => normalizeDegrees(first + i * 30))
}

function placidusCusps(f: Frame, ascendant: number, midheaven: number): number[] | null {
  const c11 = placidusCusp(f, 11)
  const c12 = placidusCusp(f, 12)
  const c2 = placidusCusp(f, 2)
  const c3 = placidusCusp(f, 3)
  if (c11 === null || c12 === null || c2 === null || c3 === null) return null
  const opposite = (value: number) => normalizeDegrees(value + 180)
  return [
    ascendant,
    c2,
    c3,
    opposite(midheaven),
    opposite(c11),
    opposite(c12),
    opposite(ascendant),
    opposite(c2),
    opposite(c3),
    midheaven,
    c11,
    c12,
  ]
}

/** 上升、天顶与宫头。纬度绝对值 >66° 或 Placidus 无解时改用整宫制并标注。 */
export function chartHouses(
  utcMs: number,
  latitude: number,
  longitude: number,
  system: HouseSystem = 'placidus',
): { ascendant: number; midheaven: number; houses: HouseResult } {
  assertUtc(utcMs)
  assertPlace(latitude, longitude)
  const f = frame(utcMs, latitude, longitude)
  const ascendant = ascendantOf(f)
  const midheaven = midheavenOf(f)
  const placidus =
    system === 'placidus' && Math.abs(latitude) <= PLACIDUS_MAX_LATITUDE
      ? placidusCusps(f, ascendant, midheaven)
      : null
  const fallback = system === 'placidus' && placidus === null
  return {
    ascendant,
    midheaven,
    houses: {
      system: placidus ? 'placidus' : 'whole-sign',
      requested: system,
      highLatitudeFallback: fallback,
      cusps: placidus ?? wholeSignCusps(ascendant),
    },
  }
}

/** 黄经所在宫（1–12）。 */
export function houseOf(longitude: number, cusps: readonly number[]): number {
  if (cusps.length !== 12) throw new RangeError('Expected 12 house cusps')
  const lon = normalizeDegrees(longitude)
  for (let i = 0; i < 12; i++) {
    const start = cusps[i] as number
    const end = cusps[(i + 1) % 12] as number
    if (normalizeDegrees(lon - start) < normalizeDegrees(end - start)) return i + 1
  }
  // 只有宫头重合等退化输入才会到这里。
  throw new RangeError('House cusps do not partition the ecliptic')
}

/** 两两比较给定点，返回容许度内的主要相位，按紧密程度排序。 */
export function findAspects(
  positions: Partial<Record<PointKey, { longitude: number }>>,
  keys: readonly PointKey[] = PLANET_KEYS,
): ChartAspect[] {
  const aspects: ChartAspect[] = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i] as PointKey
      const b = keys[j] as PointKey
      const pa = positions[a]
      const pb = positions[b]
      if (!pa || !pb) continue
      const separation = Math.abs(signedDelta(pa.longitude, pb.longitude))
      for (const aspect of ASPECTS) {
        const orb = Math.abs(separation - aspect.angle)
        if (orb <= aspect.orb) {
          aspects.push({ a, b, aspect: aspect.key, orb })
          break
        }
      }
    }
  }
  return aspects.sort((x, y) => x.orb - y.orb)
}

/** 完整出生星盘：行星、平均月交点、上升、天顶、宫头、落宫与主要相位（只含数值与稳定 key）。 */
export function natalChart({
  utcMs,
  latitude,
  longitude,
  houseSystem = 'placidus',
}: ChartInput): NatalChart {
  const positions = chartPositions(utcMs)
  const { ascendant, midheaven, houses } = chartHouses(utcMs, latitude, longitude, houseSystem)
  const points = {} as Record<PointKey, ChartPoint>
  for (const key of POINT_KEYS) {
    const position = positions[key]
    points[key] = { ...position, house: houseOf(position.longitude, houses.cusps) }
  }
  return {
    utcMs,
    latitude,
    longitude,
    points,
    ascendant: zodiacPosition(ascendant),
    midheaven: zodiacPosition(midheaven),
    houses,
    aspects: findAspects(positions),
  }
}
