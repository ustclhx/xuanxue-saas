import { JulianDay, ShouXingUtil, type SolarDay, SolarTerm } from 'tyme4ts'
import type { LunarDate } from './chart.ts'

export type KoreanLunarMonth = {
  month: number
  isLeapMonth: boolean
  firstDay: SolarDay
  days: number
}

const SYNODIC_MONTH_DAYS = 29.5306
// 寿星万年历返回北京时间的 J2000 日数。加一小时后按韩国民用午夜取整。
const koreanDay = (beijingDaysSinceJ2000: number) =>
  Math.floor(beijingDaysSinceJ2000 + 1 / 24 + 0.5)
const termDay = (term: SolarTerm) => koreanDay(term.getJulianDay().getDay() - JulianDay.J2000)

function newMoonDay(cycle: number): number {
  // shuoHigh 只在北京时间接近午夜时改用精算法。韩国午夜早一小时，因此直接精算。
  const ttDays = ShouXingUtil.msaLonT(cycle * 2 * Math.PI) * 36_525
  return koreanDay(ttDays - ShouXingUtil.dtT(ttDays) + ShouXingUtil.ONE_THIRD)
}

function winterMoon(solsticeDay: number): number {
  // 与 lunarNewYearAt 一样用平均朔望月估算序号，再按精算合朔找冬至所在的月。
  let cycle = Math.floor((solsticeDay + 8) / SYNODIC_MONTH_DAYS)
  while (newMoonDay(cycle) > solsticeDay) cycle--
  while (newMoonDay(cycle + 1) <= solsticeDay) cycle++
  return cycle
}

// 土亭秘诀已限制年份，缓存可复用的冬至间月表，避免同一次换算反复求交节与合朔。
const winterCache = new Map<number, readonly KoreanLunarMonth[]>()

function winterMonths(year: number): readonly KoreanLunarMonth[] {
  const cached = winterCache.get(year)
  if (cached) return cached

  const solstice = SolarTerm.fromIndex(year, 0)
  const first = winterMoon(termDay(solstice))
  const count = winterMoon(termDay(solstice.next(24))) - first
  const starts = Array.from({ length: count + 1 }, (_, i) => newMoonDay(first + i))
  let leapIndex = -1
  // 以含冬至的月为十一月。两冬至月之间若有十三个月，第一个无中气的月重复上月月号。
  if (count === 13) {
    const principalTerms = Array.from({ length: 12 }, (_, i) => termDay(solstice.next(i * 2)))
    leapIndex = starts.slice(0, -1).findIndex((start, i) => {
      const end = starts[i + 1] as number
      return !principalTerms.some((term) => start <= term && term < end)
    })
  }

  let month = 10
  const months = starts.slice(0, -1).map((start, i) => {
    const isLeapMonth = i === leapIndex
    if (!isLeapMonth) month = (month % 12) + 1
    return {
      month,
      isLeapMonth,
      firstDay: JulianDay.fromJulianDay(JulianDay.J2000 + start).getSolarDay(),
      days: (starts[i + 1] as number) - start,
    }
  })
  winterCache.set(year, months)
  return months
}

/** 土亭秘诀专用韩国民用阴历。按 UTC+9 判断朔日、大小月及闰月。 */
export function koreanLunarMonths(year: number): readonly KoreanLunarMonth[] {
  const current = winterMonths(year)
  const next = winterMonths(year + 1)
  return [
    ...current.slice(current.findIndex(({ month }) => month === 1)),
    ...next.slice(
      0,
      next.findIndex(({ month }) => month === 1),
    ),
  ]
}

export function koreanLunarDate(solar: SolarDay): LunarDate {
  const solarYear = solar.getYear()
  const current = koreanLunarMonths(solarYear)
  const newYear = (current[0] as KoreanLunarMonth).firstDay
  const year = solar.isBefore(newYear) ? solarYear - 1 : solarYear
  const months = year === solarYear ? current : koreanLunarMonths(year)
  const lunarMonth = months.findLast(
    ({ firstDay }) => !solar.isBefore(firstDay),
  ) as KoreanLunarMonth
  return {
    year,
    month: lunarMonth.month,
    day: solar.subtract(lunarMonth.firstDay) + 1,
    isLeapMonth: lunarMonth.isLeapMonth,
  }
}
