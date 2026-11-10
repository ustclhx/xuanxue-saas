import { localeUrlSegment, SITE_IDS } from '@xuanxue/config'
import { NOT_FOUND_PATH } from '../admin/not-found-path.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { eastHomeRedirect } from '../i18n/east-home.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import {
  EAST_ENGLISH_LOCALE,
  resolveSite,
  type SitesConfig,
  siteNavLocale,
  siteOfLocale,
} from './site.ts'

/**
 * 站点守卫（openspec add-dual-site-foundation tasks.md 1.3，specs/multi-site）：
 * 在语言中间件之前执行，先识别站点，再校验语言前缀归属。
 *
 * - 两站分开经营（openspec product-improve-ai-content-20261030 D5）：语言前缀不属于当前站点时
 *   返回本站风格、本站语言的 404，不跨站跳转；例外是东方站的英文入口页 `/en`，
 *   以及认证页（`/zh-hans/login` 在西方站）302 到本站无前缀认证页。
 * - 当前站点默认语言的前缀（如西方站 `/en/pricing`）：301 到无前缀地址。
 * - 带语言前缀的应用区地址（`/ko/app`）不跳转，由语言守卫返回 404。
 * - 东方站无前缀的公开页（含裸法律页）301 到本站默认导航语言（繁体中文）的同一路径，保留查询参数；
 *   目标不存在时由路由器返回 404，不再跳到首页（openspec fix-seo-canonical-indexing design.md 决策 4）。
 * - 未登记的 Host 按西方站处理并 noindex；预览环境需要浏览全部语言，因此不返回 404。
 */
