import type { ToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 生肖集合的地址（openspec content-growth-phase2 决策 1）。只放字面量：路由映射、注册表、
 * 站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 * zh-hans 由第 4 组登记；ko（`/띠`、`/띠/쥐띠` …）由第 5 组在各表补一列。
 */
export const ZODIAC_KEYS = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
] as const
export type ZodiacKey = (typeof ZODIAC_KEYS)[number]

export type ZodiacLocale = 'zh-Hans' | 'ko'

export const ZODIAC_HUB_PATHS: Readonly<Record<ZodiacLocale, string>> = {
  'zh-Hans': '/生肖',
  ko: '/띠',
}

/** 子页 slug 即主词（「属鼠」） */
export const ZODIAC_SLUGS: Readonly<Record<ZodiacLocale, Readonly<Record<ZodiacKey, string>>>> = {
  'zh-Hans': {
    zi: '属鼠',
    chou: '属牛',
    yin: '属虎',
    mao: '属兔',
    chen: '属龙',
    si: '属蛇',
    wu: '属马',
    wei: '属羊',
    shen: '属猴',
    you: '属鸡',
    xu: '属狗',
    hai: '属猪',
  },
  // ko 主词「쥐띠」…「돼지띠」（design 决策 1、9）
  ko: {
    zi: '쥐띠',
    chou: '소띠',
    yin: '호랑이띠',
    mao: '토끼띠',
    chen: '용띠',
    si: '뱀띠',
    wu: '말띠',
    wei: '양띠',
    shen: '원숭이띠',
    you: '닭띠',
    xu: '개띠',
    hai: '돼지띠',
  },
}

/** 枢纽页的导航名（页头「历法与生肖」分组与面包屑） */
export const ZODIAC_HUB_TITLES: Readonly<Record<ZodiacLocale, string>> = {
  'zh-Hans': '十二生肖',
  ko: '띠',
}

export const isZodiacLocale = (locale: string): locale is ZodiacLocale =>
  Object.hasOwn(ZODIAC_HUB_PATHS, locale)

/**
 * 东方站根路径英文只有枢纽 `/chinese-zodiac`（content-growth-v2-tools 决策 6、13，第 11 组）：12 个 en 生肖基础页本期不做，
 * 总表与查询结果改链 2027 年度页。地址交给 `features/east-en/paths.ts` 分发。
 */
export const ZODIAC_EN_HUB_PATH = '/chinese-zodiac'
export const ZODIAC_EN_HUB_TITLE = 'Chinese Zodiac'
export type ZodiacHubLocale = ZodiacLocale | 'en'
export const isZodiacHubLocale = (locale: string): locale is ZodiacHubLocale =>
  locale === 'en' || isZodiacLocale(locale)
export const zodiacHubPath = (locale: ZodiacHubLocale) =>
  locale === 'en' ? ZODIAC_EN_HUB_PATH : ZODIAC_HUB_PATHS[locale]
export const zodiacHubTitle = (locale: ZodiacHubLocale) =>
  locale === 'en' ? ZODIAC_EN_HUB_TITLE : ZODIAC_HUB_TITLES[locale]

export const ZODIAC_EAST_EN_CONTENT_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] = [
  { locale: 'en', path: ZODIAC_EN_HUB_PATH, collection: 'zodiac', id: 'index' },
]

const LOCALES = Object.keys(ZODIAC_HUB_PATHS) as ZodiacLocale[]

export function zodiacPath(locale: ZodiacLocale, key: ZodiacKey | 'index'): string {
  const hub = ZODIAC_HUB_PATHS[locale]
  return key === 'index' ? hub : `${hub}/${ZODIAC_SLUGS[locale][key]}`
}

export const ZODIAC_EAST_CONTENT_ROUTES: readonly EastContentRoute[] = LOCALES.flatMap((locale) => [
  { locale, path: zodiacPath(locale, 'index') as `/${string}`, collection: 'zodiac', id: 'index' },
  ...ZODIAC_KEYS.map((key) => ({
    locale,
    path: zodiacPath(locale, key) as `/${string}`,
    collection: 'zodiac' as const,
    id: key,
  })),
])

const pathsOf = (key: ZodiacKey | 'index') =>
  Object.fromEntries(LOCALES.map((locale) => [locale, zodiacPath(locale, key)]))

/**
 * 注册表条目：枢纽进页头「历法与生肖」分组（设计稿 EastNavVariant 方案 C，使用者 2026-11-22 选定），
 * 子页 nav: false。SEO 标题与描述由 zodiac/seo-pages.ts 按内容集合补上，注册表只放路径与导航名。
 */
export const ZODIAC_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'zodiac',
    site: 'east',
    navGroup: 'calendar',
    paths: { ...pathsOf('index'), en: ZODIAC_EN_HUB_PATH },
    titles: { ...ZODIAC_HUB_TITLES, en: ZODIAC_EN_HUB_TITLE },
  },
  ...ZODIAC_KEYS.map(
    (key): ToolRoute => ({
      id: `zodiac-${key}`,
      site: 'east',
      nav: false,
      paths: pathsOf(key),
      titles: Object.fromEntries(LOCALES.map((locale) => [locale, ZODIAC_SLUGS[locale][key]])),
    }),
  ),
]
