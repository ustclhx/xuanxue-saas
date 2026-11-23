import { TOOLS_HUB_EAST_CONTENT_ROUTES } from '../tools/hub/routes.ts'
import { ALMANAC_CONTENT_ROUTES } from './almanac/paths.ts'
import { COMPAT_EAST_CONTENT_ROUTES } from './compat/paths.ts'
import { TAI_SUI_YEAR_CONTENT_ROUTES } from './tai-sui-year/paths.ts'
import { TOJEONG_CONTENT_ROUTES } from './tojeong/paths.ts'
import { YEARLY_EAST_CONTENT_ROUTES } from './yearly/paths.ts'
import { YEARLY_TOOL_CONTENT_ROUTES } from './yearly-tool/paths.ts'
import { ZODIAC_EAST_CONTENT_ROUTES } from './zodiac/paths.ts'
import { ZODIAC_PAIR_EAST_CONTENT_ROUTES } from './zodiac-pair/paths.ts'

export type EastContentCollection =
  | 'zodiac'
  | 'almanac'
  | 'ziwei-stars'
  | 'yearly'
  | 'yearly-tool'
  | 'compat'
  | 'compat-scenario'
  | 'zodiac-pair'
  | 'tojeong'
  | 'nongminli'
  | 'tai-sui-year'
  | 'tools-hub'

export interface EastContentRoute {
  readonly locale: 'zh-Hans' | 'zh-Hant' | 'ko' | 'ja' | 'en'
  readonly path: `/${string}`
  readonly collection: EastContentCollection
  readonly id: string
}

/** 注册表和预渲染也可读取这份映射，因此这里只放不带语言前缀的地址和页面标识。 */
export const EAST_CONTENT_ROUTES: readonly EastContentRoute[] = [
  // 第 4 组：生肖枢纽与 12 生肖页（zh-hans）
  ...ZODIAC_EAST_CONTENT_ROUTES,
  // 第 6 组：黄历工具页与 12 个月份页（zh-hans）；v2 第 18 组：農民曆（zh-hant）
  ...ALMANAC_CONTENT_ROUTES,
  // content-growth-v2-tools 第 15 组：ko 토정비결工具页
  ...TOJEONG_CONTENT_ROUTES,
  // content-growth-v2-tools 第 18 组：2027 太歲（zh-hant）
  ...TAI_SUI_YEAR_CONTENT_ROUTES,
  // content-growth-v2-tools 第 8 组：2027 年度枢纽与 12 生肖年度页（zh-hans；第 9–11 组在 yearly/paths.ts 补语言）
  ...YEARLY_EAST_CONTENT_ROUTES,
  // content-growth-v2-tools 第 7 组：个人 2027 流年工具（zh-hans、zh-hant、ko；en 见 east-en/paths.ts）
  ...YEARLY_TOOL_CONTENT_ROUTES,
  // content-growth-v2-tools 第 13 组：合盘工具正文（zh-Hans、zh-Hant、ja）与五种语言的场景页
  ...COMPAT_EAST_CONTENT_ROUTES,
  // content-growth-v2-tools 第 16 组：生肖配对总表与 78 个配对页（zh-hans）
  ...ZODIAC_PAIR_EAST_CONTENT_ROUTES,
  // content-growth-v2-tools 第 6 组：「全部工具」枢纽页（zh-Hant、zh-Hans、ko、ja）
  ...TOOLS_HUB_EAST_CONTENT_ROUTES,
]

export function eastContentRouteOf(
  locale: string,
  path: string,
  routes: readonly EastContentRoute[] = EAST_CONTENT_ROUTES,
): EastContentRoute | undefined {
  let decoded = path
  try {
    // 解码 Unicode 路径段，保留编码后的斜杠，避免单段地址被当成两段。
    decoded = decodeURI(path)
  } catch {
    // 非法编码按原样比较。
  }
  return routes.find((route) => route.locale === locale && route.path === decoded)
}
