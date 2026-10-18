import { baseLocale, cookieName, type Locale, locales, toLocale } from '../../paraglide/runtime.js'
import { isAppAreaPath } from './app-area.ts'

// 与 Paraglide 自动同步的 Cookie 分开，只有手动选择 / 关闭建议才记为已选择。
export const PREFERENCE_COOKIE = 'locale-preference'
const MAX_AGE = 365 * 86400

export function readCookie(cookie: string, name: string): string | undefined {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export function localeCookie(locale: Locale, secure = false, name = cookieName): string {
  return `${name}=${locale}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`
}

export function rememberLocale(locale: Locale): void {
  const secure = window.location.protocol === 'https:'
  // biome-ignore lint/suspicious/noDocumentCookie: 同步记住选择后立即导航，与 Paraglide 使用同一 Cookie。
  document.cookie = localeCookie(locale, secure)
  // biome-ignore lint/suspicious/noDocumentCookie: 同步保存已选择标记，避免刷新后重复建议。
  document.cookie = localeCookie(locale, secure, PREFERENCE_COOKIE)
}

/** Accept-Language 按权重匹配配置语言；不跳转，q=0 的语言不参与建议。 */
export function preferredLocale(header: string | null): Locale {
  const preferences = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';')
      const weight = params.find((param) => param.trim().startsWith('q='))
      const q = weight ? Number(weight.trim().slice(2)) : 1
      return { tag: tag.toLowerCase(), q }
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of preferences) {
    if (tag === '*') return baseLocale
    // 先按完整标签匹配，再按主语言匹配：zh-TW / zh-CN 都归入唯一的中文 zh-Hant，ko-KR 归入 ko
    const language = tag.split('-')[0]
    const locale =
      toLocale(tag) ?? locales.find((locale) => locale.toLowerCase().split('-')[0] === language)
    if (locale) return locale
  }
  return baseLocale
}

/** Server Functions 复用同源来源页的语言；不接受跨站来源影响本次语言。 */
export function languageUrl(request: Request): URL {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/_serverFn/')) return url
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const source = new URL(referer)
      if (source.origin === url.origin) return source
    } catch {
      /* 非法外部头忽略，按 Cookie / 默认语言处理 */
    }
  }
  return url
}

export function usesAccountLocale(url: URL): boolean {
  return isAppAreaPath(url.pathname) || url.pathname.startsWith('/_serverFn/')
}
