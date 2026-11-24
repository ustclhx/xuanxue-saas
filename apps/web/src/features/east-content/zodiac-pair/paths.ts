import type { ToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'
import { ZODIAC_KEYS, ZODIAC_SLUGS, type ZodiacKey } from '../zodiac/paths.ts'

/**
 * 生肖配对集合的地址（openspec content-growth-v2-tools 决策 2、9）。只放字面量与纯函数：路由映射、注册表、
 * 站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 * 规范顺序按地支（子丑寅…），反序地址由 features/routing/pair-path.ts 301 到规范地址。
 * zh-Hans 由第 16 组发布；ko（띠궁합）、根路径英文（chinese-zodiac-compatibility）由第 17 组补内容后
 * 加入 ZODIAC_PAIR_PUBLISHED（en 另在 features/east-en/paths.ts 登记映射）。
 */
export type ZodiacPairLocale = 'zh-Hans' | 'ko' | 'en'

/** 已发布的语言：未写完的语言整组不发布，hreflang 只列这些语言（chinese-zodiac-pair-pages 规格） */
export const ZODIAC_PAIR_PUBLISHED: readonly ZodiacPairLocale[] = ['zh-Hans']

export const ZODIAC_PAIR_HUB_PATHS: Readonly<Record<ZodiacPairLocale, `/${string}`>> = {
  'zh-Hans': '/生肖配对',
  ko: '/띠궁합',
  en: '/chinese-zodiac-compatibility',
}

/** 总表的导航名与面包屑名 */
export const ZODIAC_PAIR_HUB_TITLES: Readonly<Record<ZodiacPairLocale, string>> = {
  'zh-Hans': '生肖配对',
  ko: '띠궁합',
  en: 'Chinese Zodiac Compatibility',
}

const EN_SLUGS: Readonly<Record<ZodiacKey, string>> = {
  zi: 'rat',
  chou: 'ox',
  yin: 'tiger',
  mao: 'rabbit',
  chen: 'dragon',
  si: 'snake',
  wu: 'horse',
  wei: 'goat',
  shen: 'monkey',
  you: 'rooster',
  xu: 'dog',
  hai: 'pig',
}

/** 各语言的生肖 slug 与两者之间的连接写法（与 pair-path.ts 的反序规则一致） */
const SIGN_SLUGS: Readonly<Record<ZodiacPairLocale, Readonly<Record<ZodiacKey, string>>>> = {
  'zh-Hans': ZODIAC_SLUGS['zh-Hans'],
  ko: ZODIAC_SLUGS.ko,
  en: EN_SLUGS,
}
const SEPARATORS: Readonly<Record<ZodiacPairLocale, string>> = {
  'zh-Hans': '和',
  ko: '-',
  en: '-and-',
}

/** 配对 key：两个地支 key 按地支顺序以连字符相连（`zi-chou`、`zi-zi`） */
export type ZodiacPairKey = `${ZodiacKey}-${ZodiacKey}`

/** 78 组配对（12 组同生肖 + 66 组不同生肖），按地支顺序 */
export const ZODIAC_PAIR_KEYS: readonly ZodiacPairKey[] = ZODIAC_KEYS.flatMap((a, index) =>
  ZODIAC_KEYS.slice(index).map((b): ZodiacPairKey => `${a}-${b}`),
)

export const isZodiacPairLocale = (locale: string): locale is ZodiacPairLocale =>
  Object.hasOwn(ZODIAC_PAIR_HUB_PATHS, locale)

export const isZodiacPairKey = (key: string): key is ZodiacPairKey =>
  (ZODIAC_PAIR_KEYS as readonly string[]).includes(key)

/** 任意顺序的两个地支 → 规范 key */
export function zodiacPairKey(a: ZodiacKey, b: ZodiacKey): ZodiacPairKey {
  return ZODIAC_KEYS.indexOf(a) <= ZODIAC_KEYS.indexOf(b) ? `${a}-${b}` : `${b}-${a}`
}

export function pairBranches(key: ZodiacPairKey): [ZodiacKey, ZodiacKey] {
  return key.split('-') as [ZodiacKey, ZodiacKey]
}

/** 配对页显示名（面包屑、相关配对与注册表标题）：zh-Hans 同 slug，ko「쥐띠와 소띠」，en「Rat and Ox」 */
const EN_NAMES: Readonly<Record<ZodiacKey, string>> = Object.fromEntries(
  Object.entries(EN_SLUGS).map(([key, slug]) => [key, `${slug[0]?.toUpperCase()}${slug.slice(1)}`]),
) as Record<ZodiacKey, string>
export function zodiacPairName(locale: ZodiacPairLocale, key: ZodiacPairKey): string {
  const [a, b] = pairBranches(key)
  if (locale === 'ko') return `${ZODIAC_SLUGS.ko[a]}와 ${ZODIAC_SLUGS.ko[b]}`
  if (locale === 'en') return `${EN_NAMES[a]} and ${EN_NAMES[b]}`
  return zodiacPairSlug(locale, key)
}

/** 配对页 slug 即主词（「属鼠和属牛」「쥐띠-소띠」「rat-and-ox」） */
export function zodiacPairSlug(locale: ZodiacPairLocale, key: ZodiacPairKey): string {
  const [a, b] = pairBranches(key)
  return `${SIGN_SLUGS[locale][a]}${SEPARATORS[locale]}${SIGN_SLUGS[locale][b]}`
}

export function zodiacPairPath(locale: ZodiacPairLocale, key: ZodiacPairKey | 'index'): string {
  const hub = ZODIAC_PAIR_HUB_PATHS[locale]
  return key === 'index' ? hub : `${hub}/${zodiacPairSlug(locale, key)}`
}

const routesOf = <L extends ZodiacPairLocale>(locale: L) => [
  {
    locale,
    path: zodiacPairPath(locale, 'index') as `/${string}`,
    collection: 'zodiac-pair' as const,
    id: 'index',
  },
  ...ZODIAC_PAIR_KEYS.map((key) => ({
    locale,
    path: zodiacPairPath(locale, key) as `/${string}`,
    collection: 'zodiac-pair' as const,
    id: key,
  })),
]

/** 某几种语言的内容路由（测试可传入未发布语言，验证登记后的地址与反序 301） */
export function zodiacPairContentRoutes(locales: readonly ZodiacPairLocale[]): {
  east: EastContentRoute[]
  eastEn: (EastContentRoute & { locale: 'en' })[]
} {
  return {
    east: locales
      .filter((locale): locale is Exclude<ZodiacPairLocale, 'en'> => locale !== 'en')
      .flatMap((locale) => routesOf(locale)),
    eastEn: locales.includes('en') ? routesOf('en' as const) : [],
  }
}

const PUBLISHED_ROUTES = zodiacPairContentRoutes(ZODIAC_PAIR_PUBLISHED)

/** 东方站中日韩的内容路由（features/east-content/routes.ts 引用） */
export const ZODIAC_PAIR_EAST_CONTENT_ROUTES: readonly EastContentRoute[] = PUBLISHED_ROUTES.east

/** 东方站根路径英文的内容路由（features/east-en/paths.ts 引用，第 17 组） */
export const ZODIAC_PAIR_EAST_EN_CONTENT_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] =
  PUBLISHED_ROUTES.eastEn

