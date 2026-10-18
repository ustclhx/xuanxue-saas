import { localeUrlSegment } from '@xuanxue/config'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { resolveSite, type SitesConfig, siteOfLocale, siteOrigin } from './site.ts'

/**
 * 站点守卫（openspec add-dual-site-foundation tasks.md 1.3，specs/multi-site）：
 * 在语言中间件之前执行，先识别站点，再校验语言前缀归属。
 *
 * - 语言前缀不属于当前站点：301 到所属站点的同一路径（specs/multi-site「语言归属站点」）。
 * - 当前站点默认语言的前缀（如西方站 `/en/pricing`）：307 到无前缀地址。
 * - 带语言前缀的应用区地址（`/ko/app`）不跳转，由语言守卫返回 404。
 * - 东方站没有无前缀的默认语言：除根路径（入口页）、应用区、认证页与技术路径外，302 到入口页。
 * - 未登记的 Host 按西方站处理并 noindex；预览环境需要浏览全部语言，因此不做跨站跳转。
 */
export type SiteDecision =
  | { readonly kind: 'redirect'; readonly status: 301 | 302 | 307; readonly location: string }
  | { readonly kind: 'pass'; readonly noindex: boolean }

/** 东方站上不跳转到入口页的无前缀路径（应用区另见 APP_AREA_PREFIXES） */
export const EAST_UNPREFIXED_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invitation',
] as const

// 形如语言代码的首段（`/fr`、`/zh`、`/zh-cn`）交给路由器返回 404，而不是跳转到入口页
const LANGUAGE_LIKE = /^[a-z]{2}(-[a-z0-9]+)*$/i

function isUnprefixedEastPath(pathname: string): boolean {
  const [, first = ''] = pathname.split('/')
  return (
    pathname === '/' ||
    isAppAreaPath(pathname) ||
    EAST_UNPREFIXED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    // Server Functions 等内部路径与 sitemap.xml、robots.txt、图片等文件
    first.startsWith('_') ||
    /\.[a-z0-9]+$/i.test(pathname) ||
    LANGUAGE_LIKE.test(first)
  )
}

export function routeSite(url: URL, config: SitesConfig): SiteDecision {
  const site = resolveSite(url.host, config)
  const noindex = !site.known
  if (!config.i18n.enabled) return { kind: 'pass', noindex }
  const { pathname, search } = url
  const redirect = (status: 301 | 302 | 307, origin: string, path: string): SiteDecision => ({
    kind: 'redirect',
    status,
    location: `${origin}${path}${search}`,
  })

  const locale = prefixLocale(pathname, config.i18n.locales)
  if (locale !== undefined) {
    const rest = pathname.slice(localeUrlSegment(locale).length + 1) || '/'
    // 带语言前缀的应用区地址交给语言守卫返回 404（features/i18n/gate.ts），不跳转
    if (isAppAreaPath(rest)) return { kind: 'pass', noindex }
    // 预览地址不跨站跳转，只处理默认语言前缀
    const target = site.known ? (siteOfLocale(locale, config) ?? site.id) : site.id
    const path = locale === config.sites[target].defaultLocale ? rest : pathname
    if (target !== site.id) return redirect(301, siteOrigin(target, url, config), path)
    if (path !== pathname) return redirect(307, url.origin, path)
    return { kind: 'pass', noindex }
  }

  if (site.known && config.sites[site.id].defaultLocale === null && !isUnprefixedEastPath(pathname))
    return { kind: 'redirect', status: 302, location: `${url.origin}/` }
  return { kind: 'pass', noindex }
}

/** Worker 入口使用：跳转直接返回，未登记 Host 的响应附加 `X-Robots-Tag: noindex` */
export async function gateSiteRequest(
  request: Request,
  config: SitesConfig,
  next: () => Response | Promise<Response>,
): Promise<Response> {
  const decision = routeSite(new URL(request.url), config)
  if (decision.kind === 'redirect')
    return new Response(null, { status: decision.status, headers: { location: decision.location } })
  const response = await next()
  if (!decision.noindex) return response
  // 重定向与静态响应的 headers 可能只读，复制后再设置
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex')
  return result
}
