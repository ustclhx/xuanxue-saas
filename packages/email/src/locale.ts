/**
 * 邮件语言：按收件人的 `user.locale` 选择；构建时校验模板支持所有配置语言。
 */
export const EMAIL_LOCALES = ['en', 'zh-Hant', 'ko'] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]
export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'en'

/**
 * 按语言主标签匹配：`zh`、`zh-TW`、`zh_Hant` 等归为 zh-Hant（中文只提供繁体），`ko-KR` 归为 ko；
 * 未设置或不支持的语言回退到模板默认语言。
 */
export function resolveEmailLocale(
  locale: string | null | undefined,
  defaultLocale: string = DEFAULT_EMAIL_LOCALE,
): EmailLocale {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0]
  return (
    EMAIL_LOCALES.find((l) => l.toLowerCase().split('-')[0] === language) ??
    EMAIL_LOCALES.find((l) => l === defaultLocale) ??
    DEFAULT_EMAIL_LOCALE
  )
}
