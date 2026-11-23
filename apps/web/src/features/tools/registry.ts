import type { SiteId } from '@xuanxue/config'
import { DAILY_TOOL_ROUTES } from '../daily/routes.ts'
import { ALMANAC_TOOL_ROUTES } from '../east-content/almanac/routes.ts'
import { TAI_SUI_YEAR_TOOL_ROUTES } from '../east-content/tai-sui-year/paths.ts'
import { TOJEONG_TOOL_ROUTES } from '../east-content/tojeong/paths.ts'
import { YEARLY_TOOL_ROUTES } from '../east-content/yearly/paths.ts'
import { YEARLY_TOOL_ROUTES as PERSONAL_YEARLY_TOOL_ROUTES } from '../east-content/yearly-tool/paths.ts'
import { ZODIAC_TOOL_ROUTES } from '../east-content/zodiac/paths.ts'
import { localeText } from '../i18n/split-messages.ts'
import { MOON_TOOL_ROUTES } from '../west-content/moon/paths.ts'
import { WESTERN_ZODIAC_TOOL_ROUTES } from '../west-content/zodiac/paths.ts'
import {
  CONCEPT_SLUGS,
  type ConceptKey,
  conceptPath,
  EAST_EN_TOOL_PATHS,
} from './bazi/eastern-routes.ts'
import { NUMEROLOGY_ROUTES } from './numerology/routes.ts'
import { TAROT_MEANING_ROUTES } from './tarot/meaning-routes.ts'
import { TAROT_TOOL_ROUTES } from './tarot/routes.ts'

const DIRECTORY_GROUPS = {
  east: ['chart', 'relation', 'yearly', 'divination', 'calendar', 'knowledge'],
  west: ['tarot', 'numerology', 'astrology', 'moon', 'compatibility'],
} as const satisfies Record<SiteId, readonly string[]>

export type ToolDirectoryGroup = (typeof DIRECTORY_GROUPS)[SiteId][number]
export type ToolFreeLabel =
  | 'free_chart'
  | 'free_compatibility'
  | 'free_lookup'
  | 'free_draw'
  | 'free_cast'
  | 'free_calculate'

export interface ToolBadge {
  readonly kind: 'new' | 'year'
  readonly label?: string
  /** 小标可显示至此日（含），格式为 YYYY-MM-DD。 */
  readonly until: string
}

/**
 * 工具路由注册表（openspec add-dual-site-foundation 决策 3、5；docs/10-v1-plan.md §3）：
 * 每个工具一行，由各工具 change 追加，冲突时合并两边。预渲染范围、站点地图、页头导航与内链矩阵
 * 都从这里读取，因此不引用任何运行时模块。
 */
export interface ToolRoute {
  /** 工具标识：埋点 `tool` 字段与内链目标使用，只含小写字母、数字与连字符 */
  readonly id: string
  readonly site: SiteId
  /** 各语言的页面路径（不含语言前缀，以 `/` 开头），没有对应语言版本时省略 */
  readonly paths: Readonly<Partial<Record<string, string>>>
  /**
   * 可选 SEO 描述；未提供时沿用标题。用 localeText 包裹：新语言的描述只在该语言页面加载（add-locales-eu-ja 决策 11）；
   * 路径与导航名称其他语言页面也要用（hreflang、语言菜单、页头），不包
   */
  readonly descriptions?: Readonly<Partial<Record<string, string>>>
  /** 各语言的导航名称 */
  readonly titles: Readonly<Partial<Record<string, string>>>
  /** false 时不进页头导航（同一工具的次级页面），仍参与预渲染、站点地图与 hreflang */
  readonly nav?: boolean
  /**
   * false 时不进构建期预渲染（内容按日变化的页面走 SSR + 边缘缓存，如每日运势页），
   * 仍参与页头导航、站点地图与 hreflang。
   */
  readonly prerender?: false
  /**
   * 页头工具下拉中的分组（content-growth-phase2 设计稿 EastNavVariant 方案 C）：`calendar` 列在「历法与生肖」之下，
   * 省略时在工具组
   */
  readonly navGroup?: 'calendar'
  /** 全部工具页的分组和动作式免费标签；现有独立路由清单可由注册表补上。 */
  readonly directoryGroup?: ToolDirectoryGroup
  readonly freeLabel?: ToolFreeLabel
  readonly badge?: ToolBadge
}

