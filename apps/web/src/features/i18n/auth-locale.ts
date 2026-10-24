import { localeUrlSegment } from '@xuanxue/config'
import { baseLocale } from '../../paraglide/runtime.js'
import { resolveSite, type SitesConfig } from '../site/site.ts'
import { PREFERENCE_COOKIE, preferredLocale, readCookie } from './preference.ts'

/** 没有语言前缀时也可访问的认证页（specs/i18n「认证页首次访问」） */
export const AUTH_PAGE_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invitation',
] as const

/**
 * 认证页首次访问时按浏览器语言 302 到带语言前缀的同一页面。
 * 认证页在无前缀地址上固定使用默认语言，客户端无法在不闪烁的前提下改用浏览器语言，所以在服务端完成。
 * - 只在没有 `locale-preference` Cookie（用户从未手动选择）时生效，不写 Cookie，因此不记为用户选择。
 * - 只跳转到本站已配置的语言；其他站点的语言不跨站跳转（跨站需要用户主动访问对应域名）。
 * - 默认语言与未匹配时返回 null，继续按原地址渲染。
 */
export function authLocaleRedirect(request: Request, config: SitesConfig): Response | null {
  if (request.method !== 'GET' || !config.i18n.enabled) return null
  const url = new URL(request.url)
  if (!(AUTH_PAGE_PATHS as readonly string[]).includes(url.pathname)) return null
  if (readCookie(request.headers.get('cookie') ?? '', PREFERENCE_COOKIE)) return null
  const site = resolveSite(url.host, config).id
  const locale = preferredLocale(request.headers.get('accept-language'))
  if (locale === baseLocale || !config.sites[site].locales.includes(locale)) return null
  const location = `/${localeUrlSegment(locale)}${url.pathname}${url.search}`
  return new Response(null, {
    status: 302,
    headers: { location, vary: 'accept-language, cookie' },
  })
}
