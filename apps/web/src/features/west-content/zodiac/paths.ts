import type { ToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'
import { PAIRS, SIGN_KEYS, type SignKey } from './facts.ts'

/**
 * 西方星座集合的地址（openspec content-growth-v2-tools 决策 2、12）：只有 en。
 * 路由映射、注册表、站点地图与预渲染都读这里；本文件随入口包加载，只放由事实表生成的字面量。
 */
export const ZODIAC_SIGNS_PATH = '/zodiac-signs'
export const ZODIAC_COMPAT_PATH = '/zodiac-compatibility'

export const signPath = (key: SignKey) => `${ZODIAC_SIGNS_PATH}/${key}`
export const pairPath = (a: SignKey, b: SignKey) => `${ZODIAC_COMPAT_PATH}/${a}-and-${b}`

const cap = (key: string) => key[0]?.toUpperCase() + key.slice(1)
export const signName = (key: SignKey) => cap(key)
export const pairName = (a: SignKey, b: SignKey) => `${signName(a)} and ${signName(b)}`

/** 页面 id：`index`（枢纽）、`chart`（总表）、星座 key、配对 `<a>-and-<b>` */
export const WESTERN_ZODIAC_CONTENT_ROUTES: readonly WestContentRoute[] = [
  { locale: 'en', path: ZODIAC_SIGNS_PATH, collection: 'zodiac', id: 'index' },
  ...SIGN_KEYS.map((key) => ({
    locale: 'en' as const,
    path: signPath(key) as `/${string}`,
    collection: 'zodiac' as const,
    id: key,
  })),
  { locale: 'en', path: ZODIAC_COMPAT_PATH, collection: 'zodiac', id: 'chart' },
  ...PAIRS.map(([a, b]) => ({
    locale: 'en' as const,
    path: pairPath(a, b) as `/${string}`,
    collection: 'zodiac' as const,
    id: `${a}-and-${b}`,
  })),
]

/**
 * 注册表条目：枢纽与总表进页头工具下拉，档案页与配对页 nav: false。
 * SEO 标题与描述由 seo-pages.ts 按内容集合补上；注册表只放路径与导航名。
 */
export const WESTERN_ZODIAC_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'western-zodiac-signs',
    site: 'west',
    paths: { en: ZODIAC_SIGNS_PATH },
    titles: { en: 'Zodiac Signs' },
    descriptions: {
      en: 'All 12 zodiac signs with their dates, element, modality and ruling planet, plus the traditional traits each sign is linked with.',
    },
    directoryGroup: 'astrology',
    freeLabel: 'free_lookup',
  },
  ...SIGN_KEYS.map(
    (key): ToolRoute => ({
      id: `western-zodiac-sign-${key}`,
      site: 'west',
      nav: false,
      paths: { en: signPath(key) },
      titles: { en: signName(key) },
      directoryGroup: 'astrology',
      freeLabel: 'free_lookup',
    }),
  ),
  {
    id: 'western-zodiac-compatibility',
    site: 'west',
    paths: { en: ZODIAC_COMPAT_PATH },
    titles: { en: 'Zodiac Compatibility' },
    descriptions: {
      en: 'How any two signs relate by element, modality and aspect, with a 12×12 chart covering all 78 sign pairs.',
    },
    directoryGroup: 'compatibility',
    freeLabel: 'free_compatibility',
    badge: { kind: 'new', until: '2027-02-28' },
  },
  ...PAIRS.map(
    ([a, b]): ToolRoute => ({
      id: `western-zodiac-pair-${a}-${b}`,
      site: 'west',
      nav: false,
      paths: { en: pairPath(a, b) },
      titles: { en: pairName(a, b) },
      directoryGroup: 'compatibility',
      freeLabel: 'free_compatibility',
    }),
  ),
]