export type SiteDecision =
  | { readonly kind: 'redirect'; readonly status: 301 | 302; readonly location: string }
  | { readonly kind: 'pass'; readonly noindex: boolean }
  | { readonly kind: 'not-found' }

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
  const redirect = (status: 301 | 302, origin: string, path: string): SiteDecision => ({
    kind: 'redirect',
    status,
    location: `${origin}${path}${search}`,
  })

  const locale = prefixLocale(pathname, config.i18n.locales)
  if (locale !== undefined) {
    const rest = pathname.slice(localeUrlSegment(locale).length + 1) || '/'
    // 带语言前缀的应用区地址交给语言守卫返回 404（features/i18n/gate.ts），不跳转
    if (isAppAreaPath(rest)) return { kind: 'pass', noindex }
    // 已登记的站点只提供自己的语言；预览地址可浏览全部语言
    if (site.known && siteOfLocale(locale, config) !== site.id) {
      const eastEnglish = site.id === 'east' && locale === EAST_ENGLISH_LOCALE && rest === '/'
      if (eastEnglish) return { kind: 'pass', noindex }
      // 认证页没有语言也能访问：外站语言前缀的认证页（旧状态生成的 `/zh-hans/login?redirect=…`）
      // 302 到本站无前缀认证页、保留查询参数，再由认证页语言跳转选择本站语言；不跨站
      if (EAST_UNPREFIXED_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`)))
        return redirect(302, url.origin, rest)
      return { kind: 'not-found' }
    }
    if (locale === config.sites[site.id].defaultLocale) return redirect(301, url.origin, rest)
    return { kind: 'pass', noindex }
  }

  if (
    site.known &&
    config.sites[site.id].defaultLocale === null &&
    !isUnprefixedEastPath(pathname)
  ) {
    const navLocale = siteNavLocale(site.id, config.i18n.defaultLocale, config)
    return redirect(301, url.origin, `/${localeUrlSegment(navLocale)}${pathname}`)
  }
  return { kind: 'pass', noindex }
}

/**
 * 公开地址规范化（specs/seo「规范地址收敛」）：返回应永久跳转到的规范地址，已是规范地址时返回 null。
 * - 注册表中的站点域名使用 HTTPS（Cloudflare 区域未强制 HTTPS 时由 Worker 补上）；
 *   本地 `<站点>.localhost` 与未登记的预览 Host 不升级。
 * - GET/HEAD 的非根路径去掉结尾斜杠（站内链接、canonical 与站点地图都不带斜杠）；
 *   `/api/` 与 `_` 开头的内部路径保持原样，不改变第三方回调地址。
 */
export function canonicalUrl(url: URL, method: string, config: SitesConfig): URL | null {
  const result = new URL(url.href)
  const hosts: readonly string[] = SITE_IDS.flatMap((id) => config.sites[id].hosts)
  if (result.protocol === 'http:' && hosts.includes(result.hostname.toLowerCase()))
    result.protocol = 'https:'
  const [, first = ''] = result.pathname.split('/')
  if (
    ['GET', 'HEAD'].includes(method) &&
    result.pathname.length > 1 &&
    result.pathname.endsWith('/') &&
    first !== 'api' &&
    !first.startsWith('_')
  )
    result.pathname = result.pathname.replace(/\/+$/, '') || '/'
  return result.href === url.href ? null : result
}

/**
 * 改写到的 404 路径：带上本次应使用的语言前缀，使 404 页的服务端渲染与客户端水合使用同一语言。
 * 地址的语言前缀属于本站（或未登记的 Host）时沿用；外站语言或没有前缀时用本站导航语言
 * （东方站没有无前缀默认语言，否则会落到 baseLocale 英文，即西方站的语言）。
 * 客户端同样把外站语言换成本站导航语言（features/i18n/site-locale.ts）。
 */
export function notFoundPath(url: URL, config: SitesConfig): string {
  if (!config.i18n.enabled) return NOT_FOUND_PATH
  const site = resolveSite(url.host, config)
  const prefixed = prefixLocale(url.pathname, config.i18n.locales)
  const own: readonly string[] = config.sites[site.id].locales
  const locale =
    prefixed !== undefined && (!site.known || own.includes(prefixed))
      ? prefixed
      : siteNavLocale(site.id, prefixed ?? '', config)
  return locale === config.i18n.defaultLocale
    ? NOT_FOUND_PATH
    : `/${localeUrlSegment(locale)}${NOT_FOUND_PATH}`
}

/**
 * Worker 入口使用：先把地址规范化（canonicalUrl），再按规范地址做站点判定与东方站根路径跳转，
 * 使协议、结尾斜杠与站点跳转合并为一次跳转；只有地址需要规范化而站点判定放行时，
 * 才单独跳到规范地址（GET/HEAD 301，其他方法 308 保留方法与请求体）。
 * 构建期预渲染请求传 `canonicalize: false`：它使用本地 http 地址，且不应跳转。
 * 不属于本站的语言改写到不存在的路径，由应用渲染本站风格的 404；
 * 未登记 Host 的响应附加 `X-Robots-Tag: noindex`。
 */
export async function gateSiteRequest(
  request: Request,
  config: SitesConfig,
  next: (request: Request) => Response | Promise<Response>,
  { canonicalize = true }: { readonly canonicalize?: boolean } = {},
): Promise<Response> {
  const original = new URL(request.url)
  const canonical = canonicalize ? canonicalUrl(original, request.method, config) : null
  const url = canonical ?? original
  const decision = routeSite(url, config)
  if (decision.kind === 'redirect')
    return new Response(null, { status: decision.status, headers: { location: decision.location } })
  // 不属于本站的地址直接给 404，不先跳到规范形式
  if (decision.kind === 'not-found')
    return next(new Request(new URL(notFoundPath(url, config), url), request))
  // 只对 GET/HEAD 复制请求：带请求体的请求复制后原请求体会被占用
  if (canonicalize && ['GET', 'HEAD'].includes(request.method)) {
    const home = eastHomeRedirect(new Request(url, request), config)
    if (home) return home
  }
  if (canonical)
    return new Response(null, {
      status: ['GET', 'HEAD'].includes(request.method) ? 301 : 308,
      headers: { location: canonical.href },
    })
  const response = await next(request)
  if (!decision.noindex) return response
  // 重定向与静态响应的 headers 可能只读，复制后再设置
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex')
  return result
}
