import { type BaziChart, BRANCHES, type Branch, STEMS, type Stem } from '@xuanxue/bazi'

/**
 * 日语四柱推命详批的附加数据（openspec add-locales-eu-ja design 决策 7、tasks 4.8）：
 * 日本流派常用、但 `annual` 数据档没有的两项，由服务端确定性算出，模型只引用、不自行推算：
 * - 十二運星：日干对各柱地支与各步大運地支的十二运（阳干顺行、阴干逆行；戊同丙、己同丁）；
 * - 天中殺（空亡）：日柱旬空的两支、命中的本命柱与流年窗口中地支落在这两支的年份。
 * 只在 `ja` 报告的复算中加入（catalog.ts recomputeChart），其他语言的数据与版本不变。
 */

/** 附加数据的算法版本，记入 `reading.engine_version` 的后缀（如 `…+annual.2+jp.1`） */
export const JA_DATA_VERSION = 'jp.1'

/** 十二運星，按长生起的顺序 */
export const TWELVE_STAGES = [
  'changSheng',
  'muYu',
  'guanDai',
  'jianLu',
  'diWang',
  'shuai',
  'bing',
  'si',
  'mu',
  'jue',
  'tai',
  'yang',
] as const
export type TwelveStage = (typeof TWELVE_STAGES)[number]

/** 各日干的长生地支（序号：子=0…亥=11） */
const CHANG_SHENG: Readonly<Record<Stem, number>> = {
  jia: 11,
  yi: 6,
  bing: 2,
  ding: 9,
  wu: 2,
  ji: 9,
  geng: 5,
  xin: 0,
  ren: 8,
  gui: 3,
}

/** 日干在某地支的十二運星 */
export function twelveStage(dayStem: Stem, branch: Branch): TwelveStage {
  const start = CHANG_SHENG[dayStem]
  const target = BRANCHES.indexOf(branch)
  const yang = STEMS.indexOf(dayStem) % 2 === 0
  const offset = yang ? (target - start + 12) % 12 : (start - target + 12) % 12
  return TWELVE_STAGES[offset] as TwelveStage
}

type PillarKey = 'year' | 'month' | 'day' | 'hour'

export interface JapaneseChartExtras {
  /** 各柱地支的十二運星；不知道时辰时时柱为 null */
  readonly twelveStages: Readonly<Record<PillarKey, TwelveStage | null>>
  /** 各步大運（按 index）地支的十二運星 */
  readonly decadeTwelveStages: readonly {
    readonly index: number
    readonly twelveStage: TwelveStage
  }[]
  /** 日柱旬空的两支；branches 为空表示引擎未给出 */
  readonly tenchusatsu: {
    readonly branches: readonly Branch[]
    readonly pillars: readonly string[]
    /** 流年窗口中地支落在天中殺两支的年份 */
    readonly years: readonly number[]
  }
}

export function japaneseChartExtras(
  chart: BaziChart,
  annualYears: readonly { readonly year: number; readonly branch: string }[],
): JapaneseChartExtras {
  const day = chart.dayMaster
  const stage = (pillar: BaziChart['pillars']['year'] | null) =>
    pillar ? twelveStage(day, pillar.branch) : null
  const void_ = chart.shensha.find((s) => s.key === 'kongWang' && s.basis === 'dayPillar')
  const branches = void_?.targets ?? []
  return {
    twelveStages: {
      year: stage(chart.pillars.year),
      month: stage(chart.pillars.month),
      day: stage(chart.pillars.day),
      hour: stage(chart.pillars.hour),
    },
    decadeTwelveStages: chart.fortune.decades.map((d) => ({
      index: d.index,
      twelveStage: twelveStage(day, d.branch),
    })),
    tenchusatsu: {
      branches,
      pillars: void_?.pillars ?? [],
      years: annualYears
        .filter((y) => (branches as readonly string[]).includes(y.branch))
        .map((y) => y.year),
    },
  }
}
