import { templateConfig } from '../../server/template-config.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { EAST_ENGLISH_PATH, EAST_ENGLISH_URL, resolveSite, siteOfLocale } from './site.ts'

/** 构建期用仅存在于本地 preview 的随机令牌授权内部入口，并按语言还原真实站点 Host。 */
export function prerenderRequest(request: Request, token?: string): Request | null {
  if (!token || request.headers.get('x-site-prerender') !== token) return null
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  // 东方站英文页面（入口页 / 落地页与 5b 根路径英文页面）的预渲染文件在 `/en/…` 命名空间：
  // en 的归属站点是西方站，但这些页面属于东方站（D5、features/east-en/paths.ts）
  const eastEnglish = path === EAST_ENGLISH_PATH || path.startsWith(`${EAST_ENGLISH_PATH}/`)
  const site = eastEnglish
    ? 'east'
    : (siteOfLocale(
        prefixLocale(path, templateConfig.i18n.locales) ?? templateConfig.i18n.defaultLocale,
        templateConfig,
      ) ?? 'west')
  url.host = templateConfig.sites[site].hosts[0] ?? url.host
  // 东方站英文页面的对外地址没有 `/en` 前缀（使用者 2026-11-20）：以东方站根路径地址渲染、输出到 `en/…`，
  // 不请求 `/en/…`（运行时 `/en` 301 到 `/`，其他 `/en/*` 404）
  if (eastEnglish) url.pathname = path.slice(EAST_ENGLISH_PATH.length) || EAST_ENGLISH_URL
  return new Request(url, request)
}

/**
 * /favicon.ico 按 Host 直接返回本站图标（200），不再重定向：发布门禁 check-site-isolation 要求 200，
 * 部分爬虫也不跟随图标重定向。本地开发没有 ASSETS 时由 routes/favicon[.]ico.ts 重定向兜底。
 */
export async function siteFaviconResponse(
  request: Request,
  fetchAsset: (request: Request) => Promise<Response>,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/favicon.ico' || !['GET', 'HEAD'].includes(request.method)) return null
  const site = resolveSite(url.host, templateConfig)
  const response = await fetchAsset(
    new Request(new URL(`/images/favicon-${site.id}.ico`, url), request),
  )
  if (!response.ok) return null
  const result = new Response(response.body, response)
  result.headers.set('cache-control', 'public, max-age=86400')
  return result
}

/** 只读取已知站点的公开 HTML；预览 Host 走 SSR，保留西方品牌与 noindex。 */
export async function staticPageResponse(
  request: Request,
  fetchAsset: (request: Request) => Promise<Response>,
): Promise<Response | null> {
  const url = new URL(request.url)
  const site = resolveSite(url.host, templateConfig)
  if (
    !site.known ||
    !templateConfig.marketing.enabled ||
    !['GET', 'HEAD'].includes(request.method) ||
    !isPrerenderedPath(url.pathname, templateConfig.i18n.locales)
  )
    return null
  const path = url.pathname.replace(/\/+$/, '') || '/'
  // 东方站 `/` 是英文首页：读取预渲染的 en.html（site.ts EAST_ENGLISH_URL）；东方站其他无前缀地址
  // 能走到这里的只有已放行的根路径英文页面（站点守卫），文件在 `en/…`（features/east-en/paths.ts）
  const eastEnglish =
    site.id === 'east' && prefixLocale(path, templateConfig.i18n.locales) === undefined
  url.pathname =
    path === '/'
      ? site.id === 'east'
        ? `${EAST_ENGLISH_PATH}.html`
        : '/index.html'
      : eastEnglish
        ? `${EAST_ENGLISH_PATH}${path}.html`
        : `${path}.html`
  url.search = ''
  const response = await fetchAsset(new Request(url, request))
  if (!response.ok) return null
  if (!new URL(request.url).searchParams.has('r')) return response
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex, nofollow')
  return result
}
