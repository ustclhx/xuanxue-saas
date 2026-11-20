import {
  EAST_ENGLISH_LOCALE,
  EAST_ENGLISH_PATH,
  EAST_ENGLISH_URL,
  resolveSite,
  type SitesConfig,
  siteNavLocale,
} from '../site/site.ts'
import { isAppAreaPath } from './app-area.ts'
import { isLocaleLive } from './rollout.ts'
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
 * 本站尚未发布的语言（rollout.ts）在正式域名上按外站语言处理，与服务端 404 一致。
 */
export function siteLocale(
  locale: string,
  url: URL,
  config: SitesConfig,
  release: boolean = IN_BROWSER,
): string {
  if (!config.i18n.enabled) return locale
  const site = resolveSite(url.host, config)
  if (!site.known) return locale
  if (
    site.id === 'east' &&
    locale === EAST_ENGLISH_LOCALE &&
    (url.pathname === EAST_ENGLISH_URL || url.pathname === EAST_ENGLISH_PATH)
  )
    return locale
  if (liveSiteLocales(site.id, url, config, release).includes(locale)) return locale
  if (!hasForeignPrefix(url, config, release) && !isAppAreaPath(url.pathname)) return locale
  // 本站未发布的语言不能经 siteNavLocale 原样返回，改取本站导航语言
  const own: readonly string[] = config.sites[site.id].locales
  return siteNavLocale(site.id, own.includes(locale) ? '' : locale, config)
}

/**
 * 地址带有不属于当前（已登记）站点的语言前缀。路由器的语言改写对这类地址原样保留、不去掉前缀，
 * 客户端因此与服务端一样匹配不到页面（404），不会把西方站 `/zh-hans/pricing` 当成 `/pricing` 渲染。
 */
export function hasForeignPrefix(
  url: URL,
  config: SitesConfig,
  release: boolean = IN_BROWSER,
): boolean {
  if (!config.i18n.enabled) return false
  const site = resolveSite(url.host, config)
  if (!site.known) return false
  const prefixed = prefixLocale(url.pathname, config.i18n.locales)
  // 东方站英文入口页 `/en` 也按外站前缀原样保留：它是独立路由，不能被改写成东方站首页 `/`
  if (prefixed === undefined) return false
  return !liveSiteLocales(site.id, url, config, release).includes(prefixed)
}

/**
 * 发布状态只在浏览器端参与判断：服务端在站点守卫中已把正式域名上的未发布语言改写为 404 路径，
 * 路由器不会再看到这类地址；唯一例外是构建期预渲染（以正式域名为 Host 生成 pending 语言页面，供 staging 使用），
 * 那时必须照常去掉语言前缀。浏览器直接打开正式域名上的未发布语言地址时，按外站前缀处理，与服务端 404 一致。
 */
const IN_BROWSER = typeof document !== 'undefined'

/** 本站在该主机上可访问的语言：正式域名只含已发布语言（rollout.ts） */
function liveSiteLocales(
  site: 'east' | 'west',
  url: URL,
  config: SitesConfig,
  release: boolean,
): readonly string[] {
  return config.sites[site].locales.filter(
    (item) => !release || isLocaleLive(item, url.host, config),
  )
}
