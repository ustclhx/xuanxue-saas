import { type Database, plan, planPrice } from '@xuanxue/db'
import { log } from '@xuanxue/shared/log'
import { asc, desc, eq } from 'drizzle-orm'
import type { PricingCatalog } from './pricing-data.ts'

/**
 * 公开展示的价格：有效价格，以及从未同步到支付商的种子价格（支付尚未开通时用于展示金额，标记为
 * 不可购买，且同一套餐/支付商/周期已有有效价格时不返回）。同步后被替换停用的旧价格不返回。
 * 支付可用性由每次请求的运行时配置决定。
 */
export async function readPricingCatalog(db: Database): Promise<PricingCatalog> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pricing database timeout')), 3000)
      }),
    ])
  } catch (error) {
    log.warn('pricing.database_unavailable', { error })
    throw error
  } finally {
    clearTimeout(timer)
  }

  async function read(): Promise<PricingCatalog> {
    const plans = await db
      .select({
        id: plan.id,
        key: plan.key,
        name: plan.name,
        type: plan.type,
        credits: plan.credits,
        creditExpiryDays: plan.creditExpiryDays,
        features: plan.features,
      })
      .from(plan)
      .where(eq(plan.active, true))
      .orderBy(asc(plan.sort))
    const prices = await db
      .select()
      .from(planPrice)
      .orderBy(desc(planPrice.createdAt), desc(planPrice.id))
    return {
      plans,
      prices: prices
        .filter((price) => plans.some((plan) => plan.id === price.planId))
        .filter(
          (price) =>
            price.active ||
            (price.providerPriceId.startsWith('unsynced:') &&
              !prices.some(
                (other) =>
                  other.active &&
                  other.planId === price.planId &&
                  other.provider === price.provider &&
                  other.interval === price.interval,
              )),
        )
        .map(({ providerPriceId, createdAt: _createdAt, updatedAt: _updatedAt, ...price }) => ({
          ...price,
          available:
            price.active &&
            Boolean(providerPriceId) &&
            !providerPriceId.startsWith('unsynced:') &&
            price.currency.toUpperCase() === 'USD',
        })),
      providers: [],
    }
  }
}
