import type { SiteId } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { DAILY_PATHS } from '../../daily/routes.ts'
import { displayPrice } from '../../readings/price.ts'
import { TOOL_ROUTES, type ToolRoute, toolsForSite } from '../../tools/registry.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { displayProvider, type PricingCatalog, selectDisplayPrice } from '../pricing-data.ts'

// 首页枢纽区块的数据层（openspec redesign-home-chart-visuals tasks 9.1、design D2）：
// 全部来自项目自有的静态数据——工具注册表、详批大纲常量、构建期价格快照——不查库、不发请求，
// 首页因此可完整预渲染，数据库不可达时照常显示（home-hub「首页枢纽不依赖数据库」）。

/** 工具矩阵的显示顺序；注册表中其余可导航的本站工具排在后面 */
const TOOL_ORDER: Record<SiteId, readonly string[]> = {
  east: ['bazi', 'ziwei', 'mingpan', 'saju-gunghap', 'tarot-three-card'],
  west: ['life-path', 'numerology-calculator', 'life-path-compatibility', 'tarot-three-card'],
}

/** 工具卡的一句话说明（文案在 home-hub.json）；没有时用注册表的 SEO 描述 */
const TOOL_SUMMARY: Record<string, () => string> = {
  bazi: m.home_hub_tool_bazi,
  ziwei: m.home_hub_tool_ziwei,
  mingpan: m.home_hub_tool_mingpan,
  'saju-gunghap': m.home_hub_tool_saju_gunghap,
  'tarot-three-card': m.home_hub_tool_tarot_three_card,
  'life-path': m.home_hub_tool_life_path,
  'numerology-calculator': m.home_hub_tool_numerology_calculator,
  'life-path-compatibility': m.home_hub_tool_life_path_compatibility,
}

export interface HubTool {
  readonly id: string
  readonly title: string
  readonly summary: string
  /** 同站、同语言的站内地址 */
  readonly href: string
}

/** 当前站点、当前语言有页面的工具：只取登记在本站的工具，链接不跨站 */
export function hubTools(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): HubTool[] {
  const order = TOOL_ORDER[site]
  const rank = (id: string) => {
    const index = order.indexOf(id)
    return index === -1 ? order.length : index
  }
  return toolsForSite(site, locale, routes)
    .map((tool, index) => ({ tool, index }))
    .sort((a, b) => rank(a.tool.id) - rank(b.tool.id) || a.index - b.index)
    .map(({ tool }) => {
      const route = routes.find((r) => r.id === tool.id)
      return {
        id: tool.id,
        title: tool.title,
        summary: TOOL_SUMMARY[tool.id]?.() ?? route?.descriptions?.[locale] ?? '',
        href: toolHref(tool.path, locale),
      }
    })
}

export interface HubPrice {
  readonly key: string
  readonly name: string
  readonly credits: number
  /** 「NT$65」 */
  readonly price: string
  /** zh-Hans 的人民币参考价 */
  readonly reference: string | null
}

const PACK_NAMES: Record<string, () => string> = {
  reading_single: m.pricing_pack_single,
  reading_five: m.pricing_pack_five,
}

/**
 * 定价入口：与定价页同一份构建期价格快照、同一选价规则（主展示平台 + 界面语言的结算币种），
 * 只列可购买的积分包。定价页目前不出售订阅（模板遗留套餐），这里同样不列；订阅上架后与定价页一起放开。
 * 没有可购买的方案时返回空数组，区块只显示免费说明与定价页链接，不出现金额。
 */
export function hubPricing(catalog: PricingCatalog, locale: string): HubPrice[] {
  const provider = displayProvider(catalog)
  if (!provider) return []
  return catalog.plans
    .filter((plan) => plan.type === 'credit_pack' && plan.credits > 0)
    .flatMap((plan) => {
      const prices = catalog.prices.filter(
        (price) => price.planId === plan.id && price.interval === null,
      )
      const price = selectDisplayPrice(prices, locale, provider)
      if (!price || !prices.some((item) => item.available)) return []
      const display = displayPrice({ amount: price.amount, currency: price.currency }, locale)
      return [
        {
          key: plan.key,
          name: PACK_NAMES[plan.key]?.() ?? plan.name,
          credits: plan.credits,
          price: display.text,
          reference: display.reference,
        },
      ]
    })
    .sort((a, b) => a.credits - b.credits)
}

/**
 * 公开每日运势页登记表（home-hub「每日运势入口」）：每日运势页由 add-birth-profiles-daily-horoscope 实现，
 * 路由合并、在该语言上线后在这里登记路径（D9：/每日運勢、/每日运势、/오늘의-운세、/daily-numerology），
 * 首页才显示入口卡片；未登记时不渲染，也不出现「即将开放」。
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
