import type { SiteId } from '@xuanxue/config'
import { DAILY_TOOL_ROUTES } from '../daily/routes.ts'
import { localeText } from '../i18n/split-messages.ts'
import { CONCEPT_SLUGS, type ConceptKey, conceptPath } from './bazi/eastern-routes.ts'
import { NUMEROLOGY_ROUTES } from './numerology/routes.ts'
import { TAROT_MEANING_ROUTES } from './tarot/meaning-routes.ts'
import { TAROT_TOOL_ROUTES } from './tarot/routes.ts'

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
const conceptRoutes: ToolRoute[] = conceptKeys.map((key) => {
  const paths: Record<string, string> = {}
  const titles: Record<string, string> = {}
  for (const locale of ['zh-Hant', 'zh-Hans', 'ko'] as const) {
    const path = conceptPath(locale, key)
    if (!path) continue
    paths[locale] = path
    titles[locale] = (CONCEPT_SLUGS[locale] as Record<string, string>)[key] ?? key
  }
  return { id: `bazi-concept-${key}`, site: 'east', nav: false, paths, titles }
})

export const TOOL_ROUTES: readonly ToolRoute[] = [
  // openspec add-bazi-saju-chart：繁中八字排盤与韩语만세력是同一工具的两个语言版本；
  // 路径为关键词 URL（openspec separate-landing-homepage design.md D1），语言首页是品牌落地页
  {
    id: 'bazi',
    site: 'east',
    paths: { 'zh-Hant': '/八字排盤', 'zh-Hans': '/八字排盘', ko: '/만세력', ja: '/四柱推命' },
    titles: { 'zh-Hant': '八字排盤', 'zh-Hans': '八字排盘', ko: '만세력', ja: '四柱推命' },
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
    paths: { 'zh-Hant': '/紫微斗數排盤', 'zh-Hans': '/紫微斗数排盘', ja: '/紫微斗数' },
    titles: { 'zh-Hant': '紫微斗數', 'zh-Hans': '紫微斗数', ja: '紫微斗数' },
    descriptions: localeText({
      'zh-Hant': '免費紫微斗數排盤：十二宮位、命宮與身宮、十四主星與生年四化。',
      'zh-Hans': '免费紫微斗数排盘：十二宫位、命宫与身宫、十四主星与生年四化。',
      ja: '無料の紫微斗数：生年月日から命盤を作成し、十二宮・命宮と身宮・十四主星・生年四化を表示します。',
    }),
  },
  {
    id: 'mingpan',
    site: 'east',
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
    paths: { ko: '/사주궁합' },
    titles: { ko: '사주궁합' },
    descriptions: localeText({
      ko: '무료 사주궁합: 두 사람의 일주 관계와 오행 보완으로 본 참고 점수와 항목별 가감점.',
    }),
  },
  ...TAROT_TOOL_ROUTES,
  ...TAROT_MEANING_ROUTES,
  // openspec add-numerology-tools：西方站 Life Path 工具页、工具内页、12 个数字页与两个枢纽页
  ...NUMEROLOGY_ROUTES,
  ...conceptRoutes,
  // openspec add-birth-profiles-daily-horoscope：公开每日运势页（SSR，不预渲染）
  ...DAILY_TOOL_ROUTES,
]

/**
 * 各站点的主工具（openspec separate-landing-homepage design.md D1、D4）：迁移前位于语言首页，
 * 现为关键词 URL。落地页主按钮、旧首页链接的跳转与映射都指向它。
 */
export const MAIN_TOOL_IDS: Readonly<Record<SiteId, string>> = { east: 'bazi', west: 'life-path' }

/** 某语言的主工具页路径（不含语言前缀，未编码）；该语言没有主工具页时返回 undefined */
export function mainToolPath(
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): string | undefined {
  return routes.find((route) => MAIN_TOOL_IDS[route.site] === route.id && route.paths[locale])
    ?.paths[locale]
}

/** 某语言下可链接的工具（页头导航、内链矩阵） */
export function toolsForLocale(
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): { id: string; path: string; title: string }[] {
  const seen = new Set<string>()
  return routes.flatMap((route) => {
    const path = route.paths[locale]
    const title = route.titles[locale]
    // 跨站工具在两站各登记一条、共用同一组路径，按路径去重
    if (!path || !title || route.nav === false || seen.has(path)) return []
    seen.add(path)
    return [{ id: route.id, path, title }]
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
): { id: string; path: string; title: string }[] {
  return toolsForLocale(
    locale,
    routes.filter((route) => route.site === site),
  )
}
