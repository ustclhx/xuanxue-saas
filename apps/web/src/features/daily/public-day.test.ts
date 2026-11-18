import { dayPillarOf } from '@xuanxue/bazi/daily'
import { universalDay } from '@xuanxue/numerology'
import { describe, expect, it } from 'vitest'
import { publicDayPillar, publicUniversalDay } from './public-day.ts'

/** 从 2026-01-01 起连续 1,000 天，跨闰年与多个农历年 */
function days(count: number) {
  const start = Date.UTC(2026, 0, 1)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86_400_000)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
  })
}

describe('首页今日条的当日公共信息', () => {
  it('当日干支与排盘引擎 dayPillarOf 连续 1,000 天一致', () => {
    for (const date of days(1000)) {
      const engine = dayPillarOf(date)
      expect(publicDayPillar(date), JSON.stringify(date)).toEqual({
        stem: engine.stem,
        branch: engine.branch,
        cycleIndex: engine.cycleIndex,
      })
    }
  })

  it('基准日之前与远期日期同样一致', () => {
    for (const date of [
      { year: 1969, month: 12, day: 31 },
      { year: 1950, month: 2, day: 17 },
      { year: 2000, month: 2, day: 29 },
      { year: 2099, month: 12, day: 31 },
    ]) {
      const engine = dayPillarOf(date)
      expect(publicDayPillar(date)).toMatchObject({ stem: engine.stem, branch: engine.branch })
    }
  })

  it('设计稿样例：2026-11-17 为乙未日、Universal Day 2', () => {
    const date = { year: 2026, month: 11, day: 17 }
    expect(publicDayPillar(date)).toMatchObject({ stem: 'yi', branch: 'wei' })
    expect(publicUniversalDay(date)).toBe(2)
  })

  it('Universal Day 与数字命理包 universalDay 连续 1,000 天一致', () => {
    for (const date of days(1000))
      expect(publicUniversalDay(date), JSON.stringify(date)).toBe(universalDay(date).value)
  })
})
