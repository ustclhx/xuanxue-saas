import { localePrefix, prefixLocale } from '../i18n/url-prefix.ts'
import { type DailyLocale, dateKey, referenceDate, secondsUntilDayEnd } from './date.ts'
import { DAILY_PATHS } from './routes.ts'

/**
 * 公开每日页的边缘缓存（add-birth-profiles-daily-horoscope design D7）。
 *
 * - 只处理每日页的 GET；带会话 Cookie 的请求直接 SSR，不读也不写缓存，响应标记为 private；
 * - 匿名请求以「规范 URL + 参考日期」为键查缓存，参考时区跨过 00:00 后键随之变化，旧内容不再命中；
 * - 未命中时 SSR，只缓存 200 的 HTML，去掉 Set-Cookie 后写入，TTL 为距参考日结束的秒数且不超过 3600；
 * - 响应带 `Vary: Cookie`，避免下游缓存把匿名版本给已登录用户。
 *
 * 存储以接口注入（server.ts 传入 Workers 的 `caches.default`），便于单测。
 */

export interface DailyCacheStore {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export interface DailyCacheDeps {
  readonly cache: DailyCacheStore | undefined
  /** 写缓存放到响应之后（Workers 的 ctx.waitUntil） */
  readonly waitUntil?: (promise: Promise<unknown>) => void
  /** 命中缓存时补安全头（缓存的 HTML 不带本次请求的 nonce，按脚本哈希授权） */
  readonly secure?: (response: Response) => Promise<Response>
  readonly now?: Date
}

/** 自定义头：验收时据此确认第二次请求命中缓存 */
export const DAILY_CACHE_HEADER = 'x-daily-cache'
export const MAX_TTL_SECONDS = 3600

/** 请求路径对应的每日页语言；不是每日页时返回 null。路径可能带语言前缀且保留百分号编码 */
export function dailyPageLocale(pathname: string, locales: readonly string[]): DailyLocale | null {
  let decoded = pathname
  try {
    decoded = decodeURI(pathname)
  } catch {
    return null
  }
  const path = decoded.replace(/\/+$/, '') || '/'
  const locale = prefixLocale(path, locales)
  const rest = locale ? path.slice(localePrefix(locale).length) || '/' : path
  for (const [language, dailyPath] of Object.entries(DAILY_PATHS)) {
    // 无前缀地址只属于英语（西方站默认语言）；带前缀时语言必须与路径一致
    if (dailyPath === rest && (locale ? locale === language : language === 'en'))
      return language as DailyLocale
  }
  return null
}

/** 会话 Cookie（better-auth 的 session_token / session_data，含 __Secure- 前缀） */
export function hasSessionCookie(cookie: string | null): boolean {
  if (!cookie) return false
  return cookie
    .split(';')
    .some((part) => /session_(?:token|data)$/i.test(part.split('=')[0]?.trim() ?? ''))
}

export function dailyTtl(locale: DailyLocale, now: Date): number {
  return Math.min(MAX_TTL_SECONDS, secondsUntilDayEnd(locale, now))
}

/** 缓存键：去掉查询串与片段的规范地址 + 参考日期 */
export function dailyCacheKey(url: URL, locale: DailyLocale, now: Date): Request {
  const key = new URL(url.origin + url.pathname)
  key.searchParams.set('daily', dateKey(referenceDate(locale, now)))
  return new Request(key.href, { method: 'GET' })
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const result = new Response(response.body, response)
  for (const [name, value] of Object.entries(headers)) result.headers.set(name, value)
  return result
}

/**
 * 每日页请求走缓存；不是每日页的 GET 请求时返回 null，由调用方继续原有处理。
 * `render` 是完整的 SSR 处理（语言识别与路由）。
 */
export async function dailyPageCache(
  request: Request,
  locales: readonly string[],
  deps: DailyCacheDeps,
  render: () => Promise<Response>,
): Promise<Response | null> {
  if (request.method !== 'GET') return null
  const url = new URL(request.url)
  const locale = dailyPageLocale(url.pathname, locales)
  if (!locale) return null
  if (hasSessionCookie(request.headers.get('cookie')) || !deps.cache) {
    const response = await render()
    return hasSessionCookie(request.headers.get('cookie'))
      ? withHeaders(response, { 'cache-control': 'private, no-store', vary: 'Cookie' })
      : response
  }
  const now = deps.now ?? new Date()
  const key = dailyCacheKey(url, locale, now)
  const ttl = dailyTtl(locale, now)
  const cacheControl = `public, max-age=300, s-maxage=${ttl}`
  const hit = await deps.cache.match(key).catch(() => undefined)
  if (hit) {
    const response = withHeaders(hit, {
      'cache-control': cacheControl,
      vary: 'Cookie',
      [DAILY_CACHE_HEADER]: 'hit',
    })
    return deps.secure ? deps.secure(response) : response
  }
  const response = await render()
  if (
    response.status !== 200 ||
    !response.headers.get('content-type')?.includes('text/html') ||
    !response.body
  )
    return response
  const [forClient, forCache] = response.body.tee()
  const stored = new Response(forCache, response)
  stored.headers.delete('set-cookie')
  stored.headers.set('cache-control', `public, max-age=${ttl}`)
  stored.headers.set('vary', 'Cookie')
  const write = deps.cache.put(key, stored).catch(() => {
    // 缓存写入失败不影响本次响应
  })
  if (deps.waitUntil) deps.waitUntil(write)
  else await write
  return withHeaders(new Response(forClient, response), {
    'cache-control': cacheControl,
    vary: 'Cookie',
    [DAILY_CACHE_HEADER]: 'miss',
  })
}
