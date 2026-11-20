import { baseLocale, cookieName, type Locale, locales, toLocale } from '../../paraglide/runtime.js'
import { isAppAreaPath } from './app-area.ts'

// 与 Paraglide 自动同步的 Cookie 分开，只有手动选择 / 关闭建议才记为已选择。
export const PREFERENCE_COOKIE = 'locale-preference'
/** 语言 Cookie 的有效期（秒）；首帧前脚本（suggestion.ts）写同样的 Cookie */
export const LOCALE_COOKIE_MAX_AGE = 365 * 86400

export function readCookie(cookie: string, name: string): string | undefined {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export function localeCookie(locale: Locale, secure = false, name = cookieName): string {
  return `${name}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`
}

export function rememberLocale(locale: Locale): void {
  const secure = window.location.protocol === 'https:'
  // biome-ignore lint/suspicious/noDocumentCookie: 同步记住选择后立即导航，与 Paraglide 使用同一 Cookie。
  document.cookie = localeCookie(locale, secure)
  // biome-ignore lint/suspicious/noDocumentCookie: 同步保存已选择标记，避免刷新后重复建议。
  document.cookie = localeCookie(locale, secure, PREFERENCE_COOKIE)
}

/**
 * Accept-Language 按权重匹配配置语言；q=0 的语言不参与。项目保留（模板 0.5.10 已删除）：
 * 东方站根路径跳转（east-home.ts）与认证页语言（auth-locale.ts）在服务端使用。
 */
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
    // 先按完整标签匹配，再按主语言匹配：中文按地区归入简体 zh-Hans（zh-CN、zh-SG）或繁体 zh-Hant（其余），ko-KR 归入 ko
    const language = tag.split('-')[0] ?? ''
    const locale = toLocale(tag) ?? chineseLocale(tag, language) ?? languageLocale(tag, locales)
    if (locale) return locale
  }
  return baseLocale
}

/** 简体中文的地区标签；其余中文标签（zh、zh-TW、zh-HK）归入繁体 */
const SIMPLIFIED_TAGS = new Set(['zh-hans', 'zh-cn', 'zh-sg'])

function chineseLocale(tag: string, language: string): Locale | undefined {
  if (language !== 'zh') return undefined
  const wanted = SIMPLIFIED_TAGS.has(tag) ? 'zh-Hans' : 'zh-Hant'
  return locales.find((locale) => locale === wanted)
}

const REGION = /^(?:[a-z]{2}|\d{3})$/

/**
 * 按主语言匹配（`ja-JP` → `ja`、`es-MX` → `es`）。带地区的配置语言（`pt-BR`）只匹配同地区或不带地区的标签：
 * `pt` → `pt-BR`，`pt-PT` 不匹配（openspec add-locales-eu-ja tasks 1.7；与 @xuanxue/email 的 matchLanguageTag 相同）。
 */
export function languageLocale<L extends string>(tag: string, list: readonly L[]): L | undefined {
  const [language, ...rest] = tag.toLowerCase().split('-')
  const region = rest.find((part) => REGION.test(part))
  return list.find((locale) => {
    const [own, ...parts] = locale.toLowerCase().split('-')
    const ownRegion = parts.find((part) => REGION.test(part))
    return own === language && (!ownRegion || !region || ownRegion === region)
  })
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
