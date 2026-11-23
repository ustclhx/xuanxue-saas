import { localeText } from '../../i18n/split-messages.ts'
import type { RegisteredToolRoute } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 个人 2027 流年工具的地址（openspec content-growth-v2-tools design 决策 2、6；第 7 组）。
 * 四种语言各一页，结果在浏览器计算、不改变地址。不引用运行时模块：注册表、东方内容路由映射与
 * 东方站英文的地址表都从这里读取。
 */
export const YEARLY_TOOL_YEAR = 2027

export const YEARLY_TOOL_LOCALES = ['zh-Hans', 'zh-Hant', 'ko', 'en'] as const
export type YearlyToolLocale = (typeof YEARLY_TOOL_LOCALES)[number]

export const YEARLY_TOOL_PATHS: Readonly<Record<YearlyToolLocale, `/${string}`>> = {
  'zh-Hans': '/2027流年',
  'zh-Hant': '/2027流年',
  ko: '/2027-신년-사주',
  en: '/bazi-2027',
}

/** 页头、面包屑、内链区块使用的主词（与各语言 copy 的 crumb 一致） */
export const YEARLY_TOOL_TITLES: Readonly<Record<YearlyToolLocale, string>> = {
  'zh-Hans': '2027流年',
  'zh-Hant': '2027流年',
  ko: '2027 신년 사주',
  en: 'BaZi 2027',
}

export function isYearlyToolLocale(locale: string): locale is YearlyToolLocale {
  return (YEARLY_TOOL_LOCALES as readonly string[]).includes(locale)
}

/** 东方内容分发：中日韩三种语言走 `features/east-content/routes.ts` */
export const YEARLY_TOOL_CONTENT_ROUTES: readonly EastContentRoute[] = (
  ['zh-Hans', 'zh-Hant', 'ko'] as const
).map((locale) => ({
  locale,
  path: YEARLY_TOOL_PATHS[locale],
  collection: 'yearly-tool',
  id: String(YEARLY_TOOL_YEAR),
}))

/** 东方站根路径英文：`features/east-en/paths.ts` 的内容映射 */
export const YEARLY_TOOL_EN_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] = [
  {
    locale: 'en',
    path: YEARLY_TOOL_PATHS.en,
    collection: 'yearly-tool',
    id: String(YEARLY_TOOL_YEAR),
  },
]

/**
 * 注册表条目（design 决策 5）：目录分组 `yearly`，动作式标签「免费查询」，「2027」小标到 2027-02-28。
 * 不进页头下拉（页头由第 6 组精简为精选加「全部工具」）；预渲染、站点地图、hreflang 与 llms.txt 照常。
 * 描述用 localeText 包裹，只在对应语言页面加载（同 registry.ts 现有条目）。
 */
export const YEARLY_TOOL_ROUTES: readonly RegisteredToolRoute[] = [
  {
    id: 'yearly-tool',
    site: 'east',
    nav: false,
    directoryGroup: 'yearly',
    freeLabel: 'free_lookup',
    badge: { kind: 'year', label: '2027', until: '2027-02-28' },
    paths: { ...YEARLY_TOOL_PATHS },
    titles: { ...YEARLY_TOOL_TITLES },
    descriptions: localeText({
      'zh-Hans': '输入生日，查看丁未年对日主的十神、与四柱和大运的合冲、太岁与喜忌。',
      'zh-Hant': '填入生日，對照丁未年的十神、合沖刑、所在大運、太歲與喜忌。',
      ko: '생년월일시로 정미년 세운의 십신, 원국·대운과의 합충, 태세와 희기를 정리합니다.',
      en: 'See how the 2027 Ding Wei year meets your Day Master, pillars and luck pillar.',
    }),
  },
]
