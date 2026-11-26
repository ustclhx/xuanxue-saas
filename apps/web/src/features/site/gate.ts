import { localeUrlSegment, SITE_IDS } from '@xuanxue/config'
import { NOT_FOUND_PATH } from '../admin/not-found-path.ts'
import {
  isEastEnglishContentNamespace,
  isEastEnglishOnlyPath,
  isEastEnglishPath,
} from '../east-en/paths.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { prefixLocale as segmentLocale } from '../i18n/locale-url.ts'
import { isLocaleLive, LOCALE_RELEASE, type ReleaseTable, releaseState } from '../i18n/rollout.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { reversedPairPath } from '../routing/pair-path.ts'
import { mainToolPath } from '../tools/registry.ts'
import { westContentRouteOf } from '../west-content/routes.ts'
import {
  EAST_ENGLISH_LOCALE,
  resolveSite,
  type SitesConfig,
  siteHasLocale,
  siteNavLocale,
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
 * - 本站语言尚未发布（features/i18n/rollout.ts，openspec add-locales-eu-ja 决策 5）时，正式域名返回 404、不跨站跳转；
 *   staging、预览与本地主机照常放行。东方站英文入口页 `/en` 不受东方站 `en` 发布状态影响。
 */
export type SiteDecision =
  | { readonly kind: 'redirect'; readonly status: 301 | 302; readonly location: string }
  | { readonly kind: 'pass'; readonly noindex: boolean }
  | { readonly kind: 'not-found' }

import { EAST_UNPREFIXED_PREFIXES } from './unprefixed.ts'

export { EAST_UNPREFIXED_PREFIXES }

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

export function routeSite(
  url: URL,
  config: SitesConfig,
  /** null：不按发布状态拦截（构建期预渲染请求：pending 语言页面照常预渲染，供 staging 使用） */
  release: ReleaseTable | null = LOCALE_RELEASE,
): SiteDecision {
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
    const eastEnglish =
      site.known && site.id === 'east' && locale === EAST_ENGLISH_LOCALE && rest === '/'
    // 旧英文入口页地址 `/en` 301 到东方站英文首页 `/`（使用者 2026-11-20）；构建期预渲染照常生成 en.html
    if (eastEnglish)
      return release === null ? { kind: 'pass', noindex } : redirect(301, url.origin, '/')
    // 东方站英文页面在根路径（5b），`/en/*` 不是页面：认证页照旧 302 到无前缀地址；东方站英文发布后
    // `/en/<英文页面>` 与西方站一样 301 到无前缀地址（ML-01：`/` 与 `/en` 不并存），其余 404
    if (site.known && site.id === 'east' && locale === EAST_ENGLISH_LOCALE) {
      if (EAST_UNPREFIXED_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`)))
        return redirect(302, url.origin, rest)
      if (
        release !== null &&
        siteHasLocale('east', locale, config) &&
        isEastEnglishPath(rest) &&
        isLocaleLive(locale, url.host, config, release) &&
        releaseState('east', locale, release) === 'released'
      )
        return redirect(301, url.origin, rest)
      return { kind: 'not-found' }
    }
    if (site.known && !siteHasLocale(site.id, locale, config)) {
      // 认证页没有语言也能访问：外站语言前缀的认证页（旧状态生成的 `/zh-hans/login?redirect=…`）
      // 302 到本站无前缀认证页、保留查询参数，再由认证页语言跳转选择本站语言；不跨站
      if (EAST_UNPREFIXED_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`)))
        return redirect(302, url.origin, rest)
      return { kind: 'not-found' }
    }
    if (locale === config.sites[site.id].defaultLocale) return redirect(301, url.origin, rest)
    if (release && !eastEnglish && !isLocaleLive(locale, url.host, config, release))
      return { kind: 'not-found' }
    return { kind: 'pass', noindex }
  }

  // 东方站根路径英文页面（5b）：本站英文已发布（或预览主机、构建期预渲染）时放行；
  // 正式域名上未发布前维持下方的 301（与发布前完全相同）
  if (
    site.known &&
    site.id === 'east' &&
    siteHasLocale('east', EAST_ENGLISH_LOCALE, config) &&
    (isEastEnglishPath(pathname) || isEastEnglishContentNamespace(pathname)) &&
    (release === null || isLocaleLive(EAST_ENGLISH_LOCALE, url.host, config, release))
  )
    return { kind: 'pass', noindex }
  // 只属于东方站英文的地址（`/bazi-calculator` 等）不是西方站页面：西方站返回本站 404，不跨站
  if (
    site.known &&
    site.id === 'west' &&
    siteHasLocale('east', EAST_ENGLISH_LOCALE, config) &&
    isEastEnglishOnlyPath(pathname)
  )
    return { kind: 'not-found' }
  if (site.known && site.id === 'east') {
    const westPath = reversedPairPath('west', 'en', pathname) ?? pathname
    if (westContentRouteOf('en', westPath) || isEastEnglishContentNamespace(pathname))
      return { kind: 'not-found' }
  }
  if (
    site.known &&
    config.sites[site.id].defaultLocale === null &&
    !isUnprefixedEastPath(pathname)
  ) {
    // 跳到本站默认导航语言（繁中）。不能用 siteNavLocale(site, 'en')：东方站英文发布后 en 也是东方站语言，
    // 会跳到不存在的 `/en/…`（东方站英文页面在根路径，能走到这里的都不是英文页面）
    const navLocale = siteNavLocale(site.id, '', config)
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
 * - GET/HEAD 的语言前缀大小写不同（`/ZH-HANT/…`）时改为小写前缀（template 0.8.0 ML-01），
 *   再由站点判定处理默认语言前缀，两者合并为一次 301。
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
  const locale = segmentLocale(first, config.i18n.locales)
  if (
    ['GET', 'HEAD'].includes(method) &&
    locale !== undefined &&
    first !== localeUrlSegment(locale)
  )
    result.pathname = `/${localeUrlSegment(locale)}${result.pathname.slice(first.length + 1)}`
  return result.href === url.href ? null : result
}

