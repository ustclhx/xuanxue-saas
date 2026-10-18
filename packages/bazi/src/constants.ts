/**
 * 干支、五行、十神的稳定 key。结果只含这些 key，文案由页面按 messages/<locale>/bazi.json 渲染。
 * 数组顺序即传统序号（甲=0、子=0、木火土金水），各模块用序号做模运算。
 */

export const STEMS = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'] as const
export type Stem = (typeof STEMS)[number]

export const BRANCHES = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
] as const
export type Branch = (typeof BRANCHES)[number]

export const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const
export type Element = (typeof ELEMENTS)[number]

export const TEN_GODS = [
  'biJian',
  'jieCai',
  'shiShen',
  'shangGuan',
  'pianCai',
  'zhengCai',
  'qiSha',
  'zhengGuan',
  'pianYin',
  'zhengYin',
] as const
export type TenGod = (typeof TEN_GODS)[number]

export const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const
export type PillarKey = (typeof PILLAR_KEYS)[number]

/** 天干五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。 */
export function stemElement(stem: number): number {
  return Math.floor(stem / 2)
}

/** 阳干/阳支为 0，阴为 1。 */
export function stemPolarity(stem: number): number {
  return stem % 2
}

const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]

export function branchElement(branch: number): number {
  return BRANCH_ELEMENT[branch] as number
}

export function stemIndex(stem: Stem): number {
  return STEMS.indexOf(stem)
}

export function branchIndex(branch: Branch): number {
  return BRANCHES.indexOf(branch)
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}
