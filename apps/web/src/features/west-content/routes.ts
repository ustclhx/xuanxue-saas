import { TOOLS_HUB_WEST_CONTENT_ROUTES } from '../tools/hub/routes.ts'
import { ANGEL_CONTENT_ROUTES } from './angel-numbers/paths.ts'
import { MOON_CONTENT_ROUTES } from './moon/paths.ts'
import { NATAL_CONTENT_ROUTES } from './natal-chart/paths.ts'
import { PERSONAL_YEAR_CONTENT_ROUTES } from './personal-year/paths.ts'
import { RETROGRADE_CONTENT_ROUTES } from './retrograde-calendar/paths.ts'
import { TAROT_SPREAD_CONTENT_ROUTES } from './tarot-spreads/paths.ts'
import { WESTERN_ZODIAC_CONTENT_ROUTES } from './zodiac/paths.ts'

export type WestContentCollection =
  | 'moon'
  | 'zodiac'
  | 'natal-chart'
  | 'synastry'
  | 'retrograde-calendar'
  | 'saturn-return'
  | 'solar-return'
  | 'angel-numbers'
  | 'personal-year'
  | 'tarot-spreads'
  | 'tools-hub'

export interface WestContentRoute {
  readonly locale: 'en' | 'es'
  readonly path: `/${string}`
  readonly collection: WestContentCollection
  readonly id: string
}

/** 注册表和预渲染也可读取这份映射，因此这里只放不带语言前缀的地址和页面标识。 */
export const WEST_CONTENT_ROUTES: readonly WestContentRoute[] = [
  // 第 19 组：今日月相、满月、年度满月表、月历枢纽与 12 个月份页（en）
  ...MOON_CONTENT_ROUTES,
  // 第 20 组：星座枢纽、12 个星座档案、配对总表与 78 组配对页（en）
  ...WESTERN_ZODIAC_CONTENT_ROUTES,
  // content-growth-v2-tools 第 6 组：「All tools」枢纽页（en `/tools`、es `/herramientas`）
  ...TOOLS_HUB_WEST_CONTENT_ROUTES,
  // 第 28 组：爱情、事业、满月牌阵页（en，`/tarot/…` 由塔罗文件路由转交本映射）
  ...TAROT_SPREAD_CONTENT_ROUTES,
  // 第 26 组：angel numbers 枢纽与数字页（en、es 各自的数字集合）
  ...ANGEL_CONTENT_ROUTES,
  // 第 27 组：personal year 计算器与 1–9 年份数页（en、es）
  ...PERSONAL_YEAR_CONTENT_ROUTES,
  // 第 23 组：三巨头计算器 `/rising-sign-calculator` 与出生星盘 `/birth-chart`（en）
  ...NATAL_CONTENT_ROUTES,
  // 第 25.2 项：逆行日历 `/retrograde-calendar`（en）
  ...RETROGRADE_CONTENT_ROUTES,
]

export function westContentRouteOf(locale: string, path: string): WestContentRoute | undefined {
  let decoded = path
  try {
    // 解码 Unicode 路径段，保留编码后的斜杠，避免单段地址被当成两段。
    decoded = decodeURI(path)
  } catch {
    // 非法编码按原样比较。
  }
  return WEST_CONTENT_ROUTES.find((route) => route.locale === locale && route.path === decoded)
}
