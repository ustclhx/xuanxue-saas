import type { EastContentRoute } from '../routes.ts'

/**
 * 黄历的地址（openspec content-growth-phase2 决策 1、5）：只有 zh-hans。
 * 不引用运行时模块：注册表、东方内容路由映射与边缘缓存都从这里读取。
 */
export const ALMANAC_LOCALE = 'zh-Hans'
export const ALMANAC_TOOL_PATH = '/黄历'
export const ALMANAC_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export type AlmanacMonthNumber = (typeof ALMANAC_MONTHS)[number]

/** 月份页地址不带年份（决策 5）：`/黄历/1月` */
export function almanacMonthPath(month: number): `/${string}` {
  return `${ALMANAC_TOOL_PATH}/${month}月`
}

/** 东方内容分发的映射：工具页 id 为 `tool`，月份页 id 为月份数字 */
export const ALMANAC_CONTENT_ROUTES: readonly EastContentRoute[] = [
  { locale: ALMANAC_LOCALE, path: ALMANAC_TOOL_PATH, collection: 'almanac', id: 'tool' },
  ...ALMANAC_MONTHS.map(
    (month): EastContentRoute => ({
      locale: ALMANAC_LOCALE,
      path: almanacMonthPath(month),
      collection: 'almanac',
      id: String(month),
    }),
  ),
]

/** 不带语言前缀、已解码的路径是否为黄历页面（边缘缓存用） */
export function isAlmanacPath(path: string): 'tool' | 'month' | null {
  if (path === ALMANAC_TOOL_PATH) return 'tool'
  return ALMANAC_MONTHS.some((month) => almanacMonthPath(month) === path) ? 'month' : null
}
