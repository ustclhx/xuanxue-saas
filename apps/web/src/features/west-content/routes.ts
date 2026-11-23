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
export const WEST_CONTENT_ROUTES: readonly WestContentRoute[] = []

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
