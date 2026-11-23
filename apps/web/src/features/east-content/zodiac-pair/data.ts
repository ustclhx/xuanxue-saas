import type { Branch, Element } from '@xuanxue/bazi'
import { type ZodiacPairFacts, zodiacPairFacts } from '@xuanxue/bazi/almanac'
import type { ZodiacKey } from '../zodiac/paths.ts'
import { ORDER, type PairMark, TRIAD_GROUPS, triadGroupOf } from './constants.ts'
import { pairBranches, ZODIAC_PAIR_KEYS, type ZodiacPairKey, zodiacPairKey } from './paths.ts'

export type { PairMark } from './constants.ts'

/**
 * 生肖配对的引擎事实（design 决策 4、9）：只在服务端与构建期计算，结果随 loader 下发，客户端不加载引擎。
 * 输出只含稳定 key 与数值，文字由页面按语言渲染（messages/<locale>/zodiac-pair.json）。
 */

export type PairRelation = ZodiacPairFacts['relations'][number]
export type ElementRelation = ZodiacPairFacts['elementRelation']

export interface PairFactsView {
  readonly branches: readonly [Branch, Branch]
  readonly relations: readonly PairRelation[]
  readonly elements: readonly [Element, Element]
  readonly elementRelation: ElementRelation
  readonly triads: readonly [number, number]
}

export function pairFacts(key: ZodiacPairKey): PairFactsView {
  const [a, b] = pairBranches(key)
  const facts = zodiacPairFacts(a, b)
  return {
    branches: [a, b],
    relations: facts.relations,
    elements: facts.elements,
    elementRelation: facts.elementRelation,
    triads: [triadGroupOf(a), triadGroupOf(b)],
  }
}

export function markOf(key: ZodiacPairKey): PairMark {
  const [a, b] = pairBranches(key)
  if (a === b) return 'same'
  const { relations } = zodiacPairFacts(a, b)
  for (const mark of ['sixCombine', 'triad', 'clash', 'harm'] as const)
    if (relations.includes(mark)) return mark
  return 'none'
}

/** 总表 78 格的标记（12×12 沿对角线对称，页面按需取反序格） */
export function pairMarks(): Readonly<Record<ZodiacPairKey, PairMark>> {
  return Object.fromEntries(ZODIAC_PAIR_KEYS.map((key) => [key, markOf(key)])) as Record<
    ZodiacPairKey,
    PairMark
  >
}

/**
 * 本支在显示年份范围内的年份（1924 甲子起每 12 年一轮）：取今年前 72 年至后 8 年，
 * 年份按立春换年，页面另注明。
 */
export function signYears(branch: Branch, calendarYear: number): number[] {
  const first = 1924 + ORDER.indexOf(branch)
  const years: number[] = []
  for (let year = first; year <= calendarYear + 8; year += 12)
    if (year >= calendarYear - 72) years.push(year)
  return years
}

/**
 * 相关配对（模板区块）：两支各自的三合同局配对与六冲配对，去掉本页，按出现顺序取前若干组。
 */
export function relatedPairs(key: ZodiacPairKey, limit = 3): ZodiacPairKey[] {
  const [a, b] = pairBranches(key)
  const out: ZodiacPairKey[] = []
  for (const sign of a === b ? [a] : [a, b]) {
    const group = TRIAD_GROUPS[triadGroupOf(sign)]
    const partners: ZodiacKey[] = [
      ...(group?.branches.filter((other) => other !== sign) ?? []),
      ORDER[(ORDER.indexOf(sign) + 6) % 12] as Branch,
    ]
    for (const partner of partners) {
      const candidate = zodiacPairKey(sign, partner)
      if (candidate !== key && !out.includes(candidate)) out.push(candidate)
    }
  }
  return out.slice(0, limit)
}

/** 系列导航：按地支顺序的上一对与下一对 */
export function seriesOf(key: ZodiacPairKey): {
  previous: ZodiacPairKey | null
  next: ZodiacPairKey | null
} {
  const index = ZODIAC_PAIR_KEYS.indexOf(key)
  return {
    previous: ZODIAC_PAIR_KEYS[index - 1] ?? null,
    next: ZODIAC_PAIR_KEYS[index + 1] ?? null,
  }
}
