import type { SeoPage } from '../../seo/metadata.ts'
import { isSignKey, parsePairSlug } from './facts.ts'
import {
  pairName,
  pairPath,
  signName,
  signPath,
  ZODIAC_COMPAT_PATH,
  ZODIAC_SIGNS_PATH,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 westernZodiac 集合） */
export interface WesternZodiacSeoEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly description: string
}

/**
 * 西方星座页进入公开页面清单（站点地图、内链区块与静态校验）。层级：
 * 首页 › Zodiac Signs › Aries；首页 › Zodiac Compatibility › Aries and Leo。
 * 档案页同组（枢纽为组页）；配对页的「同组」由页面按星座自选，不声明 group。只有 en，不声明 alternates。
 */
export function westernZodiacSeoPages(entries: readonly WesternZodiacSeoEntry[]): SeoPage[] {
  return entries.flatMap((entry): SeoPage[] => {
    if (entry.locale !== 'en') return []
    const base = {
      locale: 'en',
      site: 'west' as const,
      title: entry.title,
      description: entry.description,
    }
    if (entry.key === 'index')
      return [{ ...base, path: ZODIAC_SIGNS_PATH, titleMain: 'Zodiac Signs', parent: '/' }]
    if (entry.key === 'compatibility')
      return [{ ...base, path: ZODIAC_COMPAT_PATH, titleMain: 'Zodiac Compatibility', parent: '/' }]
    if (isSignKey(entry.key))
      return [
        {
          ...base,
          path: signPath(entry.key),
          titleMain: signName(entry.key),
          parent: ZODIAC_SIGNS_PATH,
          group: ZODIAC_SIGNS_PATH,
        },
      ]
    const pair = parsePairSlug(entry.key)
    if (!pair) return []
    return [
      {
        ...base,
        path: pairPath(...pair),
        titleMain: pairName(...pair),
        parent: ZODIAC_COMPAT_PATH,
      },
    ]
  })
}
