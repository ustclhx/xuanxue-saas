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
 * 东方站的英文入口页（openspec product-improve-ai-content-20261030 D5，specs/multi-site「东方站英文入口页」）：
 * en 归西方站，东方站只有 `/en` 这一页英文介绍，其他 `/en/*` 返回 404。
 */
export const EAST_ENGLISH_LOCALE = 'en'
export const EAST_ENGLISH_PATH = '/en'

/**
 * 站点导航（页头工具、定价链接）使用的语言：当前语言属于该站点时原样使用，否则取站点默认语言；
 * 东方站没有无前缀默认语言，取它的第一个语言（繁体中文）。两站分开经营，导航不跨站（D5）。
 */
export function siteNavLocale(site: SiteId, locale: string, config: SitesConfig): string {
  const { locales, defaultLocale } = config.sites[site]
  if (locales.some((item) => item === locale)) return locale
  return defaultLocale ?? locales[0] ?? config.i18n.defaultLocale
}

/** 语言所属的站点；未配置的语言返回 undefined */
export function siteOfLocale(locale: string, config: SitesConfig): SiteId | undefined {
  return SITE_IDS.find((id) => config.sites[id].locales.some((item) => item === locale))
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
