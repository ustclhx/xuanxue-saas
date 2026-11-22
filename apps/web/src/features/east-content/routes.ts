import { ALMANAC_CONTENT_ROUTES } from './almanac/paths.ts'
import { ZODIAC_EAST_CONTENT_ROUTES } from './zodiac/paths.ts'

export type EastContentCollection = 'zodiac' | 'almanac' | 'ziwei-stars'

export interface EastContentRoute {
  readonly locale: 'zh-Hans' | 'zh-Hant' | 'ko'
  readonly path: `/${string}`
  readonly collection: EastContentCollection
  readonly id: string
}

/** 注册表和预渲染也可读取这份映射，因此这里只放不带语言前缀的地址和页面标识。 */
export const EAST_CONTENT_ROUTES: readonly EastContentRoute[] = [
  // 第 4 组：生肖枢纽与 12 生肖页（zh-hans）
  ...ZODIAC_EAST_CONTENT_ROUTES,
  // 第 6 组：黄历工具页与 12 个月份页（zh-hans）
  ...ALMANAC_CONTENT_ROUTES,
]

export function eastContentRouteOf(locale: string, path: string): EastContentRoute | undefined {
  let decoded = path
  try {
    // 解码 Unicode 路径段，保留编码后的斜杠，避免单段地址被当成两段。
    decoded = decodeURI(path)
  } catch {
    // 非法编码按原样比较。
  }
  return EAST_CONTENT_ROUTES.find((route) => route.locale === locale && route.path === decoded)
}
