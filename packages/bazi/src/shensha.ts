import { BRANCHES, type Branch, mod, type PillarKey } from './constants.ts'
import type { GanZhi } from './pillars.ts'

export const SHENSHA_KEYS = [
  'kongWang',
  'taoHua',
  'tianYiGuiRen',
  'yiMa',
  'huaGai',
  'wenChang',
  'yangRen',
  'luShen',
] as const
export type ShenshaKey = (typeof SHENSHA_KEYS)[number]

export type ShenshaBasis =
  | 'dayPillar'
  | 'yearPillar'
  | 'dayStem'
  | 'yearStem'
  | 'dayBranch'
  | 'yearBranch'

export type ShenshaEntry = {
  key: ShenshaKey
  /** 起法依据，例如「日干查」「年支查」。 */
  basis: ShenshaBasis
  /** 该神煞落在的地支。 */
  targets: Branch[]
  /** 地支命中 targets 的柱（不含依据所在柱本身）。 */
  pillars: PillarKey[]
  /** 不知道时辰时未检查时柱，页面应提示「需要出生时辰」。 */
  requiresHour: boolean
}

// 以下表均按序号：天干 甲=0…癸=9，地支 子=0…亥=11

/** 天乙贵人（日干/年干）：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎。 */
const GUI_REN: number[][] = [
  [1, 7],
  [0, 8],
  [11, 9],
  [11, 9],
  [1, 7],
  [0, 8],
  [1, 7],
  [6, 2],
  [3, 5],
  [3, 5],
]
/** 文昌（日干）：甲巳 乙午 丙申 丁酉 戊申 己酉 庚亥 辛子 壬寅 癸卯。 */
const WEN_CHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]
/** 禄神（日干）：甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子。 */
const LU_SHEN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]

/** 三合局组号 = 地支序号 mod 4：申子辰=0、巳酉丑=1、寅午戌=2、亥卯未=3。以下三表按组号排列。 */
export function triadOf(branch: number): number {
  return mod(branch, 4)
}
/** 桃花（咸池）：申子辰在酉，巳酉丑在午，寅午戌在卯，亥卯未在子。 */
const TAO_HUA = [9, 6, 3, 0]
/** 驿马：申子辰马在寅，巳酉丑马在亥，寅午戌马在申，亥卯未马在巳。 */
const YI_MA = [2, 11, 8, 5]
/** 华盖：申子辰见辰，巳酉丑见丑，寅午戌见戌，亥卯未见未。 */
const HUA_GAI = [4, 1, 10, 7]

/** 旬空：所在旬（甲子旬…甲寅旬）未配到天干的两个地支。 */
export function kongWangOf(gz: GanZhi): number[] {
  const xunStart = mod(gz[1] - gz[0], 12)
  return [mod(xunStart + 10, 12), mod(xunStart + 11, 12)]
}

/** 羊刃：禄前一位（甲卯 乙辰 丙午 丁未 戊午 己未 庚酉 辛戌 壬子 癸丑）。 */
export function yangRenOf(stem: number): number {
  return mod((LU_SHEN[stem] as number) + 1, 12)
}

type Pillars = { year: GanZhi; month: GanZhi; day: GanZhi; hour: GanZhi | null }

export function computeShensha(p: Pillars): ShenshaEntry[] {
  const keys: PillarKey[] = ['year', 'month', 'day', 'hour']
  const entry = (
    key: ShenshaKey,
    basis: ShenshaBasis,
    targets: number[],
    exclude: PillarKey,
  ): ShenshaEntry => ({
    key,
    basis,
    targets: targets.map((b) => BRANCHES[b] as Branch),
    pillars: keys.filter((k) => {
      if (k === exclude) return false
      const gz = p[k]
      return gz !== null && targets.includes(gz[1])
    }),
    requiresHour: p.hour === null,
  })
  const dayStem = p.day[0]
  const yearStem = p.year[0]
  const dayTriad = triadOf(p.day[1])
  const yearTriad = triadOf(p.year[1])
  return [
    entry('kongWang', 'dayPillar', kongWangOf(p.day), 'day'),
    entry('kongWang', 'yearPillar', kongWangOf(p.year), 'year'),
    entry('taoHua', 'yearBranch', [TAO_HUA[yearTriad] as number], 'year'),
    entry('taoHua', 'dayBranch', [TAO_HUA[dayTriad] as number], 'day'),
    entry('tianYiGuiRen', 'dayStem', GUI_REN[dayStem] as number[], 'day'),
    entry('tianYiGuiRen', 'yearStem', GUI_REN[yearStem] as number[], 'year'),
    entry('yiMa', 'yearBranch', [YI_MA[yearTriad] as number], 'year'),
    entry('yiMa', 'dayBranch', [YI_MA[dayTriad] as number], 'day'),
    entry('huaGai', 'yearBranch', [HUA_GAI[yearTriad] as number], 'year'),
    entry('huaGai', 'dayBranch', [HUA_GAI[dayTriad] as number], 'day'),
    entry('wenChang', 'dayStem', [WEN_CHANG[dayStem] as number], 'day'),
    entry('yangRen', 'dayStem', [yangRenOf(dayStem)], 'day'),
    entry('luShen', 'dayStem', [LU_SHEN[dayStem] as number], 'day'),
  ]
}
