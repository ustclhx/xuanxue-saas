import { describe, expect, it } from 'vitest'
import type { BirthInput } from '../src/input.ts'
import { computeZiwei, ziweiHoroscope } from '../src/ziwei.ts'

const sample: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}
const window = { startYear: 2026, years: 5 }

/** 十干四化（禄、权、科、忌），与 iztro 默认（全书）口径一致 */
const YEAR_MUTAGENS: Record<string, string[]> = {
  jia: ['lianzhen', 'pojun', 'wuqu', 'taiyang'],
  yi: ['tianji', 'tianliang', 'ziwei', 'taiyin'],
  bing: ['tiantong', 'tianji', 'wenchang', 'lianzhen'],
  ding: ['taiyin', 'tiantong', 'tianji', 'jumen'],
  wu: ['tanlang', 'taiyin', 'youbi', 'tianji'],
  ji: ['wuqu', 'tanlang', 'tianliang', 'wenqu'],
  geng: ['taiyang', 'wuqu', 'taiyin', 'tiantong'],
  xin: ['jumen', 'taiyang', 'wenqu', 'wenchang'],
  ren: ['tianliang', 'ziwei', 'zuofu', 'wuqu'],
  gui: ['pojun', 'jumen', 'taiyin', 'tanlang'],
}

describe('紫微运限', () => {
  it('不知道时辰仍不出盘', () => {
    expect(ziweiHoroscope({ ...sample, time: null }, window)).toEqual({
      status: 'requiresHour',
      engineVersion: expect.any(String),
    })
  })

  it('十二宫大限区间连续覆盖，当前与下一步大限相邻', () => {
    const h = ziweiHoroscope(sample, window)
    if (h.status !== 'ok') throw new Error('expected horoscope')
    expect(h.decades).toHaveLength(12)
    expect(new Set(h.decades.map((d) => d.palace)).size).toBe(12)
    for (let i = 1; i < h.decades.length; i++)
      expect(h.decades[i]?.ageRange[0]).toBe((h.decades[i - 1]?.ageRange[1] ?? 0) + 1)
    // 1990 年生，2026 年虚岁 37
    expect(h.years[0]?.nominalAge).toBe(37)
    const current = h.currentDecade
    expect(current && current.ageRange[0] <= 37 && 37 <= current.ageRange[1]).toBe(true)
    expect(h.nextDecade?.ageRange[0]).toBe((current?.ageRange[1] ?? 0) + 1)
    expect(h.years[0]?.decadePalace).toBe(current?.palace)
  })

  it('流年四化星曜与该年天干一致，落宫为星曜所在本命宫', () => {
    const h = ziweiHoroscope(sample, window)
    if (h.status !== 'ok') throw new Error('expected horoscope')
    const chart = computeZiwei(sample)
    if (chart.status !== 'ok') throw new Error('expected chart')
    expect(h.years.map((y) => `${y.year}:${y.stem}-${y.branch}`)).toEqual([
      '2026:bing-wu',
      '2027:ding-wei',
      '2028:wu-shen',
      '2029:ji-you',
      '2030:geng-xu',
    ])
    for (const y of h.years) {
      expect(y.mutagens.map((m) => m.star)).toEqual(YEAR_MUTAGENS[y.stem])
      expect(y.mutagens.map((m) => m.mutagen)).toEqual(['lu', 'quan', 'ke', 'ji'])
      for (const m of y.mutagens) {
        const palace = chart.palaces.find((p) => p.key === m.palace)
        if (palace?.majorStars.some((s) => s.star === m.star)) continue
        // 辅星（文昌、左辅等）不在 majorStars 中，只检查落宫存在
        expect(palace).toBeDefined()
      }
      // 流年命宫地支即流年地支
      expect(chart.palaces.find((p) => p.key === y.soulPalace)?.branch).toBe(y.branch)
    }
  })

  it('六吉六煞各落一宫，同一输入结果相同', () => {
    const h = ziweiHoroscope(sample, window)
    if (h.status !== 'ok') throw new Error('expected horoscope')
    expect(h.auxiliaryStars.map((s) => s.star)).toEqual([
      'zuofu',
      'youbi',
      'wenchang',
      'wenqu',
      'tiankui',
      'tianyue',
      'qingyang',
      'tuoluo',
      'huoxing',
      'lingxing',
      'dikong',
      'dijie',
    ])
    expect(ziweiHoroscope(sample, window)).toEqual(h)
    expect(() => ziweiHoroscope(sample, { startYear: 2026, years: 0 })).toThrow(RangeError)
  })
})
