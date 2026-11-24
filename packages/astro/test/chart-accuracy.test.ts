// 精度门槛（content-growth-v2-tools 22.3 / design 决策 19）：30 个样例与 Swiss Ephemeris 参考值逐项比对。
// 夹具只含数值，来源与设置见 fixtures/swisseph-natal-reference.json 的 provenance 字段。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  houseOf,
  natalChart,
  POINT_KEYS,
  type PointKey,
  zodiacPosition,
} from '@xuanxue/astro/chart'
import { localToUtc } from '@xuanxue/astro/places'
import { afterAll, describe, expect, it } from 'vitest'
import reference from './fixtures/swisseph-natal-reference.json'

const PLANET_MAX_ARCMIN = 1
const ANGLE_MAX_DEG = 0.05
const CUSP_MAX_DEG = 0.1
// 引擎速度为 ±1 小时中心差分，参考为瞬时速度（度/日）。
const SPEED_MAX_DEG_PER_DAY = 0.01

type Case = (typeof reference.cases)[number]
type Row = {
  id: string
  tags: string[]
  houseSystem: string
  utcMatches: boolean
  pointsArcmin: Record<PointKey, number>
  speedErrors: Record<PointKey, number>
  retrogradeMismatches: string[]
  ascendantDeg: number
  midheavenDeg: number
  cuspsMaxDeg: number
  signMismatches: string[]
  houseMismatches: string[]
}

const rows: Row[] = []
const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

function parseLocal(local: string) {
  const [date, time] = local.split('T') as [string, string]
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  return { year, month, day, hour, minute }
}

function evaluate(c: Case): Row {
  const resolved = localToUtc(parseLocal(c.local), c.tz)
  const chart = natalChart({ utcMs: resolved.utcMs, latitude: c.lat, longitude: c.lon })
  const pointsArcmin = {} as Record<PointKey, number>
  const speedErrors = {} as Record<PointKey, number>
  const retrogradeMismatches: string[] = []
  const signMismatches: string[] = []
  const houseMismatches: string[] = []
  for (const key of POINT_KEYS) {
    const expected = c.points[key].lon
    const actual = chart.points[key]
    pointsArcmin[key] = diff(actual.longitude, expected) * 60
    speedErrors[key] = Math.abs(actual.speed - c.points[key].speed)
    if (actual.retrograde !== c.points[key].speed < 0) retrogradeMismatches.push(key)
    if (actual.sign !== zodiacPosition(expected).sign) signMismatches.push(key)
    if (actual.house !== houseOf(expected, c.cusps)) houseMismatches.push(key)
  }
  if (chart.ascendant.sign !== zodiacPosition(c.ascendant).sign) signMismatches.push('ascendant')
  if (chart.midheaven.sign !== zodiacPosition(c.midheaven).sign) signMismatches.push('midheaven')
  return {
    id: c.id,
    tags: c.tags,
    houseSystem: chart.houses.system,
    utcMatches: resolved.utcMs === Date.parse(c.utc),
    pointsArcmin,
    speedErrors,
    retrogradeMismatches,
    ascendantDeg: diff(chart.ascendant.longitude, c.ascendant),
    midheavenDeg: diff(chart.midheaven.longitude, c.midheaven),
    cuspsMaxDeg: Math.max(...chart.houses.cusps.map((cusp, i) => diff(cusp, c.cusps[i] as number))),
    signMismatches,
    houseMismatches,
  }
}

describe('natal chart accuracy gate', () => {
  it('covers 30 cases across hemispheres, high latitude, DST boundaries, pre-1970 and the date line', () => {
    const tags = reference.cases.flatMap((c) => c.tags)
    expect(reference.cases).toHaveLength(30)
    for (const tag of ['north', 'south', 'high-latitude', 'dst-boundary', 'pre-1970', 'date-line'])
      expect(tags, tag).toContain(tag)
    expect(reference.cases.filter((c) => c.lat < -66)).not.toHaveLength(0)
  })

  it.each(reference.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const row = evaluate(c)
    rows.push(row)
    // 出生地时间经 Intl 换算的 UTC 与参考（Python zoneinfo + tzdata）一致。
    expect(row.utcMatches, `UTC for ${c.local} ${c.tz}`).toBe(true)
    for (const key of POINT_KEYS)
      expect(row.pointsArcmin[key], key).toBeLessThanOrEqual(PLANET_MAX_ARCMIN)
    expect(row.ascendantDeg).toBeLessThanOrEqual(ANGLE_MAX_DEG)
    expect(row.midheavenDeg).toBeLessThanOrEqual(ANGLE_MAX_DEG)
    expect(row.houseSystem).toBe(c.houseSystem)
    // 整宫制宫头由上升星座决定，必须完全一致；Placidus 宫头按门槛比较。
    expect(row.cuspsMaxDeg).toBeLessThanOrEqual(c.houseSystem === 'placidus' ? CUSP_MAX_DEG : 1e-9)
    for (const key of POINT_KEYS)
      expect(row.speedErrors[key], `${key} speed`).toBeLessThanOrEqual(SPEED_MAX_DEG_PER_DAY)
    expect(row.retrogradeMismatches).toEqual([])
    expect(row.signMismatches).toEqual([])
    expect(row.houseMismatches).toEqual([])
  })
})

afterAll(() => {
  const dir = process.env.EVIDENCE_DIR
  if (!dir || rows.length !== reference.cases.length) return
  const max = (values: number[]) => Math.max(...values)
  const summary = {
    cases: rows.length,
    thresholds: {
      planetArcmin: PLANET_MAX_ARCMIN,
      angleDeg: ANGLE_MAX_DEG,
      placidusCuspDeg: CUSP_MAX_DEG,
      speedDegPerDay: SPEED_MAX_DEG_PER_DAY,
    },
    maxPointArcmin: Object.fromEntries(
      POINT_KEYS.map((key) => [key, max(rows.map((row) => row.pointsArcmin[key]))]),
    ),
    maxSpeedErrorDegPerDay: Object.fromEntries(
      POINT_KEYS.map((key) => [key, max(rows.map((row) => row.speedErrors[key]))]),
    ),
    retrogradeMismatches: rows.flatMap((row) =>
      row.retrogradeMismatches.map((key) => `${row.id}:${key}`),
    ),
    maxAscendantDeg: max(rows.map((row) => row.ascendantDeg)),
    maxMidheavenDeg: max(rows.map((row) => row.midheavenDeg)),
    maxPlacidusCuspDeg: max(
      rows.filter((row) => row.houseSystem === 'placidus').map((row) => row.cuspsMaxDeg),
    ),
    maxWholeSignCuspDeg: max(
      rows.filter((row) => row.houseSystem === 'whole-sign').map((row) => row.cuspsMaxDeg),
    ),
    utcMismatches: rows.filter((row) => !row.utcMatches).map((row) => row.id),
    signMismatches: rows.flatMap((row) => row.signMismatches.map((key) => `${row.id}:${key}`)),
    houseMismatches: rows.flatMap((row) => row.houseMismatches.map((key) => `${row.id}:${key}`)),
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'chart-accuracy-report.json'),
    `${JSON.stringify({ provenance: reference.provenance, summary, rows }, null, 2)}\n`,
  )
})
