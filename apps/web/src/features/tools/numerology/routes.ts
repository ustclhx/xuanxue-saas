import { pageCopy } from '../../i18n/page-copy.ts'
import type { ToolRoute } from '../registry.ts'

/**
 * 西方站数字命理页面（openspec add-numerology-tools specs/numerology-pages）的路径与 SEO 文案。
 * 预渲染、站点地图与工具注册表都从这里读取，因此不引用任何运行时模块（与 registry.ts 相同）。
 * 路径不带末尾 `/`：路由器与 Paraglide 都按 trailingSlash: 'never' 规范化。
 */
export const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33] as const
export type LifePathValue = (typeof LIFE_PATH_NUMBERS)[number]

/** 英语（西方站默认语言）：英文页面与只在英语提供的入口（如每日数字页）使用 */
export const NUMEROLOGY_LOCALE = 'en'

/**
 * 提供数字命理页面的语言（openspec add-locales-eu-ja 决策 2、9）：西班牙语路径段用去变音符的本地关键词，
 * 页面与英语一一对应、互为 hreflang（注册表 paths）。
 */
export const NUMEROLOGY_LOCALES = ['en', 'es'] as const
export type NumerologyLocale = (typeof NUMEROLOGY_LOCALES)[number]

export function isNumerologyLocale(locale: string): locale is NumerologyLocale {
  return (NUMEROLOGY_LOCALES as readonly string[]).includes(locale)
}

/** 各语言的路径段：Life Path 工具页（数字页在其下）、四个工具内页与两个枢纽页 */
const PATHS = {
  en: {
    'life-path': '/life-path-number',
    'numerology-calculator': '/numerology-calculator',
    'numerology-chart': '/numerology-chart',
    'name-numerology': '/name-numerology',
    'life-path-compatibility': '/life-path-compatibility',
    'destiny-number': '/destiny-number',
    'soul-urge-number': '/soul-urge-number',
  },
  es: {
    'life-path': '/numero-de-vida',
    'numerology-calculator': '/calculadora-numerologia',
    'numerology-chart': '/carta-numerologica',
    'name-numerology': '/numerologia-del-nombre',
    'life-path-compatibility': '/compatibilidad-numerologica',
    'destiny-number': '/numero-del-destino',
    'soul-urge-number': '/numero-del-alma',
  },
} as const satisfies Record<NumerologyLocale, Record<string, string>>
export type NumerologyPageId = keyof (typeof PATHS)['en']

/** 某语言下数字命理页面的路径（不含语言前缀） */
export function numerologyPath(id: NumerologyPageId, locale: NumerologyLocale): string {
  return PATHS[locale][id]
}

/** 路径（不含语言前缀）在该语言下对应的数字命理页面 */
export function numerologyPageOfPath(path: string, locale: NumerologyLocale) {
  return (Object.keys(PATHS[locale]) as NumerologyPageId[]).find((id) => PATHS[locale][id] === path)
}

/** 某语言下数字页的路径，如 `/numero-de-vida/7` */
export function localizedLifePathPath(value: number, locale: NumerologyLocale): string {
  return `${PATHS[locale]['life-path']}/${value}`
}

export function lifePathPath(value: number): string {
  return `/life-path-number/${value}`
}

/** Life Path Number 计算器（主工具页，迁移前在西方站首页；openspec separate-landing-homepage design.md D1） */
export const LIFE_PATH_TOOL_PATH = '/life-path-number'

/** 内容集合中的 slug → 页面路径；计算器长文 `life-path-number` 属于 Life Path 工具页 */
export function numerologyContentPath(slug: string, locale: NumerologyLocale = 'en'): string {
  const number = /^life-path-(\d+)$/.exec(slug)?.[1]
  if (number) return localizedLifePathPath(Number(number), locale)
  if (slug === 'life-path-number') return PATHS[locale]['life-path']
  if (slug in PATHS[locale]) return PATHS[locale][slug as NumerologyPageId]
  return `/${slug}`
}