// 首页与「全部工具」卡片的一句话说明：沿用各语言总表页已审定的 SEO 描述（content/zodiac-pair/<locale>/index.mdx）
const HUB_DESCRIPTIONS: Readonly<Record<ZodiacPairLocale, string>> = {
  'zh-Hans':
    '生肖配对表收录十二生肖的七十八种组合。总表标出三合、六合、六冲与相害，各配对页补充相刑、相破、五行生克和出生年份，并说明这些传统关系该怎样读。',
  ko: '띠궁합 표에서 열두 띠의 78가지 조합을 한눈에 봅니다. 삼합, 육합, 충, 해를 표시했고 각 조합 페이지에서 형, 파, 오행 관계와 출생 연도를 함께 확인할 수 있습니다.',
  en: 'Chinese zodiac compatibility chart for all 78 pairs, marking three harmony, six harmony, clash and harm, with a page per pair on elements and birth years.',
}

const pathsOf = (key: ZodiacPairKey | 'index') =>
  Object.fromEntries(ZODIAC_PAIR_PUBLISHED.map((locale) => [locale, zodiacPairPath(locale, key)]))

/**
 * 注册表条目（预渲染、站点地图与 hreflang 读取）：总表进「全部工具」的关系分组（directoryGroup 由
 * registry.ts 补上），78 个配对页 nav: false。SEO 标题与描述由 zodiac-pair/seo-pages.ts 按内容集合补上。
 */
export const ZODIAC_PAIR_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'zodiac-pair',
    site: 'east',
    paths: pathsOf('index'),
    titles: Object.fromEntries(
      ZODIAC_PAIR_PUBLISHED.map((locale) => [locale, ZODIAC_PAIR_HUB_TITLES[locale]]),
    ),
    descriptions: Object.fromEntries(
      ZODIAC_PAIR_PUBLISHED.map((locale) => [locale, HUB_DESCRIPTIONS[locale]]),
    ),
    badge: { kind: 'new', until: '2027-02-28' },
  },
  ...ZODIAC_PAIR_KEYS.map(
    (key): ToolRoute => ({
      id: `zodiac-pair-${key}`,
      site: 'east',
      nav: false,
      paths: pathsOf(key),
      titles: Object.fromEntries(
        ZODIAC_PAIR_PUBLISHED.map((locale) => [locale, zodiacPairName(locale, key)]),
      ),
    }),
  ),
]
