import type { SeoPage } from '../../seo/metadata.ts'
import {
  isZodiacHubLocale,
  isZodiacLocale,
  ZODIAC_HUB_PATHS,
  ZODIAC_SLUGS,
  type ZodiacHubLocale,
  type ZodiacKey,
  type ZodiacLocale,
  zodiacHubPath,
  zodiacHubTitle,
  zodiacPath,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 zodiac 集合） */
export interface ZodiacSeoEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly description: string
}

/**
 * 生肖页进入公开页面清单（站点地图、hreflang、内链区块）：标题与描述取内容集合，
 * 层级为 首页 › 十二生肖 › 属X，子页同组（group 为枢纽地址，同组区块轮转列出其他生肖）。
 * hreflang 只列出有撰写版本的语言（ML-04、ML-05）：按 `key` 在各语言内容中配对。
 */
export function zodiacSeoPages(entries: readonly ZodiacSeoEntry[]): SeoPage[] {
  // 东方站英文只有枢纽（第 11 组），与中文、ko 枢纽互为 hreflang
  const published = entries.filter(
    (entry) =>
      isZodiacLocale(entry.locale) || (isZodiacHubLocale(entry.locale) && entry.key === 'index'),
  )
  return published.map((entry) => {
    const key = entry.key as ZodiacKey | 'index'
    const alternates = Object.fromEntries(
      published
        .filter((other) => other.key === entry.key)
        .map((other) => [
          other.locale,
          key === 'index'
            ? zodiacHubPath(other.locale as ZodiacHubLocale)
            : zodiacPath(other.locale as ZodiacLocale, key),
        ]),
    )
    if (key === 'index') {
      const hubLocale = entry.locale as ZodiacHubLocale
      return {
        path: zodiacHubPath(hubLocale),
        locale: hubLocale,
        // 东方站根路径英文的语言归属站点是西方站，须显式声明
        ...(hubLocale === 'en' ? { site: 'east' as const } : {}),
        title: entry.title,
        description: entry.description,
        titleMain: zodiacHubTitle(hubLocale),
        parent: '/',
        alternates,
      }
    }
    const locale = entry.locale as ZodiacLocale
    const hub = ZODIAC_HUB_PATHS[locale]
    return {
      path: zodiacPath(locale, key),
      locale,
      title: entry.title,
      description: entry.description,
      titleMain: ZODIAC_SLUGS[locale][key],
      parent: hub,
      group: hub,
      alternates,
    }
  })
}
