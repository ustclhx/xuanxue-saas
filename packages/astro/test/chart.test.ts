import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
  ASPECTS,
  chartHouses,
  chartPositions,
  findAspects,
  houseOf,
  moonSignsBetween,
  natalChart,
  zodiacPosition,
} from '@xuanxue/astro/chart'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const TROMSO = { latitude: 69.6496, longitude: 18.957 }
const utc = (iso: string) => Date.parse(iso)

describe('high latitude houses', () => {
  it('switches Placidus to whole-sign houses above 66° in both hemispheres and flags it', () => {
    for (const latitude of [66.01, 69.6496, -77.846]) {
      const { ascendant, houses } = chartHouses(utc('1990-06-21T10:00:00Z'), latitude, 18.957)
      expect(houses).toMatchObject({
        system: 'whole-sign',
        requested: 'placidus',
        highLatitudeFallback: true,
      })
      const first = Math.floor(ascendant / 30) * 30
      expect(houses.cusps).toEqual(Array.from({ length: 12 }, (_, i) => (first + i * 30) % 360))
    }
  })

  it('keeps Placidus at 66° and does not flag an explicit whole-sign request', () => {
    expect(chartHouses(utc('1990-06-21T10:00:00Z'), 66, 18.957).houses.system).toBe('placidus')
    const chart = natalChart({
      utcMs: utc('1990-06-21T10:00:00Z'),
      ...TROMSO,
      houseSystem: 'whole-sign',
    })
    expect(chart.houses).toMatchObject({ system: 'whole-sign', highLatitudeFallback: false })
    for (const point of Object.values(chart.points))
      expect(point.house).toBe(houseOf(point.longitude, chart.houses.cusps))
  })
})

describe('natalChart', () => {
  const chart = natalChart({
    utcMs: utc('1985-07-04T18:30:00Z'),
    latitude: 40.71427,
    longitude: -74.00597,
  })

  it('returns stable keys and numbers only', () => {
    expect(Object.keys(chart.points)).toEqual([
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
      'meanNode',
    ])
    expect(chart.points.sun).toMatchObject({ sign: 'cancer', retrograde: false })
    expect(chart.points.meanNode.retrograde).toBe(true)
    expect(chart.houses.cusps[0]).toBe(chart.ascendant.longitude)
    expect(chart.houses.cusps[9]).toBe(chart.midheaven.longitude)
    expect(JSON.parse(JSON.stringify(chart))).toEqual(chart)
  })

  it('lists only major aspects within the fixed orbs, tightest first', () => {
    expect(ASPECTS.map(({ key, orb }) => `${key}:${orb}`)).toEqual([
      'conjunction:8',
      'sextile:6',
      'square:8',
      'trine:8',
      'opposition:8',
    ])
    expect(chart.aspects.length).toBeGreaterThan(0)
    for (const [i, aspect] of chart.aspects.entries()) {
      const limit = ASPECTS.find(({ key }) => key === aspect.aspect)?.orb ?? 0
      expect(aspect.orb).toBeLessThanOrEqual(limit)
      expect(aspect.orb).toBeGreaterThanOrEqual(chart.aspects[i - 1]?.orb ?? 0)
      expect(aspect.a).not.toBe('meanNode')
    }
  })

  it('finds aspects across 0° Aries and rejects wide orbs', () => {
    const aspects = findAspects({ sun: { longitude: 357 }, moon: { longitude: 3 } }, [
      'sun',
      'moon',
    ])
    expect(aspects).toEqual([{ a: 'sun', b: 'moon', aspect: 'conjunction', orb: 6 }])
    expect(
      findAspects({ sun: { longitude: 0 }, moon: { longitude: 66.5 } }, ['sun', 'moon']),
    ).toEqual([])
  })

  it('rejects invalid input', () => {
    expect(() => natalChart({ utcMs: Number.NaN, latitude: 0, longitude: 0 })).toThrow(RangeError)
    expect(() =>
      natalChart({ utcMs: utc('1700-01-01T00:00:00Z'), latitude: 0, longitude: 0 }),
    ).toThrow(RangeError)
    expect(() => natalChart({ utcMs: 0, latitude: 91, longitude: 0 })).toThrow(RangeError)
    expect(() => natalChart({ utcMs: 0, latitude: 0, longitude: -181 })).toThrow(RangeError)
  })
})

describe('time-unknown helpers', () => {
  it('gives planet signs without a place', () => {
    expect(chartPositions(utc('2000-01-01T12:00:00Z')).sun.sign).toBe('capricorn')
  })

  it('lists both moon signs when the moon changes sign during the day', () => {
    // Swiss Ephemeris：2024-01-03 UTC 全天月亮由 179.6° 走到 191.5°，当天由处女座进入天秤座；次日整天在天秤座。
    const start = utc('2024-01-03T00:00:00Z')
    expect(moonSignsBetween(start, start + 86_400_000)).toEqual(['virgo', 'libra'])
    expect(moonSignsBetween(start + 86_400_000, start + 2 * 86_400_000)).toEqual(['libra'])
    expect(zodiacPosition(chartPositions(start).moon.longitude).sign).toBe('virgo')
    expect(moonSignsBetween(start, start)).toHaveLength(1)
    expect(() => moonSignsBetween(start, start + 3 * 86_400_000)).toThrow(RangeError)
  })

  it.each([
    // Swiss Ephemeris：两个 48 小时窗口里月亮由约 179.9° 走到约 210.4°，经过处女、天秤、天蝎三个星座。
    ['2020-03-10T10:00:00Z'],
    ['2020-04-06T21:00:00Z'],
  ])('lists every sign when the moon crosses two boundaries in 48 hours (%s)', (iso) => {
    const start = utc(iso)
    expect(moonSignsBetween(start, start + 2 * 86_400_000)).toEqual(['virgo', 'libra', 'scorpio'])
  })
})

describe('houseOf', () => {
  it('handles cusps that wrap past 0°', () => {
    const cusps = Array.from({ length: 12 }, (_, i) => (350 + i * 30) % 360)
    expect(houseOf(355, cusps)).toBe(1)
    expect(houseOf(5, cusps)).toBe(1)
    expect(houseOf(20, cusps)).toBe(2)
    expect(houseOf(349.9, cusps)).toBe(12)
  })
})

describe('bundle boundaries', () => {
  const entry = (name: string) => fileURLToPath(new URL(`../src/${name}.ts`, import.meta.url))
  const bundle = (name: string) =>
    build({
      entryPoints: [entry(name)],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      metafile: true,
    })

  it('keeps ./moon free of chart and place code', async () => {
    const result = await bundle('moon')
    const inputs = Object.keys(result.metafile.inputs)
    expect(inputs.some((path) => path.endsWith('src/moon.ts'))).toBe(true)
    expect(inputs.filter((path) => /src\/(chart|places)\.ts$/.test(path))).toEqual([])
  })

  it('keeps ./places free of astronomy-engine so the place picker stays light', async () => {
    const result = await bundle('places')
    expect(
      Object.keys(result.metafile.inputs).filter((path) => path.includes('astronomy-engine')),
    ).toEqual([])
    const [output] = result.outputFiles
    expect(output && gzipSync(output.contents).length).toBeLessThan(4_000)
  })
})
