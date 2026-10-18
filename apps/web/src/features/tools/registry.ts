import type { SiteId } from '@xuanxue/config'
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
  /** 可选 SEO 描述；未提供时沿用标题 */
  readonly descriptions?: Readonly<Partial<Record<string, string>>>
  /** 各语言的导航名称 */
  readonly titles: Readonly<Partial<Record<string, string>>>
  /** false 时不进页头导航（同一工具的次级页面），仍参与预渲染、站点地图与 hreflang */
  readonly nav?: boolean
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
  for (const locale of ['zh-Hant', 'ko'] as const) {
    const path = conceptPath(locale, key)
    if (!path) continue
    paths[locale] = path
    titles[locale] = (CONCEPT_SLUGS[locale] as Record<string, string>)[key] ?? key
  }
  return { id: `bazi-concept-${key}`, site: 'east', nav: false, paths, titles }
})

export const TOOL_ROUTES: readonly ToolRoute[] = [
  // openspec add-bazi-saju-chart：繁中八字排盤与韩语만세력是同一工具的两个语言版本
  {
    id: 'bazi',
    site: 'east',
    paths: { 'zh-Hant': '/', ko: '/' },
    titles: { 'zh-Hant': '八字排盤', ko: '만세력' },
    descriptions: {
      'zh-Hant': '免費八字排盤：四柱命盤、五行強弱、身強身弱、喜用神、大運流年、神煞與八字重量。',
      ko: '무료 만세력: 사주팔자, 오행 분포, 신강·신약, 용신, 대운·세운, 신살·귀인·공망 조회.',
    },
  },
  {
    id: 'ziwei',
    site: 'east',
    paths: { 'zh-Hant': '/紫微斗數排盤' },
    titles: { 'zh-Hant': '紫微斗數' },
    descriptions: { 'zh-Hant': '免費紫微斗數排盤：十二宮位、命宮與身宮、十四主星與生年四化。' },
  },
  {
    id: 'mingpan',
    site: 'east',
    paths: { 'zh-Hant': '/命盤查詢' },
    titles: { 'zh-Hant': '命盤查詢' },
    descriptions: { 'zh-Hant': '免費命盤查詢：四柱、藏干、十神與大運流年表。' },
  },
  {
    id: 'saju-gunghap',
    site: 'east',
    paths: { ko: '/사주궁합' },
    titles: { ko: '사주궁합' },
    descriptions: {
      ko: '무료 사주궁합: 두 사람의 일주 관계와 오행 보완으로 본 참고 점수와 항목별 가감점.',
    },
  },
  ...TAROT_TOOL_ROUTES,
  ...TAROT_MEANING_ROUTES,
  // openspec add-numerology-tools：西方站首页、工具内页、12 个数字页与两个枢纽页
  ...NUMEROLOGY_ROUTES,
  ...conceptRoutes,
]

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
