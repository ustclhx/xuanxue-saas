import type { SeoPage } from '../../seo/metadata.ts'
import {
  isZodiacLocale,
  ZODIAC_HUB_PATHS,
  ZODIAC_HUB_TITLES,
  ZODIAC_SLUGS,
  type ZodiacKey,
  type ZodiacLocale,
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
  const published = entries.filter((entry) => isZodiacLocale(entry.locale))
  return published.map((entry) => {
    const locale = entry.locale as ZodiacLocale
    const key = entry.key as ZodiacKey | 'index'
    const alternates = Object.fromEntries(
      published
        .filter((other) => other.key === entry.key)
        .map((other) => [other.locale, zodiacPath(other.locale as ZodiacLocale, key)]),
    )
    const hub = ZODIAC_HUB_PATHS[locale]
    return key === 'index'
      ? {
          path: hub,
          locale,
          title: entry.title,
          description: entry.description,
          titleMain: ZODIAC_HUB_TITLES[locale],
          parent: '/',
          alternates,
        }
      : {
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
