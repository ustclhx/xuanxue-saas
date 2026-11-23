import type { ToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 年度生肖集合的地址（openspec content-growth-v2-tools 决策 2、6）。只放字面量：路由映射、注册表、
 * 站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 * zh-Hans 由第 8 组登记；zh-Hant、ko、en（第 9、10、11 组）各在下列表中补一行，组件与集合不必改。
 * en 的地址不进 east-content 映射，由 `YEARLY_EAST_EN_CONTENT_ROUTES` 交给 east-en 分发。
 */
export const YEARLY_KEYS = [
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
export type YearlyKey = (typeof YEARLY_KEYS)[number]

export type YearlyLocale = 'zh-Hans' | 'zh-Hant' | 'ko' | 'en'

/** 已登记的年份（网址带年份，旧年份页按 seo「带年份页面的时效」由使用者裁定处理） */
export const YEARLY_YEARS = [2027] as const
export type YearlyYear = (typeof YEARLY_YEARS)[number]

interface YearlyLocalePaths {
  /** 枢纽地址（不含语言前缀） */
  readonly hub: Readonly<Record<YearlyYear, string>>
  /** 枢纽的主词：面包屑、注册表标题与模板区块锚文本 */
  readonly hubTitle: Readonly<Record<YearlyYear, string>>
  /** 子页 slug（接在枢纽地址之后） */
  readonly slugs: Readonly<Record<YearlyKey, string>>
  /** 子页主词（注册表标题与模板区块锚文本），`{year}` 换为年份 */
  readonly childTitle: Readonly<Record<YearlyKey, string>>
}

export const YEARLY_PATHS: Readonly<Partial<Record<YearlyLocale, YearlyLocalePaths>>> = {
  'zh-Hans': {
    hub: { 2027: '/2027生肖运势' },
    hubTitle: { 2027: '2027生肖运势' },
    slugs: {
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
    childTitle: {
      zi: '{year}属鼠',
      chou: '{year}属牛',
      yin: '{year}属虎',
      mao: '{year}属兔',
      chen: '{year}属龙',
      si: '{year}属蛇',
      wu: '{year}属马',
      wei: '{year}属羊',
      shen: '{year}属猴',
      you: '{year}属鸡',
      xu: '{year}属狗',
      hai: '{year}属猪',
    },
  },
  // 第 9 组：zh-Hant（台湾、香港用语另写，地址见 design 决策 2）
  'zh-Hant': {
    hub: { 2027: '/2027生肖運勢' },
    hubTitle: { 2027: '2027生肖運勢' },
    slugs: {
      zi: '屬鼠',
      chou: '屬牛',
      yin: '屬虎',
      mao: '屬兔',
      chen: '屬龍',
      si: '屬蛇',
      wu: '屬馬',
      wei: '屬羊',
      shen: '屬猴',
      you: '屬雞',
      xu: '屬狗',
      hai: '屬豬',
    },
    childTitle: {
      zi: '{year}屬鼠',
      chou: '{year}屬牛',
      yin: '{year}屬虎',
      mao: '{year}屬兔',
      chen: '{year}屬龍',
      si: '{year}屬蛇',
      wu: '{year}屬馬',
      wei: '{year}屬羊',
      shen: '{year}屬猴',
      you: '{year}屬雞',
      xu: '{year}屬狗',
      hai: '{year}屬豬',
    },
  },
  // 第 11 组：东方站根路径英文（`features/east-en/paths.ts` 分发；决策 2、13）
  en: {
    hub: { 2027: '/chinese-zodiac-2027' },
    hubTitle: { 2027: 'Chinese Zodiac 2027' },
    slugs: {
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
    },
    childTitle: {
      zi: 'Rat in {year}',
      chou: 'Ox in {year}',
      yin: 'Tiger in {year}',
      mao: 'Rabbit in {year}',
      chen: 'Dragon in {year}',
      si: 'Snake in {year}',
      wu: 'Horse in {year}',
      wei: 'Goat in {year}',
      shen: 'Monkey in {year}',
      you: 'Rooster in {year}',
      xu: 'Dog in {year}',
      hai: 'Pig in {year}',
    },
  },
  // 第 10 组：ko 主词「2027년 띠」「쥐띠 2027」（design 决策 6、13）；不以「띠별 운세」为目标
  ko: {
    hub: { 2027: '/2027년-띠' },
    hubTitle: { 2027: '2027년 띠' },
    slugs: {
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
    childTitle: {
      zi: '쥐띠 {year}',
      chou: '소띠 {year}',
      yin: '호랑이띠 {year}',
      mao: '토끼띠 {year}',
      chen: '용띠 {year}',
      si: '뱀띠 {year}',
      wu: '말띠 {year}',
      wei: '양띠 {year}',
      shen: '원숭이띠 {year}',
      you: '닭띠 {year}',
      xu: '개띠 {year}',
      hai: '돼지띠 {year}',
    },
  },
}

export const YEARLY_LOCALES = Object.keys(YEARLY_PATHS) as YearlyLocale[]

export const isYearlyLocale = (locale: string): locale is YearlyLocale =>
  Object.hasOwn(YEARLY_PATHS, locale)

export const isYearlyYear = (year: number): year is YearlyYear =>
  (YEARLY_YEARS as readonly number[]).includes(year)

/** 路由 id：`2027/index` 为枢纽，`2027/wu` 为子页 */
export const yearlyRouteId = (year: YearlyYear, key: YearlyKey | 'index') => `${year}/${key}`

export function parseYearlyRouteId(
  id: string,
): { year: YearlyYear; key: YearlyKey | 'index' } | null {
  const [yearText, key] = id.split('/')
  const year = Number(yearText)
  if (!isYearlyYear(year)) return null
  if (key !== 'index' && !(YEARLY_KEYS as readonly string[]).includes(key ?? '')) return null
  return { year, key: key as YearlyKey | 'index' }
}

export function yearlyPath(
  locale: YearlyLocale,
  year: YearlyYear,
  key: YearlyKey | 'index',
): string | undefined {
  const paths = YEARLY_PATHS[locale]
  if (!paths) return undefined
  const hub = paths.hub[year]
  return key === 'index' ? hub : `${hub}/${paths.slugs[key]}`
}

export function yearlyTitle(
  locale: YearlyLocale,
  year: YearlyYear,
  key: YearlyKey | 'index',
): string {
  const paths = YEARLY_PATHS[locale]
  if (!paths) return ''
  return key === 'index'
    ? paths.hubTitle[year]
    : paths.childTitle[key].replace('{year}', String(year))
}

const routesOf = (locale: YearlyLocale) =>
  YEARLY_YEARS.flatMap((year) =>
    (['index', ...YEARLY_KEYS] as const).map((key) => ({
      locale,
      path: yearlyPath(locale, year, key) as `/${string}`,
      collection: 'yearly' as const,
      id: yearlyRouteId(year, key),
    })),
  )

/** 中日韩：`features/east-content/routes.ts` 的内容映射 */
export const YEARLY_EAST_CONTENT_ROUTES: readonly EastContentRoute[] = YEARLY_LOCALES.filter(
  (locale) => locale !== 'en',
).flatMap(routesOf)

/** 东方站根路径英文：`features/east-en/paths.ts` 的内容映射（第 11 组） */
export const YEARLY_EAST_EN_CONTENT_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] =
  YEARLY_LOCALES.includes('en')
    ? routesOf('en').map((route) => ({ ...route, locale: 'en' as const }))
    : []

const pathsOf = (year: YearlyYear, key: YearlyKey | 'index') =>
  Object.fromEntries(YEARLY_LOCALES.map((locale) => [locale, yearlyPath(locale, year, key)]))
const titlesOf = (year: YearlyYear, key: YearlyKey | 'index') =>
  Object.fromEntries(YEARLY_LOCALES.map((locale) => [locale, yearlyTitle(locale, year, key)]))

/** 枢纽在首页与「全部工具」卡片上的一句话说明：沿用 content/yearly/<locale>/<年份>/index.mdx 已审定的 SEO 描述 */
const YEARLY_HUB_DESCRIPTIONS: Readonly<
  Record<YearlyYear, Readonly<Partial<Record<string, string>>>>
> = {
  2027: {
    'zh-Hans':
      '2027年是丁未年，纳音天河水。本页按传统地支规则列出十二生肖与丁未年的值、冲、刑、害、破太岁与六合、三合关系，并说明立春与春节两种起算方式，仅供参考。',
  },
}

/**
 * 注册表条目（features/tools/registry.ts）：枢纽带年份小标（到 2 月底消失），由第 6 组的全部工具页与首页季节位引用；
 * 页头下拉由第 6 组改版，这里不加入现有「历法与生肖」分组，枢纽与子页都 nav: false。SEO 标题与描述由 yearly/seo-pages.ts 按内容集合补上，注册表只放路径与导航名。
 */
export const YEARLY_TOOL_ROUTES: readonly ToolRoute[] = YEARLY_YEARS.flatMap((year) => [
  {
    id: `yearly-${year}`,
    site: 'east',
    nav: false,
    directoryGroup: 'yearly',
    freeLabel: 'free_lookup',
    badge: { kind: 'year', label: String(year), until: `${year}-02-28` },
    paths: pathsOf(year, 'index'),
    titles: titlesOf(year, 'index'),
    descriptions: YEARLY_HUB_DESCRIPTIONS[year],
  } satisfies ToolRoute,
  ...YEARLY_KEYS.map(
    (key): ToolRoute => ({
      id: `yearly-${year}-${key}`,
      site: 'east',
      nav: false,
      directoryGroup: 'yearly',
      freeLabel: 'free_lookup',
      paths: pathsOf(year, key),
      titles: titlesOf(year, key),
    }),
  ),
])
