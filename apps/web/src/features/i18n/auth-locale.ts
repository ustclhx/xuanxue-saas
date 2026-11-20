import { localeUrlSegment } from '@xuanxue/config'
import { resolveSite, type SitesConfig } from '../site/site.ts'
import { eastDefaultLocale } from './east-home.ts'
import { localePrefix, prefixLocale } from './url-prefix.ts'

/** 没有语言前缀时也可访问的认证页（specs/i18n「认证页首次访问」） */
export const AUTH_PAGE_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invitation',
] as const

export type AuthPagePath = (typeof AUTH_PAGE_PATHS)[number]

/** 认证页（含任意语言前缀与查询参数）：响应带 noindex（specs/seo「认证页不进索引」） */
export function isAuthPagePath(pathname: string, locales: readonly string[]): boolean {
  const locale = prefixLocale(pathname, locales)
  const rest = locale === undefined ? pathname : pathname.slice(localePrefix(locale).length) || '/'
  return (AUTH_PAGE_PATHS as readonly string[]).includes(rest.replace(/\/+$/, '') || '/')
}

/**
 * 无前缀认证页的语言跳转（使用者 2026-11-20 网址规则：语言只由地址决定，不按浏览器语言或 Cookie 选择）：
 * - 东方站没有无前缀的英文认证页（东方站英文版本只有首页），无前缀认证页固定 302 到东方站第一个已发布语言
 *   （繁体中文）的同一页面，保留查询参数；结果与访客无关，GET 与 HEAD 都处理。
 * - 西方站无前缀认证页就是英文页面，不跳转。
 */
export function authLocaleRedirect(request: Request, config: SitesConfig): Response | null {
  if (!config.i18n.enabled) return null
  const url = new URL(request.url)
  if (!(AUTH_PAGE_PATHS as readonly string[]).includes(url.pathname)) return null
  if (!['GET', 'HEAD'].includes(request.method)) return null
  const site = resolveSite(url.host, config)
  if (site.id !== 'east' || config.sites.east.defaultLocale !== null) return null
  const location = `/${localeUrlSegment(eastDefaultLocale(config))}${url.pathname}${url.search}`
  return new Response(null, { status: 302, headers: { location } })
}
