import type { SiteId } from '@xuanxue/config'
import type { EastContentRoute } from '../../east-content/routes.ts'
import { localeText } from '../../i18n/split-messages.ts'
import type { WestContentRoute } from '../../west-content/routes.ts'
import type { RegisteredToolRoute } from '../registry.ts'

/**
 * 「全部工具」枢纽页的地址（openspec content-growth-v2-tools 第 6 组，specs/tool-directory）。
 * 地址取使用者 2026-11-23 确认的默认值（docs/design/prototypes/README.md 索引行）：
 * `/tools`、`/es/herramientas`、`/zh-hans/工具`、`/zh-hant/工具`、`/ko/도구`、`/ja/ツール`。
 * 只放字面量：注册表、路由映射、预渲染与站点地图都从这里读取，不引用运行时模块。
 */
export const TOOLS_HUB_ID = 'tools-hub'

export const TOOLS_HUB_PATHS = {
  east: { 'zh-Hant': '/工具', 'zh-Hans': '/工具', ko: '/도구', ja: '/ツール', en: '/tools' },
  west: { en: '/tools', es: '/herramientas' },
} as const satisfies Record<SiteId, Readonly<Record<string, `/${string}`>>>

/** 导航名、面包屑与 H1 */
export const TOOLS_HUB_TITLES: Readonly<Record<string, string>> = {
  'zh-Hant': '全部工具',
  'zh-Hans': '全部工具',
  ko: '전체 도구',
  ja: 'ツール一覧',
  en: 'All tools',
  es: 'Todas las herramientas',
}

/** Title 标签（不含站名）：以导航名开头，后接本语言已有的主要工具 */
export const TOOLS_HUB_SEO_TITLES: Readonly<Record<SiteId, Readonly<Record<string, string>>>> = {
  east: localeText({
    'zh-Hant': '全部工具：八字排盤、紫微斗數與塔羅占卜',
    'zh-Hans': '全部工具：八字排盘、紫微、黄历与塔罗占卜',
    ko: '전체 도구: 만세력, 사주궁합, 타로, 열두 띠',
    ja: 'ツール一覧：四柱推命・紫微斗数・タロット占い',
    en: 'All Tools: BaZi, Zi Wei Dou Shu and Tarot',
  }),
  west: localeText({
    en: 'All Tools: Tarot, Numerology and Life Path',
    es: 'Todas las herramientas: tarot y numerología',
  }),
}

const DESCRIPTIONS: Readonly<Record<SiteId, Readonly<Record<string, string>>>> = {
  east: localeText({
    'zh-Hant':
      '干支日的免費工具都整理在這一頁：八字排盤、紫微斗數、命盤查詢、塔羅占卜與今日運勢，依排盤、占卜與知識庫分類，每個工具都能免費看到結果，不需要註冊。',
    'zh-Hans':
      '干支日的免费工具都列在这一页：八字排盘、紫微斗数、命盘查询、塔罗占卜、今日运势、黄历与十二生肖，按排盘、占卜、历法分组，每个工具都能免费得到结果。',
    ko: '간지데이의 무료 도구를 한 페이지에 모았습니다. 만세력, 사주궁합, 타로, 오늘의 운세, 열두 띠를 종류별로 찾으실 수 있고, 모두 무료로 결과를 보실 수 있습니다.',
    ja: '干支日の無料ツールを一覧にまとめました。四柱推命、紫微斗数、タロット占いを種類ごとに探せます。どのツールも無料で結果を確認でき、会員登録は必要ありません。',
    en: 'Every free tool on Ganjiday in one place: the BaZi calculator, Zi Wei Dou Shu chart and tarot spreads, grouped by type. Each one gives a free result.',
  }),
  west: localeText({
    en: 'Every free tool on Arcanumber in one place: tarot spreads, life path and numerology calculators, and the number of the day. Each one gives a free result.',
    es: 'Todas las herramientas gratuitas de Arcanumber en una página: tiradas de tarot, número de vida y calculadora de numerología. Cada una da un resultado gratis.',
  }),
}

const SITES = Object.keys(TOOLS_HUB_PATHS) as SiteId[]

export function toolsHubPath(site: SiteId, locale: string): `/${string}` | undefined {
  return (TOOLS_HUB_PATHS[site] as Partial<Record<string, `/${string}`>>)[locale]
}

/**
 * 注册表条目：两站各一条，进预渲染、站点地图、hreflang 与 llms.txt；`nav: false`，页头入口由页头单独渲染在下拉末行。
 * 枢纽页自身不在目录中列出（directory.ts 按 id 排除），`directoryGroup` 与 `freeLabel` 只为满足注册表类型。
 */
export const TOOLS_HUB_ROUTES: readonly RegisteredToolRoute[] = SITES.map((site) => ({
  id: TOOLS_HUB_ID,
  site,
  nav: false,
  directoryGroup: site === 'east' ? 'knowledge' : 'tarot',
  freeLabel: 'free_lookup',
  paths: TOOLS_HUB_PATHS[site],
  titles: Object.fromEntries(
    Object.keys(TOOLS_HUB_PATHS[site]).map((locale) => [locale, TOOLS_HUB_TITLES[locale] ?? '']),
  ),
  descriptions: DESCRIPTIONS[site],
}))

/** 东方站中日韩的内容路由（features/east-content/routes.ts） */
export const TOOLS_HUB_EAST_CONTENT_ROUTES: readonly EastContentRoute[] = (
  ['zh-Hant', 'zh-Hans', 'ko', 'ja'] as const
).map((locale) => ({
  locale,
  path: TOOLS_HUB_PATHS.east[locale],
  collection: 'tools-hub',
  id: 'index',
}))

/** 东方站根路径英文的内容路由（features/east-en/paths.ts） */
export const TOOLS_HUB_EAST_EN_CONTENT_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] = [
  { locale: 'en', path: TOOLS_HUB_PATHS.east.en, collection: 'tools-hub', id: 'index' },
]

/** 西方站的内容路由（features/west-content/routes.ts） */
export const TOOLS_HUB_WEST_CONTENT_ROUTES: readonly WestContentRoute[] = (
  ['en', 'es'] as const
).map((locale) => ({
  locale,
  path: TOOLS_HUB_PATHS.west[locale],
  collection: 'tools-hub',
  id: 'index',
}))
