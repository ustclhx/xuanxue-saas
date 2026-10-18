import type { SiteId } from '@xuanxue/config'

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
}

export const TOOL_ROUTES: readonly ToolRoute[] = []

/** 某语言下可链接的工具（页头导航、内链矩阵） */
export function toolsForLocale(
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): { id: string; path: string; title: string }[] {
  return routes.flatMap((route) => {
    const path = route.paths[locale]
    const title = route.titles[locale]
    return path && title ? [{ id: route.id, path, title }] : []
  })
}
