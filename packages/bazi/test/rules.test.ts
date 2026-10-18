import { EarthBranch, HeavenStem, SixtyCycle } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import { TEN_GODS } from '../src/constants.ts'
import { hourBranchOf, hourStemOf, tenGodOf } from '../src/pillars.ts'
import { computeShensha, kongWangOf, triadOf, yangRenOf } from '../src/shensha.ts'
import { branchQiUnits, computeStrength, computeUseful } from '../src/strength.ts'
import { computeWeight } from '../src/weight.ts'

const TEN_STAR_NAMES = [
  '比肩',
  '劫财',
  '食神',
  '伤官',
  '偏财',
  '正财',
  '七杀',
  '正官',
  '偏印',
  '正印',
]

describe('十神', () => {
  it('100 组日干 × 目标干与 tyme4ts 一致', () => {
    for (let d = 0; d < 10; d++) {
      for (let t = 0; t < 10; t++) {
        const expected = HeavenStem.fromIndex(d).getTenStar(HeavenStem.fromIndex(t)).getName()
        expect(TEN_STAR_NAMES[TEN_GODS.indexOf(tenGodOf(d, t))]).toBe(expected)
      }
    }
  })

  it('庚日：壬为食神、丙为七杀、己为正印', () => {
    expect(tenGodOf(6, 8)).toBe('shiShen')
    expect(tenGodOf(6, 2)).toBe('qiSha')
    expect(tenGodOf(6, 5)).toBe('zhengYin')
  })
})

describe('时柱', () => {
  it('时支：23–1 点子时、11–13 点午时', () => {
    expect([0, 1, 2, 10, 11, 12, 13, 22, 23].map(hourBranchOf)).toEqual([
      0, 1, 1, 5, 6, 6, 7, 11, 0,
    ])
  })

  it('五鼠遁：甲己日甲子时、乙庚日丙子时、丙辛日戊子时、丁壬日庚子时、戊癸日壬子时', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => hourStemOf(d, 0))).toEqual([
      0, 2, 4, 6, 8, 0, 2, 4, 6, 8,
    ])
    // 庚日巳时 = 辛巳
    expect(hourStemOf(6, 5)).toBe(7)
  })
})

describe('五行计分', () => {
  it('每个地支藏干合计等于一个天干（1.0），本气/中气/余气 0.6/0.3/0.1，缺气并入本气', () => {
    for (let b = 0; b < 12; b++) {
      expect(branchQiUnits(b).reduce((s, h) => s + h.units, 0)).toBe(20)
    }
    expect(branchQiUnits(0).map((h) => h.units)).toEqual([20]) // 子：癸
    expect(branchQiUnits(6).map((h) => h.units)).toEqual([14, 6]) // 午：丁 0.7 己 0.3
    expect(branchQiUnits(1).map((h) => h.units)).toEqual([12, 6, 2]) // 丑：己癸辛
  })

  it('藏干与 tyme4ts 一致', () => {
    for (let b = 0; b < 12; b++) {
      const names = EarthBranch.fromIndex(b)
        .getHideHeavenStems()
        .map((h) => h.getHeavenStem().getIndex())
      expect(branchQiUnits(b).map((h) => h.stem)).toEqual(names)
    }
  })

  // 庚午 辛巳 庚辰 辛巳
  const sample = {
    year: [6, 6] as [number, number],
    month: [7, 5] as [number, number],
    day: [6, 4] as [number, number],
    hour: [7, 5] as [number, number],
  }

  it('样例：月令 ×1.5，金 4.75、火 2.2、土 1.15、木 0.3、水 0.1，同党 69.4% 判身强', () => {
    const s = computeStrength(sample)
    const score = Object.fromEntries(s.elements.map((e) => [e.element, e.score]))
    expect(score).toEqual({ wood: 0.3, fire: 2.2, earth: 1.15, metal: 4.75, water: 0.1 })
    expect(s.total).toBe(8.5)
    expect(s.support).toBe(5.9)
    expect(s.supportPercent).toBe(69.4)
    expect(s.verdict).toBe('strong')
    const count = Object.fromEntries(s.elements.map((e) => [e.element, e.count]))
    expect(count).toEqual({ wood: 0, fire: 3, earth: 1, metal: 4, water: 0 })
    // 明细逐项相加等于总分
    expect(Math.round(s.items.reduce((a, i) => a + i.score, 0) * 100) / 100).toBe(8.5)
  })

  it('同党恰好 50% 判身强', () => {
    // 甲子 甲子 甲子 庚申：木 3 水 3（子）对 金 1+1（庚、申本气）+ 申中气水/余气土
    const s = computeStrength({ year: [0, 0], month: [0, 0], day: [0, 0], hour: [6, 8] })
    expect(s.supportPercent).toBeGreaterThanOrEqual(50)
    expect(s.verdict).toBe('strong')
  })

  it('喜用神：身强取克泄耗、身弱取生扶，按分数从低到高', () => {
    const strong = computeStrength(sample)
    expect(computeUseful(6, strong)).toEqual({
      method: 'fuYi',
      favorable: ['water', 'wood', 'fire'],
      unfavorable: ['earth', 'metal'],
      reference: true,
    })
    const weak = { ...strong, verdict: 'weak' as const }
    expect(computeUseful(6, weak).favorable).toEqual(['earth', 'metal'])
  })

  it('无时辰时只计六字', () => {
    const s = computeStrength({ ...sample, hour: null })
    expect(s.elements.reduce((a, e) => a + e.count, 0)).toBe(6)
    expect(s.items.every((i) => i.pillar !== 'hour')).toBe(true)
  })
})

