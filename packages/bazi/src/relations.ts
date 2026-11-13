import { BRANCHES, type Branch, mod, STEMS, type Stem } from './constants.ts'

/**
 * 干支关系判定（天干五合、地支六合 / 三合 / 六冲 / 相刑 / 六害），以序号计算（甲=0、子=0）。
 * 独立成模块供궁합、流年窗口与每日运势共用，避免各处重复维护口诀表。
 */

/** 天干五合：甲己、乙庚、丙辛、丁壬、戊癸（相隔五位）。 */
export function isStemCombine(a: number, b: number): boolean {
  return mod(a - b, 10) === 5
}

/** 六合：子丑、寅亥、卯戌、辰酉、巳申、午未（两支序号和 ≡ 1 mod 12）。 */
export function isSixCombine(a: number, b: number): boolean {
  return mod(a + b, 12) === 1
}

/** 相冲：相隔六位。 */
export function isClash(a: number, b: number): boolean {
  return mod(a - b, 12) === 6
}

/** 三合局组号 = 地支序号 mod 4：申子辰=0、巳酉丑=1、寅午戌=2、亥卯未=3。 */
export function triadOf(branch: number): number {
  return mod(branch, 4)
}

/** 三合（含半合）：同属申子辰/亥卯未/寅午戌/巳酉丑且不同支。 */
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

/** 六害：子未、丑午、寅巳、卯辰、申亥、酉戌（两支序号和 ≡ 7 mod 12）。 */
export function isHarm(a: number, b: number): boolean {
  return mod(a + b, 12) === 7
}

/** 天干之间的关系 */
export type StemRelationType = 'stemCombine'
/** 地支之间的关系 */
export type BranchRelationType = 'sixCombine' | 'triad' | 'clash' | 'punish' | 'harm'
export type GanZhiRelationType = StemRelationType | BranchRelationType

/** 两个地支的全部关系，顺序固定（合在前、冲刑害在后），同一输入结果逐项相同。 */
export function branchRelations(a: Branch, b: Branch): BranchRelationType[] {
  const x = BRANCHES.indexOf(a)
  const y = BRANCHES.indexOf(b)
  const result: BranchRelationType[] = []
  if (isSixCombine(x, y)) result.push('sixCombine')
  if (isTriad(x, y)) result.push('triad')
  if (isClash(x, y)) result.push('clash')
  if (isPunish(x, y)) result.push('punish')
  if (isHarm(x, y)) result.push('harm')
  return result
}

export function stemRelations(a: Stem, b: Stem): StemRelationType[] {
  return isStemCombine(STEMS.indexOf(a), STEMS.indexOf(b)) ? ['stemCombine'] : []
}

/** 两柱（干支）之间的关系：天干五合 + 地支各关系。 */
export function ganZhiRelations(
  a: { stem: Stem; branch: Branch },
  b: { stem: Stem; branch: Branch },
): GanZhiRelationType[] {
  return [...stemRelations(a.stem, b.stem), ...branchRelations(a.branch, b.branch)]
}

/**
 * 流年（或流日）地支与本命年支的太岁关系：同支为值太岁，相冲为冲太岁；
 * 刑、害太岁流派说法不一，这里不计。
 */
export function taiSuiOf(branch: Branch, natalYearBranch: Branch): 'zhi' | 'chong' | null {
  if (branch === natalYearBranch) return 'zhi'
  return isClash(BRANCHES.indexOf(branch), BRANCHES.indexOf(natalYearBranch)) ? 'chong' : null
}
