// 逆行日历的停滞时刻精度（content-growth-v2-tools 25.2）：与 Swiss Ephemeris 参考逐项比对。
// 参考来源：fixtures/swisseph-retrograde-stations.json 的 provenance（pyswisseph 2.10.3.2、SWIEPH sepl_18，
// 视黄经速度变号时刻，2025–2028 共 71 次停滞）；夹具只含数值，生成脚本在私有证据目录
// content-growth/v2/25/retrograde/reference-generator/。
//
// 25.2 的目标是 ≤2 分钟。astronomy-engine（VSOP87 截断级数）在停滞附近的速度误差使时刻偏差按行星不同：
// 水星至火星最大约 7 分钟，木星、土星约 14 分钟，天王星约 16 分钟，海王星、冥王星约 41 分钟（行星越慢，
// 停滞越「平」，同样的速度误差换成的时间偏差越大）。下面按行星分级的门槛锁住当前实测值，
// 「≤2 分钟」的达标数另行报告，不在此宣称全部达标；页面只显示日期，另有「UTC 日期全部一致」的断言。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertRetrogradeCoverage,
  generateRetrogradeBuildData,
  planetStations,
  RETROGRADE_PLANETS,
  type RetrogradePlanet,
  retrogradePeriods,
  retrogradeSigns,
  type Station,
} from '@xuanxue/astro/retrograde'
import { afterAll, describe, expect, it } from 'vitest'
import reference from './fixtures/swisseph-retrograde-stations.json'

const TARGET_MINUTES = 2
/** 按行星分级的门槛（分钟）：使用者 2026-11-25 裁定以此取代「≤2 分钟」（design 决策 19），正文须写明同一组数 */
const MAX_MINUTES: Record<RetrogradePlanet, number> = {
  mercury: 8,
  venus: 8,
  mars: 8,
  jupiter: 15,
  saturn: 15,
  uranus: 20,
  neptune: 45,
  pluto: 45,
}
const START = Date.UTC(2025, 0, 1)
const END = Date.UTC(2029, 0, 1)

type Row = { planet: string; kind: string; reference: string; engine: string; minutes: number }
const rows: Row[] = []
const ours: Station[] = RETROGRADE_PLANETS.flatMap((planet) => planetStations(planet, START, END))

describe('station accuracy against Swiss Ephemeris', () => {
  it('finds the same 71 stations in the same order', () => {
    expect(reference.stations).toHaveLength(71)
    expect(ours.map(({ planet, kind }) => `${planet}:${kind}`)).toEqual(
      reference.stations.map(({ planet, kind }) => `${planet}:${kind}`),
    )
  })

  it.each(reference.stations.map((s, i) => [`${s.planet} ${s.kind} ${s.utc}`, s, i] as const))(
    '%s',
    (_name, station, index) => {
      const engine = ours[index] as Station
      const minutes = (engine.utcMs - Date.parse(station.utc)) / 60_000
      rows.push({
        planet: station.planet,
        kind: station.kind,
        reference: station.utc,
        engine: new Date(engine.utcMs).toISOString(),
        minutes: Math.round(minutes * 100) / 100,
      })
      expect(Math.abs(minutes)).toBeLessThanOrEqual(MAX_MINUTES[station.planet as RetrogradePlanet])
      // 页面按日期显示：UTC 日历日期与参考一致
      expect(new Date(engine.utcMs).toISOString().slice(0, 10)).toBe(station.utc.slice(0, 10))
      // 停滞黄经与参考相差不到 1 角分（星座判断由此而来）
      const delta = Math.abs(((engine.longitude - station.longitude + 540) % 360) - 180)
      expect(delta * 60).toBeLessThanOrEqual(1)
    },
  )
})

