import type { SeoPage } from '../../seo/metadata.ts'
import {
  isYearlyLocale,
  isYearlyYear,
  type YearlyKey,
  type YearlyLocale,
  type YearlyYear,
  yearlyPath,
  yearlyTitle,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 yearly 集合） */
export interface YearlySeoEntry {
  readonly locale: string
  readonly year: number
  readonly key: string
  readonly title: string
  readonly description: string
}

/**
 * 年度生肖页进入公开页面清单（站点地图、hreflang、内链区块）：标题与描述取内容集合，
 * 层级为 首页 › 2027生肖运势 › 2027属X，子页同组（group 为枢纽地址）。
 * hreflang 只列出有撰写版本、且地址已登记的语言（yearly-outlook-pages「四种语言互为 hreflang」）：
 * 按年份与 `key` 在各语言内容中配对。东方站根路径英文与中日韩同属东方站，显式声明 site。
 */
export function yearlySeoPages(entries: readonly YearlySeoEntry[]): SeoPage[] {
  const published = entries.filter(
    (entry) =>
      isYearlyLocale(entry.locale) &&
      isYearlyYear(entry.year) &&
      yearlyPath(entry.locale, entry.year, entry.key as YearlyKey | 'index') !== undefined,
  )
  return published.map((entry) => {
    const locale = entry.locale as YearlyLocale
    const year = entry.year as YearlyYear
    const key = entry.key as YearlyKey | 'index'
    const alternates: Record<string, string> = Object.fromEntries(
      published
        .filter((other) => other.key === entry.key && other.year === entry.year)
        .map((other) => [other.locale, yearlyPath(other.locale as YearlyLocale, year, key) ?? '']),
    )
    const hub = yearlyPath(locale, year, 'index') as string
    const common = {
      locale,
      site: 'east' as const,
      title: entry.title,
      description: entry.description,
      titleMain: yearlyTitle(locale, year, key),
      alternates,
    }
    return key === 'index'
      ? { ...common, path: hub, parent: '/' }
      : { ...common, path: yearlyPath(locale, year, key) as string, parent: hub, group: hub }
  })
}
