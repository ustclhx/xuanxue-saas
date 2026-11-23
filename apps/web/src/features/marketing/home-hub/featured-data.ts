import type { SiteId } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { BUILD_DATE } from '../../tools/build-date.ts'
import type { DirectoryEntry } from '../../tools/directory.ts'
import {
  badgeText,
  freeLabelText,
  toolGlyph,
  toolSummary,
  toolTitle,
} from '../../tools/hub/copy.ts'
import { TOOLS_HUB_ID, TOOLS_HUB_TITLES, toolsHubPath } from '../../tools/hub/routes.ts'
import { TOOL_ROUTES, type ToolRoute } from '../../tools/registry.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { type FeaturedSeason, selectFeatured } from './featured.ts'

// 首页精选的视图数据（openspec content-growth-v2-tools 决策 5）：把 featured.ts 的选择结果配上卡片文案。
// 全部来自工具注册表与文案，不查库、不发请求；`today` 为构建日期。

/** 主卡动作文字（文案在 landing.json，去掉末尾箭头后作为主卡上的按钮文字） */
const TOOL_ACTION: Record<string, () => string> = {
  bazi: m.landing_tool_cta_bazi,
  ziwei: m.landing_tool_cta_ziwei,
  mingpan: m.landing_tool_cta_mingpan,
  'saju-gunghap': m.landing_tool_cta_saju_gunghap,
  'tarot-three-card': m.landing_tool_cta_tarot,
  'life-path': m.landing_tool_cta_life_path,
  'numerology-calculator': m.landing_tool_cta_numerology_calculator,
}

const withoutArrow = (text: string) => text.replace(/\s*→\s*$/, '')

export interface HubTool {
  readonly id: string
  readonly title: string
  readonly summary: string
  /** 同站、同语言的站内地址 */
  readonly href: string
  readonly glyph: string
  /** 动作式免费标签（「免费排盘」）；入口卡只标免费动作，不标付费 */
  readonly label: string | null
  /** 「新」或年份小标；过期或未登记时为 null */
  readonly badge: string | null
  /** 主卡上的按钮文字（「开始排盘」），没有专属文案时用免费标签 */
  readonly action: string
}

/** 把目录条目配上卡片文案（首页精选与「全部工具」枢纽页共用） */
export function hubTool(tool: DirectoryEntry, site: SiteId, locale: string): HubTool {
  const title = toolTitle(tool, site, locale)
  const label = freeLabelText(tool.freeLabel)
  const action = TOOL_ACTION[tool.id]?.()
  return {
    id: tool.id,
    title,
    summary: toolSummary(tool, site, locale),
    href: toolHref(tool.path, locale),
    glyph: toolGlyph(tool, title),
    label,
    badge: badgeText(tool.badge),
    action: action ? withoutArrow(action) : (label ?? title),
  }
}

export interface HubSeasonLink {
  readonly id: string
  readonly href: string
  readonly label: string
}

export interface HubSeason {
  /** `year`：当季年份内容；`daily`：每日运势入口（季节窗口之外，或当季内容尚未上线） */
  readonly kind: 'year' | 'daily'
  readonly badge: string | null
  /** 装饰用的大字（该年干支） */
  readonly mark: string | null
  readonly title: string
  readonly summary: string
  /** 按钮 */
  readonly primary: HubSeasonLink
  /** 文字链接；锚文本为目标页主词 */
  readonly secondary: HubSeasonLink | null
}

export interface HubFeatured {
  readonly main: HubTool | null
  readonly season: HubSeason | null
  readonly secondary: readonly HubTool[]
  /** 「全部工具」枢纽页；当前语言没有枢纽页时为 null */
  readonly hub: { readonly href: string; readonly label: string } | null
}

function hubSeason(season: FeaturedSeason, site: SiteId, locale: string): HubSeason | null {
  const [first, second] = season.links
  if (!first) return null
  const link = (tool: DirectoryEntry, label: string): HubSeasonLink => ({
    id: tool.id,
    href: toolHref(tool.path, locale),
    label,
  })
  if (season.kind === 'daily')
    return {
      kind: 'daily',
      badge: null,
      mark: null,
      title: m.home_hub_daily_title(),
      summary: m.home_hub_daily_desc(),
      primary: link(first, withoutArrow(m.home_hub_daily_cta())),
      secondary: null,
    }
  const title = toolTitle(first, site, locale)
  return {
    kind: 'year',
    badge: season.badge,
    mark: season.mark ?? null,
    title: site === 'east' ? m.tools_hub_season_east_title() : title,
    summary:
      site === 'east' ? m.tools_hub_season_east_summary() : m.tools_hub_season_west_summary(),
    primary: link(first, m.tools_hub_season_open({ title })),
    secondary: second ? link(second, toolTitle(second, site, locale)) : null,
  }
}

/**
 * 首页精选（specs/tool-directory「首页精选由主卡、副卡与季节位组成」）：1 张主卡、最多 4 张副卡与 1 个季节位。
 * 只列登记在本站、当前语言有页面的工具，链接不跨站；`today` 为构建日期，决定季节位与小标。
 */
export function hubFeatured(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
  today: string = BUILD_DATE,
): HubFeatured {
  const selection = selectFeatured(site, locale, routes, today)
  const hubPath = routes.some(
    (route) => route.site === site && route.id === TOOLS_HUB_ID && route.paths[locale],
  )
    ? toolsHubPath(site, locale)
    : undefined
  return {
    main: selection.main && hubTool(selection.main, site, locale),
    season: selection.season && hubSeason(selection.season, site, locale),
    secondary: selection.secondary.map((tool) => hubTool(tool, site, locale)),
    hub: hubPath
      ? { href: toolHref(hubPath, locale), label: TOOLS_HUB_TITLES[locale] ?? '' }
      : null,
  }
}
