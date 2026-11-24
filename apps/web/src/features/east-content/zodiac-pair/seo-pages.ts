import type { SeoPage } from '../../seo/metadata.ts'
import {
  isZodiacPairKey,
  isZodiacPairLocale,
  ZODIAC_PAIR_HUB_PATHS,
  ZODIAC_PAIR_HUB_TITLES,
  ZODIAC_PAIR_PUBLISHED,
  type ZodiacPairKey,
  type ZodiacPairLocale,
  zodiacPairName,
  zodiacPairPath,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 zodiacPair 集合） */
export interface ZodiacPairSeoEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly description: string
}

/**
 * 配对页进入公开页面清单（站点地图、hreflang、面包屑）：标题与描述取内容集合，层级为 首页 › 生肖配对 › 属X和属Y（ko「쥐띠와 소띠」、en「Rat and Ox」）。
 * 只收已发布语言（测试可传入 `locales`）；hreflang 按 `key` 在已发布语言的内容中配对（chinese-zodiac-pair-pages「语言范围与上线次序」）。
 * 同组区块不用：配对页的相关配对与上一对/下一对由页面按引擎关系生成。
 */
export function zodiacPairSeoPages(
  entries: readonly ZodiacPairSeoEntry[],
  locales: readonly ZodiacPairLocale[] = ZODIAC_PAIR_PUBLISHED,
): SeoPage[] {
  const published = entries.filter(
    (entry) =>
      isZodiacPairLocale(entry.locale) &&
      locales.includes(entry.locale) &&
      (entry.key === 'index' || isZodiacPairKey(entry.key)),
  )
  return published.map((entry) => {
    const locale = entry.locale as ZodiacPairLocale
    const key = entry.key as ZodiacPairKey | 'index'
    const alternates = Object.fromEntries(
      published
        .filter((other) => other.key === entry.key)
        .map((other) => [other.locale, zodiacPairPath(other.locale as ZodiacPairLocale, key)]),
    )
    const hub = ZODIAC_PAIR_HUB_PATHS[locale]
    const base = {
      locale,
      title: entry.title,
      description: entry.description,
      site: 'east' as const,
      alternates,
    }
    return key === 'index'
      ? { ...base, path: hub, titleMain: ZODIAC_PAIR_HUB_TITLES[locale], parent: '/' }
      : {
          ...base,
          path: zodiacPairPath(locale, key),
          titleMain: zodiacPairName(locale, key),
          parent: hub,
        }
  })
}
