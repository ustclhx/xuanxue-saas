import { EarthBranch, SolarDay, SolarTime } from 'tyme4ts'
import {
  BRANCHES,
  type Branch,
  mod,
  type PillarKey,
  STEMS,
  type Stem,
  stemElement,
  stemPolarity,
  TEN_GODS,
  type TenGod,
} from './constants.ts'
import type { BirthTime } from './time.ts'

export type Qi = 'main' | 'middle' | 'residual'

export type HiddenStem = { stem: Stem; qi: Qi; tenGod: TenGod }

export type Pillar = {
  stem: Stem
  branch: Branch
  /** 天干十神；日柱为日主本身，记 null。 */
  tenGod: TenGod | null
  hiddenStems: HiddenStem[]
}

export type Pillars = Record<Exclude<PillarKey, 'hour'>, Pillar> & { hour: Pillar | null }

/** 干支序号对：[天干, 地支]。 */
export type GanZhi = [number, number]

const QI_BY_TYPE: Record<number, Qi> = { 2: 'main', 1: 'middle', 0: 'residual' }

/** 地支藏干（取自 tyme4ts），顺序为本气、中气、余气。 */
export function hiddenStemsOf(branch: number): { stem: number; qi: Qi }[] {
  return EarthBranch.fromIndex(branch)
    .getHideHeavenStems()
    .map((h) => ({ stem: h.getHeavenStem().getIndex(), qi: QI_BY_TYPE[h.getType()] as Qi }))
}

/**
 * 十神：以日主五行与阴阳对照目标天干。
 * 同我者比劫、我生者食伤、我克者财、克我者官杀、生我者印；同阴阳取偏（比肩/食神/偏财/七杀/偏印）。
 */
export function tenGodOf(dayStem: number, target: number): TenGod {
  const relation = mod(stemElement(target) - stemElement(dayStem), 5)
  // relation 与 TEN_GODS 分组同序：0 同我、1 我生、2 我克、3 克我、4 生我
  const samePolarity = stemPolarity(target) === stemPolarity(dayStem)
  return TEN_GODS[relation * 2 + (samePolarity ? 0 : 1)] as TenGod
}

/** 时支：23–1 点子时，每两小时一支。 */
export function hourBranchOf(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12
}

/** 五鼠遁：甲己日起甲子时、乙庚日起丙子时……时干 = 日干 × 2 + 时支。 */
export function hourStemOf(dayStem: number, hourBranch: number): number {
  return mod(dayStem * 2 + hourBranch, 10)
}

/**
 * 四柱干支序号。年柱、月柱按出生时刻与节气交接时刻（北京时间）比较；
 * 日柱、时柱按排盘所用的当地时间，23 点起换日（早晚子时不分）。
 */
export function computeGanZhi(time: BirthTime, hourKnown: boolean) {
  const b = time.beijing
  const eightChar = SolarTime.fromYmdHms(b.year, b.month, b.day, b.hour, b.minute, b.second)
    .getLunarHour()
    .getEightChar()
  const pair = (c: ReturnType<typeof eightChar.getYear>): GanZhi => [
    c.getHeavenStem().getIndex(),
    c.getEarthBranch().getIndex(),
  ]
  const u = time.used
  const dayCycle = SolarDay.fromYmd(u.year, u.month, u.day)
    .next(hourKnown && u.hour >= 23 ? 1 : 0)
    .getLunarDay()
    .getSixtyCycle()
  const day: GanZhi = [dayCycle.getHeavenStem().getIndex(), dayCycle.getEarthBranch().getIndex()]
  let hour: GanZhi | null = null
  if (hourKnown) {
    const branch = hourBranchOf(u.hour)
    hour = [hourStemOf(day[0], branch), branch]
  }
  return { year: pair(eightChar.getYear()), month: pair(eightChar.getMonth()), day, hour }
}

export function buildPillar(gz: GanZhi, dayStem: number, isDay: boolean): Pillar {
  return {
    stem: STEMS[gz[0]] as Stem,
    branch: BRANCHES[gz[1]] as Branch,
    tenGod: isDay ? null : tenGodOf(dayStem, gz[0]),
    hiddenStems: hiddenStemsOf(gz[1]).map(({ stem, qi }) => ({
      stem: STEMS[stem] as Stem,
      qi,
      tenGod: tenGodOf(dayStem, stem),
    })),
  }
}
