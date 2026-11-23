import type { EastContentRoute } from '../routes.ts'

/**
 * 黄历的地址（openspec content-growth-phase2 决策 1、5）：zh-hans `/黄历`；
 * zh-hant 農民曆 `/農民曆`（content-growth-v2-tools 决策 2、10，第 18 组）。两种语言共用同一组组件与引擎，
 * 互为 hreflang。不引用运行时模块：注册表、东方内容路由映射与边缘缓存都从这里读取。
 */
export const ALMANAC_LOCALES = ['zh-Hans', 'zh-Hant'] as const
export type AlmanacLocale = (typeof ALMANAC_LOCALES)[number]

export const isAlmanacLocale = (locale: string): locale is AlmanacLocale =>
  (ALMANAC_LOCALES as readonly string[]).includes(locale)

/** zh-hans 黄历（第 2 阶段原有导出，每日页与单测沿用） */
export const ALMANAC_LOCALE = 'zh-Hans'
export const ALMANAC_TOOL_PATH = '/黄历'

export const ALMANAC_TOOL_PATHS: Readonly<Record<AlmanacLocale, `/${string}`>> = {
  'zh-Hans': ALMANAC_TOOL_PATH,
  'zh-Hant': '/農民曆',
}

export const ALMANAC_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export type AlmanacMonthNumber = (typeof ALMANAC_MONTHS)[number]

/** 月份页地址不带年份（决策 5）：`/黄历/1月`、`/農民曆/1月` */
export function almanacMonthPath(
  month: number,
  locale: AlmanacLocale = ALMANAC_LOCALE,
): `/${string}` {
  return `${ALMANAC_TOOL_PATHS[locale]}/${month}月`
}

/** 东方内容分发的映射：工具页 id 为 `tool`，月份页 id 为月份数字 */
export const ALMANAC_CONTENT_ROUTES: readonly EastContentRoute[] = ALMANAC_LOCALES.flatMap(
  (locale) => [
    { locale, path: ALMANAC_TOOL_PATHS[locale], collection: 'almanac' as const, id: 'tool' },
    ...ALMANAC_MONTHS.map(
      (month): EastContentRoute => ({
        locale,
        path: almanacMonthPath(month, locale),
        collection: 'almanac',
        id: String(month),
      }),
    ),
  ],
)

/** 不带语言前缀、已解码的路径是否为该语言的黄历页面（边缘缓存用） */
export function isAlmanacPath(
  path: string,
  locale: AlmanacLocale = ALMANAC_LOCALE,
): 'tool' | 'month' | null {
  if (path === ALMANAC_TOOL_PATHS[locale]) return 'tool'
  return ALMANAC_MONTHS.some((month) => almanacMonthPath(month, locale) === path) ? 'month' : null
}