/** 迁移前只在语言首页的工具上使用的查询参数：解锁 / 结账回跳（readings/unlock.ts、unlock-card.tsx） */
export const LEGACY_TOOL_PARAMS = ['unlock', 'checkout'] as const

/**
 * 旧首页查询跳转（openspec separate-landing-homepage design.md D4）：工具从语言首页迁到关键词 URL 后，
 * 已签发、`returnTo` 为语言首页的解锁令牌（6 小时内的结账与登录回跳）仍会回到首页。
 * GET/HEAD 请求本站某语言首页且带 `unlock` 或 `checkout` 参数时，301 到该语言主工具页并保留查询串；
 * 东方站 `/` 是英文首页（没有英文工具页），不跳转。
 * 只带 `utm_*`、`gclid` 等参数的首页请求不跳转（广告与外链落地页仍是首页）。
 * `#r=` 分享片段服务器看不到，由落地页的内联脚本处理（legacyHashRedirectScript）。
 */
export function legacyHomeRedirect(request: Request, config: SitesConfig): Response | null {
  if (!['GET', 'HEAD'].includes(request.method) || !config.i18n.enabled) return null
  const url = new URL(request.url)
  if (!LEGACY_TOOL_PARAMS.some((name) => url.searchParams.has(name))) return null
  const site = resolveSite(url.host, config)
  const prefixed = prefixLocale(url.pathname, config.i18n.locales)
  const root = url.pathname === '/'
  // 语言首页：`/<语言前缀>`，或无前缀的 `/`（西方站默认语言首页、东方站按访客偏好选语言）
  if (!root && (prefixed === undefined || url.pathname !== `/${localeUrlSegment(prefixed)}`))
    return null
  // 东方站 `/` 是英文首页（没有英文工具页），旧首页查询不跳转
  const locale = root ? config.sites[site.id].defaultLocale : prefixed
  const path = locale ? mainToolPath(locale) : undefined
  if (!locale || !path) return null
  const prefix =
    config.sites[site.id].defaultLocale === locale ? '' : `/${localeUrlSegment(locale)}`
  return new Response(null, {
    status: 301,
    headers: {
      location: `${url.origin}${prefix}${encodeURI(path)}${url.search}`,
    },
  })
}

export { legacyHashRedirectScript } from './legacy-hash.ts'

/**
 * 改写到的 404 路径：带上本次应使用的语言前缀，使 404 页的服务端渲染与客户端水合使用同一语言。
 * 地址的语言前缀属于本站（或未登记的 Host）时沿用；外站语言或没有前缀时用本站导航语言
 * （东方站没有无前缀默认语言，否则会落到 baseLocale 英文，即西方站的语言）。
 * 客户端同样把外站语言换成本站导航语言（features/i18n/site-locale.ts）。
 */
