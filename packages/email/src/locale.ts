/**
 * 邮件语言：按收件人的 `user.locale` 选择；构建时校验模板支持所有配置语言。
 */
export const EMAIL_LOCALES = ['en', 'zh-Hant', 'zh-Hans', 'ko'] as const
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
    EMAIL_LOCALES.find((l) => l.toLowerCase().split('-')[0] === language) ??
    EMAIL_LOCALES.find((l) => l === defaultLocale) ??
    DEFAULT_EMAIL_LOCALE
  )
}
