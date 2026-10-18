import { localeUrlSegment } from '@xuanxue/config'

/**
 * 语言前缀（openspec add-dual-site-foundation 决策 2）：URL 中使用小写语言 id（`zh-Hant` → `/zh-hant`），
 * 与 Paraglide 的 urlPatterns（scripts/i18n-project.ts）一致；大小写不同的写法不是语言前缀。
 * vite 配置与预渲染范围也引用这里，因此不引用任何运行时模块。
 */
export function localePrefix(locale: string): string {
  return `/${localeUrlSegment(locale)}`
}

/** 路径首段对应的语言；首段不是任何语言前缀时返回 undefined */
export function prefixLocale<L extends string>(
  pathname: string,
  locales: readonly L[],
): L | undefined {
  const first = pathname.split('/')[1] ?? ''
  return locales.find((locale) => localeUrlSegment(locale) === first)
}
