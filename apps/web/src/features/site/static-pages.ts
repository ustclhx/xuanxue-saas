import { templateConfig } from '../../server/template-config.ts'
import { prefixLocale } from '../i18n/url-prefix.ts'
import { EAST_ENTRY_PATH, isPrerenderedPath } from '../marketing/prerender.ts'
import { resolveSite, siteOfLocale } from './site.ts'

/** 构建期用仅存在于本地 preview 的随机令牌授权内部入口，并按语言还原真实站点 Host。 */
export function prerenderRequest(request: Request, token?: string): Request | null {
  if (!token || request.headers.get('x-site-prerender') !== token) return null
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const site =
    path === EAST_ENTRY_PATH
      ? 'east'
      : (siteOfLocale(
          prefixLocale(path, templateConfig.i18n.locales) ?? templateConfig.i18n.defaultLocale,
          templateConfig,
        ) ?? 'west')
  url.host = templateConfig.sites[site].hosts[0] ?? url.host
  if (path === EAST_ENTRY_PATH) url.pathname = '/'
  return new Request(url, request)
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
  url.pathname =
    path === '/'
      ? site.id === 'east' && templateConfig.i18n.enabled
        ? `${EAST_ENTRY_PATH}.html`
        : '/index.html'
      : `${path}.html`
  url.search = ''
  const response = await fetchAsset(new Request(url, request))
  if (!response.ok) return null
  if (!new URL(request.url).searchParams.has('r')) return response
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', 'noindex, nofollow')
  return result
}
