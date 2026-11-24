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
/**
 * 副卡上限：东方站 4 张；西方站原为 3 张（Proposals 提议 3），出生星盘上线后增至 4 张
 * （第二批默认 B12，设计稿 content-growth-v2-batch2/HomeWestB.dc.html）
 */
export const FEATURED_SECONDARY_LIMIT: Readonly<Record<SiteId, number>> = { east: 4, west: 4 }
/** 页头工具下拉列出的精选工具上限（Nav.dc.html、NavWestB.dc.html：主卡 + 季节位 + 副卡，最多 5 项） */
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

/** 年度生肖枢纽的注册表 id 随年份生成（yearly 集合登记为 `yearly-<年份>`） */
export const yearlyHubId = (year: number) => `yearly-${year}`

/** 个人年度流年工具的注册表 id（第 7 组登记时使用） */
export const YEARLY_TOOL_ID = 'yearly-tool'

/**
 * 某一年的季节窗口：上一年 12-01 至该年 2 月末（使用者 2026-11-23 确认），之后季节位换回每日运势。
 * 起止日期与小标都由年份算出，下一年只需把年份与干支加进 SEASON_YEARS。
 */
function yearWindow(year: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return {
    from: `${year - 1}-12-01`,
    until: `${year}-02-${leap ? 29 : 28}`,
    badge: String(year),
  }
}

/** 当季年份与该年干支 */
const SEASON_YEARS: readonly (readonly [number, string])[] = [[2027, '丁未']]

/**
 * 精选配置（design 决策 5 的表）。东方站：主卡八字排盘 / 만세력 / 四柱推命 / BaZi Calculator；
 * 副卡依次为合盘、紫微、生肖配对、塔罗，韩语在季节之外补토정비결；其后是没有前述工具的语言的顺补项。
 * 西方站按设计稿 HomeWest：主卡三张牌塔罗，季节位月相；出生星盘上线后按 HomeWestB（默认 B12）副卡 4 张、
 * Birth Chart 居首，其后星座配对、Life Path、Numerology Calculator（季节之外月相排在 Birth Chart 之后）。
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
    seasonal: SEASON_YEARS.map(([year, mark]) => ({
      ...yearWindow(year),
      mark,
      links: [YEARLY_TOOL_ID, yearlyHubId(year)],
      linksByLocale: {
        ko: ['tojeong', YEARLY_TOOL_ID],
        en: [yearlyHubId(year), YEARLY_TOOL_ID],
      },
    })),
    offSeason: ['daily'],
  },
  west: {
    main: ['tarot-three-card', 'life-path'],
    secondary: [
      'birth-chart',
      'moon-phase-today',
      'western-zodiac-compatibility',
      'life-path',
      'numerology-calculator',
      'life-path-compatibility',
    ],
    seasonal: SEASON_YEARS.map(([year]) => ({
      ...yearWindow(year),
      links: ['moon-phase-today', 'full-moon-calendar'],
    })),
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
 * 页头工具下拉里的精选工具（Nav.dc.html、NavWestB.dc.html）：主卡、季节位的年度内容、副卡，最多 5 项。
 * 季节位只取按钮那一项（画板上季节位在下拉里只占一行，如「2027 流年」「Moon Phase Today」），文字链接不进下拉；
 * 西方站出生星盘上线后下拉为 Three-Card Tarot、Birth Chart、Moon Phase Today、Zodiac Compatibility、Life Path
 * （默认 B13：Birth Chart 替换 Numerology Calculator）。
 * 每日运势在导航中单列，「历法与生肖」分组的工具列在分组里，都不重复出现在这里。
 */
export function featuredNavTools(selection: FeaturedSelection): DirectoryEntry[] {
  return [
    ...(selection.main ? [selection.main] : []),
    ...(selection.season?.kind === 'year' ? selection.season.links.slice(0, 1) : []),
    ...selection.secondary,
  ]
    .filter((tool) => tool.navGroup !== 'calendar')
    .slice(0, FEATURED_NAV_LIMIT)
}