export function notFoundPath(
  url: URL,
  config: SitesConfig,
  release: ReleaseTable = LOCALE_RELEASE,
): string {
  if (!config.i18n.enabled) return NOT_FOUND_PATH
  const site = resolveSite(url.host, config)
  const prefixed = prefixLocale(url.pathname, config.i18n.locales)
  const own: readonly string[] = config.sites[site.id].locales
  // 未发布语言在正式域名上的 404 用本站导航语言渲染，不显示未发布语言的界面
  const locale =
    prefixed !== undefined &&
    (!site.known || own.includes(prefixed)) &&
    isLocaleLive(prefixed, url.host, config, release)
      ? prefixed
      : siteNavLocale(site.id, own.includes(prefixed ?? '') ? '' : (prefixed ?? ''), config)
  return locale === config.i18n.defaultLocale
    ? NOT_FOUND_PATH
    : `/${localeUrlSegment(locale)}${NOT_FOUND_PATH}`
}

/**
 * 站点闸门的判定部分（不调用后续处理）：先把地址规范化（canonicalUrl），再按规范地址做站点判定、
 * 旧首页查询跳转与东方站根路径跳转，使协议、结尾斜杠与站点跳转合并为一次跳转；只有地址需要规范化而
 * 站点判定放行时，才单独跳到规范地址（GET/HEAD 301，其他方法 308 保留方法与请求体）。
 * 项目闸门（server/project-gate.ts，早于预渲染静态资源与环境校验）与 gateSiteRequest 共用。
 * - `redirect`：应直接返回的跳转响应；
 * - `not-found`：不属于本站的地址，`path` 为应改写到的本站 404 路径；
 * - `pass`：放行，未登记的 Host 带 `noindex`。
 */
export type SiteGateResult =
  | { readonly kind: 'redirect'; readonly response: Response }
  | { readonly kind: 'not-found'; readonly url: URL }
  | { readonly kind: 'pass'; readonly noindex: boolean }

export function siteGateDecision(
  request: Request,
  config: SitesConfig,
  {
    canonicalize = true,
    prerender = false,
  }: {
    readonly canonicalize?: boolean
    /** 构建期预渲染请求：未发布语言的页面也要生成（正式域名上由本守卫在运行时返回 404） */
    readonly prerender?: boolean
  } = {},
): SiteGateResult {
  const original = new URL(request.url)
  const canonical = canonicalize ? canonicalUrl(original, request.method, config) : null
  const url = canonical ?? original
  const decision = routeSite(url, config, prerender ? null : LOCALE_RELEASE)
  if (decision.kind === 'redirect')
    return {
      kind: 'redirect',
      response: new Response(null, {
        status: decision.status,
        headers: { location: decision.location },
      }),
    }
  // 不属于本站的地址直接给 404，不先跳到规范形式
  if (decision.kind === 'not-found')
    return { kind: 'not-found', url: new URL(notFoundPath(url, config), url) }
  // 只对 GET/HEAD 复制请求：带请求体的请求复制后原请求体会被占用。
  // 东方站根路径不再按浏览器语言跳转（使用者 2026-11-20：两站 `/` 都是英文首页，不自动选语言）
  if (canonicalize && ['GET', 'HEAD'].includes(request.method)) {
    const home = legacyHomeRedirect(new Request(url, request), config)
    if (home) return { kind: 'redirect', response: home }
  }
  if (canonical)
    return {
      kind: 'redirect',
      response: new Response(null, {
        status: ['GET', 'HEAD'].includes(request.method) ? 301 : 308,
        headers: { location: canonical.href },
      }),
    }
  return { kind: 'pass', noindex: decision.noindex }
}

/** 未登记 Host 的响应附加 `X-Robots-Tag: noindex`（重定向与静态响应的 headers 可能只读，复制后再设置）。 */
export function withSiteNoindex(response: Response): Response {
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex')
  return result
}

/**
 * Worker 入口使用：按 siteGateDecision 的判定返回跳转，或把请求交给后续处理。
 * 构建期预渲染请求传 `canonicalize: false`：它使用本地 http 地址，且不应跳转。
 * 不属于本站的语言改写到不存在的路径，由应用渲染本站风格的 404；
 * 未登记 Host 的响应附加 `X-Robots-Tag: noindex`。
 */
export async function gateSiteRequest(
  request: Request,
  config: SitesConfig,
  next: (request: Request) => Response | Promise<Response>,
  options: {
    readonly canonicalize?: boolean
    readonly prerender?: boolean
  } = {},
): Promise<Response> {
  const result = siteGateDecision(request, config, options)
  if (result.kind === 'redirect') return result.response
  if (result.kind === 'not-found') return next(new Request(result.url, request))
  const response = await next(request)
  return result.noindex ? withSiteNoindex(response) : response
}
