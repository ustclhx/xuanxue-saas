/**
 * 邮件语言：按收件人的 `user.locale` 选择；构建时校验模板支持所有配置语言。
 */
export const EMAIL_LOCALES = ['en', 'zh-Hant', 'zh-Hans', 'ko', 'ja'] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]
export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'en'

/** 简体中文的地区标签（`zh-CN`、`zh-SG`）；其余中文标签（`zh`、`zh-TW`、`zh-HK`）归为繁体 */
const SIMPLIFIED_REGIONS = new Set(['zh-hans', 'zh-cn', 'zh-sg'])

/**
 * 中文按地区归入简体或繁体（与 `preferredLocale` 一致：`zh-CN`、`zh-SG` 归 zh-Hans，其余中文归 zh-Hant）；
 * 其他语言按主标签匹配，`ko-KR` 归为 ko；未设置或不支持的语言回退到模板默认语言。
 */
export function resolveEmailLocale(
  locale: string | null | undefined,
  defaultLocale: string = DEFAULT_EMAIL_LOCALE,
): EmailLocale {
  const tag = locale?.trim().toLowerCase().replace('_', '-') ?? ''
  const language = tag.split('-')[0]
  if (language === 'zh') return SIMPLIFIED_REGIONS.has(tag) ? 'zh-Hans' : 'zh-Hant'
  return (
    matchLanguageTag(tag, EMAIL_LOCALES) ??
    EMAIL_LOCALES.find((l) => l === defaultLocale) ??
    DEFAULT_EMAIL_LOCALE
  )
}

const REGION = /^(?:[a-z]{2}|\d{3})$/

/**
 * 按主语言匹配（`es-MX` → `es`、`ja-JP` → `ja`）。带地区的语言（`pt-BR`）只匹配同地区或不带地区的标签：
 * `pt`、`pt-BR` → `pt-BR`，`pt-PT` 不匹配（openspec add-locales-eu-ja tasks 1.7）。`tag` 须为小写、连字符分隔。
 */
export function matchLanguageTag<L extends string>(
  tag: string,
  locales: readonly L[],
): L | undefined {
  const [language, ...rest] = tag.split('-')
  const region = rest.find((part) => REGION.test(part))
  return locales.find((locale) => {
    const [own, ...parts] = locale.toLowerCase().split('-')
    const ownRegion = parts.find((part) => REGION.test(part))
    return own === language && (!ownRegion || !region || ownRegion === region)
  })
}
