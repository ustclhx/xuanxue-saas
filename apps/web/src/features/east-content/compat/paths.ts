import type { ToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 合盘工具正文与关系场景页的地址（openspec content-growth-v2-tools 决策 2、7，第 13 组）。
 * 本文件随注册表进入入口包，只放字面量，不引用运行时模块。
 *
 * - 工具页（`compat` 集合）：zh-Hans、zh-Hant、ja、en 的合盘工具页改由东方内容分发渲染，带上本集合的长文与 FAQ；
 *   ko `/사주궁합` 正文不改，仍由排盘页分发（`EASTERN_PAGES`）。
 * - 场景页（`compat-scenario` 集合）：五种语言各 5 页，两段地址走 `$section/$item`。
 */
export const COMPAT_LOCALES = ['zh-Hans', 'zh-Hant', 'ko', 'ja', 'en'] as const
export type CompatPageLocale = (typeof COMPAT_LOCALES)[number]

/** 场景页的 key 与 `compat-share.ts` 的 CompatScenario 相同（不含工具页的 general） */
export const COMPAT_SCENARIO_KEYS = [
  'marriage',
  'couple',
  'friends',
  'business',
  'parent-child',
] as const
export type CompatScenarioKey = (typeof COMPAT_SCENARIO_KEYS)[number]

/** 合盘工具页地址（与注册表 `saju-gunghap` 相同） */
export const COMPAT_TOOL_PATHS: Readonly<Record<CompatPageLocale, `/${string}`>> = {
  'zh-Hans': '/八字合盘',
  'zh-Hant': '/八字合盤',
  ko: '/사주궁합',
  ja: '/四柱推命相性',
  en: '/bazi-compatibility',
}

/** 工具页正文由本集合提供的语言（ko 工具页正文不改） */
export const COMPAT_TOOL_BODY_LOCALES = ['zh-Hans', 'zh-Hant', 'ja', 'en'] as const

/** 场景页 slug（决策 2 的定稿表） */
export const COMPAT_SCENARIO_SLUGS: Readonly<
  Record<CompatPageLocale, Readonly<Record<CompatScenarioKey, string>>>
> = {
  'zh-Hans': {
    marriage: '合婚',
    couple: '恋人',
    friends: '朋友',
    business: '合伙',
    'parent-child': '亲子',
  },
  'zh-Hant': {
    marriage: '合婚',
    couple: '戀人',
    friends: '朋友',
    business: '合夥',
    'parent-child': '親子',
  },
  ko: {
    marriage: '부부',
    couple: '연인',
    friends: '친구',
    business: '동업',
    'parent-child': '부모-자녀',
  },
  ja: {
    marriage: '結婚',
    couple: '恋愛',
    friends: '友人',
    business: '仕事',
    'parent-child': '親子',
  },
  en: {
    marriage: 'marriage',
    couple: 'couples',
    friends: 'friends',
    business: 'business-partners',
    'parent-child': 'parent-child',
  },
}

/**
 * 场景页的导航名（面包屑末项、同组卡片标题、其他场景页指向本页的锚文本），与内容集合的 `short` 一致
 * （scripts/check-content-compat.mjs 校验）。注册表也要用，因此放字面量。
 */
export const COMPAT_SCENARIO_TITLES: Readonly<
  Record<CompatPageLocale, Readonly<Record<CompatScenarioKey, string>>>
> = {
  'zh-Hans': {
    marriage: '八字合婚',
    couple: '恋人合盘',
    friends: '朋友合盘',
    business: '合伙合盘',
    'parent-child': '亲子合盘',
  },
  'zh-Hant': {
    marriage: '八字合婚',
    couple: '情侶合盤',
    friends: '朋友合盤',
    business: '合夥人合盤',
    'parent-child': '親子合盤',
  },
  ko: {
    marriage: '부부 궁합',
    couple: '연인 궁합',
    friends: '친구 궁합',
    business: '동업 궁합',
    'parent-child': '부모 자녀 궁합',
  },
  ja: {
    marriage: '結婚の相性',
    couple: '恋愛の相性',
    friends: '友人との相性',
    business: '仕事相手との相性',
    'parent-child': '親子の相性',
  },
  en: {
    marriage: 'BaZi Marriage Compatibility',
    couple: 'BaZi Compatibility for Couples',
    friends: 'BaZi Compatibility for Friends',
    business: 'BaZi Compatibility for Business Partners',
    'parent-child': 'BaZi Compatibility for Parent and Child',
  },
}

export const isCompatLocale = (locale: string): locale is CompatPageLocale =>
  (COMPAT_LOCALES as readonly string[]).includes(locale)

export const isCompatScenarioKey = (key: string): key is CompatScenarioKey =>
  (COMPAT_SCENARIO_KEYS as readonly string[]).includes(key)

export function compatScenarioPath(locale: CompatPageLocale, key: CompatScenarioKey): `/${string}` {
  return `${COMPAT_TOOL_PATHS[locale]}/${COMPAT_SCENARIO_SLUGS[locale][key]}`
}

/** 场景页之间的正文内链：每页链向下一个场景（环形），每个场景页恰好得到一条正文入链 */
export function nextCompatScenario(key: CompatScenarioKey): CompatScenarioKey {
  const index = COMPAT_SCENARIO_KEYS.indexOf(key)
  return COMPAT_SCENARIO_KEYS[(index + 1) % COMPAT_SCENARIO_KEYS.length] as CompatScenarioKey
}

const routesFor = (locale: CompatPageLocale): EastContentRoute[] => [
  ...((COMPAT_TOOL_BODY_LOCALES as readonly string[]).includes(locale)
    ? [{ locale, path: COMPAT_TOOL_PATHS[locale], collection: 'compat' as const, id: 'tool' }]
    : []),
  ...COMPAT_SCENARIO_KEYS.map((key) => ({
    locale,
    path: compatScenarioPath(locale, key),
    collection: 'compat-scenario' as const,
    id: key,
  })),
]

/** 东方站中日韩（带语言前缀）的映射，追加到 east-content/routes.ts */
export const COMPAT_EAST_CONTENT_ROUTES: readonly EastContentRoute[] = COMPAT_LOCALES.filter(
  (locale) => locale !== 'en',
).flatMap(routesFor)

/** 东方站根路径英文的映射，追加到 east-en/paths.ts */
export const COMPAT_EAST_EN_CONTENT_ROUTES = routesFor('en') as readonly (EastContentRoute & {
  locale: 'en'
})[]

/**
 * 注册表条目：场景页是合盘工具的次级页面（nav: false），进预渲染、站点地图与 hreflang；
 * 全部工具页仍只列合盘工具本身（同组 relation）。SEO 标题与描述由 compat/seo-pages.ts 按内容集合补上。
 */
export const COMPAT_SCENARIO_TOOL_ROUTES: readonly ToolRoute[] = COMPAT_SCENARIO_KEYS.map(
  (key): ToolRoute => ({
    id: `saju-gunghap-${key}`,
    site: 'east',
    nav: false,
    directoryGroup: 'relation',
    freeLabel: 'free_compatibility',
    paths: Object.fromEntries(
      COMPAT_LOCALES.map((locale) => [locale, compatScenarioPath(locale, key)]),
    ),
    titles: Object.fromEntries(
      COMPAT_LOCALES.map((locale) => [locale, COMPAT_SCENARIO_TITLES[locale][key]]),
    ),
  }),
)
