import { localeUrlSegment } from '@xuanxue/config'
import { resolveSite, type SitesConfig } from '../site/site.ts'
import { PREFERENCE_COOKIE, preferredLocale, readCookie } from './preference.ts'

/**
 * 东方站根路径不再展示语言选择页：没有语言前缀的 `/` 直接跳到某个语言的首页（specs/multi-site「东方站入口页」）。
 * - 已有手动选择（`locale-preference` Cookie）且属于东方站语言时优先采用；
 * - 否则按浏览器语言在东方站语言内选择（zh-CN 归简体，其余中文归繁体）；
 * - 都不匹配时用东方站第一个语言（繁体中文）。
 * 落到繁体中文（爬虫通常不带 Accept-Language 与 Cookie，也落在这里）时 301，使 `/` 的信号合并到规范首页
 * `/zh-hant`；落到其他语言时 302。跳转目标为不带结尾斜杠的绝对地址（与 canonical 一致），
 * 响应按访客偏好变化，带 Vary 且不缓存（openspec fix-seo-canonical-indexing design.md 决策 3）。
 * 只处理东方站的 `/`（GET 与 HEAD，HEAD 不能落到西方站静态首页）；西方站与带语言前缀的地址保持原样。
 * 不写 Cookie，因此不记为用户选择。由站点守卫在地址规范化之后调用（features/site/gate.ts）。
 */
export function eastHomeRedirect(request: Request, config: SitesConfig): Response | null {
  if (!['GET', 'HEAD'].includes(request.method) || !config.i18n.enabled) return null
  const url = new URL(request.url)
  if (url.pathname !== '/') return null
  if (resolveSite(url.host, config).id !== 'east') return null
  const locale = eastLocale(request, config)
  return new Response(null, {
    status: locale === config.sites.east.locales[0] ? 301 : 302,
    headers: {
      location: `${url.origin}/${localeUrlSegment(locale)}${url.search}`,
      vary: 'accept-language, cookie',
      'cache-control': 'private, no-store',
    },
  })
}

/**
 * 东方站无前缀地址要落到的语言（根路径与认证页共用）：属于东方站的手动选择优先，
 * 其次是东方站语言内的浏览器语言，都不匹配时取东方站第一个语言（繁体中文）。
 */
export function eastLocale(request: Request, config: SitesConfig): string {
  const east: readonly string[] = config.sites.east.locales
  const cookie = readCookie(request.headers.get('cookie') ?? '', PREFERENCE_COOKIE)
  const preferred: string =
    cookie !== undefined && east.includes(cookie)
      ? cookie
      : preferredLocale(request.headers.get('accept-language'))
  return east.includes(preferred) ? preferred : (east[0] ?? config.i18n.defaultLocale)
}
