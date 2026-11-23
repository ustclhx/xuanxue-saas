import { DAILY_PATHS } from '../../daily/routes.ts'
import { toolHref } from '../../tools/tool-href.ts'

// 首页精选（openspec content-growth-v2-tools 决策 5）：`FEATURED` 改为主卡、副卡与季节位三部分，按构建日期选择季节窗口。
// 配置与选择在 featured.ts（页头下拉也引用），视图文案在 featured-data.ts（东方站英文落地页也引用）。
export {
  FEATURED,
  FEATURED_MAIN_LIMIT,
  FEATURED_SECONDARY_LIMIT,
  selectFeatured,
} from './featured.ts'
export {
  type HubFeatured,
  type HubSeason,
  type HubSeasonLink,
  type HubTool,
  hubFeatured,
  hubTool,
} from './featured-data.ts'

/**
 * 公开每日运势页登记表（home-hub「每日运势入口」）：每日运势页由 add-birth-profiles-daily-horoscope 实现，
 * 路由合并、在该语言上线后在这里登记路径（D9：/每日運勢、/每日运势、/오늘의-운세、/daily-numerology），
 * 首页才显示今日条；未登记时不渲染，也不出现「即将开放」。
 */
// 每日运势页已上线（#152），直接取其规范地址；routes.ts 只含数据，不引入运行时模块
export const DAILY_PAGES: Readonly<Partial<Record<string, string>>> = DAILY_PATHS

export function dailyEntryHref(
  locale: string,
  pages: Readonly<Partial<Record<string, string>>> = DAILY_PAGES,
): string | null {
  const path = pages[locale]
  return path ? toolHref(path, locale) : null
}
