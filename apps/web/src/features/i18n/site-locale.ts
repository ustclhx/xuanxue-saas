import {
  EAST_ENGLISH_LOCALE,
  EAST_ENGLISH_PATH,
  resolveSite,
  type SitesConfig,
  siteNavLocale,
} from '../site/site.ts'
import { isAppAreaPath } from './app-area.ts'
import { prefixLocale } from './url-prefix.ts'

/**
 * 浏览器端语言按站点约束（两站分开经营，D5）：Paraglide 在客户端按地址前缀取语言，应用区按
 * `PARAGLIDE_LOCALE` Cookie 取语言，两者都不知道当前站点。外站语言前缀的地址（西方站 `/zh-hans/...`）
 * 服务端已改写为本站语言的 404（site/gate.ts 的 notFoundPath），客户端若仍取地址里的外站语言，
 * 水合后的文案会与服务端不同（英文 404 上混入简体中文导航）；应用区残留外站语言的 Cookie 时，
 * 路由器生成的登录跳转会带上外站前缀。
 *
 * 只在这两种来源上纠正：地址带外站语言前缀，或应用区取到外站语言；改用本站导航语言（siteNavLocale）。
 * 东方站英文入口页 `/en` 与未登记的 Host（预览可浏览全部语言）保持原样。纯函数，便于测试。
 */
export function siteLocale(locale: string, url: URL, config: SitesConfig): string {
  if (!config.i18n.enabled) return locale
  const site = resolveSite(url.host, config)
  if (!site.known) return locale
  const own: readonly string[] = config.sites[site.id].locales
  if (own.includes(locale)) return locale
  if (site.id === 'east' && locale === EAST_ENGLISH_LOCALE && url.pathname === EAST_ENGLISH_PATH)
    return locale
  if (!hasForeignPrefix(url, config) && !isAppAreaPath(url.pathname)) return locale
  return siteNavLocale(site.id, locale, config)
}

/**
 * 地址带有不属于当前（已登记）站点的语言前缀。路由器的语言改写对这类地址原样保留、不去掉前缀，
 * 客户端因此与服务端一样匹配不到页面（404），不会把西方站 `/zh-hans/pricing` 当成 `/pricing` 渲染。
 */
export function hasForeignPrefix(url: URL, config: SitesConfig): boolean {
  if (!config.i18n.enabled) return false
  const site = resolveSite(url.host, config)
  if (!site.known) return false
  const prefixed = prefixLocale(url.pathname, config.i18n.locales)
  const own: readonly string[] = config.sites[site.id].locales
  return prefixed !== undefined && !own.includes(prefixed)
}
