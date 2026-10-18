import type { ToolRoute } from '../registry.ts'

/**
 * 西方站数字命理页面（openspec add-numerology-tools specs/numerology-pages）的路径与 SEO 文案。
 * 预渲染、站点地图与工具注册表都从这里读取，因此不引用任何运行时模块（与 registry.ts 相同）。
 * 路径不带末尾 `/`：路由器与 Paraglide 都按 trailingSlash: 'never' 规范化。
 */
export const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33] as const
export type LifePathValue = (typeof LIFE_PATH_NUMBERS)[number]

export const NUMEROLOGY_LOCALE = 'en'

export function lifePathPath(value: number): string {
  return `/life-path-number/${value}`
}

/** 内容集合中的 slug → 页面路径；首页长文 `life-path-number` 属于 `/` */
export function numerologyContentPath(slug: string): string {
  const number = /^life-path-(\d+)$/.exec(slug)?.[1]
  if (number) return lifePathPath(Number(number))
  return slug === 'life-path-number' ? '/' : `/${slug}`
}

/** 四个工具内页：路径、页头导航名（省略则不进导航）、Title 与 description */
export const NUMEROLOGY_TOOLS = {
  'numerology-calculator': {
    path: '/numerology-calculator',
    nav: 'Numerology Calculator',
    title: 'Numerology Calculator: Life Path, Expression, Soul Urge and More',
    description:
      'Free numerology calculator: enter your name and birth date to get your life path, expression, soul urge, personality, birthday number and personal year, with every step shown.',
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

/**
 * 工具注册表条目：首页与工具内页、12 个数字页与两个枢纽页。没有导航名的条目只用于预渲染与站点地图，
 * toolsForLocale 会跳过它们（页头导航对齐原型：Life Path / Numerology Calculator / Compatibility）。
 */
export const NUMEROLOGY_ROUTES: readonly ToolRoute[] = [
  { id: 'life-path', site: 'west', paths: { en: '/' }, titles: { en: 'Life Path' } },
  ...Object.entries(NUMEROLOGY_TOOLS).map(([id, tool]) => ({
    id,
    site: 'west' as const,
    paths: { en: tool.path },
    titles: tool.nav ? { en: tool.nav } : {},
  })),
  ...LIFE_PATH_NUMBERS.map((value) => ({
    id: `life-path-${value}`,
    site: 'west' as const,
    paths: { en: lifePathPath(value) },
    titles: {},
  })),
  ...['soul-urge-number', 'destiny-number'].map((id) => ({
    id,
    site: 'west' as const,
    paths: { en: `/${id}` },
    titles: {},
  })),
]

interface NumerologyContent {
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly description: string
}

/** 站点地图与 OG 图片用的页面清单：首页（长文 frontmatter）、四个工具内页、12 个数字页与两个枢纽页 */
export function numerologySeoPages(content: readonly NumerologyContent[]) {
  return [
    ...Object.values(NUMEROLOGY_TOOLS).map(({ path, title, description }) => ({
      path,
      title,
      description,
      locale: NUMEROLOGY_LOCALE,
    })),
    ...content.map((page) => ({
      path: numerologyContentPath(page.slug),
      title: page.title,
      description: page.description,
      locale: page.locale,
    })),
  ]
}
