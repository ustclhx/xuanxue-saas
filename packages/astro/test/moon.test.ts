import {
  assertMoonCoverage,
  fullMoonNames,
  generateMoonBuildData,
  moonPhaseTable,
  moonQuarterEvents,
} from '@xuanxue/astro/moon'
import { describe, expect, it } from 'vitest'
import usno from './fixtures/usno-moon-phases.json'

describe('moonQuarterEvents', () => {
  it('matches every USNO principal phase in 2026–2027 within two minutes', () => {
    const events = moonQuarterEvents('2026-01-01', '2028-01-01')
    expect(events).toHaveLength(99)
    expect(events.map(({ phase }) => phase)).toEqual(usno.events.map(({ phase }) => phase))
    for (const [index, reference] of usno.events.entries()) {
      const utcMs = events[index]?.utcMs ?? Number.NaN
      expect(Math.abs(utcMs - Date.parse(reference.utc)), reference.utc).toBeLessThanOrEqual(
        120_000,
      )
    }
  })

  it('marks only the second May full moon as blue even when the first is outside the query', () => {
    const may = moonQuarterEvents('2026-05-01', '2026-06-01').filter(
      (event) => event.phase === 'full-moon',
    )
    expect(may.map(({ blueMoon }) => blueMoon)).toEqual([false, true])
    expect(moonQuarterEvents('2026-05-02', '2026-06-01').at(-1)).toEqual(may.at(-1))
    expect(moonQuarterEvents('2026-05-30', '2026-05-31')).toEqual([])
  })

  it('distinguishes December’s perigee full moon from November’s full moon', () => {
    const fullMoons = moonQuarterEvents('2026-11-01', '2027-01-01').filter(
      (event) => event.phase === 'full-moon',
    )
    expect(fullMoons.map(({ supermoon }) => supermoon)).toEqual([false, true])
  })
})

describe('moonPhaseTable', () => {
  it('labels principal phases on their UTC dates and measures age from the latest new moon', () => {
    const rows = moonPhaseTable('2026-01-01', 32)
    expect(rows[2]).toEqual(['full-moon', expect.closeTo(1, 2), expect.closeTo(14.35, 1)])
    expect(rows[9]).toEqual(['last-quarter', expect.closeTo(0.5, 2), expect.any(Number)])
    expect(rows[16]?.[0]).toBe('waning-crescent')
    expect(rows[17]).toEqual(['new-moon', expect.closeTo(0, 2), 0])
    expect(rows[18]).toEqual(['waxing-crescent', expect.any(Number), expect.closeTo(0.67, 1)])
    expect(rows[25]?.[0]).toBe('first-quarter')
  })

  it('rejects invalid calendar inputs', () => {
    expect(() => moonPhaseTable('2027-02-29', 1)).toThrow(RangeError)
    expect(() => moonPhaseTable('2027-01-01', 1.5)).toThrow(RangeError)
    expect(() => moonQuarterEvents('2027-02-01', '2027-01-01')).toThrow(RangeError)
  })
})

it('uses one distinct traditional full moon key per calendar month', () => {
  const names = fullMoonNames()
  expect(names[1]).toBe('wolf-moon')
  expect(names[12]).toBe('cold-moon')
  expect(new Set(Object.values(names)).size).toBe(12)
})

describe('build-time moon data', () => {
  it('covers a rolling cross-year window and clamps month-end dates', () => {
    const data = generateMoonBuildData('2026-12-31')
    expect(data.startDate).toBe('2026-11-30')
    expect(data.endDate).toBe('2028-02-29')
    expect(data.days).toHaveLength(456)
    expect(data.events.length).toBeGreaterThan(0)
    for (const event of data.events) {
      const dayIndex = Math.floor((event.utcMs - Date.parse(data.startDate)) / 86_400_000)
      expect(data.days[dayIndex]?.[0]).toBe(event.phase)
    }
  })

  it('accepts exactly 13 months of remaining coverage and rejects a shorter table', () => {
    expect(() => assertMoonCoverage('2028-02-29', '2027-01-31')).not.toThrow()
    expect(() => assertMoonCoverage('2028-02-29', '2027-02-01')).toThrow(/2028-03-01/)
  })
})
