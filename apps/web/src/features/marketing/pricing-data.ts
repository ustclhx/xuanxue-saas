import { currencyFor, selectCurrencyPrice } from '@xuanxue/billing/currency'
import type { PlanFeatures } from '@xuanxue/db'
import type { customerCatalog } from '../billing/customer-data.ts'

export type BillingInterval = 'month' | 'year'

/**
 * 定价区块展示的套餐，字段对应 `plan` 与 `plan_price`（金额为最小货币单位）。
 * 首屏使用构建快照，浏览器经公开读取函数刷新；结账仍由服务端读取实时价格。
 */
export interface PricingPlan {
  readonly key: string
  readonly name: string
  readonly type: 'subscription' | 'credit_pack'
  readonly credits: number
  readonly creditExpiryDays: number | null
  readonly features: PlanFeatures
  readonly maxSeats: number | null
  readonly storageGb: number | null
  readonly highlighted?: boolean
  readonly prices: readonly {
    readonly interval: BillingInterval | null
    readonly amount: number
    readonly currency: string
  }[]
}

export type PricingCatalog = Awaited<ReturnType<typeof customerCatalog>>
export const PRICING_TTL_MS = 60 * 60 * 1000
/** 读取失败后的重试间隔：数据库短暂不可达时不应锁定一小时的降级数据 */
export const PRICING_RETRY_MS = 60 * 1000

/**
 * 只保存普通数据；Worker 的数据库客户端和 I/O Promise 不跨请求复用。
 * 读取失败时沿用上一次成功读取的数据（没有时才用构建快照），并在 `PRICING_RETRY_MS` 后重试。
 */
export function createPricingCache(snapshot: PricingCatalog, now = Date.now) {
  let catalog = snapshot
  let expiresAt = 0
  return async (read: () => Promise<PricingCatalog>): Promise<PricingCatalog> => {
    if (now() < expiresAt) return catalog
    try {
      catalog = await read()
      expiresAt = now() + PRICING_TTL_MS
    } catch {
      expiresAt = now() + PRICING_RETRY_MS
    }
    return catalog
  }
}

export function marketingPlans(catalog: PricingCatalog): PricingPlan[] {
  return catalog.plans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    type: plan.type,
    credits: plan.credits,
    creditExpiryDays: plan.creditExpiryDays,
    features: plan.features,
    maxSeats: plan.features.maxSeats,
    storageGb: plan.features.storageGb,
    highlighted: plan.key === 'pro',
    prices: catalog.prices
      .filter((price) => price.planId === plan.id)
      .filter(
        (price, index, prices) =>
          prices.findIndex(
            (other) => other.interval === price.interval && other.currency === price.currency,
          ) === index,
      ),
  }))
}

export type PricingFeature =
  | { key: 'maxSeats' | 'storageGb' | 'maxConcurrentTasks'; value: number }
  | { key: 'publicApi' | 'priorityQueue' | 'watermark'; value: boolean }
  | { key: 'models'; value: readonly string[] }

/** Stable keys let each UI localize labels without hardcoding plan-specific promises. */
export function pricingFeatures(features: PlanFeatures): PricingFeature[] {
  return [
    { key: 'maxSeats', value: features.maxSeats },
    { key: 'storageGb', value: features.storageGb },
    { key: 'maxConcurrentTasks', value: features.maxConcurrentTasks },
    { key: 'publicApi', value: features.publicApi },
    { key: 'priorityQueue', value: features.priorityQueue },
    { key: 'watermark', value: features.watermark },
    { key: 'models', value: features.models },
  ]
}

export function groupPricingPlans<T extends { readonly type: 'subscription' | 'credit_pack' }>(
  plans: readonly T[],
) {
  return {
    subscriptions: plans.filter((plan) => plan.type === 'subscription'),
    creditPacks: plans.filter((plan) => plan.type === 'credit_pack'),
  }
}

export function pricingForInterval<P extends { readonly interval: BillingInterval | null }>(
  plan: { readonly type: 'subscription' | 'credit_pack'; readonly prices: readonly P[] },
  interval: BillingInterval,
): P[] {
  return plan.prices.filter(
    (price) => price.interval === (plan.type === 'subscription' ? interval : null),
  )
}

