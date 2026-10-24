import { localeUrlSegment } from '@xuanxue/config'
import { resolveSite, type SitesConfig } from '../site/site.ts'
import { PREFERENCE_COOKIE, preferredLocale, readCookie } from './preference.ts'

/**
 * 东方站根路径不再展示语言选择页：没有语言前缀的 `/` 直接 302 到某个语言的首页。
 * - 已有手动选择（`locale-preference` Cookie）且属于东方站语言时优先采用；
 * - 否则按浏览器语言在东方站语言内选择（zh-CN 归简体，其余中文归繁体）；
 * - 都不匹配时用东方站第一个语言（繁体中文）。
 * 只处理东方站的 `/`；西方站与带语言前缀的地址保持原样。不写 Cookie，因此不记为用户选择。
 */
export function eastHomeRedirect(request: Request, config: SitesConfig): Response | null {
  if (request.method !== 'GET' || !config.i18n.enabled) return null
  const url = new URL(request.url)
  if (url.pathname !== '/') return null
  if (resolveSite(url.host, config).id !== 'east') return null
  const east: readonly string[] = config.sites.east.locales
  const cookie = readCookie(request.headers.get('cookie') ?? '', PREFERENCE_COOKIE)
  const preferred: string =
    cookie !== undefined && east.includes(cookie)
      ? cookie
      : preferredLocale(request.headers.get('accept-language'))
  const locale = east.includes(preferred) ? preferred : (east[0] ?? config.i18n.defaultLocale)
  return new Response(null, {
    status: 302,
    headers: {
      location: `/${localeUrlSegment(locale)}/${url.search}`,
      vary: 'accept-language, cookie',
    },
  })
}