/** 完整注册表的条目必须明确归类并提供免费标签。 */
export interface RegisteredToolRoute extends ToolRoute {
  readonly directoryGroup: ToolDirectoryGroup
  readonly freeLabel: ToolFreeLabel
}

export function defineToolRoutes(
  routes: readonly RegisteredToolRoute[],
): readonly RegisteredToolRoute[] {
  for (const { site, id, directoryGroup, badge } of routes) {
    const groups: readonly ToolDirectoryGroup[] = DIRECTORY_GROUPS[site]
    if (!groups.includes(directoryGroup)) {
      throw new Error(`Invalid directoryGroup for ${site}/${id}: ${directoryGroup}`)
    }
    if (badge) {
      // Date 会把无效月末顺延至下月，转回 ISO 后核对原值。
      const midnight = `${badge.until}T00:00:00.000Z`
      const date = new Date(midnight)
      if (
        badge.until.length !== 10 ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString() !== midnight
      ) {
        throw new Error(
          `Invalid badge.until for ${site}/${id}: ${badge.until} (expected YYYY-MM-DD)`,
        )
      }
    }
  }
  return routes
}

function withDirectoryDefaults(
  route: ToolRoute,
  directoryGroup: ToolDirectoryGroup,
  freeLabel: ToolFreeLabel,
): RegisteredToolRoute {
  // 保留与原清单的对象引用，调用端可按原清单辨识条目所属集合。
  return Object.assign(route, {
    directoryGroup: route.directoryGroup ?? directoryGroup,
    freeLabel: route.freeLabel ?? freeLabel,
  })
}

// 每个 conceptKey 一条记录，只有存在译文的语言参与 hreflang。
const conceptKeys: readonly Exclude<ConceptKey, 'base'>[] = [
  'luck',
  'useful-god',
  'elements',
  'strength',
  'void',
  'shensha',
  'weight',
  'ten-gods',
  'day-pillar',
]
const conceptRoutes: RegisteredToolRoute[] = conceptKeys.map((key) => {
  const paths: Record<string, string> = {}
  const titles: Record<string, string> = {}
  for (const locale of ['zh-Hant', 'zh-Hans', 'ko'] as const) {
    const path = conceptPath(locale, key)
    if (!path) continue
    paths[locale] = path
    titles[locale] = (CONCEPT_SLUGS[locale] as Record<string, string>)[key] ?? key
  }
  return {
    id: `bazi-concept-${key}`,
    site: 'east',
    directoryGroup: 'knowledge',
    freeLabel: 'free_lookup',
    nav: false,
    paths,
    titles,
  }
})

