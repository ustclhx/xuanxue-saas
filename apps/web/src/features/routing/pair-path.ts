import type { SiteId } from '@xuanxue/config'
import { ZODIAC_KEYS, ZODIAC_SLUGS } from '../east-content/zodiac/paths.ts'

const EAST_EN_SLUGS = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'goat',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const

export const WESTERN_ZODIAC_SLUGS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const

const PAIR_PATHS = [
  {
    site: 'east',
    locale: 'zh-Hans',
    section: '生肖配对',
    separator: '和',
    order: ZODIAC_KEYS.map((key) => ZODIAC_SLUGS['zh-Hans'][key]),
  },
  {
    site: 'east',
    locale: 'ko',
    section: '띠궁합',
    separator: '-',
    order: ZODIAC_KEYS.map((key) => ZODIAC_SLUGS.ko[key]),
  },
  {
    site: 'east',
    locale: 'en',
    section: 'chinese-zodiac-compatibility',
    separator: '-and-',
    order: EAST_EN_SLUGS,
  },
  {
    site: 'west',
    locale: 'en',
    section: 'zodiac-compatibility',
    separator: '-and-',
    order: WESTERN_ZODIAC_SLUGS,
  },
] satisfies readonly {
  site: SiteId
  locale: string
  section: string
  separator: string
  order: readonly string[]
}[]

/** 只解析受支持的反序地址；是否已有规范页由各站路由表判断。 */
export function reversedPairPath(site: SiteId, locale: string, path: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURI(path)
  } catch {
    return undefined
  }
  const [, section, item, ...rest] = decoded.split('/')
  if (!item || rest.length) return undefined
  const pair = PAIR_PATHS.find(
    (entry) => entry.site === site && entry.locale === locale && entry.section === section,
  )
  if (!pair) return undefined

  const parts = item.split(pair.separator)
  const order: readonly string[] = pair.order
  const first = order.indexOf(parts[0] ?? '')
  const second = order.indexOf(parts[1] ?? '')
  if (parts.length === 2 && second >= 0 && first > second)
    return `/${section}/${parts[1]}${pair.separator}${parts[0]}`
}
