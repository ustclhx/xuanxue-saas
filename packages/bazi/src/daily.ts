import { SolarDay } from 'tyme4ts'
import type { BaziChart, LunarDate } from './chart.ts'
import {
  BRANCHES,
  type Branch,
  branchIndex,
  mod,
  PILLAR_KEYS,
  type PillarKey,
  STEMS,
  type Stem,
  stemIndex,
  type TenGod,
} from './constants.ts'
import { BaziInputError, MAX_YEAR, MIN_YEAR } from './input.ts'
import { hiddenStemsOf, tenGodOf } from './pillars.ts'
import { isClash, isHarm, isPunish, isSixCombine, isTriad } from './relations.ts'

/**
 * 流日（add-birth-profiles-daily-horoscope design D6）：给定公历日期，返回当日干支、农历日、
 * 黄历宜忌与建除，以及相对本命盘的十神与地支关系。结果只含稳定 key 与 tyme4ts 序号，
 * 文案由 web 的每日文案表按语言提供。
 *
 * 换日采用民用日界（当地 00:00）：调用方传入的是「今天」的日期本身，与排盘时 23 点换日的
 * 日柱规则无关（daily-horoscope spec「参考时区与访客本地日期」）。
 */

/** 规则或输出结构变化时递增；与 ENGINE_VERSION 分开，避免流日改动影响命盘 fixtures。 */
export const DAILY_RULES_VERSION = '1.0.0'

/** 建除十二值星，顺序与 tyme4ts Duty.NAMES（建除满平定执破危成收开闭）一致。 */
export const DUTY_KEYS = [
  'jian',
  'chu',
  'man',
  'ping',
  'ding',
  'zhi',
  'po',
  'wei',
  'cheng',
  'shou',
  'kai',
  'bi',
] as const
export type DutyKey = (typeof DUTY_KEYS)[number]

export type DailyDate = { year: number; month: number; day: number }

export type DayPillar = {
  rulesVersion: string
  date: DailyDate
  stem: Stem
  branch: Branch
  /** 六十甲子序号（甲子 = 0）。 */
  cycleIndex: number
  lunar: LunarDate
  /** 黄历「宜」：tyme4ts Taboo 序号，按 tyme4ts 给出的顺序。 */
  recommends: number[]
  /** 黄历「忌」：tyme4ts Taboo 序号。 */
  avoids: number[]
  duty: DutyKey
}

export type DailyRelationKind = 'clash' | 'combine' | 'triad' | 'punish' | 'harm'

export type DailyRelation = {
  /** 与本命哪一柱的地支发生关系。 */
  natal: PillarKey
  natalBranch: Branch
  kind: DailyRelationKind
}

export type DailyRelations = {
  rulesVersion: string
  day: DayPillar
  dayMaster: Stem
  /** 当日日干相对日主的十神。 */
  tenGod: TenGod
  /** 当日日支本气相对日主的十神。 */
  branchTenGod: TenGod
  /** 按年、月、日、时柱顺序，同一柱内按 RELATION_KINDS 顺序；时辰未知时不含时柱。 */
  relations: DailyRelation[]
}

/** 只需要日主与四柱地支，便于 web 传入命盘摘要。 */
export type DailyNatal = {
  dayMaster: Stem
  pillars: {
    [K in PillarKey]: K extends 'hour'
      ? Pick<BaziChart['pillars']['day'], 'branch'> | null
      : Pick<BaziChart['pillars']['day'], 'branch'>
  }
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

function assertDate(date: DailyDate): void {
  const { year, month, day } = date
  if (!isInt(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new BaziInputError([{ field: 'year', code: 'out_of_range' }])
  }
  if (!isInt(month) || month < 1 || month > 12) {
    throw new BaziInputError([{ field: 'month', code: 'out_of_range' }])
  }
  const days = SolarDay.fromYmd(year, month, 1).getSolarMonth().getDayCount()
  if (!isInt(day) || day < 1 || day > days) {
    throw new BaziInputError([{ field: 'day', code: 'invalid_date' }])
  }
}

/** 当日日柱、农历日、宜忌与建除（tyme4ts SixtyCycleDay，月令按节气）。 */
export function dayPillarOf(date: DailyDate): DayPillar {
  assertDate(date)
  const solar = SolarDay.fromYmd(date.year, date.month, date.day)
  const cycleDay = solar.getSixtyCycleDay()
  const cycle = cycleDay.getSixtyCycle()
  const lunarDay = solar.getLunarDay()
  const lunarMonth = lunarDay.getLunarMonth()
  return {
    rulesVersion: DAILY_RULES_VERSION,
    date: { year: date.year, month: date.month, day: date.day },
    stem: STEMS[cycle.getHeavenStem().getIndex()] as Stem,
    branch: BRANCHES[cycle.getEarthBranch().getIndex()] as Branch,
    cycleIndex: cycle.getIndex(),
    lunar: {
      year: lunarMonth.getLunarYear().getYear(),
      month: lunarMonth.getMonth(),
      day: lunarDay.getDay(),
      isLeapMonth: lunarMonth.isLeap(),
    },
    recommends: cycleDay.getRecommends().map((t) => t.getIndex()),
    avoids: cycleDay.getAvoids().map((t) => t.getIndex()),
    duty: DUTY_KEYS[cycleDay.getDuty().getIndex()] as DutyKey,
  }
}

const RELATION_KINDS: readonly [DailyRelationKind, (a: number, b: number) => boolean][] = [
  ['clash', isClash],
  ['combine', isSixCombine],
  ['triad', isTriad],
  ['punish', isPunish],
  ['harm', isHarm],
]

/**
 * 两支之间成立的全部关系（同一对可同时成立多种，如寅巳既刑又害）。判断取自共享的 relations.ts；
 * 此处按每日运势的关系名（combine 而非 sixCombine）输出。
 */
export function dailyBranchRelations(a: number, b: number): DailyRelationKind[] {
  return RELATION_KINDS.filter(([, test]) => test(a, b)).map(([kind]) => kind)
}

/** 当日相对本命盘的十神与地支关系；`date` 也可直接传入已算好的 DayPillar。 */
export function dailyRelations(natal: DailyNatal, date: DailyDate | DayPillar): DailyRelations {
  const day = 'stem' in date ? date : dayPillarOf(date)
  const master = stemIndex(natal.dayMaster)
  const dayBranch = branchIndex(day.branch)
  const mainQi = hiddenStemsOf(dayBranch)[0]?.stem as number
  const relations: DailyRelation[] = []
  for (const key of PILLAR_KEYS) {
    const pillar = natal.pillars[key]
    // 时辰未知时 hour 为 null，只比较年、月、日三支
    if (!pillar) continue
    for (const kind of dailyBranchRelations(dayBranch, branchIndex(pillar.branch))) {
      relations.push({ natal: key, natalBranch: pillar.branch, kind })
    }
  }
  return {
    rulesVersion: DAILY_RULES_VERSION,
    day,
    dayMaster: natal.dayMaster,
    tenGod: tenGodOf(master, stemIndex(day.stem)),
    branchTenGod: tenGodOf(master, mainQi),
    relations,
  }
}