describe('retrograde periods', () => {
  it('pairs stations into periods and lists the signs crossed', () => {
    const data = generateRetrogradeBuildData('2026-11-25')
    expect(data.years).toEqual([2026, 2027])
    const mercury2027 = data.periods.filter(
      (p) => p.planet === 'mercury' && new Date(p.startMs).getUTCFullYear() === 2027,
    )
    expect(mercury2027).toHaveLength(3)
    expect(mercury2027.map((p) => retrogradeSigns(p.startLongitude, p.endLongitude))).toEqual([
      ['pisces', 'aquarius'],
      ['cancer', 'gemini'],
      ['scorpio', 'libra'],
    ])
    // 火星 2026 年没有逆行，2027-01-10 开始；金星 2027 年没有逆行
    const mars = data.periods.filter((p) => p.planet === 'mars')
    expect(mars.map((p) => new Date(p.startMs).toISOString().slice(0, 10))).toEqual(['2027-01-10'])
    const venus2027 = data.periods.filter(
      (p) =>
        p.planet === 'venus' && p.startMs < Date.UTC(2028, 0, 1) && p.endMs >= Date.UTC(2027, 0, 1),
    )
    expect(venus2027).toEqual([])
    // 跨年的逆行期完整：木星 2025-11 起、天王星 2027-09 至 2028-02
    expect(
      data.periods.some(
        (p) => p.planet === 'jupiter' && new Date(p.startMs).toISOString().startsWith('2025-11'),
      ),
    ).toBe(true)
    expect(
      data.periods.some(
        (p) => p.planet === 'uranus' && new Date(p.endMs).toISOString().startsWith('2028-02'),
      ),
    ).toBe(true)
  })

  it('wraps signs across 0° Aries and drops incomplete periods at the edges', () => {
    expect(retrogradeSigns(9.59, 356.83)).toEqual(['aries', 'pisces'])
    expect(retrogradeSigns(355, 340)).toEqual(['pisces'])
    const stations = planetStations('mars', Date.UTC(2025, 0, 1), Date.UTC(2027, 2, 1))
    // 2025-02-24 恢复顺行（前一段起点不在区间内）、2027-01-10 开始逆行（终点不在区间内）
    expect(stations.map((s) => s.kind)).toEqual(['direct', 'retrograde'])
    expect(retrogradePeriods(stations)).toEqual([])
  })
})

describe('coverage and year rollover', () => {
  it('lists the build year and the next, and searches one year back and two ahead', () => {
    const data = generateRetrogradeBuildData('2027-01-05')
    expect(data.years).toEqual([2027, 2028])
    expect(new Date(data.searchStartMs).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(new Date(data.searchEndMs).toISOString()).toBe('2030-01-01T00:00:00.000Z')
  })

  it('fails once today is outside the listed years or less than 13 months of data remain', () => {
    const data = { buildDate: '2026-11-25', years: [2026, 2027] as [number, number] }
    const searchEndMs = Date.UTC(2029, 0, 1)
    expect(() => assertRetrogradeCoverage({ ...data, searchEndMs }, '2026-11-25')).not.toThrow()
    expect(() => assertRetrogradeCoverage({ ...data, searchEndMs }, '2027-11-30')).not.toThrow()
    // 次年之后未重新构建：年份已滚出页面
    expect(() => assertRetrogradeCoverage({ ...data, searchEndMs }, '2028-01-01')).toThrow(
      RangeError,
    )
    // 搜索区间不足 13 个月
    expect(() =>
      assertRetrogradeCoverage({ ...data, searchEndMs: Date.UTC(2027, 6, 1) }, '2026-11-25'),
    ).toThrow(RangeError)
    expect(() => generateRetrogradeBuildData('2026-02-30')).toThrow(RangeError)
  })
})

afterAll(() => {
  const dir = process.env.EVIDENCE_DIR
  if (!dir || rows.length !== reference.stations.length) return
  const byPlanet = Object.fromEntries(
    RETROGRADE_PLANETS.map((planet) => {
      const errors = rows.filter((row) => row.planet === planet).map((row) => Math.abs(row.minutes))
      return [
        planet,
        {
          stations: errors.length,
          maxMinutes: Math.max(...errors),
          withinTarget: errors.filter((value) => value <= TARGET_MINUTES).length,
          gateMinutes: MAX_MINUTES[planet],
        },
      ]
    }),
  )
  const all = rows.map((row) => Math.abs(row.minutes))
  const summary = {
    stations: rows.length,
    targetMinutes: TARGET_MINUTES,
    withinTarget: all.filter((value) => value <= TARGET_MINUTES).length,
    maxMinutes: Math.max(...all),
    sameUtcDate: rows.every((row) => row.engine.slice(0, 10) === row.reference.slice(0, 10)),
    byPlanet,
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'retrograde-accuracy-report.json'),
    `${JSON.stringify({ provenance: reference.provenance, summary, rows }, null, 2)}\n`,
  )
})
