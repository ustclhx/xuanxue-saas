import { describe, expect, it } from 'vitest'
import {
  COMPAT_BASE,
  computeCompatibility,
  isClash,
  isPunish,
  isSixCombine,
  isStemCombine,
  isTriad,
} from '../src/compat.ts'
import type { BirthInput } from '../src/input.ts'
import { computeZiwei, MAJOR_STARS, ziweiTimeIndex } from '../src/ziwei.ts'

const sample: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}

describe('紫微斗数', () => {
  it('不知道时辰时提示需要时辰且不出盘', () => {
    expect(computeZiwei({ ...sample, time: null })).toEqual({
      status: 'requiresHour',
      engineVersion: expect.any(String),
    })
  })

  it('样例：十二宫、命宫子、身宫戌、十四主星各落一宫、庚年四化', () => {
    const z = computeZiwei(sample)
    if (z.status !== 'ok') throw new Error('expected chart')
    expect(z.timeIndex).toBe(5)
    expect(z.palaces).toHaveLength(12)
    expect(new Set(z.palaces.map((p) => p.key)).size).toBe(12)
    expect(z.palaces.find((p) => p.key === 'soul')?.branch).toBe('zi')
    expect(z.bodyPalaceBranch).toBe('xu')
    expect(z.palaces.find((p) => p.isBodyPalace)?.branch).toBe('xu')
    const stars = z.palaces.flatMap((p) => p.majorStars.map((s) => s.star))
    expect([...stars].sort()).toEqual([...MAJOR_STARS].sort())
    // 庚：太阳禄、武曲权、太阴科、天同忌
    expect(z.mutagens.map((m) => `${m.star}:${m.mutagen}`).sort()).toEqual(
      ['taiyang:lu', 'wuqu:quan', 'taiyin:ke', 'tiantong:ji'].sort(),
    )
  })

  it('时辰序号：0 点早子、23 点晚子', () => {
    expect([0, 1, 10, 11, 22, 23].map(ziweiTimeIndex)).toEqual([0, 1, 5, 6, 11, 12])
  })
})

describe('사주궁합', () => {
  it('日柱关系判定', () => {
    expect(isStemCombine(0, 5)).toBe(true) // 甲己
    expect(isStemCombine(6, 1)).toBe(true) // 庚乙
    expect(isSixCombine(0, 1)).toBe(true) // 子丑
    expect(isSixCombine(6, 7)).toBe(true) // 午未
    expect(isSixCombine(2, 11)).toBe(true) // 寅亥
    expect(isTriad(8, 4)).toBe(true) // 申辰
    expect(isClash(0, 6)).toBe(true) // 子午
    expect(isPunish(0, 3)).toBe(true) // 子卯
    expect(isPunish(2, 8)).toBe(true) // 寅申
    expect(isPunish(6, 6)).toBe(true) // 午午自刑
    expect(isPunish(0, 0)).toBe(false)
  })

  it('分数可解释：基础分加各项加减分等于总分，且在 0–100', () => {
    const b: BirthInput = { ...sample, year: 1992, month: 11, day: 3, gender: 'female' }
    const r = computeCompatibility(sample, b, { referenceYear: 2026 })
    expect(r.base).toBe(COMPAT_BASE)
    expect(r.items.length).toBeGreaterThanOrEqual(2)
    for (const item of r.items) {
      expect(typeof item.delta).toBe('number')
      expect(item.detail).toBeTypeOf('object')
    }
    const raw = r.items.reduce((s, i) => s + i.delta, r.base)
    expect(r.score).toBe(Math.max(0, Math.min(100, raw)))
    expect(r.charts).toHaveLength(2)
  })

  it('日干相合、日支六合加分；日支相冲扣分', () => {
    // 样例为庚辰日；六十甲子日每天顺推一位：+5 天乙酉日，−6 天甲戌日
    const yiYou: BirthInput = { ...sample, day: 20, gender: 'female' }
    const jiaXu: BirthInput = { ...sample, day: 9, gender: 'female' }
    const good = computeCompatibility(sample, yiYou, { referenceYear: 2026 })
    expect(good.charts[1].pillars.day).toMatchObject({ stem: 'yi', branch: 'you' })
    // 乙庚合 +15、辰酉六合 +12
    expect(
      good.items.filter((i) => i.delta > 0 && i.key.startsWith('s')).map((i) => i.key),
    ).toEqual(['stemCombine'])
    expect(good.items.find((i) => i.key === 'branchSixCombine')?.delta).toBe(12)
    const bad = computeCompatibility(sample, jiaXu, { referenceYear: 2026 })
    expect(bad.charts[1].pillars.day).toMatchObject({ stem: 'jia', branch: 'xu' })
    expect(bad.items.find((i) => i.key === 'branchClash')?.delta).toBe(-15)
    expect(bad.items.some((i) => i.key === 'stemCombine')).toBe(false)
    expect(good.score).toBeGreaterThan(bad.score)
  })
})
