import {
  ChildLimit,
  Gender,
  LunarSect2ChildLimitProvider,
  SixtyCycleYear,
  SolarTime,
} from 'tyme4ts'
import { BRANCHES, type Branch, STEMS, type Stem, type TenGod } from './constants.ts'
import type { Gender as BirthGender } from './input.ts'
import { tenGodOf } from './pillars.ts'
import type { BirthTime } from './time.ts'

export type YearFortune = { year: number; stem: Stem; branch: Branch; tenGod: TenGod }

export type DecadeFortune = {
  index: number
  stem: Stem
  branch: Branch
  tenGod: TenGod
  startYear: number
  endYear: number
  /** 虚岁，与常见万年历一致。 */
  startAge: number
  endAge: number
  years: YearFortune[]
}

export type Fortune = {
  /** 阳男阴女顺排，阴男阳女逆排。 */
  forward: boolean
  /** 起运：出生后多久交运（周岁年数 + 月 + 日 + 时）。 */
  startAfter: { years: number; months: number; days: number; hours: number }
  /** 交运时刻（北京时间）。 */
  startTime: { year: number; month: number; day: number; hour: number; minute: number }
  decades: DecadeFortune[]
}

const DECADE_COUNT = 10
// 起运按分钟精确换算（3 天 = 1 年、1 天 = 4 个月、1 时辰 = 10 天），与 lunar-javascript 流派 2 一致
const childLimitProvider = new LunarSect2ChildLimitProvider()

export function yearFortune(year: number, dayStem: number): YearFortune {
  const cycle = SixtyCycleYear.fromYear(year).getSixtyCycle()
  const stem = cycle.getHeavenStem().getIndex()
  return {
    year,
    stem: STEMS[stem] as Stem,
    branch: BRANCHES[cycle.getEarthBranch().getIndex()] as Branch,
    tenGod: tenGodOf(dayStem, stem),
  }
}

export function computeFortune(time: BirthTime, gender: BirthGender, dayStem: number): Fortune {
  const b = time.beijing
  const birth = SolarTime.fromYmdHms(b.year, b.month, b.day, b.hour, b.minute, b.second)
  // ChildLimit 只提供全局 provider；同步调用期间临时切换并立即恢复
  const previous = ChildLimit.provider
  ChildLimit.provider = childLimitProvider
  let limit: ChildLimit
  try {
    limit = ChildLimit.fromSolarTime(birth, gender === 'male' ? Gender.MAN : Gender.WOMAN)
  } finally {
    ChildLimit.provider = previous
  }
  const end = limit.getEndTime()
  const decades: DecadeFortune[] = []
  for (let i = 0; i < DECADE_COUNT; i++) {
    const d = limit.getStartDecadeFortune().next(i)
    const cycle = d.getSixtyCycle()
    const stem = cycle.getHeavenStem().getIndex()
    const startYear = d.getStartSixtyCycleYear().getYear()
    const endYear = d.getEndSixtyCycleYear().getYear()
    const years: YearFortune[] = []
    for (let y = startYear; y <= endYear; y++) years.push(yearFortune(y, dayStem))
    decades.push({
      index: i,
      stem: STEMS[stem] as Stem,
      branch: BRANCHES[cycle.getEarthBranch().getIndex()] as Branch,
      tenGod: tenGodOf(dayStem, stem),
      startYear,
      endYear,
      startAge: d.getStartAge(),
      endAge: d.getEndAge(),
      years,
    })
  }
  return {
    forward: limit.isForward(),
    startAfter: {
      years: limit.getYearCount(),
      months: limit.getMonthCount(),
      days: limit.getDayCount(),
      hours: limit.getHourCount(),
    },
    startTime: {
      year: end.getYear(),
      month: end.getMonth(),
      day: end.getDay(),
      hour: end.getHour(),
      minute: end.getMinute(),
    },
    decades,
  }
}
