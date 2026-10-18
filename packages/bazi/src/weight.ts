/**
 * 八字重量（袁天罡称骨）：年（农历年干支）+ 农历月 + 农历日 + 时辰，单位「钱」，十钱为一两。
 * 闰月按所闰月份计。
 */

/** 六十甲子年重，按甲子=0 顺序。 */
const YEAR_QIAN = [
  12, 9, 6, 7, 12, 5, 9, 8, 7, 8, 15, 9, 16, 8, 8, 19, 12, 6, 8, 7, 5, 15, 6, 16, 15, 7, 9, 12, 10,
  7, 15, 6, 5, 14, 14, 9, 7, 7, 9, 12, 8, 7, 13, 5, 14, 5, 9, 17, 5, 7, 12, 8, 8, 6, 19, 6, 8, 16,
  10, 6,
]
/** 农历正月至十二月。 */
const MONTH_QIAN = [6, 7, 18, 9, 5, 16, 9, 15, 18, 8, 9, 5]
/** 农历初一至三十。 */
const DAY_QIAN = [
  5, 10, 8, 15, 16, 15, 8, 16, 8, 16, 9, 17, 8, 17, 10, 8, 9, 18, 5, 15, 10, 9, 8, 9, 15, 18, 7, 8,
  16, 6,
]
/** 子时至亥时。 */
const HOUR_QIAN = [16, 6, 7, 10, 9, 16, 10, 8, 8, 9, 6, 6]

export type WeightParts = { year: number; month: number; day: number }

export type Weight =
  | {
      status: 'ok'
      /** 总重（钱）及「两/钱」拆分。 */
      totalQian: number
      liang: number
      qian: number
      parts: WeightParts & { hour: number }
    }
  | { status: 'requiresHour'; parts: WeightParts }

export function computeWeight(input: {
  /** 农历年干支序号 0–59。 */
  yearCycle: number
  lunarMonth: number
  lunarDay: number
  hourBranch: number | null
}): Weight {
  const parts = {
    year: YEAR_QIAN[input.yearCycle] as number,
    month: MONTH_QIAN[input.lunarMonth - 1] as number,
    day: DAY_QIAN[input.lunarDay - 1] as number,
  }
  if (input.hourBranch === null) return { status: 'requiresHour', parts }
  const hour = HOUR_QIAN[input.hourBranch] as number
  const totalQian = parts.year + parts.month + parts.day + hour
  return {
    status: 'ok',
    totalQian,
    liang: Math.floor(totalQian / 10),
    qian: totalQian % 10,
    parts: { ...parts, hour },
  }
}
