import { templateConfig } from '../../server/template-config.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { isPrerenderedPath } from '../marketing/prerender.ts'
import { EAST_ENGLISH_PATH, resolveSite, siteOfLocale } from './site.ts'

/** 构建期用仅存在于本地 preview 的随机令牌授权内部入口，并按语言还原真实站点 Host。 */
export function prerenderRequest(request: Request, token?: string): Request | null {
  if (!token || request.headers.get('x-site-prerender') !== token) return null
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  // 东方站英文入口页 `/en` 的语言归西方站，但页面属于东方站（D5）
  const site =
    path === EAST_ENGLISH_PATH
      ? 'east'
      : (siteOfLocale(
          prefixLocale(path, templateConfig.i18n.locales) ?? templateConfig.i18n.defaultLocale,
          templateConfig,
        ) ?? 'west')
  url.host = templateConfig.sites[site].hosts[0] ?? url.host
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
  // 东方站根路径已由站点守卫跳转到语言首页（features/site/gate.ts），这里只会遇到西方站与关闭多语言时的根路径
  url.pathname = path === '/' ? '/index.html' : `${path}.html`
  url.search = ''
  const response = await fetchAsset(new Request(url, request))
  if (!response.ok) return null
  if (!new URL(request.url).searchParams.has('r')) return response
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex, nofollow')
  return result
}