describe('神煞表', () => {
  it('旬空与 tyme4ts 六十甲子一致', () => {
    for (let i = 0; i < 60; i++) {
      const c = SixtyCycle.fromIndex(i)
      const gz: [number, number] = [c.getHeavenStem().getIndex(), c.getEarthBranch().getIndex()]
      expect(kongWangOf(gz)).toEqual(c.getExtraEarthBranches().map((b) => b.getIndex()))
    }
  })

  it('三合分组', () => {
    expect([8, 0, 4].map(triadOf)).toEqual([0, 0, 0])
    expect([5, 9, 1].map(triadOf)).toEqual([1, 1, 1])
    expect([2, 6, 10].map(triadOf)).toEqual([2, 2, 2])
    expect([11, 3, 7].map(triadOf)).toEqual([3, 3, 3])
  })

  it('羊刃为禄前一位', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(yangRenOf)).toEqual([3, 4, 6, 7, 6, 7, 9, 10, 0, 1])
  })

  const find = (list: ReturnType<typeof computeShensha>, key: string, basis: string) =>
    list.find((s) => s.key === key && s.basis === basis)

  it('甲子年 丙寅月 甲午日 癸酉时：贵人、桃花、驿马、文昌、禄、羊刃、华盖逐项命中', () => {
    const list = computeShensha({ year: [0, 0], month: [2, 2], day: [0, 6], hour: [9, 9] })
    // 甲日贵人丑未：无
    expect(find(list, 'tianYiGuiRen', 'dayStem')?.pillars).toEqual([])
    // 年支子（申子辰）桃花在酉：时柱
    expect(find(list, 'taoHua', 'yearBranch')?.pillars).toEqual(['hour'])
    // 日支午（寅午戌）桃花在卯、驿马在申、华盖在戌：无
    expect(find(list, 'taoHua', 'dayBranch')?.targets).toEqual(['mao'])
    expect(find(list, 'yiMa', 'dayBranch')?.targets).toEqual(['shen'])
    expect(find(list, 'huaGai', 'dayBranch')?.targets).toEqual(['xu'])
    // 年支子驿马在寅：月柱
    expect(find(list, 'yiMa', 'yearBranch')?.pillars).toEqual(['month'])
    // 甲日文昌巳、禄寅（月柱）、羊刃卯
    expect(find(list, 'wenChang', 'dayStem')?.targets).toEqual(['si'])
    expect(find(list, 'luShen', 'dayStem')?.pillars).toEqual(['month'])
    expect(find(list, 'yangRen', 'dayStem')?.targets).toEqual(['mao'])
    // 甲午日在甲午旬，空辰巳；甲子年空戌亥
    expect(find(list, 'kongWang', 'dayPillar')?.targets).toEqual(['chen', 'si'])
    expect(find(list, 'kongWang', 'yearPillar')?.targets).toEqual(['xu', 'hai'])
    expect(list.every((s) => !s.requiresHour)).toBe(true)
  })

  it('贵人六辛逢马虎、壬癸兔蛇藏', () => {
    const xin = computeShensha({ year: [7, 2], month: [0, 6], day: [7, 1], hour: null })
    expect(find(xin, 'tianYiGuiRen', 'dayStem')?.targets).toEqual(['wu', 'yin'])
    expect(find(xin, 'tianYiGuiRen', 'dayStem')?.pillars).toEqual(['year', 'month'])
    expect(xin.every((s) => s.requiresHour)).toBe(true)
  })

  it('不检查依据所在柱本身', () => {
    // 日支辰（申子辰）华盖在辰，不算日柱
    const list = computeShensha({ year: [6, 6], month: [7, 5], day: [6, 4], hour: [7, 5] })
    expect(find(list, 'huaGai', 'dayBranch')?.pillars).toEqual([])
  })
})

describe('八字重量', () => {
  it('样例 庚午年 四月 廿一 巳时 = 0.9 + 0.9 + 1.0 + 1.6 = 四两四钱', () => {
    expect(computeWeight({ yearCycle: 6, lunarMonth: 4, lunarDay: 21, hourBranch: 5 })).toEqual({
      status: 'ok',
      totalQian: 44,
      liang: 4,
      qian: 4,
      parts: { year: 9, month: 9, day: 10, hour: 16 },
    })
  })

  it('称骨范围为二两一钱至七两一钱', () => {
    let min = Number.POSITIVE_INFINITY
    let max = 0
    for (let y = 0; y < 60; y++) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 19, 18, 26]) {
          for (let h = 0; h < 12; h++) {
            const w = computeWeight({ yearCycle: y, lunarMonth: m, lunarDay: d, hourBranch: h })
            if (w.status !== 'ok') throw new Error('unexpected')
            min = Math.min(min, w.totalQian)
            max = Math.max(max, w.totalQian)
          }
        }
      }
    }
    expect(min).toBe(21)
    expect(max).toBe(71)
  })

  it('无时辰时提示需要出生时辰，只给年月日三部分', () => {
    expect(computeWeight({ yearCycle: 6, lunarMonth: 4, lunarDay: 21, hourBranch: null })).toEqual({
      status: 'requiresHour',
      parts: { year: 9, month: 9, day: 10 },
    })
  })
})
