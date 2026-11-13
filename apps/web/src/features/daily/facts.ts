import type {
  Branch,
  DailyNatal,
  DailyRelationKind,
  DayPillar,
  DutyKey,
  LunarDate,
  PillarKey,
  Stem,
  TenGod,
} from '@xuanxue/bazi'
import {
  type BirthDate,
  type NumberResult,
  personalDay,
  type Step,
  universalDay,
} from '@xuanxue/numerology'
import { type CivilDate, dateKey } from './date.ts'
import { DAILY_COPY_VERSION } from './rules/types.ts'

/**
 * 每日运势的结构化事实（add-birth-profiles-daily-horoscope design D6）。
 *
 * 引擎结果 → `DailyFacts`：只含稳定 key、数字与规则版本，不含出生日期、地点、姓名，也不含本地化文字。
 * 页面据此按语言选文案；「把今天带去问 AI」的临时上下文也只用它（design D10）。
 *
 * 东方站的流日计算依赖 tyme4ts（体积较大），本文件只引用引擎类型，
 * 调用方传入按需加载的 `@xuanxue/bazi/daily` 模块，避免把引擎打进首屏包。
 */

export type DailyEngine = Pick<
  typeof import('@xuanxue/bazi/daily'),
  'dayPillarOf' | 'dailyRelations'
>

export const STEM_KEYS: readonly Stem[] = [
  'jia',
  'yi',
  'bing',
  'ding',
  'wu',
  'ji',
  'geng',
  'xin',
  'ren',
  'gui',
]
const TEN_GOD_KEYS: readonly TenGod[] = [
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
]

/**
 * 天干相对日主的十神（与引擎 pillars.ts 的 tenGodOf 同一规则，facts.test.ts 逐一核对）。
 * 公开页的十个日主区块不需要本命盘，只用这一个纯函数，不必加载引擎。
 */
export function tenGodFor(dayMaster: Stem, other: Stem): TenGod {
  const master = STEM_KEYS.indexOf(dayMaster)
  const stem = STEM_KEYS.indexOf(other)
  // 五行序：木火土金水；差值 0 同我、1 我生、2 我克、3 克我、4 生我
  const relation = (Math.floor(stem / 2) - Math.floor(master / 2) + 5) % 5
  const samePolarity = master % 2 === stem % 2
  return TEN_GOD_KEYS[relation * 2 + (samePolarity ? 0 : 1)] as TenGod
}

/** 当日事实（东方站，公开页与今日面板共用） */
export interface EastDayFacts {
  readonly date: string
  readonly stem: Stem
  readonly branch: Branch
  readonly lunar: LunarDate
  readonly recommends: readonly number[]
  readonly avoids: readonly number[]
  readonly duty: DutyKey
  readonly rulesVersion: string
}

export function eastDayFacts(engine: DailyEngine, date: CivilDate): EastDayFacts {
  const day: DayPillar = engine.dayPillarOf(date)
  return {
    date: dateKey(date),
    stem: day.stem,
    branch: day.branch,
    lunar: day.lunar,
    recommends: day.recommends,
    avoids: day.avoids,
    duty: day.duty,
    rulesVersion: day.rulesVersion,
  }
}

/** 本命摘要：日主与四支（时辰未知时没有时支），不含出生日期 */
export interface NatalSummary {
  readonly dayMaster: Stem
  readonly branches: Readonly<Partial<Record<PillarKey, Branch>>>
}

export interface EastRelationFact {
  readonly natal: PillarKey
  readonly natalBranch: Branch
  readonly kind: DailyRelationKind
}

/** 当日相对本命的事实 */
export interface EastPersonalFacts {
  readonly dayMaster: Stem
  readonly tenGod: TenGod
  readonly branchTenGod: TenGod
  readonly relations: readonly EastRelationFact[]
}

export function eastPersonalFacts(
  engine: DailyEngine,
  natal: NatalSummary,
  date: CivilDate,
): EastPersonalFacts {
  const pillar = (key: PillarKey) => {
    const branch = natal.branches[key]
    return branch ? { branch } : null
  }
  const dailyNatal = {
    dayMaster: natal.dayMaster,
    pillars: {
      year: pillar('year'),
      month: pillar('month'),
      day: pillar('day'),
      hour: pillar('hour'),
    },
  } as DailyNatal
  const result = engine.dailyRelations(dailyNatal, date)
  return {
    dayMaster: result.dayMaster,
    tenGod: result.tenGod,
    branchTenGod: result.branchTenGod,
    relations: result.relations.map(({ natal, natalBranch, kind }) => ({
      natal,
      natalBranch,
      kind,
    })),
  }
}

/** 大运与流年背景（今日面板，东方站） */
export interface LuckBackground {
  readonly decade: { readonly stem: Stem; readonly branch: Branch; readonly tenGod: TenGod } | null
  readonly year: { readonly stem: Stem; readonly branch: Branch; readonly tenGod: TenGod }
}

/** 当日事实（西方站） */
export interface WestDayFacts {
  readonly date: string
  readonly universal: NumberResult
}

export function westDayFacts(date: CivilDate): WestDayFacts {
  return { date: dateKey(date), universal: universalDay(date) }
}

/** 个人年、月、日（西方站）；只需出生月日（个人年按本地年份） */
export interface WestPersonalFacts {
  readonly personalYear: NumberResult
  readonly personalMonth: NumberResult
  readonly personalDay: NumberResult
}

export function westPersonalFacts(birth: BirthDate, date: CivilDate): WestPersonalFacts {
  const result = personalDay(birth, date)
  const strip = (value: NumberResult): NumberResult => ({
    value: value.value,
    master: value.master,
    steps: value.steps,
  })
  return {
    personalYear: strip(result.personalYear),
    personalMonth: strip(result.personalMonth),
    personalDay: strip(result),
  }
}

/** 「把今天带去问 AI」与后续润色的统一输入（design D6 / D10）：只有推导结果 */
export type DailyFacts =
  | {
      readonly site: 'east'
      readonly copyVersion: string
      readonly day: EastDayFacts
      readonly personal: EastPersonalFacts | null
      readonly background: LuckBackground | null
    }
  | {
      readonly site: 'west'
      readonly copyVersion: string
      readonly day: WestDayFacts
      readonly personal: WestPersonalFacts | null
    }

export function eastFacts(
  day: EastDayFacts,
  personal: EastPersonalFacts | null,
  background: LuckBackground | null = null,
): DailyFacts {
  return { site: 'east', copyVersion: DAILY_COPY_VERSION, day, personal, background }
}

export function westFacts(day: WestDayFacts, personal: WestPersonalFacts | null): DailyFacts {
  return { site: 'west', copyVersion: DAILY_COPY_VERSION, day, personal }
}

/** 归约步骤按阶段分组（页面逐行展示） */
export function stepsOf(result: NumberResult, phase: Step['phase']): Step[] {
  return result.steps.filter((step) => step.phase === phase)
}
