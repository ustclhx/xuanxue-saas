import type { ToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * angel numbers 集合的地址（openspec content-growth-v2-tools 决策 2、20，specs/angel-number-pages）。
 * en 与 es 各自按本语言搜索词选数字（选择依据见证据目录 content-growth/v2/26/number-sets.md），集合可以不同；
 * 同一数字两种语言都有页面时互为 hreflang，只有一种语言时不声明另一种。
 * 只放字面量：西方内容路由映射、注册表、站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 * 已发布 = content/angel-numbers/<语言>/<数字>.mdx 存在；本表与内容文件一一对应（angel.test.tsx 与
 * scripts/check-content-angel-numbers.mjs 校验），枢纽与 hreflang 读内容集合，不读本表。
 */
export const ANGEL_LOCALES = ['en', 'es'] as const
export type AngelLocale = (typeof ANGEL_LOCALES)[number]

export const ANGEL_HUB_PATHS = {
  en: '/angel-numbers',
  es: '/numeros-angelicales',
} as const satisfies Record<AngelLocale, `/${string}`>

/** 各语言已发布的数字（字符串保留前导 0，如 `000`），顺序即枢纽分组内的顺序 */
export const ANGEL_NUMBERS = {
  en: [
    '000',
    '111',
    '222',
    '333',
    '444',
    '555',
    '666',
    '777',
    '888',
    '999',
    '1010',
    '1111',
    '1122',
    '1144',
    '1212',
    '1221',
    '1234',
    '1313',
    '1414',
    '1515',
    '2020',
    '2222',
    '3333',
    '4444',
    '5555',
    '123',
    '711',
    '717',
    '818',
    '911',
  ],
  es: [
    '000',
    '111',
    '222',
    '333',
    '444',
    '555',
    '666',
    '777',
    '888',
    '999',
    '1001',
    '1010',
    '1111',
    '1212',
    '1221',
    '1313',
    '1717',
    '2121',
    '2222',
    '2323',
  ],
} as const satisfies Record<AngelLocale, readonly string[]>

export function isAngelLocale(locale: string): locale is AngelLocale {
  return (ANGEL_LOCALES as readonly string[]).includes(locale)
}

export const angelNumberPath = (locale: AngelLocale, number: string): `/${string}` =>
  `${ANGEL_HUB_PATHS[locale]}/${number}`

/** 枢纽与数字页在注册表、面包屑中的名称 */
export const ANGEL_HUB_TITLE: Readonly<Record<AngelLocale, string>> = {
  en: 'Angel Numbers',
  es: 'Números angelicales',
}
export const angelNumberTitle = (locale: AngelLocale, number: string) =>
  locale === 'en' ? `Angel Number ${number}` : `Número angelical ${number}`

const publishedIn = (number: string) =>
  ANGEL_LOCALES.filter((locale) => (ANGEL_NUMBERS[locale] as readonly string[]).includes(number))

/** 页面 id：`index`（枢纽）或数字本身 */
export const ANGEL_CONTENT_ROUTES: readonly WestContentRoute[] = ANGEL_LOCALES.flatMap((locale) => [
  { locale, path: ANGEL_HUB_PATHS[locale], collection: 'angel-numbers' as const, id: 'index' },
  ...ANGEL_NUMBERS[locale].map((number) => ({
    locale,
    path: angelNumberPath(locale, number),
    collection: 'angel-numbers' as const,
    id: number,
  })),
])

const ALL_NUMBERS = [...new Set<string>([...ANGEL_NUMBERS.en, ...ANGEL_NUMBERS.es])]

/**
 * 注册表条目：枢纽进「全部工具」的 numerology 分组（设计稿 HubWestB），不进页头下拉（页头只列首页精选）；
 * 数字页 nav: false。数字页的 paths 只含已发布该数字的语言，hreflang 因此不指向未发布的对应页。
 * SEO 标题与描述由 seo-pages.ts 按内容集合补上。
 */
export const ANGEL_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'angel-numbers',
    site: 'west',
    paths: { ...ANGEL_HUB_PATHS },
    titles: { ...ANGEL_HUB_TITLE },
    descriptions: {
      en: 'Repeating sequences such as 111 and 1212, number by number.',
      es: 'Secuencias repetidas como 111 o 1212, número por número.',
    },
    directoryGroup: 'numerology',
    freeLabel: 'free_lookup',
    badge: { kind: 'new', until: '2027-02-28' },
  },
  ...ALL_NUMBERS.map(
    (number): ToolRoute => ({
      id: `angel-number-${number}`,
      site: 'west',
      nav: false,
      paths: Object.fromEntries(
        publishedIn(number).map((locale) => [locale, angelNumberPath(locale, number)]),
      ),
      titles: Object.fromEntries(
        publishedIn(number).map((locale) => [locale, angelNumberTitle(locale, number)]),
      ),
      directoryGroup: 'numerology',
      freeLabel: 'free_lookup',
    }),
  ),
]