export const TOOL_ROUTES = defineToolRoutes([
  // openspec add-bazi-saju-chart：繁中八字排盤与韩语만세력是同一工具的两个语言版本；
  // 路径为关键词 URL（openspec separate-landing-homepage design.md D1），语言首页是品牌落地页
  {
    id: 'bazi',
    site: 'east',
    directoryGroup: 'chart',
    freeLabel: 'free_chart',
    // en：东方站根路径英文（openspec add-locales-eu-ja 5b，关键词地图 keyword-maps/east-en.md）；
    // 描述不登记 en（另一站点的同语言页面在 publicPages 以导航名代替，页面 head 取 features/east-en 的文案）
    paths: {
      'zh-Hant': '/八字排盤',
      'zh-Hans': '/八字排盘',
      ko: '/만세력',
      ja: '/四柱推命',
      en: EAST_EN_TOOL_PATHS.bazi,
    },
    titles: {
      'zh-Hant': '八字排盤',
      'zh-Hans': '八字排盘',
      ko: '만세력',
      ja: '四柱推命',
      en: 'BaZi Calculator',
    },
    descriptions: localeText({
      'zh-Hant': '免費八字排盤：四柱命盤、五行強弱、身強身弱、喜用神、大運流年、神煞與八字重量。',
      'zh-Hans': '免费八字排盘：四柱命盘、五行强弱、身强身弱、喜用神、大运流年、神煞与八字重量。',
      ko: '무료 만세력: 사주팔자, 오행 분포, 신강·신약, 용신, 대운·세운, 신살·귀인·공망 조회.',
      ja: '無料の四柱推命：生年月日と出生時間から命式を作成し、通変星・蔵干・十二運星・大運・天中殺を表示します。',
    }),
  },
  {
    id: 'ziwei',
    site: 'east',
    directoryGroup: 'chart',
    freeLabel: 'free_chart',
    paths: {
      'zh-Hant': '/紫微斗數排盤',
      'zh-Hans': '/紫微斗数排盘',
      ja: '/紫微斗数',
      en: EAST_EN_TOOL_PATHS.ziwei,
    },
    titles: {
      'zh-Hant': '紫微斗數',
      'zh-Hans': '紫微斗数',
      ja: '紫微斗数',
      en: 'Zi Wei Dou Shu Chart',
    },
    descriptions: localeText({
      'zh-Hant': '免費紫微斗數排盤：十二宮位、命宮與身宮、十四主星與生年四化。',
      'zh-Hans': '免费紫微斗数排盘：十二宫位、命宫与身宫、十四主星与生年四化。',
      ja: '無料の紫微斗数：生年月日から命盤を作成し、十二宮・命宮と身宮・十四主星・生年四化を表示します。',
    }),
  },
  {
    id: 'mingpan',
    site: 'east',
    directoryGroup: 'chart',
    freeLabel: 'free_lookup',
    paths: { 'zh-Hant': '/命盤查詢', 'zh-Hans': '/命盘查询' },
    titles: { 'zh-Hant': '命盤查詢', 'zh-Hans': '命盘查询' },
    descriptions: localeText({
      'zh-Hant': '免費命盤查詢：四柱、藏干、十神與大運流年表。',
      'zh-Hans': '免费命盘查询：四柱、藏干、十神与大运流年表。',
    }),
  },
  {
    id: 'saju-gunghap',
    site: 'east',
    directoryGroup: 'relation',
    freeLabel: 'free_compatibility',
    // content-growth-v2-tools 12.3：同一合盘组件的五个语言版本（决策 2）；en 为东方站根路径英文，
    // 描述同 bazi 不登记 en（页面 head 取 messages/en/compat.json）
    paths: {
      'zh-Hant': '/八字合盤',
      'zh-Hans': '/八字合盘',
      ko: '/사주궁합',
      ja: '/四柱推命相性',
      en: EAST_EN_TOOL_PATHS.gunghap,
    },
    titles: {
      'zh-Hant': '八字合盤',
      'zh-Hans': '八字合盘',
      ko: '사주궁합',
      ja: '四柱推命の相性',
      en: 'BaZi Compatibility',
    },
    descriptions: localeText({
      'zh-Hant': '免費八字合盤：雙方日柱的合沖與五行喜用互補，得出傳統參考分與逐項加減分。',
      'zh-Hans': '免费八字合盘：两人日柱的合冲与五行喜用互补，得出传统参考分与逐项加减分。',
      ko: '무료 사주궁합: 두 사람의 일주 관계와 오행 보완으로 본 참고 점수와 항목별 가감점.',
      ja: '無料の四柱推命相性：二人の日柱の干合・支合・冲と五行の補い合いから、伝統的な参考点と項目ごとの加点・減点を表示します。',
    }),
  },
  ...TAROT_TOOL_ROUTES.map((route) =>
    withDirectoryDefaults(route, route.site === 'east' ? 'divination' : 'tarot', 'free_draw'),
  ),
  ...TAROT_MEANING_ROUTES.map((route) =>
    withDirectoryDefaults(route, route.site === 'east' ? 'knowledge' : 'tarot', 'free_lookup'),
  ),
  // openspec add-numerology-tools：西方站 Life Path 工具页、工具内页、12 个数字页与两个枢纽页
  ...NUMEROLOGY_ROUTES.map((route) => {
    switch (route.id) {
      case 'life-path-compatibility':
        return withDirectoryDefaults(route, 'compatibility', 'free_compatibility')
      case 'numerology-chart':
        return withDirectoryDefaults(route, 'numerology', 'free_chart')
      case 'life-path':
      case 'numerology-calculator':
      case 'name-numerology':
        return withDirectoryDefaults(route, 'numerology', 'free_calculate')
      default:
        return withDirectoryDefaults(route, 'numerology', 'free_lookup')
    }
  }),
  ...conceptRoutes,
  // openspec add-birth-profiles-daily-horoscope：公开每日运势页（SSR，不预渲染）
  ...DAILY_TOOL_ROUTES.map((route) =>
    withDirectoryDefaults(route, route.site === 'east' ? 'yearly' : 'numerology', 'free_lookup'),
  ),
  // openspec content-growth-phase2 第 6 组：黄历工具页与 12 个月份页（SSR，不预渲染）；
  // 黄历在前，页头「历法与生肖」分组依次为 黄历、十二生肖（设计稿 EastNavVariant 方案 C）
  ...ALMANAC_TOOL_ROUTES.map((route) => withDirectoryDefaults(route, 'calendar', 'free_lookup')),
  // openspec content-growth-phase2 第 4 组：生肖枢纽（页头「历法与生肖」分组）与 12 生肖页
  ...ZODIAC_TOOL_ROUTES.map((route) => withDirectoryDefaults(route, 'calendar', 'free_lookup')),
  // content-growth-v2-tools 第 15 组：ko 토정비결（年度组，2027 小标）
  ...TOJEONG_TOOL_ROUTES.map((route) => withDirectoryDefaults(route, 'yearly', 'free_cast')),
  // openspec content-growth-v2-tools 第 19 组：月相页（构建期预渲染，数据为构建期预计算表）
  ...MOON_TOOL_ROUTES.map((route) => withDirectoryDefaults(route, 'moon', 'free_lookup')),
  // openspec content-growth-v2-tools 第 20 组：星座枢纽与档案（astrology）、配对总表与配对页（compatibility）
  ...WESTERN_ZODIAC_TOOL_ROUTES.map((route) =>
    withDirectoryDefaults(route, 'astrology', 'free_lookup'),
  ),
  // openspec content-growth-v2-tools 第 18 组：2027 太歲（zh-hant，预渲染）
  ...TAI_SUI_YEAR_TOOL_ROUTES,
  // openspec content-growth-v2-tools 第 8 组：2027 年度枢纽（年份小标）与 12 生肖年度页
  ...YEARLY_TOOL_ROUTES.map((route) => withDirectoryDefaults(route, 'yearly', 'free_lookup')),
  // content-growth-v2-tools 第 7 组：个人 2027 流年工具（四种语言，目录分组 yearly，「2027」小标至 2027-02-28）
  ...PERSONAL_YEARLY_TOOL_ROUTES,
])

