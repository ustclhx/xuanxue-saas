import { localeText } from '../../i18n/split-messages.ts'
import type { ToolRoute } from '../../tools/registry.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * personal year 计算器与 1–9 年份数页的地址（openspec content-growth-v2-tools 决策 2，第 27 组）：
 * en `/personal-year-number`、`/personal-year-number/1` … `/9`；es `/es/ano-personal`、`/es/ano-personal/1` …（es 另写，不由 en 翻译）。
 * 只放字面量：西方内容路由映射、注册表、站点地图与预渲染都从这里读取，本文件随入口包加载，不得引用运行时模块。
 */
export const PERSONAL_YEAR_LOCALES = ['en', 'es'] as const
export type PersonalYearLocale = (typeof PERSONAL_YEAR_LOCALES)[number]

export const PERSONAL_YEAR_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type PersonalYearNumber = (typeof PERSONAL_YEAR_NUMBERS)[number]

export function isPersonalYearLocale(locale: string): locale is PersonalYearLocale {
  return (PERSONAL_YEAR_LOCALES as readonly string[]).includes(locale)
}

export function isPersonalYearNumber(value: number): value is PersonalYearNumber {
  return (PERSONAL_YEAR_NUMBERS as readonly number[]).includes(value)
}

/** 计算器页地址（不含语言前缀） */
export const PERSONAL_YEAR_PATHS = {
  en: '/personal-year-number',
  es: '/ano-personal',
} as const satisfies Record<PersonalYearLocale, `/${string}`>

export function personalYearNumberPath(
  locale: PersonalYearLocale,
  value: PersonalYearNumber,
): `/${string}` {
  return `${PERSONAL_YEAR_PATHS[locale]}/${value}`
}

/** 页面 id：`index`（计算器）或 `1` … `9`；即内容集合的 key（content/personal-year/<locale>/<key>.mdx） */
export type PersonalYearPageId = 'index' | `${PersonalYearNumber}`

export const PERSONAL_YEAR_CONTENT_ROUTES: readonly WestContentRoute[] =
  PERSONAL_YEAR_LOCALES.flatMap((locale) => [
    {
      locale,
      path: PERSONAL_YEAR_PATHS[locale],
      collection: 'personal-year' as const,
      id: 'index',
    },
    ...PERSONAL_YEAR_NUMBERS.map((value) => ({
      locale,
      path: personalYearNumberPath(locale, value),
      collection: 'personal-year' as const,
      id: String(value),
    })),
  ])

const NUMBER_TITLE: Readonly<Record<PersonalYearLocale, (value: number) => string>> = {
  en: (value) => `Personal Year ${value}`,
  es: (value) => `Año personal ${value}`,
}

/**
 * 注册表条目（features/tools/registry.ts）：构建期预渲染，不查数据库。计算器进「全部工具」numerology 组；
 * 年份数页 nav: false，由计算器、1–9 网格与面包屑链接。导航名即面包屑与模板区块的主词。
 */
export const PERSONAL_YEAR_TOOL_ROUTES: readonly ToolRoute[] = [
  {
    id: 'personal-year',
    site: 'west',
    paths: { en: PERSONAL_YEAR_PATHS.en, es: PERSONAL_YEAR_PATHS.es },
    titles: { en: 'Personal Year Calculator', es: 'Calculadora del año personal' },
    descriptions: localeText({
      en: 'Find your personal year number for any year from your birth month and day, with every step of the arithmetic and a link to the meaning of 1 to 9.',
      es: 'Calcula tu año personal en numerología para cualquier año con tu mes y día de nacimiento, paso a paso, y lee qué tema se asocia a cada número del 1 al 9.',
    }),
    badge: { kind: 'new', until: '2027-02-28' },
  },
  ...PERSONAL_YEAR_NUMBERS.map(
    (value): ToolRoute => ({
      id: `personal-year-${value}`,
      site: 'west',
      nav: false,
      paths: {
        en: personalYearNumberPath('en', value),
        es: personalYearNumberPath('es', value),
      },
      titles: { en: NUMBER_TITLE.en(value), es: NUMBER_TITLE.es(value) },
    }),
  ),
]
