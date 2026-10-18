import { describe, expect, it } from 'vitest'
import { type BirthInput, validateInput } from '../src/input.ts'
import { equationOfTime, resolveBirthTime } from '../src/time.ts'

const base: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}
const at = (patch: Partial<BirthInput>): BirthInput => ({ ...base, ...patch })
const hm = (p: { hour: number; minute: number }) =>
  `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`

describe('时间换算', () => {
  it('台湾夏令时期间出生：1975-07-01 10:30 台北按 09:30 标准时间排盘', () => {
    const t = resolveBirthTime(at({ year: 1975, month: 7, day: 1 }))
    expect(t.dst).toBe(true)
    expect(t.offsetSeconds).toBe(9 * 3600)
    expect(t.standardOffsetSeconds).toBe(8 * 3600)
    expect(hm(t.standard)).toBe('09:30')
    expect(t.used).toEqual(t.standard)
  })

  it('非夏令时期间标准时间等于钟表时间', () => {
    const t = resolveBirthTime(base)
    expect(t.dst).toBe(false)
    expect(hm(t.standard)).toBe('10:30')
    expect(hm(t.beijing)).toBe('10:30')
  })

  it('韩国 1954–1961 标准时间为 UTC+8:30，夏令时在其上加 1 小时', () => {
    const winter = resolveBirthTime(
      at({ year: 1958, month: 1, day: 10, location: { city: 'seoul' } }),
    )
    expect(winter.standardOffsetSeconds).toBe(8.5 * 3600)
    expect(winter.dst).toBe(false)
    const summer = resolveBirthTime(
      at({
        year: 1957,
        month: 7,
        day: 1,
        time: { hour: 6, minute: 0 },
        location: { city: 'seoul' },
      }),
    )
    expect(summer.offsetSeconds).toBe(9.5 * 3600)
    expect(hm(summer.standard)).toBe('05:00')
    // 节气按北京时间比较：05:00 (UTC+8:30) = 04:30 北京时间
    expect(hm(summer.beijing)).toBe('04:30')
  })

  it('韩国 1987–1988 夏令时', () => {
    const t = resolveBirthTime(
      at({
        year: 1987,
        month: 7,
        day: 15,
        time: { hour: 14, minute: 0 },
        location: { city: 'seoul' },
      }),
    )
    expect(t.dst).toBe(true)
    expect(hm(t.standard)).toBe('13:00')
    expect(hm(t.beijing)).toBe('12:00')
  })

  it('夏令时开始拨快造成的不存在时间按切换前的标准时间解释', () => {
    // 台湾 1974-04-01 00:00 拨到 01:00
    const t = resolveBirthTime(at({ year: 1974, month: 4, day: 1, time: { hour: 0, minute: 30 } }))
    expect(hm(t.standard)).toBe('00:30')
  })

  it('夏令时结束回拨造成的重复时间取较早的夏令时解释', () => {
    // 台湾 1974-09-30 23:00 回拨到 22:00，22:30 出现两次
    const t = resolveBirthTime(
      at({ year: 1974, month: 9, day: 30, time: { hour: 22, minute: 30 } }),
    )
    expect(t.dst).toBe(true)
    expect(hm(t.standard)).toBe('21:30')
  })

  it('手选 UTC 偏移不含夏令时', () => {
    const t = resolveBirthTime(at({ location: { utcOffsetMinutes: 420, longitude: 100.5 } }))
    expect(t.offsetSeconds).toBe(420 * 60)
    expect(hm(t.beijing)).toBe('11:30')
  })

  it('农历输入换算为国历日期', () => {
    const t = resolveBirthTime(
      at({ calendar: 'lunar', year: 2020, month: 4, day: 15, isLeapMonth: true }),
    )
    expect(t.solarDate).toEqual({ year: 2020, month: 6, day: 6 })
  })

  it('不知道时辰时按当地 12:00 估算出生时刻', () => {
    const t = resolveBirthTime(at({ time: null }))
    expect(t.clock).toBeNull()
    expect(hm(t.standard)).toBe('12:00')
    expect(t.trueSolar).toBeNull()
  })
})

describe('真太阳时', () => {
  it('均时差符合天文年历量级（2 月中约 −14 分钟、11 月初约 +16 分钟）', () => {
    expect(equationOfTime(Date.UTC(2020, 1, 11, 12))).toBeCloseTo(-14.2, 0)
    expect(equationOfTime(Date.UTC(2020, 10, 3, 12))).toBeCloseTo(16.4, 0)
  })

  it('首尔经度 126.98° 相对东九区约慢 32 分钟，再加均时差', () => {
    const t = resolveBirthTime(
      at({
        year: 1993,
        month: 3,
        day: 3,
        time: { hour: 11, minute: 10 },
        location: { city: 'seoul' },
        trueSolarTime: true,
      }),
    )
    expect(t.trueSolarCorrectionMinutes).toBe(-45)
    expect(hm(t.used)).toBe('10:25')
    expect(t.used).toEqual(t.trueSolar)
    expect(hm(t.standard)).toBe('11:10')
  })

  it('只修正日柱/时柱所用时间，不改变节气比较所用的出生时刻', () => {
    const off = resolveBirthTime(at({ location: { city: 'seoul' } }))
    const on = resolveBirthTime(at({ location: { city: 'seoul' }, trueSolarTime: true }))
    expect(on.utcMs).toBe(off.utcMs)
    expect(on.beijing).toEqual(off.beijing)
  })
})

describe('输入校验', () => {
  it('合法输入没有错误', () => {
    expect(validateInput(base)).toEqual([])
  })

  it('年份超出 1900–2100', () => {
    expect(validateInput(at({ year: 1899 }))).toContainEqual({
      field: 'year',
      code: 'out_of_range',
    })
    expect(validateInput(at({ year: 2101 }))).toContainEqual({
      field: 'year',
      code: 'out_of_range',
    })
  })

  it('不存在的国历日期', () => {
    expect(validateInput(at({ month: 2, day: 30 }))).toEqual([
      { field: 'day', code: 'invalid_date' },
    ])
    expect(validateInput(at({ year: 2024, month: 2, day: 29 }))).toEqual([])
  })

  it('不存在的农历闰月显示在闰月字段', () => {
    expect(
      validateInput(at({ calendar: 'lunar', year: 2021, month: 4, day: 1, isLeapMonth: true })),
    ).toEqual([{ field: 'leapMonth', code: 'leap_month_not_exist' }])
  })

  it('农历小月没有三十日', () => {
    // 2020 闰四月为小月（29 天）
    expect(
      validateInput(at({ calendar: 'lunar', year: 2020, month: 4, day: 30, isLeapMonth: true })),
    ).toEqual([{ field: 'day', code: 'invalid_date' }])
  })

  it('时间与地点字段', () => {
    expect(validateInput(at({ time: { hour: 24, minute: 0 } }))).toEqual([
      { field: 'time', code: 'out_of_range' },
    ])
    expect(validateInput(at({ location: { utcOffsetMinutes: 2000 } }))).toEqual([
      { field: 'location', code: 'out_of_range' },
    ])
    expect(validateInput(at({ location: { utcOffsetMinutes: 480 }, trueSolarTime: true }))).toEqual(
      [{ field: 'trueSolarTime', code: 'longitude_required' }],
    )
  })
})
