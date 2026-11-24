import type { SeoPage } from '../../seo/metadata.ts'
import {
  ANGEL_HUB_PATHS,
  ANGEL_HUB_TITLE,
  type AngelLocale,
  angelNumberPath,
  angelNumberTitle,
  isAngelLocale,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 angelNumbers 集合） */
export interface AngelSeoEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly description: string
}

/** 某数字（或枢纽 `index`）已发布的语言：内容文件存在即已发布 */
export function publishedLocales(
  entries: readonly Pick<AngelSeoEntry, 'locale' | 'key'>[],
  key: string,
): AngelLocale[] {
  return entries
    .filter((entry) => entry.key === key)
    .map((entry) => entry.locale)
    .filter(isAngelLocale)
}

const pathOf = (locale: AngelLocale, key: string) =>
  key === 'index' ? ANGEL_HUB_PATHS[locale] : angelNumberPath(locale, key)

/**
 * angel numbers 页进入公开页面清单（站点地图、hreflang、内链区块与静态校验）。层级：
 * 首页 › Angel Numbers › 1111。数字页同组（枢纽为组页）。
 * hreflang（alternates）只列同一数字已发布的语言：es 没有的数字，其 en 页不含 es（specs/angel-number-pages）。
 * 始终声明 alternates（至少含自身），否则 alternateLinks 会按同路径推断出不存在的其他语言地址。
 */
export function angelSeoPages(entries: readonly AngelSeoEntry[]): SeoPage[] {
  return entries.flatMap((entry): SeoPage[] => {
    if (!isAngelLocale(entry.locale)) return []
    const locale = entry.locale
    const alternates = Object.fromEntries(
      publishedLocales(entries, entry.key).map((other) => [other, pathOf(other, entry.key)]),
    )
    const base = {
      locale,
      site: 'west' as const,
      title: entry.title,
      description: entry.description,
      alternates,
    }
    if (entry.key === 'index')
      return [
        { ...base, path: ANGEL_HUB_PATHS[locale], titleMain: ANGEL_HUB_TITLE[locale], parent: '/' },
      ]
    return [
      {
        ...base,
        path: angelNumberPath(locale, entry.key),
        titleMain: angelNumberTitle(locale, entry.key),
        parent: ANGEL_HUB_PATHS[locale],
        group: ANGEL_HUB_PATHS[locale],
      },
    ]
  })
}
