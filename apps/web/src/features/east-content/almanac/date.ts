import { type CivilDate, parseDateKey } from '../../daily/date.ts'

/**
 * 日期参数的校验（工具页客户端与服务端共用）。单独成文件：页面组件只需这两项，
 * 不必把 model.ts 的宜忌词表与释义打进客户端分包。
 */

/** 引擎支持的公历年份范围（packages/bazi MIN_YEAR / MAX_YEAR） */
export const ALMANAC_YEAR_RANGE = [1900, 2100] as const

/** 解析 `?date=`：合法且在引擎范围内时返回日期，否则 null */
export function parseAlmanacDate(value: string | undefined): CivilDate | null {
  if (value === undefined) return null
  const date = parseDateKey(value)
  if (!date || date.year < ALMANAC_YEAR_RANGE[0] || date.year > ALMANAC_YEAR_RANGE[1]) return null
  return date
}