/** 四个工具内页：路径、页头导航名（省略则不进导航）、Title 与 description */
export const NUMEROLOGY_TOOLS = {
  'numerology-calculator': {
    path: '/numerology-calculator',
    nav: 'Numerology Calculator',
    title: 'Numerology Calculator: Life Path, Expression, Soul Urge and More',
    description:
      'Free numerology calculator: enter your name and birth date for life path, expression, soul urge, personality, birthday number and personal year, step by step.',
  },
  'numerology-chart': {
    path: '/numerology-chart',
    nav: undefined,
    title: 'Numerology Chart: See Which Digits Fill Your Birth Grid',
    description:
      'Map the digits of your birth date, and optionally your name, onto the 3×3 numerology chart to see repeated and missing numbers alongside your life path.',
  },
  'name-numerology': {
    path: '/name-numerology',
    nav: undefined,
    title: 'Name Numerology Calculator: Expression, Soul Urge and Personality',
    description:
      'Turn the letters of your name into expression, soul urge and personality numbers with the Pythagorean letter table, including accents and the Y rule.',
  },
  'life-path-compatibility': {
    path: '/life-path-compatibility',
    nav: 'Compatibility',
    title: 'Life Path Compatibility Calculator for Two Birth Dates',
    description:
      'Compare two birth dates: see both life path numbers, their step-by-step calculation and the compatibility level from a fixed numerology table.',
  },
} as const satisfies Record<
  string,
  { path: string; nav: string | undefined; title: string; description: string }
>
export type NumerologyToolId = keyof typeof NUMEROLOGY_TOOLS

/** 西班牙语工具内页的导航名（关键词地图 es，使用者 2026-11-20 确认）；没有导航名的页面不进页头导航 */
const NAV_ES: Partial<Record<NumerologyToolId | 'life-path', string>> = {
  'life-path': 'Número de vida',
  'numerology-calculator': 'Calculadora de numerología',
  'life-path-compatibility': 'Compatibilidad numerológica',
}

/**
 * 某语言的工具内页条目（路径、导航名、Title、description）。新语言的 Title 与 description 按语言拆分在
 * features/i18n/page-copy/<语言>.ts（首页包预算，add-locales-eu-ja 决策 11）。
 */
export function numerologyTool(
  id: NumerologyToolId,
  locale: NumerologyLocale,
): { path: string; nav: string | undefined; title: string; description: string } {
  if (locale === 'en') return NUMEROLOGY_TOOLS[id]
  const path = PATHS[locale][id]
  const [title, description] = pageCopy(locale)?.numerologyTools?.[id] ?? [path, '']
  return { path, nav: NAV_ES[id], title, description }
}

/** 页面在各语言的路径（注册表 paths，互为 hreflang） */
const pathsOf = (id: NumerologyPageId) => ({ en: PATHS.en[id], es: PATHS.es[id] })

/**
 * 工具注册表条目：Life Path 工具页与工具内页、12 个数字页与两个枢纽页。没有导航名的条目只用于预渲染与站点地图，
 * toolsForLocale 会跳过它们（页头导航对齐原型：Life Path / Numerology Calculator / Compatibility）。
 */
export const NUMEROLOGY_ROUTES: readonly ToolRoute[] = [
  {
    id: 'life-path',
    site: 'west',
    paths: pathsOf('life-path'),
    titles: { en: 'Life Path', es: NAV_ES['life-path'] },
  },
  ...(Object.keys(NUMEROLOGY_TOOLS) as NumerologyToolId[]).map((id) => ({
    id,
    site: 'west' as const,
    paths: pathsOf(id),
    titles: { en: NUMEROLOGY_TOOLS[id].nav, es: NAV_ES[id] },
  })),
  ...LIFE_PATH_NUMBERS.map((value) => ({
    id: `life-path-${value}`,
    site: 'west' as const,
    paths: { en: lifePathPath(value), es: localizedLifePathPath(value, 'es') },
    titles: {},
  })),
  ...(['soul-urge-number', 'destiny-number'] as const).map((id) => ({
    id,
    site: 'west' as const,
    paths: pathsOf(id),
    titles: {},
  })),
]

interface NumerologyContent {
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly description: string
}

/** 站点地图与 OG 图片用的页面清单：Life Path 工具页（长文 frontmatter）、四个工具内页、12 个数字页与两个枢纽页 */
export function numerologySeoPages(content: readonly NumerologyContent[]) {
  return [
    ...NUMEROLOGY_LOCALES.flatMap((locale) =>
      (Object.keys(NUMEROLOGY_TOOLS) as NumerologyToolId[]).map((id) => {
        const { path, title, description } = numerologyTool(id, locale)
        return { path, title, description, locale }
      }),
    ),
    ...content.flatMap((page) =>
      isNumerologyLocale(page.locale)
        ? [
            {
              path: numerologyContentPath(page.slug, page.locale),
              title: page.title,
              description: page.description,
              locale: page.locale,
            },
          ]
        : [],
    ),
  ]
}
