// 出生地静态切片（public/geo/places）的完整性与可查性；数据由 scripts/geonames-places.mjs 生成。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createPlaceSearch,
  isValidTimeZone,
  PLACE_DATA_VERSION,
  PLACE_SLICE_KEYS,
  type PlaceSlice,
} from '@xuanxue/astro/places'
import { describe, expect, it } from 'vitest'

const dir = join(import.meta.dirname, `../public/geo/places/v${PLACE_DATA_VERSION}`)
const read = (key: string): PlaceSlice => JSON.parse(readFileSync(join(dir, `${key}.json`), 'utf8'))
const search = createPlaceSearch(async (key) => read(key))

describe('GeoNames place slices', () => {
  it('has one valid slice per initial with known IANA zones', () => {
    let total = 0
    for (const key of PLACE_SLICE_KEYS) {
      const slice = read(key)
      expect(slice).toMatchObject({ v: PLACE_DATA_VERSION, key })
      expect(slice.tz.every(isValidTimeZone), key).toBe(true)
      for (const [name, , country, lat, lon, tz] of slice.places) {
        expect(name.length).toBeGreaterThan(0)
        expect(country).toMatch(/^[A-Z]{2}$/)
        expect(Math.abs(lat)).toBeLessThanOrEqual(90)
        expect(Math.abs(lon)).toBeLessThanOrEqual(180)
        expect(slice.tz[tz]).toBeDefined()
      }
      total += slice.places.length
    }
    expect(total).toBeGreaterThan(30_000)
  })

  it.each([
    ['new york', 'New York City', 'US', 'America/New_York'],
    ['london', 'London', 'GB', 'Europe/London'],
    ['sao paulo', 'São Paulo', 'BR', 'America/Sao_Paulo'],
    ['tromso', 'Tromsø', 'NO', 'Europe/Oslo'],
    ['sydney', 'Sydney', 'AU', 'Australia/Sydney'],
    ['apia', 'Apia', 'WS', 'Pacific/Apia'],
    ['madrid', 'Madrid', 'ES', 'Europe/Madrid'],
  ])('finds %s first', async (query, name, country, timeZone) => {
    const [first] = await search(query)
    expect(first).toMatchObject({ name, country, timeZone })
    expect(first?.alias).toBeUndefined()
  })

  it.each([
    ['cologne', 'Köln', 'Cologne'],
    ['koeln', 'Köln', 'Koeln'],
    ['peking', 'Beijing', 'Peking'],
    ['bombay', 'Mumbai', 'Bombay'],
  ])('finds %s by ASCII or English alternate name', async (query, name, alias) => {
    const [first] = await search(query)
    expect(first).toMatchObject({ name, alias })
  })
})
