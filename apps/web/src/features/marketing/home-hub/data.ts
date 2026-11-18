import type { SiteId } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'
import { DAILY_PATHS } from '../../daily/routes.ts'
import { displayPrice } from '../../readings/price.ts'
import { TOOL_ROUTES, type ToolRoute, toolsForSite } from '../../tools/registry.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { DAILY_LOGIN_CREDITS, DEFAULT_READING_CREDITS } from '../pricing-credits.ts'
import { displayProvider, type PricingCatalog, selectDisplayPrice } from '../pricing-data.ts'

// 落地页的数据层（openspec separate-landing-homepage design.md D2、D2a；前身为 redesign-home-chart-visuals 的首页枢纽）：
// 全部来自项目自有的静态数据——工具注册表、详批大纲常量、构建期价格快照与模板配置——不查库、不发请求，
// 首页因此可完整预渲染，数据库不可达时照常显示。

/** 精选工具入口的上限（home-hub「工具矩阵」：3–4 个） */
export const FEATURED_LIMIT = 4

/**
 * 精选入口与顺序（使用者 2026-11-17 在画布上确认，design.md D2a）：按顺序取当前语言有页面的前 4 个。
 * 东方站中文为八字排盤、紫微斗數、三張牌塔羅、命盤查詢；韩语没有紫微与命盤查詢，为만세력、사주궁합、쓰리 카드 타로。
 * 每日运势只在今日条出现，不进入口。
 */
const FEATURED: Record<SiteId, readonly string[]> = {
  east: ['bazi', 'ziwei', 'saju-gunghap', 'tarot-three-card', 'mingpan'],
  west: ['life-path', 'numerology-calculator', 'tarot-three-card'],
}

/** 入口卡片下方的一行文字链接（西方站 Compatibility），不占入口名额 */
const MORE_TOOL: Partial<Record<SiteId, string>> = { west: 'life-path-compatibility' }

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

/** 卡片上的名称与注册表导航名不同的工具（注册表中 life-path 的导航名是「Life Path」） */
const TOOL_TITLE: Record<string, () => string> = {
  'life-path': m.landing_tool_title_life_path,
}

/** 工具卡的大号字形（站点强调色，对读屏隐藏）与链接文字 */
const TOOL_GLYPH: Record<string, () => string> = {
  bazi: m.landing_tool_glyph_bazi,
  ziwei: m.landing_tool_glyph_ziwei,
  mingpan: m.landing_tool_glyph_mingpan,
  'saju-gunghap': m.landing_tool_glyph_saju_gunghap,
  'tarot-three-card': m.landing_tool_glyph_tarot,
  'life-path': m.landing_tool_glyph_life_path,
  'numerology-calculator': m.landing_tool_glyph_numerology_calculator,
}

const TOOL_ACTION: Record<string, () => string> = {
  bazi: m.landing_tool_cta_bazi,
  ziwei: m.landing_tool_cta_ziwei,
  mingpan: m.landing_tool_cta_mingpan,
  'saju-gunghap': m.landing_tool_cta_saju_gunghap,
  'tarot-three-card': m.landing_tool_cta_tarot,
  'life-path': m.landing_tool_cta_life_path,
  'numerology-calculator': m.landing_tool_cta_numerology_calculator,
}

export interface HubTool {
  readonly id: string
  readonly title: string
  readonly summary: string
  /** 同站、同语言的站内地址 */
  readonly href: string
  readonly glyph: string
  /** 卡片底部的链接文字，如「開始排盤 →」 */
  readonly action: string
}

function hubTool(
  tool: { id: string; path: string; title: string },
  locale: string,
  routes: readonly ToolRoute[],
): HubTool {
  const route = routes.find((item) => item.id === tool.id)
  return {
    id: tool.id,
    title: TOOL_TITLE[tool.id]?.() ?? tool.title,
    summary: TOOL_SUMMARY[tool.id]?.() ?? route?.descriptions?.[locale] ?? '',
    href: toolHref(tool.path, locale),
    glyph: TOOL_GLYPH[tool.id]?.() ?? '',
    action: TOOL_ACTION[tool.id]?.() ?? '',
  }
}

/** 精选工具入口：只取登记在本站、当前语言有页面的工具，按精选顺序最多 4 个，链接不跨站 */
export function hubTools(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): HubTool[] {
  const available = toolsForSite(site, locale, routes)
  return FEATURED[site]
    .flatMap((id) => available.filter((tool) => tool.id === id))
    .slice(0, FEATURED_LIMIT)
    .map((tool) => hubTool(tool, locale, routes))
}

/** 入口卡片下方的文字链接；该站点没有或当前语言没有页面时为 null */
export function hubMoreTool(
  site: SiteId,
  locale: string,
  routes: readonly ToolRoute[] = TOOL_ROUTES,
): Pick<HubTool, 'id' | 'href'> | null {
  const tool = toolsForSite(site, locale, routes).find((item) => item.id === MORE_TOOL[site])
  return tool ? { id: tool.id, href: toolHref(tool.path, locale) } : null
}

export interface HubPrice {
  readonly key: string
  readonly name: string
  readonly credits: number
  /** 「NT$97」 */
  readonly price: string
  /** zh-Hans 的人民币参考价 */
  readonly reference: string | null
}

const PACK_NAMES: Record<string, () => string> = {
  reading_single: m.pricing_pack_single,
  reading_five: m.pricing_pack_five,
}

/**
 * 可购买的积分包：与定价页同一份构建期价格快照、同一选价规则（主展示平台 + 界面语言的结算币种）。
 * 首页不显示金额，只用它判断当前语言是否有可购买的方案（见 hubPriceLine）。
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

export interface HubPriceLine {
  /** 每份详批所需积分 */
  readonly readingCredits: number
  /** 每日登录赠送积分；未开启每日赠送时为 null */
  readonly dailyCredits: number | null
}

/**
 * 首页一行价格（home-hub「定价与订阅入口」）：每份详批积分数与每日登录赠送积分数，与定价页取自同一份配置
 * （pricing-credits.ts 与模板配置的每日赠送开关）。当前语言没有可购买的方案时返回 null，
 * 首页只显示免费说明与定价页链接，不出现数字。
 */
export function hubPriceLine(
  catalog: PricingCatalog,
  locale: string,
  credits: { readonly enabled: boolean; readonly dailyEnabled: boolean } = templateConfig.credits,
): HubPriceLine | null {
  if (hubPricing(catalog, locale).length === 0) return null
  return {
    readingCredits: DEFAULT_READING_CREDITS,
    dailyCredits: credits.enabled && credits.dailyEnabled ? DAILY_LOGIN_CREDITS : null,
  }
}

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
