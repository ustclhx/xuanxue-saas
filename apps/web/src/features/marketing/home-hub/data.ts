import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'
import { DAILY_PATHS } from '../../daily/routes.ts'
import { displayPrice } from '../../readings/price.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { DAILY_LOGIN_CREDITS, DEFAULT_READING_CREDITS } from '../pricing-credits.ts'
import { displayProvider, type PricingCatalog, selectDisplayPrice } from '../pricing-data.ts'

// 落地页的数据层（openspec separate-landing-homepage design.md D2、D2a；前身为 redesign-home-chart-visuals 的首页枢纽）：
// 全部来自项目自有的静态数据——工具注册表、详批大纲常量、构建期价格快照与模板配置——不查库、不发请求，
// 首页因此可完整预渲染，数据库不可达时照常显示。

// 首页精选（openspec content-growth-v2-tools 决策 5）：`FEATURED` 改为主卡、副卡与季节位三部分，按构建日期选择季节窗口。
// 配置与选择在 featured.ts（纯数据，页头下拉也引用），配上文案的视图数据在 featured-data.ts（东方站英文落地页也引用，
// 不带入下方的价格数据）；都从这里再导出，首页相关的数据仍以本文件为入口。
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
  /** 新用户首次登录共得积分（注册赠送 + 当天每日领取，与定价页「首次登录共送」一致）；无注册赠送时为 null */
  readonly firstLoginCredits: number | null
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
  signupBonus: number = templateConfig.billing.signupBonusCredits,
): HubPriceLine | null {
  if (hubPricing(catalog, locale).length === 0) return null
  const daily = credits.enabled && credits.dailyEnabled ? DAILY_LOGIN_CREDITS : null
  return {
    readingCredits: DEFAULT_READING_CREDITS,
    dailyCredits: daily,
    // 单日 5 积分不够一份 10 积分的详批，首页改写首次登录合计（2026-11-18 使用者确认）
    firstLoginCredits: daily !== null && signupBonus > 0 ? signupBonus + daily : null,
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
