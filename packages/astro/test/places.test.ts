import {
  createPlaceSearch,
  isValidTimeZone,
  localToUtc,
  normalizePlaceName,
  PLACE_DATA_VERSION,
  type PlaceSlice,
  placeSliceKey,
  utcOffsetSeconds,
} from '@xuanxue/astro/places'
import { describe, expect, it } from 'vitest'

const at = (local: string) => {
  const [date, time] = local.split('T') as [string, string]
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  return { year, month, day, hour, minute }
}
const iso = (utcMs: number) => new Date(utcMs).toISOString().replace('.000', '')

describe('localToUtc', () => {
  it('applies daylight saving time (spec example: New York 1985-07-04 14:30 is UTC−4)', () => {
    expect(localToUtc(at('1985-07-04T14:30'), 'America/New_York')).toEqual({
      utcMs: Date.parse('1985-07-04T18:30:00Z'),
      offsetSeconds: -4 * 3600,
      status: 'ok',
    })
  })

  it('handles the spring-forward day: before, inside and after the gap', () => {
    const zone = 'America/New_York'
    expect(iso(localToUtc(at('2021-03-14T01:30'), zone).utcMs)).toBe('2021-03-14T06:30:00Z')
    const gap = localToUtc(at('2021-03-14T02:30'), zone)
    // 跳过的时间按跳变前偏移（EST）换算，等同于把钟拨快后的 03:30 EDT。
    expect(gap).toMatchObject({ status: 'nonexistent', offsetSeconds: -5 * 3600 })
    expect(iso(gap.utcMs)).toBe('2021-03-14T07:30:00Z')
    expect(localToUtc(at('2021-03-14T03:30'), zone)).toMatchObject({
      status: 'ok',
      offsetSeconds: -4 * 3600,
    })
  })

  it('takes the earlier instant for the repeated hour when DST ends, in both hemispheres', () => {
    const london = localToUtc(at('2019-10-27T01:30'), 'Europe/London')
    expect(london).toMatchObject({ status: 'ambiguous', offsetSeconds: 3600 })
    expect(iso(london.utcMs)).toBe('2019-10-27T00:30:00Z')
    const sydney = localToUtc(at('2020-04-05T02:30'), 'Australia/Sydney')
    expect(sydney).toMatchObject({ status: 'ambiguous', offsetSeconds: 11 * 3600 })
    expect(localToUtc(at('2020-04-05T03:30'), 'Australia/Sydney').status).toBe('ok')
  })

  it('uses historical offsets before 1970', () => {
    // 英国 1944 年双重夏令时（UTC+2）、印度 1943 年战时（UTC+6:30）、檀香山 1940 年（UTC−10:30）。
    expect(localToUtc(at('1944-06-06T06:30'), 'Europe/London').offsetSeconds).toBe(7200)
    expect(localToUtc(at('1943-01-15T05:45'), 'Asia/Kolkata').offsetSeconds).toBe(23400)
    expect(localToUtc(at('1940-12-07T07:55'), 'Pacific/Honolulu').offsetSeconds).toBe(-37800)
    // 1883 年铁路标准时之前用地方平时，偏移不是整分钟（纽约 LMT −4:56:02）。
    expect(localToUtc(at('1880-01-01T12:00'), 'America/New_York').offsetSeconds).toBe(-17762)
  })

  it('handles the date line: Samoa skipped 2011-12-30 entirely', () => {
    expect(localToUtc(at('2011-12-29T23:30'), 'Pacific/Apia').offsetSeconds).toBe(-10 * 3600)
    expect(localToUtc(at('2011-12-30T12:00'), 'Pacific/Apia').status).toBe('nonexistent')
    const after = localToUtc(at('2011-12-31T00:30'), 'Pacific/Apia')
    expect(after).toMatchObject({ status: 'ok', offsetSeconds: 14 * 3600 })
    expect(iso(after.utcMs)).toBe('2011-12-30T10:30:00Z')
    expect(localToUtc(at('1995-01-02T06:00'), 'Pacific/Kiritimati').offsetSeconds).toBe(14 * 3600)
  })

  it('rejects unknown zones and impossible dates', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(() => localToUtc(at('2021-01-01T00:00'), 'Mars/Olympus_Mons')).toThrow(RangeError)
    expect(() => localToUtc(at('2021-02-29T12:00'), 'UTC')).toThrow(RangeError)
    expect(() => localToUtc(at('2021-01-01T24:00'), 'UTC')).toThrow(RangeError)
    expect(utcOffsetSeconds(Date.parse('2021-06-01T00:00:00Z'), 'UTC')).toBe(0)
  })
})

describe('place search', () => {
  const slices: Record<string, PlaceSlice> = {
    s: {
      v: PLACE_DATA_VERSION,
      key: 's',
      tz: ['America/Sao_Paulo', 'Asia/Shanghai', 'Europe/Rome'],
      places: [
        ['Shanghai', 'Shanghai', 'CN', 31.2222, 121.4581, 1],
        ['São Paulo', 'São Paulo', 'BR', -23.5475, -46.6361, 0],
        ['Sao Paulo de Olivenca', 'Amazonas', 'BR', -3.3783, -68.8725, 0],
        ['Sassari', 'Sardinia', 'IT', 40.7259, 8.5557, 2],
      ],
    },
  }
  let loads = 0
  const search = createPlaceSearch(async (key) => {
    loads++
    const slice = slices[key]
    if (!slice) throw new Error('missing')
    return slice
  })

  it('normalizes diacritics and punctuation', () => {
    expect(normalizePlaceName('  São-Paulo ')).toBe('sao paulo')
    expect(normalizePlaceName('Tromsø')).toBe('tromso')
    expect(normalizePlaceName('ʻEwa Beach')).toBe('ewa beach')
    expect(placeSliceKey('Ðà Lạt')).toBe('d')
    expect(placeSliceKey('6th of October City')).toBeNull()
  })

  it('matches by prefix without diacritics, exact names first, and loads each slice once', async () => {
    const results = await search('sao paulo')
    expect(results.map(({ name }) => name)).toEqual(['São Paulo', 'Sao Paulo de Olivenca'])
    expect(results[0]).toEqual({
      name: 'São Paulo',
      admin1: 'São Paulo',
      country: 'BR',
      latitude: -23.5475,
      longitude: -46.6361,
      timeZone: 'America/Sao_Paulo',
    })
    // 无完全同名时按切片顺序（人口降序）截断。
    expect((await search('SA', 2)).map(({ name }) => name)).toEqual([
      'São Paulo',
      'Sao Paulo de Olivenca',
    ])
    expect((await search('sassari')).map(({ name }) => name)).toEqual(['Sassari'])
    expect(loads).toBe(1)
  })

  it('returns nothing for too-short or non-Latin queries and retries failed loads', async () => {
    expect(await search('s')).toEqual([])
    expect(await search('東京')).toEqual([])
    await expect(search('xi')).rejects.toThrow('missing')
    await expect(search('xi')).rejects.toThrow('missing')
    expect(loads).toBe(3)
  })
})
