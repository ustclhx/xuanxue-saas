import { localeUrlSegment } from '@xuanxue/config'
import { baseLocale } from '../../paraglide/runtime.js'
import { resolveSite, type SitesConfig } from '../site/site.ts'
import { eastLocale } from './east-home.ts'
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
 * 无前缀认证页的语言跳转（302 到带语言前缀的同一页面，保留查询参数，不写 Cookie）：
 * - 东方站没有无前缀的默认语言（defaultLocale 为 null），无前缀地址只能按 Paraglide 的 baseLocale（en）渲染，
 *   即西方站的英文与品牌。因此东方站的无前缀认证页一律跳到东方站语言，与东方站根路径的选择规则相同
 *   （eastLocale：东方站内的手动选择 → 浏览器语言 → 繁体中文），GET 与 HEAD 都处理。
 * - 其他站点仅在首次访问（没有 `locale-preference` Cookie）时按浏览器语言跳转；只跳到本站已配置的语言，
 *   默认语言与未匹配时返回 null，继续按原地址渲染。认证页在无前缀地址上固定使用默认语言，
 *   客户端无法在不闪烁的前提下改用浏览器语言，所以在服务端完成。
 */
export function authLocaleRedirect(request: Request, config: SitesConfig): Response | null {
  if (!config.i18n.enabled) return null
  const url = new URL(request.url)
  if (!(AUTH_PAGE_PATHS as readonly string[]).includes(url.pathname)) return null
  const site = resolveSite(url.host, config)
  const eastUnprefixed = site.id === 'east' && config.sites.east.defaultLocale === null
  if (request.method !== 'GET' && !(eastUnprefixed && request.method === 'HEAD')) return null
  let locale: string
  if (eastUnprefixed) locale = eastLocale(request, config)
  else {
    if (readCookie(request.headers.get('cookie') ?? '', PREFERENCE_COOKIE)) return null
    locale = preferredLocale(request.headers.get('accept-language'))
    if (locale === baseLocale || !config.sites[site.id].locales.includes(locale)) return null
  }
  const location = `/${localeUrlSegment(locale)}${url.pathname}${url.search}`
  return new Response(null, {
    status: 302,
    headers: { location, vary: 'accept-language, cookie' },
  })
}
