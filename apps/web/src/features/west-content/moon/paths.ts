import type { ToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * 月相页的地址（openspec content-growth-v2-tools 决策 2、11）：en 为全部 16 页；es（第 19.4 项，按西语主词另写）
 * 只有今日月相、满月与月历枢纽三页，月份页与年度满月表后续再做。
 * 只放字面量：西方内容路由映射、注册表、站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 */
export const MOON_LOCALE = 'en'
export const MOON_LOCALES = ['en', 'es'] as const
export type MoonLocale = (typeof MOON_LOCALES)[number]
export function isMoonLocale(locale: string): locale is MoonLocale {
  return (MOON_LOCALES as readonly string[]).includes(locale)
}
export const MOON_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const
export type MoonMonthSlug = (typeof MOON_MONTHS)[number]

/** 页面标识即内容集合的 key（content/moon/en/<key>.mdx） */
export type MoonPageId =
  | 'today'
  | 'full-moon'
  | 'full-moon-calendar'
  | 'moon-calendar'
  | MoonMonthSlug

export const MOON_PATHS = {
  today: '/moon-phase-today',
  'full-moon': '/full-moon',
  'full-moon-calendar': '/full-moon-calendar',
  'moon-calendar': '/moon-calendar',
} as const satisfies Record<Exclude<MoonPageId, MoonMonthSlug>, `/${string}`>

/** 月份页地址不带年份（决策 11，滚动规则同第 2 阶段黄历决策 5）：`/moon-calendar/january` */
export function moonMonthPath(month: number): `/${string}` {
  const slug = MOON_MONTHS[month - 1]
  if (!slug) throw new RangeError(`Invalid month: ${month}`)
  return `${MOON_PATHS['moon-calendar']}/${slug}`
}

export function moonPagePath(id: MoonPageId): `/${string}` {
  const month = MOON_MONTHS.indexOf(id as MoonMonthSlug)
  return month >= 0 ? moonMonthPath(month + 1) : MOON_PATHS[id as keyof typeof MOON_PATHS]
}

const MAIN_IDS = Object.keys(MOON_PATHS) as Exclude<MoonPageId, MoonMonthSlug>[]
export const MOON_PAGE_IDS: readonly MoonPageId[] = [...MAIN_IDS, ...MOON_MONTHS]

/** es 三页（第 19.4 项）：西语主词「fase lunar hoy」「luna llena」「calendario lunar」，地址不带语言前缀 */
export const MOON_ES_PATHS = {
  today: '/fase-lunar-hoy',
  'full-moon': '/luna-llena',
  'moon-calendar': '/calendario-lunar',
} as const satisfies Partial<Record<MoonPageId, `/${string}`>>
export type MoonEsPageId = keyof typeof MOON_ES_PATHS
export const MOON_ES_PAGE_IDS = Object.keys(MOON_ES_PATHS) as MoonEsPageId[]

/** 某语言有哪些月相页 */
export function moonPageIds(locale: MoonLocale): readonly MoonPageId[] {
  return locale === 'es' ? MOON_ES_PAGE_IDS : MOON_PAGE_IDS
}

/** 本地化地址（不含语言前缀）；该语言没有这一页时返回 null */
export function moonLocalePath(id: MoonPageId, locale: MoonLocale): `/${string}` | null {
  if (locale === 'en') return moonPagePath(id)
  return (MOON_ES_PATHS as Partial<Record<MoonPageId, `/${string}`>>)[id] ?? null
}

export const MOON_CONTENT_ROUTES: readonly WestContentRoute[] = MOON_LOCALES.flatMap((locale) =>
  moonPageIds(locale).map((id) => ({
    locale,
    path: moonLocalePath(id, locale) ?? moonPagePath(id),
    collection: 'moon' as const,
    id,
  })),
)

const MONTH_NAMES = MOON_MONTHS.map((slug) => slug[0]?.toUpperCase() + slug.slice(1))

/** 月份页只认 `?year=`：其余参数仍渲染规范页 */
export const MOON_YEAR_PARAM = 'year'

/**
 * 预渲染页按路径读取静态 HTML（features/site/static-pages.ts）。月份页带 `?year=` 时改走 SSR，
 * 才能输出所请求年份与 `noindex, follow`（spec「月份页随时间滚动」）。
 */
export function isMoonQueryRequest(pathname: string, search: URLSearchParams): boolean {
  if (!search.has(MOON_YEAR_PARAM)) return false
  const path = pathname.replace(/\/+$/, '')
  return MOON_MONTHS.some((_, i) => moonMonthPath(i + 1) === path)
}

/**
 * 注册表条目（features/tools/registry.ts）：构建期预渲染（数据为构建期预计算表，spec「预渲染且不查数据库」），
 * 只有今日月相进页头工具下拉，其余页由正文、面包屑与月历枢纽链接。标题是面包屑与模板区块的主词。
 */
export const MOON_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'moon-phase-today',
    site: 'west',
    paths: { en: MOON_PATHS.today, es: MOON_ES_PATHS.today },
    titles: { en: 'Moon Phase Today', es: 'Fase lunar hoy' },
    descriptions: {
      en: 'Tonight’s moon phase, illumination and moon age for your time zone, with the next full and new moon dates.',
      es: 'La fase de la Luna de hoy, qué porcentaje está iluminado y su edad en días, con las fechas de la próxima luna llena y luna nueva en tu zona horaria.',
    },
  },
  {
    id: 'full-moon',
    site: 'west',
    nav: false,
    paths: { en: MOON_PATHS['full-moon'], es: MOON_ES_PATHS['full-moon'] },
    titles: { en: 'Full Moon Tonight', es: 'Luna llena' },
    descriptions: {
      en: 'Whether tonight is a full moon, the date, time and traditional name of the next full moon, and supermoon and blue moon notes.',
      es: 'Si hoy hay luna llena, cuándo será la próxima, a qué hora y con qué nombre popular, con aviso de superluna y luna azul.',
    },
  },
  {
    id: 'full-moon-calendar',
    site: 'west',
    nav: false,
    paths: { en: MOON_PATHS['full-moon-calendar'] },
    titles: { en: 'Full Moon Calendar' },
    descriptions: {
      en: 'Every full moon of this year and next with dates, times and traditional names, plus supermoon and blue moon marks.',
    },
  },
  {
    id: 'moon-calendar',
    site: 'west',
    nav: false,
    paths: { en: MOON_PATHS['moon-calendar'], es: MOON_ES_PATHS['moon-calendar'] },
    titles: { en: 'Moon Calendar', es: 'Calendario lunar' },
    descriptions: {
      en: 'A month-by-month moon phase calendar with the four main phases and their times in your time zone.',
      es: 'Las fases de la Luna día a día en el mes actual y las fechas de luna llena y luna nueva de los próximos meses, en tu zona horaria.',
    },
  },
  ...MOON_MONTHS.map(
    (slug, i): ToolRoute => ({
      id: `moon-calendar-${slug}`,
      site: 'west',
      nav: false,
      paths: { en: moonMonthPath(i + 1) },
      titles: { en: `${MONTH_NAMES[i]} Moon Calendar` },
      descriptions: {
        en: `Daily moon phases for ${MONTH_NAMES[i]}, the full and new moon times in your time zone, and where the month’s full moon name comes from.`,
      },
    }),
  ),
]