/**
 * 各站点的主工具（openspec separate-landing-homepage design.md D1、D4）：迁移前位于语言首页，
 * 现为关键词 URL。落地页主按钮、旧首页链接的跳转与映射都指向它。
 */
export const MAIN_TOOL_IDS: Readonly<Record<SiteId, string>> = { east: 'bazi', west: 'life-path' }

/**
 * 同一语言在两站都有页面时（en：西方站根路径与东方站根路径英文，5b），不指定站点即取该语言作为
 * 无前缀默认语言的站点（与 template.config.ts 中 en 为西方站默认语言一致）。只含字面量，不引用配置。
 */
const SHARED_LOCALE_OWNER: Readonly<Partial<Record<string, SiteId>>> = { en: 'west' }

/** 路由是否属于该语言在指定站点（未指定时为归属站点）下的页面 */
function routeOnSite(route: ToolRoute, locale: string, site: SiteId | undefined): boolean {
  const owner = site ?? SHARED_LOCALE_OWNER[locale]
  return owner === undefined || route.site === owner
}

/** 某语言的主工具页路径（不含语言前缀，未编码）；该语言没有主工具页时返回 undefined */
export function mainToolPath(
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  site?: SiteId,
): string | undefined {
  return routes.find(
    (route) =>
      MAIN_TOOL_IDS[route.site] === route.id &&
      route.paths[locale] &&
      routeOnSite(route, locale, site),
  )?.paths[locale]
}

/** 某语言下可链接的工具（页头导航、内链矩阵） */
export function toolsForLocale(
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  site?: SiteId,
): { id: string; path: string; title: string; navGroup?: 'calendar' }[] {
  const seen = new Set<string>()
  return routes.flatMap((route) => {
    const path = route.paths[locale]
    const title = route.titles[locale]
    // 跨站工具在两站各登记一条、共用同一组路径，按路径去重
    if (!path || !title || route.nav === false || seen.has(path)) return []
    if (!routeOnSite(route, locale, site)) return []
    seen.add(path)
    return [{ id: route.id, path, title, ...(route.navGroup && { navGroup: route.navGroup }) }]
  })
}

/**
 * 某站点在某语言下的页头工具（openspec product-improve-ai-content-20261030 D5）：只取登记在该站点的工具。
 * 调用方先用 siteNavLocale 把不属于本站的语言换成本站默认语言，链接因此不会跨站。
 */
export function toolsForSite(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): { id: string; path: string; title: string; navGroup?: 'calendar' }[] {
  return toolsForLocale(
    locale,
    routes.filter((route) => route.site === site),
    site,
  )
}
