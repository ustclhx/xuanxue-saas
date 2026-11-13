import { describe, expect, it, vi } from 'vitest'
import { examplePricingCatalog } from '../../../scripts/pricing-snapshot.ts'
import {
  createPricingCache,
  groupPricingPlans,
  marketingPlans,
  PRICING_RETRY_MS,
  PRICING_TTL_MS,
  pricingFeatures,
  pricingForInterval,
  selectDisplayPrice,
} from './pricing-data.ts'

describe('公开定价缓存（tasks.md 3.2）', () => {
  it('一小时内复用读取结果，到期后展示更新的价格', async () => {
    const snapshot = examplePricingCatalog()
    let now = 1000
    let amount = 1900
    const read = vi.fn(async () => ({
      ...snapshot,
      prices: snapshot.prices.map((price) => ({ ...price, amount })),
    }))
    const cached = createPricingCache(snapshot, () => now)
    expect((await cached(read)).prices[0]?.amount).toBe(1900)
    amount = 2900
    now += PRICING_TTL_MS - 1
    expect((await cached(read)).prices[0]?.amount).toBe(1900)
    expect(read).toHaveBeenCalledTimes(1)
    now++
    expect((await cached(read)).prices[0]?.amount).toBe(2900)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('数据库不可达时：首次返回构建数据，之后沿用上次成功的数据，并在一分钟后重试', async () => {
    const snapshot = examplePricingCatalog()
    let now = 1000
    const cached = createPricingCache(snapshot, () => now)
    const offline = vi.fn(async () => {
      throw new Error('Database unavailable')
    })
    expect(await cached(offline)).toBe(snapshot)
    await cached(offline)
    expect(offline).toHaveBeenCalledTimes(1)
    // 失败后一分钟即重试，数据库恢复后立即展示实时数据
    const live = { ...snapshot, prices: snapshot.prices.map((p) => ({ ...p, amount: 4900 })) }
    now += PRICING_RETRY_MS
    expect(await cached(async () => live)).toBe(live)
    // 刷新失败时不退回构建快照，继续展示上次成功读取的数据
    now += PRICING_TTL_MS
    expect(await cached(offline)).toBe(live)
    expect(offline).toHaveBeenCalledTimes(2)
    now += PRICING_RETRY_MS - 1
    await cached(offline)
    expect(offline).toHaveBeenCalledTimes(2)
    now++
    await cached(offline)
    expect(offline).toHaveBeenCalledTimes(3)
  })

  it('groups subscriptions and packs while changing only subscription intervals and retaining features', () => {
    const catalog = examplePricingCatalog()
    const groups = groupPricingPlans(marketingPlans(catalog))
    expect(groups.subscriptions.every((plan) => plan.type === 'subscription')).toBe(true)
    expect(groups.creditPacks.length).toBeGreaterThan(0)
    for (const plan of groups.subscriptions) {
      expect(pricingForInterval(plan, 'year').every((price) => price.interval === 'year')).toBe(
        true,
      )
      expect(plan.features).toEqual(catalog.plans.find((entry) => entry.key === plan.key)?.features)
      expect(pricingFeatures(plan.features)).toContainEqual({
        key: 'maxConcurrentTasks',
        value: plan.features.maxConcurrentTasks,
      })
    }
    for (const pack of groups.creditPacks)
      expect(pricingForInterval(pack, 'year')).toEqual(pricingForInterval(pack, 'month'))
  })

  it('仅有积分包的目录在两种订阅周期下仍返回全部一次性价格', () => {
    const catalog = examplePricingCatalog()
    const packPlans = catalog.plans.filter((plan) => plan.type === 'credit_pack')
    const groups = groupPricingPlans(marketingPlans({ ...catalog, plans: packPlans }))
    expect(groups.subscriptions).toEqual([])
    expect(groups.creditPacks.map((plan) => plan.key)).toEqual(packPlans.map((plan) => plan.key))
    expect(groups.creditPacks.length).toBeGreaterThan(0)
    for (const pack of groups.creditPacks) {
      const prices = pricingForInterval(pack, 'month')
      expect(prices.length).toBeGreaterThan(0)
      expect(prices.every((price) => price.interval === null)).toBe(true)
      expect(pricingForInterval(pack, 'year')).toEqual(prices)
    }
  })

  it('区块展示积分包的积分与价格，并合并不同支付渠道的同周期报价', () => {
    const plans = marketingPlans(examplePricingCatalog())
    const single = plans.find((plan) => plan.key === 'reading_single')
    expect(single).toMatchObject({ credits: 100 })
    // 不同支付渠道的同周期同币种报价合并为一项，价目表的每个结算币种各保留一项
    expect(single?.prices.map((p) => [p.interval, p.currency, p.amount])).toEqual([
      [null, 'USD', 199],
      [null, 'TWD', 6500],
      [null, 'KRW', 2800],
    ])
  })
})

describe('展示选价（localize-checkout-currency 5.1）', () => {
  const row = (provider: string, currency: string, available = true) => ({
    id: `${provider}-${currency}`,
    planId: 'pack',
    provider,
    interval: null,
    currency,
    available,
  })
  const prices = [
    row('stripe', 'USD'),
    row('stripe', 'TWD'),
    row('stripe', 'KRW'),
    row('paypal', 'USD'),
  ]

  it.each([
    ['zh-Hant', 'stripe', 'stripe-TWD'],
    ['ko', 'stripe', 'stripe-KRW'],
    ['zh-Hans', 'stripe', 'stripe-USD'],
    ['en', 'stripe', 'stripe-USD'],
    ['ko', 'paypal', 'paypal-USD'],
    ['zh-Hant', 'paypal', 'paypal-USD'],
  ])('%s + %s 展示 %s', (locale, provider, id) => {
    expect(selectDisplayPrice(prices, locale, provider)?.id).toBe(id)
  })

  it('本地价格缺失或不可购买时显示 USD', () => {
    expect(selectDisplayPrice([row('stripe', 'USD')], 'zh-Hant', 'stripe')?.id).toBe('stripe-USD')
    expect(
      selectDisplayPrice([row('stripe', 'USD'), row('stripe', 'KRW', false)], 'ko', 'stripe')?.id,
    ).toBe('stripe-USD')
  })

  it('支付尚未开通时按目标币种展示金额', () => {
    const closed = prices.map((price) => ({ ...price, available: false }))
    expect(selectDisplayPrice(closed, 'ko', 'stripe')?.id).toBe('stripe-KRW')
  })
})
