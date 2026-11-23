import type { SiteId } from '@xuanxue/config'
import { BUILD_DATE } from './build-date.ts'
import { TOOLS_HUB_ID } from './hub/routes.ts'
import {
  activeBadge,
  DIRECTORY_GROUPS,
  TOOL_ROUTES,
  type ToolBadge,
  type ToolDirectoryGroup,
  type ToolFreeLabel,
  type ToolRoute,
} from './registry.ts'

// 工具目录的数据层（openspec content-growth-v2-tools 决策 5，specs/tool-directory）：首页精选、页头下拉与
// 「全部工具」枢纽页都从注册表取同一份条目。只含纯函数，不引用文案，页头可以引用而不增加其他页面的包。

export interface DirectoryEntry {
  readonly id: string
  /** 不含语言前缀的路径 */
  readonly path: string
  /** 注册表的导航名 */
  readonly title: string
  readonly group: ToolDirectoryGroup | undefined
  readonly freeLabel: ToolFreeLabel | undefined
  /** 仍在有效期内的小标；过期后为 undefined */
  readonly badge: ToolBadge | undefined
  readonly navGroup: 'calendar' | undefined
  /** 注册表的 SEO 描述，没有工具专属的一句话说明时用它 */
  readonly description: string | undefined
}

/**
 * 既有的 `nav: false` 条目中仍要进枢纽页的工具：牌阵子页、牌义索引与数字命理入门。
 * 新工具不必加到这里——工具页不设 `nav: false` 即可（规则见 registry.ts DIRECTORY_GROUPS）。
 */
const HUB_EXTRA_IDS: ReadonlySet<string> = new Set([
  'tarot-daily',
  'tarot-yes-or-no',
  'tarot-celtic-cross',
  'tarot-card-index',
  'numerology',
  // 年运分组：个人流年工具（第 7 组）与年度枢纽、太歲页（第 8、18 组）只为不进页头下拉而设 `nav: false`
  'yearly-tool',
  // 月相分组：年度满月表按已确认的 HubWest 画板进枢纽页（月份页与满月页不进）
  'full-moon-calendar',
])

/** 年度枢纽与太歲页的 id 随年份生成（`yearly-<年份>`、`tai-sui-<年份>`），同样进枢纽页的年运分组 */
const HUB_EXTRA_PATTERN = /^(?:yearly|tai-sui)-\d{4}$/

function entryOf(route: ToolRoute, locale: string, today: string): DirectoryEntry | undefined {
  const path = route.paths[locale]
  const title = route.titles[locale]
  if (!path || !title) return undefined
  return {
    id: route.id,
    path,
    title,
    group: route.directoryGroup,
    freeLabel: route.freeLabel,
    badge: activeBadge(route.badge, today),
    navGroup: route.navGroup,
    description: route.descriptions?.[locale],
  }
}

/**
 * 某站点某语言下有页面的工具，按 id 查。未发布语言没有路径，自然查不到：入口与小标都不显示。
 * 同一 id 只取第一条；枢纽页自身不算工具。
 */
export function siteTools(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  today: string = BUILD_DATE,
): Map<string, DirectoryEntry> {
  const tools = new Map<string, DirectoryEntry>()
  for (const route of routes) {
    if (route.site !== site || route.id === TOOLS_HUB_ID || tools.has(route.id)) continue
    const entry = entryOf(route, locale, today)
    if (entry) tools.set(route.id, entry)
  }
  return tools
}

export interface DirectoryGroup {
  readonly group: ToolDirectoryGroup
  readonly tools: readonly DirectoryEntry[]
}

/**
 * 「全部工具」枢纽页的分组：按站点的分组顺序，组内按注册表顺序；没有条目的分组不返回（空分组不显示）。
 * 列出的条目：`nav` 不为 false 的工具、`knowledge` 分组里带导航名的条目，以及 HUB_EXTRA_IDS 与 HUB_EXTRA_PATTERN。
 */
export function directoryGroups(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  today: string = BUILD_DATE,
): DirectoryGroup[] {
  const listed = new Set(
    routes
      .filter(
        (route) =>
          route.site === site &&
          (route.nav !== false ||
            route.directoryGroup === 'knowledge' ||
            HUB_EXTRA_IDS.has(route.id) ||
            HUB_EXTRA_PATTERN.test(route.id)),
      )
      .map((route) => route.id),
  )
  const tools = [...siteTools(site, locale, routes, today).values()].filter((tool) =>
    listed.has(tool.id),
  )
  const groups: readonly ToolDirectoryGroup[] = DIRECTORY_GROUPS[site]
  return groups.flatMap((group) => {
    const members = tools.filter((tool) => tool.group === group)
    return members.length > 0 ? [{ group, tools: members }] : []
  })
}