/** 当前周期展示的价格：积分包只有一次性价格，不随月付/年付切换变化 */
export function planPrice<P extends { readonly interval: BillingInterval | null }>(
  plan: { readonly type: 'subscription' | 'credit_pack'; readonly prices: readonly P[] },
  interval: BillingInterval,
): P | undefined {
  return pricingForInterval(plan, interval)[0]
}

/** 订阅卡展示的价格：年付模式下只有月价的套餐回退显示月价，并标记 `monthlyOnly` */
export function subscriptionDisplayPrice<P extends { readonly interval: BillingInterval | null }>(
  plan: { readonly type: 'subscription' | 'credit_pack'; readonly prices: readonly P[] },
  interval: BillingInterval,
): { price: P; interval: BillingInterval; monthlyOnly: boolean } | undefined {
  const price = planPrice(plan, interval)
  if (price) return { price, interval, monthlyOnly: false }
  const monthly = interval === 'year' ? planPrice(plan, 'month') : undefined
  return monthly ? { price: monthly, interval: 'month', monthlyOnly: true } : undefined
}

/**
 * 年付相对 12 个月月付的节省比例（同币种比较）。各套餐比例不同时 `uniform` 为 false，
 * 标签改为「最高省」；没有可比价格时 `max` 为 0。
 */
export function yearlySavings(subscriptions: readonly Pick<PricingPlan, 'prices'>[]): {
  max: number
  uniform: boolean
} {
  const percents = new Set<number>()
  for (const plan of subscriptions) {
    for (const year of plan.prices.filter((price) => price.interval === 'year')) {
      const month = plan.prices.find(
        (price) => price.interval === 'month' && price.currency === year.currency,
      )
      if (!month || month.amount <= 0) continue
      percents.add(Math.round((1 - year.amount / (month.amount * 12)) * 100))
    }
  }
  return { max: Math.max(0, ...percents), uniform: percents.size <= 1 }
}

/** 积分包有效期：全部长期有效时为 null，否则取最短天数，规则说明不夸大有效期 */
export function packExpiryDays(
  packs: readonly Pick<PricingPlan, 'creditExpiryDays'>[],
): number | null {
  const days = packs
    .map((pack) => pack.creditExpiryDays)
    .filter((value): value is number => value !== null)
  return days.length ? Math.min(...days) : null
}

interface DisplayablePrice {
  readonly planId: string
  readonly provider: string
  readonly interval: BillingInterval | null
  readonly currency: string
  readonly available: boolean
}

/**
 * 页面展示的价格行（localize-checkout-currency D5）：与结账的服务端选价使用同一规则——
 * 在该支付平台的可购买行中按界面语言的结算币种选，缺失时回退 USD，因此展示币种与扣款一致。
 * 支付尚未开通（没有可购买行）时只用于展示金额，同样按目标币种选、回退 USD。
 */
export function selectDisplayPrice<P extends DisplayablePrice>(
  prices: readonly P[],
  locale: string,
  provider: string,
): P | undefined {
  const own = prices.filter((price) => price.provider === provider)
  const target = currencyFor(locale, provider)
  const available = own.filter((price) => price.available)
  return available.length
    ? selectCurrencyPrice(available, target)
    : selectCurrencyPrice(own, target)
}

/** 每个 (套餐, 周期) 只保留一行展示价格，顺序沿用输入 */
export function displayPrices<P extends DisplayablePrice>(
  prices: readonly P[],
  locale: string,
  provider: string,
): P[] {
  const groups = new Map<string, P[]>()
  for (const price of prices) {
    if (price.provider !== provider) continue
    const key = `${price.planId}:${price.interval}`
    groups.set(key, [...(groups.get(key) ?? []), price])
  }
  return [...groups.values()].flatMap((group) => {
    const chosen = selectDisplayPrice(group, locale, provider)
    return chosen ? [chosen] : []
  })
}

/** 公开页的主展示平台：template.config 顺序中第一个可用的平台，都不可用时取第一个出现的平台 */
export function displayProvider(catalog: {
  readonly providers: readonly { readonly id: string; readonly available: boolean }[]
  readonly prices: readonly { readonly provider: string }[]
}): string | undefined {
  return (
    catalog.providers.find((provider) => provider.available)?.id ??
    catalog.providers[0]?.id ??
    catalog.prices[0]?.provider
  )
}
