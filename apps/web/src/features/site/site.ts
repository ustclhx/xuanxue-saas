import { SITE_IDS, type SiteId, type TemplateConfig } from '@xuanxue/config'

/**
 * 站点识别（openspec add-dual-site-foundation 决策 1，specs/multi-site「按域名识别站点」）：
 * 同一个 Worker 按请求 Host 区分东方站与西方站，站点注册表在 template.config.ts 的 `sites`。
 * 纯函数，不引用运行时模块，服务端中间件与页面都可使用。
 */
export type SitesConfig = Pick<TemplateConfig, 'sites' | 'i18n'>

export interface ResolvedSite {
  readonly id: SiteId
  /** false：未登记的 Host（如 `*.workers.dev` 预览地址），按西方站渲染并整体 noindex */
  readonly known: boolean
}

// 本地开发用 `<站点 id>.localhost`（浏览器把 *.localhost 解析到本机）访问对应站点
const LOCAL_SUFFIX = '.localhost'

/** `host` 可带端口，大小写不敏感 */
export function resolveSite(host: string, config: SitesConfig): ResolvedSite {
  const hostname = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  for (const id of SITE_IDS) {
    if (config.sites[id].hosts.includes(hostname) || hostname === `${id}${LOCAL_SUFFIX}`)
      return { id, known: true }
  }
  return { id: 'west', known: false }
}

/**
 * 账户站点（openspec split-site-accounts 决策 1）：只取请求地址的 Host，忽略查询参数、请求体、Cookie 与其他请求头，
 * 客户端无法指定；未登记的 Host（staging / 预览 `*.workers.dev`、未知 localhost）一律为西方站。
 * 由 Worker 入口在每个请求开始时调用一次，结果传给认证实例与空间解析。
 */
export function accountSiteOf(request: Pick<Request, 'url'>, config: SitesConfig): SiteId {
  return resolveSite(new URL(request.url).host, config).id
}

/**
 * 东方站的英文首页（openspec product-improve-ai-content-20261030 D5；使用者 2026-11-20 网址规则）：
 * 两站的 `/` 都是英文首页、不跳转。东方站完整英文页面上线前，`/` 显示原英文入口页的内容（过渡），
 * 旧地址 `/en` 301 到 `/`，其他 `/en/*` 返回 404。
 * - `EAST_ENGLISH_URL`：对外地址（canonical、hreflang、站点地图、链接）；
 * - `EAST_ENGLISH_PATH`：路由器内的路由路径与预渲染文件（`/en` → en.html）。东方站 `/` 在路由改写中映射到它
 *   （features/i18n/routing.ts），静态页按它读取（static-pages.ts）。
 */
export const EAST_ENGLISH_LOCALE = 'en'
export const EAST_ENGLISH_PATH = '/en'
export const EAST_ENGLISH_URL = '/'

/** 东方站英文首页的请求（对外地址 `/`）：只在已登记为东方站的主机上成立 */
export function isEastEnglishHome(url: URL, config: SitesConfig): boolean {
  if (url.pathname !== EAST_ENGLISH_URL) return false
  const site = resolveSite(url.host, config)
  return site.known && site.id === 'east'
}

/**
 * 站点导航（页头工具、定价链接）使用的语言：当前语言属于该站点时原样使用，否则取站点默认语言；
 * 东方站没有无前缀默认语言，取它的第一个语言（繁体中文）。两站分开经营，导航不跨站（D5）。
 */
export function siteNavLocale(site: SiteId, locale: string, config: SitesConfig): string {
  const { locales, defaultLocale } = config.sites[site]
  if (locales.some((item) => item === locale)) return locale
  return defaultLocale ?? locales[0] ?? config.i18n.defaultLocale
}

/**
 * 语言所属的站点；未配置的语言返回 undefined。
 * 同一语言可在两个站点各有页面（openspec add-locales-eu-ja：东方站 `/en/…`）：此时取以它为默认语言的站点
 * （`en` → 西方站），只知道语言、不知道站点的场景（规范域名、品牌名）继续落在原站点；
 * 按站点区分的判断用 siteHasLocale。
 */
export function siteOfLocale(locale: string, config: SitesConfig): SiteId | undefined {
  const owners = SITE_IDS.filter((id) => siteHasLocale(id, locale, config))
  return owners.find((id) => config.sites[id].defaultLocale === locale) ?? owners[0]
}

/** 站点是否服务该语言（按站点的语言列表，不经过 siteOfLocale 的单一归属） */
export function siteHasLocale(site: SiteId, locale: string, config: SitesConfig): boolean {
  return config.sites[site].locales.some((item) => item === locale)
}

/**
 * 站点的规范地址：生产使用注册表中的第一个 host（https）；本地 `<id>.localhost` 保留协议与端口。
 * `from` 为当前请求地址；未登记的 Host（`*.workers.dev` 预览/staging）不跨站，保留请求自身 origin，
 * 避免报告邮件等链接指向尚未上线的规范域名。
 */
export function siteOrigin(id: SiteId, from: URL, config: SitesConfig): string {
  if (from.hostname.endsWith(LOCAL_SUFFIX)) {
    const url = new URL(from.origin)
    url.hostname = `${id}${LOCAL_SUFFIX}`
    return url.origin
  }
  if (!resolveSite(from.host, config).known) return from.origin
  const [host] = config.sites[id].hosts
  return host ? `https://${host}` : from.origin
}

/**
 * 认证与支付回跳接受的站点 Host（决策 4「两站各自登录」）：注册表中的全部域名；
 * `appUrl` 指向本机时再加入同端口的 `<站点 id>.localhost`，生产部署不接受本地 Host。
 */
export function siteHosts(config: SitesConfig, appUrl: string): string[] {
  const app = new URL(appUrl)
  const hosts: string[] = SITE_IDS.flatMap((id) => [...config.sites[id].hosts])
  if (app.hostname === 'localhost' || app.hostname === '127.0.0.1')
    for (const id of SITE_IDS) hosts.push(`${id}${LOCAL_SUFFIX}${app.port ? `:${app.port}` : ''}`)
  return hosts
}

/** 请求所在站点的 origin；Host 不在 siteHosts 中（预览地址等）时回退到 `appUrl` */
export function requestSiteOrigin(requestUrl: string, config: SitesConfig, appUrl: string): string {
  const url = new URL(requestUrl)
  return siteHosts(config, appUrl).includes(url.host.toLowerCase())
    ? url.origin
    : new URL(appUrl).origin
}
