import type { SiteId } from '@xuanxue/config'
import { BUILD_DATE } from '../../tools/build-date.ts'
import { type DirectoryEntry, siteTools } from '../../tools/directory.ts'
import { TOOL_ROUTES, type ToolRoute } from '../../tools/registry.ts'

// 首页精选的配置与选择（openspec content-growth-v2-tools 决策 5，specs/tool-directory「首页精选由主卡、副卡与季节位组成」；
// 设计稿 docs/design/prototypes/content-growth-v2-tools/Main.dc.html、HomeWest.dc.html、HomeEastKo.dc.html、Nav.dc.html）。
// 只含 id 与纯函数，不引用文案：首页（data.ts）与页头下拉（site-header.tsx）共用同一份选择结果。
// 这里引用的 id 可以先于工具上线：当前语言没有页面的 id 自动跳过，由列表中下一个有页面的工具顺补。

/** 主卡 1 张 */
export const FEATURED_MAIN_LIMIT = 1
/** 副卡上限：东方站 4 张，西方站 3 张（Proposals 提议 3） */
export const FEATURED_SECONDARY_LIMIT: Readonly<Record<SiteId, number>> = { east: 4, west: 3 }
/** 页头工具下拉列出的精选工具上限（Nav.dc.html：主卡 + 季节位 + 副卡，最多 5 项） */
export const FEATURED_NAV_LIMIT = 5

export interface SeasonWindow {
  /** 起止日期（含），YYYY-MM-DD，与构建日期比较 */
  readonly from: string
  readonly until: string
  /** 季节位左上角的小标 */
  readonly badge: string
  /** 装饰用的大字（该年干支），对读屏隐藏 */
  readonly mark?: string
  /** 季节位的链接：有页面的第一个为按钮，第二个为文字链接 */
  readonly links: readonly string[]
  /** 个别语言的链接顺序 */
  readonly linksByLocale?: Readonly<Partial<Record<string, readonly string[]>>>
}

interface FeaturedConfig {
  /** 主卡候选，取第一个有页面的 */
  readonly main: readonly string[]
  /** 副卡候选，按顺序取前几个有页面的 */
  readonly secondary: readonly string[]
  readonly secondaryByLocale?: Readonly<Partial<Record<string, readonly string[]>>>
  readonly seasonal: readonly SeasonWindow[]
  /** 季节窗口之外（或窗口内没有已上线的内容）时季节位放的每日入口 */
  readonly offSeason: readonly string[]
}

/** 2027 丁未年窗口：12-01 至次年 2 月末（使用者 2026-11-23 确认），之后季节位换回每日运势 */
const YEAR_2027 = { from: '2026-12-01', until: '2027-02-28', badge: '2027' } as const

/**
 * 精选配置（design 决策 5 的表）。东方站：主卡八字排盘 / 만세력 / 四柱推命 / BaZi Calculator；
 * 副卡依次为合盘、紫微、生肖配对、塔罗，韩语在季节之外补토정비결；其后是没有前述工具的语言的顺补项。
 * 西方站按设计稿 HomeWest：主卡三张牌塔罗，季节位月相，副卡星座配对、Life Path、Numerology Calculator。
 */
export const FEATURED: Readonly<Record<SiteId, FeaturedConfig>> = {
  east: {
    main: ['bazi'],
    secondary: [
      'saju-gunghap',
      'ziwei',
      'zodiac-pair',
      'tarot-three-card',
      'tojeong',
      'almanac',
      'zodiac',
      'mingpan',
    ],
    secondaryByLocale: {
      en: ['saju-gunghap', 'zodiac-pair', 'ziwei', 'tarot-three-card', 'tarot-card-index'],
    },
    seasonal: [
      {
        ...YEAR_2027,
        mark: '丁未',
        links: ['yearly-tool', 'yearly'],
        linksByLocale: { ko: ['tojeong', 'yearly-tool'], en: ['yearly', 'yearly-tool'] },
      },
    ],
    offSeason: ['daily'],
  },
  west: {
    main: ['tarot-three-card', 'life-path'],
    secondary: [
      'moon-today',
      'zodiac-compatibility',
      'life-path',
      'numerology-calculator',
      'life-path-compatibility',
    ],
    seasonal: [{ ...YEAR_2027, links: ['moon-today', 'full-moon-calendar'] }],
    offSeason: ['daily-numerology'],
  },
}

export type FeaturedSeason =
  | {
      readonly kind: 'year'
      readonly badge: string
      readonly mark: string | undefined
      readonly links: readonly DirectoryEntry[]
    }
  | { readonly kind: 'daily'; readonly links: readonly [DirectoryEntry] }

export interface FeaturedSelection {
  readonly main: DirectoryEntry | null
  readonly season: FeaturedSeason | null
  readonly secondary: readonly DirectoryEntry[]
}

/**
 * 按站点、语言与构建日期选出主卡、季节位与副卡。只取登记在本站、当前语言有页面的工具，链接不跨站；
 * 季节位用到的工具不再占副卡，每个工具在首页只出现一次。
 */
export function selectFeatured(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  today: string = BUILD_DATE,
): FeaturedSelection {
  const config = FEATURED[site]
  const tools = siteTools(site, locale, routes, today)
  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const tool = tools.get(id)
      return tool ? [tool] : []
    })

  const main = pick(config.main)[0] ?? null
  const window = config.seasonal.find((entry) => entry.from <= today && today <= entry.until)
  const yearLinks = window
    ? pick(window.linksByLocale?.[locale] ?? window.links)
        .filter((tool) => tool.id !== main?.id)
        .slice(0, 2)
    : []
  const daily = pick(config.offSeason)[0]
  const season: FeaturedSeason | null =
    window && yearLinks.length > 0
      ? { kind: 'year', badge: window.badge, mark: window.mark, links: yearLinks }
      : daily
        ? { kind: 'daily', links: [daily] }
        : null

  const used = new Set([main?.id, ...(season?.links ?? []).map((tool) => tool.id)])
  const secondary = pick(config.secondaryByLocale?.[locale] ?? config.secondary)
    .filter((tool) => !used.has(tool.id))
    .slice(0, FEATURED_SECONDARY_LIMIT[site])
  return { main, season, secondary }
}

/**
 * 页头工具下拉里的精选工具（Nav.dc.html）：主卡、季节位的年度内容、副卡，最多 5 项。
 * 每日运势在导航中单列，「历法与生肖」分组的工具列在分组里，都不重复出现在这里。
 */
export function featuredNavTools(selection: FeaturedSelection): DirectoryEntry[] {
  return [
    ...(selection.main ? [selection.main] : []),
    ...(selection.season?.kind === 'year' ? selection.season.links : []),
    ...selection.secondary,
  ]
    .filter((tool) => tool.navGroup !== 'calendar')
    .slice(0, FEATURED_NAV_LIMIT)
}
