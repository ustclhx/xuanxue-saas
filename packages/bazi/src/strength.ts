import { branchElement, ELEMENTS, type Element, mod, stemElement } from './constants.ts'
import type { GanZhi, Qi } from './pillars.ts'
import { hiddenStemsOf } from './pillars.ts'

/**
 * 五行计分（design 决策 4）。内部以 0.05 为一个单位做整数运算，输出时再换算，
 * 保证浏览器与服务端逐位一致。
 */
const UNIT = 20
const STEM_UNITS = 20
const QI_UNITS: Record<Qi, number> = { main: 12, middle: 6, residual: 2 }
const MONTH_FACTOR_NUM = 3
const MONTH_FACTOR_DEN = 2

export type ElementStat = {
  element: Element
  /** 八字（无时辰为六字）中的个数：天干按本身五行，地支按本气五行。 */
  count: number
  score: number
  /** 占总分百分比，一位小数。 */
  percent: number
}

export type ScoreItem = {
  source: 'stem' | 'hidden'
  pillar: 'year' | 'month' | 'day' | 'hour'
  element: Element
  score: number
}

export type Strength = {
  elements: ElementStat[]
  total: number
  /** 同党（比劫 + 印）分数与百分比。 */
  support: number
  supportPercent: number
  verdict: 'strong' | 'weak'
  /** 计分明细，供展示与 AI 使用。 */
  items: ScoreItem[]
}

export type UsefulElements = {
  method: 'fuYi'
  /** 扶抑法：身强取克泄耗，身弱取生扶；按当前分数从低到高排序，首项为用神、次项为喜神。 */
  favorable: Element[]
  unfavorable: Element[]
  reference: true
}

/**
 * 地支藏干权重：本气/中气/余气 0.6/0.3/0.1；缺少的气并入本气，使每个地支合计 1.0，
 * 与一个天干等重（子卯酉本气 1.0，午亥本气 0.7 + 中气 0.3）。
 */
export function branchQiUnits(branch: number): { stem: number; qi: Qi; units: number }[] {
  const hidden = hiddenStemsOf(branch)
  const others = hidden.filter((h) => h.qi !== 'main').reduce((sum, h) => sum + QI_UNITS[h.qi], 0)
  return hidden.map((h) => ({
    ...h,
    units: h.qi === 'main' ? STEM_UNITS - others : QI_UNITS[h.qi],
  }))
}

const toScore = (units: number) => units / UNIT

export function computeStrength(pillars: {
  year: GanZhi
  month: GanZhi
  day: GanZhi
  hour: GanZhi | null
}): Strength {
  const units = [0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0]
  const items: ScoreItem[] = []
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    const gz = pillars[key]
    if (gz === null) continue
    const [stem, branch] = gz
    const se = stemElement(stem)
    units[se] = (units[se] as number) + STEM_UNITS
    counts[se] = (counts[se] as number) + 1
    counts[branchElement(branch)] = (counts[branchElement(branch)] as number) + 1
    items.push({
      source: 'stem',
      pillar: key,
      element: ELEMENTS[se] as Element,
      score: toScore(STEM_UNITS),
    })
    for (const h of branchQiUnits(branch)) {
      // 月令加权 ×1.5：只作用于月支藏干
      const u = key === 'month' ? (h.units * MONTH_FACTOR_NUM) / MONTH_FACTOR_DEN : h.units
      const e = stemElement(h.stem)
      units[e] = (units[e] as number) + u
      items.push({
        source: 'hidden',
        pillar: key,
        element: ELEMENTS[e] as Element,
        score: toScore(u),
      })
    }
  }
  const total = units.reduce((a, b) => a + b, 0)
  const dm = stemElement(pillars.day[0])
  // 同党 = 同我（比劫）+ 生我（印）
  const supportUnits = (units[dm] as number) + (units[mod(dm - 1, 5)] as number)
  const percentOf = (u: number) => Math.round((u * 1000) / total) / 10
  return {
    elements: ELEMENTS.map((element, i) => ({
      element,
      count: counts[i] as number,
      score: toScore(units[i] as number),
      percent: percentOf(units[i] as number),
    })),
    total: toScore(total),
    support: toScore(supportUnits),
    supportPercent: percentOf(supportUnits),
    verdict: supportUnits * 2 >= total ? 'strong' : 'weak',
    items,
  }
}

export function computeUseful(dayStem: number, strength: Strength): UsefulElements {
  const dm = stemElement(dayStem)
  const support = [dm, mod(dm - 1, 5)]
  // 克泄耗：我生（食伤）、我克（财）、克我（官杀）
  const drain = [mod(dm + 1, 5), mod(dm + 2, 5), mod(dm + 3, 5)]
  const [favorable, unfavorable] =
    strength.verdict === 'strong' ? [drain, support] : [support, drain]
  const byScore = (list: number[]) =>
    [...list]
      .sort((a, b) => {
        const sa = strength.elements[a]?.score ?? 0
        const sb = strength.elements[b]?.score ?? 0
        return sa - sb || a - b
      })
      .map((i) => ELEMENTS[i] as Element)
  return {
    method: 'fuYi',
    favorable: byScore(favorable),
    unfavorable: byScore(unfavorable),
    reference: true,
  }
}
