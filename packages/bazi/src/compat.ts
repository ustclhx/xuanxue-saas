import { type BaziChart, type ChartOptions, computeChart } from './chart.ts'
import { branchIndex, mod, stemIndex } from './constants.ts'
import type { BirthInput } from './input.ts'
import { triadOf } from './shensha.ts'

/**
 * 사주궁합参考分：基础 60 分，按日柱关系与五行互补加减，最终限制在 0–100。
 * 每一项都输出 key 与加减分，页面展开即可解释分数来源。
 */
export const COMPAT_BASE = 60

export type CompatItemKey =
  | 'stemCombine'
  | 'branchSixCombine'
  | 'branchTriad'
  | 'branchClash'
  | 'branchPunish'
  | 'elementComplementAB'
  | 'elementComplementBA'

export type CompatItem = {
  key: CompatItemKey
  delta: number
  /** 项目依据：涉及的天干/地支或五行。 */
  detail: Record<string, string | number>
}

export type Compatibility = {
  engineVersion: string
  score: number
  base: number
  items: CompatItem[]
  charts: [BaziChart, BaziChart]
}

const STEM_COMBINE = 15
const SIX_COMBINE = 12
const TRIAD = 8
const CLASH = -15
const PUNISH = -8
const COMPLEMENT_MAX = 10
/** 对方在我两种喜用五行上的占比达到 40% 即得满分。 */
const COMPLEMENT_FULL_PERCENT = 40

/** 六合：子丑、寅亥、卯戌、辰酉、巳申、午未（两支序号和 ≡ 1 mod 12）。 */
export function isSixCombine(a: number, b: number): boolean {
  return mod(a + b, 12) === 1
}

/** 相冲：相隔六位。 */
export function isClash(a: number, b: number): boolean {
  return mod(a - b, 12) === 6
}

/** 三合：同属申子辰/亥卯未/寅午戌/巳酉丑且不同支。 */
export function isTriad(a: number, b: number): boolean {
  return a !== b && triadOf(a) === triadOf(b)
}

const PUNISH_PAIRS = new Set(['0-3', '2-5', '5-8', '2-8', '1-10', '10-7', '1-7'])
const SELF_PUNISH = new Set([4, 6, 9, 11])

/** 相刑：子卯、寅巳申、丑戌未；自刑：辰午酉亥。 */
export function isPunish(a: number, b: number): boolean {
  if (a === b) return SELF_PUNISH.has(a)
  return PUNISH_PAIRS.has(`${a}-${b}`) || PUNISH_PAIRS.has(`${b}-${a}`)
}

/** 天干五合：甲己、乙庚、丙辛、丁壬、戊癸（相隔五位）。 */
export function isStemCombine(a: number, b: number): boolean {
  return mod(a - b, 10) === 5
}

function complement(self: BaziChart, other: BaziChart): { delta: number; percent: number } {
  const wanted = self.useful.favorable.slice(0, 2)
  const percent = other.strength.elements
    .filter((e) => wanted.includes(e.element))
    .reduce((sum, e) => sum + e.percent, 0)
  const ratio = Math.min(1, percent / COMPLEMENT_FULL_PERCENT)
  return { delta: Math.round(COMPLEMENT_MAX * ratio), percent: Math.round(percent * 10) / 10 }
}

export function scoreCompatibility(a: BaziChart, b: BaziChart): Omit<Compatibility, 'charts'> {
  const items: CompatItem[] = []
  const sa = stemIndex(a.pillars.day.stem)
  const sb = stemIndex(b.pillars.day.stem)
  const ba = branchIndex(a.pillars.day.branch)
  const bb = branchIndex(b.pillars.day.branch)
  const stems = { a: a.pillars.day.stem, b: b.pillars.day.stem }
  const branches = { a: a.pillars.day.branch, b: b.pillars.day.branch }
  if (isStemCombine(sa, sb)) items.push({ key: 'stemCombine', delta: STEM_COMBINE, detail: stems })
  if (isSixCombine(ba, bb)) {
    items.push({ key: 'branchSixCombine', delta: SIX_COMBINE, detail: branches })
  }
  if (isTriad(ba, bb)) items.push({ key: 'branchTriad', delta: TRIAD, detail: branches })
  if (isClash(ba, bb)) items.push({ key: 'branchClash', delta: CLASH, detail: branches })
  if (isPunish(ba, bb)) items.push({ key: 'branchPunish', delta: PUNISH, detail: branches })
  const ab = complement(a, b)
  const bA = complement(b, a)
  const favorable = (c: BaziChart) => c.useful.favorable.slice(0, 2).join(',')
  items.push({
    key: 'elementComplementAB',
    delta: ab.delta,
    detail: { favorable: favorable(a), percent: ab.percent },
  })
  items.push({
    key: 'elementComplementBA',
    delta: bA.delta,
    detail: { favorable: favorable(b), percent: bA.percent },
  })
  const raw = items.reduce((sum, item) => sum + item.delta, COMPAT_BASE)
  return {
    engineVersion: a.engineVersion,
    score: Math.max(0, Math.min(100, raw)),
    base: COMPAT_BASE,
    items,
  }
}

/** 双人궁합：分别排盘后计分。 */
export function computeCompatibility(
  a: BirthInput,
  b: BirthInput,
  options: ChartOptions,
): Compatibility {
  const charts: [BaziChart, BaziChart] = [computeChart(a, options), computeChart(b, options)]
  return { ...scoreCompatibility(charts[0], charts[1]), charts }
}
