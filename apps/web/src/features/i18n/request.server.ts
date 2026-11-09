import { AppError } from '@xuanxue/shared'
import { baseLocale, cookieName, isLocale, type Locale } from '../../paraglide/runtime.js'
import { paraglideMiddleware } from '../../paraglide/server.js'
import type { WebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { resolveSite } from '../site/site.ts'
import { eastLocale } from './east-home.ts'
import { languageUrl, localeCookie, readCookie, usesAccountLocale } from './preference.ts'
import { readRequestSession, withSessionCache } from './session.server.ts'

/** 中间件内用修改后的 Cookie 决定语言，交给路由器的仍是原地址与原请求头。 */
export function localizeRequest(
  request: Request,
  runtime: Pick<WebRuntime, 'db' | 'auth'>,
  next: () => Response | Promise<Response>,
): Promise<Response> {
  // 单语言构建只使用 baseLocale，不读取账号或 Cookie，也不按 URL 自动跳转。
  if (!templateConfig.i18n.enabled) return paraglideMiddleware(request, next)
  const url = new URL(request.url)
  // 认证端点可能修改会话；不读取、不缓存会话，也不改 Cookie。
  if (url.pathname.startsWith('/api/')) return paraglideMiddleware(request, next)
  const run = request.method === 'GET' ? withSessionCache : <T>(handle: () => T) => handle()
  return run(async () => {
    const source = languageUrl(request)
    let locale: Locale | undefined
    if (usesAccountLocale(source)) {
      try {
        const fresh = await readRequestSession({
          auth: runtime.auth,
          db: runtime.db,
          headers: request.headers,
        })
        locale = accountLocale(fresh.user.locale, request)
      } catch (error) {
        if (!(error instanceof AppError && [401, 403].includes(error.status))) throw error
        // 未登录时应用区按 Cookie 取语言；Cookie 是另一站的语言（旧版同域名下切换过语言、
        // 账号语言曾被同步到本站）时不能沿用，否则 `/app` 的登录跳转会生成 `/zh-hans/login` 这类
        // 本站不存在的地址。改用本站回退语言并更正 Cookie。
        const current = readCookie(request.headers.get('cookie') ?? '', cookieName)
        if (current !== undefined && !ownsLocale(current, request))
          locale = accountLocale(undefined, request)
      }
    }
    const headers = new Headers(request.headers)
    if (locale) {
      const cookies = (headers.get('cookie') ?? '')
        .split(';')
        .filter((part) => !part.trim().startsWith(`${cookieName}=`))
      headers.set('cookie', [...cookies, `${cookieName}=${locale}`].join('; '))
    }
    // 此 Request 仅供语言识别；请求体只交给 next 内的原始请求消费。
    const localized = new Request(request.url, { headers, method: request.method })
    const response = await paraglideMiddleware(localized, next, { effectiveRequestUrl: source })
    if (locale) {
      // 账号语言同步给客户端水合；应用区响应不可被共享缓存。
      const result = new Response(response.body, response)
      result.headers.set('cache-control', 'private, no-store')
      if (readCookie(request.headers.get('cookie') ?? '', cookieName) !== locale)
        result.headers.append('set-cookie', localeCookie(locale, url.protocol === 'https:'))
      return result
    }
    return response
  })
}

/**
 * 应用区语言：账号保存的语言属于本站时采用；否则按本站规则回退。
 * 东方站没有英文应用区，未保存语言（或保存了另一站语言，如迁移出的副本账户）时
 * 与东方站无前缀页相同按 eastLocale 选择，不能落到 baseLocale（西方站英文）。
 * 未登记的 Host（staging / 预览）不限制站点语言。
 */
function accountLocale(saved: string | null | undefined, request: Request): Locale {
  const site = resolveSite(new URL(request.url).host, templateConfig)
  if (isLocale(saved) && ownsLocale(saved, request)) return saved
  if (site.id === 'east') {
    const east = eastLocale(request, templateConfig)
    if (isLocale(east)) return east
  }
  const fallback = templateConfig.sites[site.id].defaultLocale
  return isLocale(fallback) ? fallback : baseLocale
}

/** 语言属于请求 Host 对应的站点；未登记的 Host 接受全部已配置语言 */
function ownsLocale(locale: string, request: Request): boolean {
  const site = resolveSite(new URL(request.url).host, templateConfig)
  const own: readonly string[] = templateConfig.sites[site.id].locales
  return isLocale(locale) && (!site.known || own.includes(locale))
}
