import { SolarDay } from 'tyme4ts'
import { STEMS, type Stem } from './constants.ts'
import { computeFortune, type Fortune, type YearFortune, yearFortune } from './fortune.ts'
import { assertValidInput, type BirthInput } from './input.ts'
import { buildPillar, computeGanZhi, type Pillars } from './pillars.ts'
import { computeShensha, type ShenshaEntry } from './shensha.ts'
import { computeStrength, computeUseful, type Strength, type UsefulElements } from './strength.ts'
import { type BirthTime, type DateTimeParts, resolveBirthTime } from './time.ts'
import { ENGINE_VERSION } from './version.ts'
import { computeWeight, type Weight } from './weight.ts'

export type LunarDate = { year: number; month: number; day: number; isLeapMonth: boolean }

export type ChartTime = {
  clock: DateTimeParts | null
  standard: DateTimeParts
  trueSolar: DateTimeParts | null
  trueSolarCorrectionMinutes: number | null
  /** 实际用于排盘的时间（结果页显示）。 */
  used: DateTimeParts
  offsetSeconds: number
  standardOffsetSeconds: number
  dst: boolean
  /** 排盘日（23 点后已换到次日）对应的农历日期。 */
  lunar: LunarDate
}

export type BaziChart = {
  engineVersion: string
  input: BirthInput
  hourKnown: boolean
  time: ChartTime
  pillars: Pillars
  dayMaster: Stem
  strength: Strength
  useful: UsefulElements
  /** 无时辰时出生时刻按当地 12:00 估算，起运日期可能相差数天。 */
  fortune: Fortune & { approximate: boolean }
  currentYear: YearFortune & { decadeIndex: number | null }
  shensha: ShenshaEntry[]
  weight: Weight
}

export type ChartOptions = {
  /** 「当前流年」所用公历年；页面传入当前年，便于服务端复算得到相同结果。 */
  referenceYear: number
}

function lunarOf(time: BirthTime, hourKnown: boolean) {
  const u = time.used
  const lunar = SolarDay.fromYmd(u.year, u.month, u.day)
    .next(hourKnown && u.hour >= 23 ? 1 : 0)
    .getLunarDay()
  const month = lunar.getLunarMonth()
  return {
    date: {
      year: month.getLunarYear().getYear(),
      month: month.getMonth(),
      day: lunar.getDay(),
      isLeapMonth: month.isLeap(),
    },
    yearCycle: month.getLunarYear().getSixtyCycle().getIndex(),
  }
}

export function computeChart(input: BirthInput, options: ChartOptions): BaziChart {
  assertValidInput(input)
  const hourKnown = input.time !== null
  const time = resolveBirthTime(input)
  const gz = computeGanZhi(time, hourKnown)
  const dayStem = gz.day[0]
  const lunar = lunarOf(time, hourKnown)
  const strength = computeStrength(gz)
  const fortune = computeFortune(time, input.gender, dayStem)
  const current = yearFortune(options.referenceYear, dayStem)
  const decade = fortune.decades.find(
    (d) => d.startYear <= options.referenceYear && options.referenceYear <= d.endYear,
  )

  return {
    engineVersion: ENGINE_VERSION,
    input,
    hourKnown,
    time: {
      clock: time.clock,
      standard: time.standard,
      trueSolar: time.trueSolar,
      trueSolarCorrectionMinutes: time.trueSolarCorrectionMinutes,
      used: time.used,
      offsetSeconds: time.offsetSeconds,
      standardOffsetSeconds: time.standardOffsetSeconds,
      dst: time.dst,
      lunar: lunar.date,
    },
    pillars: {
      year: buildPillar(gz.year, dayStem, false),
      month: buildPillar(gz.month, dayStem, false),
      day: buildPillar(gz.day, dayStem, true),
      hour: gz.hour === null ? null : buildPillar(gz.hour, dayStem, false),
    },
    dayMaster: STEMS[dayStem] as Stem,
    strength,
    useful: computeUseful(dayStem, strength),
    fortune: { ...fortune, approximate: !hourKnown },
    currentYear: { ...current, decadeIndex: decade?.index ?? null },
    shensha: computeShensha(gz),
    weight: computeWeight({
      yearCycle: lunar.yearCycle,
      lunarMonth: lunar.date.month,
      lunarDay: lunar.date.day,
      hourBranch: gz.hour?.[1] ?? null,
    }),
  }
}
