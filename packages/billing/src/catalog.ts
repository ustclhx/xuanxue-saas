import { type Database, type Plan, type PlanPrice, plan, planPrice } from '@xuanxue/db'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { newId } from '@xuanxue/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { assertMinorAmount, type EnabledCurrency, providerSettlesIn } from './currency.ts'
import { creditPackId } from './paypal/metadata.ts'
import { type CatalogPrice, tablePrices } from './price-table.ts'
import type { PaymentProvider } from './provider.ts'

/**
 * Template examples; sold plans take their multi-currency prices from the project price table
 * (`price-table.ts`). Model permissions are managed in the admin console.
 */
export const EXAMPLE_CATALOG = [
  {
    key: 'free',
    name: 'Free',
    type: 'subscription',
    credits: 0,
    creditExpiryDays: null,
    rollover: false,
    features: DEFAULT_FREE_FEATURES,
    sort: 0,
    active: true,
    prices: [],
  },
  {
    key: 'pro',
    name: 'Pro (template example)',
    type: 'subscription',
    credits: 1000,
    creditExpiryDays: null,
    rollover: false,
    features: {
      ...DEFAULT_FREE_FEATURES,
      models: [],
      maxConcurrentTasks: 10,
      storageGb: 50,
      watermark: false,
    },
    sort: 10,
    // 暂不销售订阅：停用且不再同步价格；重跑 seed 会把已有行置为停用，结账因 plan.active 被拒绝。
    active: false,
    prices: [],
  },
  {
    key: 'team',
    name: 'Team (template example)',
    type: 'subscription',
    credits: 5000,
    creditExpiryDays: null,
    rollover: false,
    features: {
      ...DEFAULT_FREE_FEATURES,
      models: [],
      maxConcurrentTasks: 30,
      maxSeats: 10,
      storageGb: 200,
      publicApi: true,
      priorityQueue: true,
      watermark: false,
    },
    sort: 20,
    // 同 pro：暂不销售订阅。
    active: false,
    prices: [],
  },
  // 平台管理员自测用内部套餐：不在售（active: false、无价格），仅作为 admin 个人空间的权益基线（packages/entitlements）。
  {
    key: 'staff',
    name: 'Staff (platform admin)',
    type: 'subscription',
    credits: 0,
    creditExpiryDays: null,
    rollover: false,
    features: {
      ...DEFAULT_FREE_FEATURES,
      models: ['*'],
      maxConcurrentTasks: 10,
      storageGb: 50,
      watermark: false,
    },
    sort: 1000,
    active: false,
    prices: [],
  },
  // 详批积分包（add-reading-monetization design 决策 4）：1 次详批 = 100 积分。
  // 价格来自价目表，每个结算币种一行（localize-checkout-currency D1/D2）。
  {
    key: 'reading_single',
    name: 'Single Reading',
    type: 'credit_pack',
    credits: 100,
    creditExpiryDays: 365,
    rollover: false,
    features: DEFAULT_FREE_FEATURES,
    sort: 0,
    active: true,
    prices: tablePrices('reading_single'),
  },
  {
    key: 'reading_five',
    name: '5-Reading Pack',
    type: 'credit_pack',
    credits: 500,
    creditExpiryDays: 365,
    rollover: false,
    features: DEFAULT_FREE_FEATURES,
    sort: 10,
    active: true,
    prices: tablePrices('reading_five'),
  },
  // 两档月付订阅（enable-subscriptions-daily-credits D1）：不复用模板示例 pro/team。只有月付价格，
  // 每期积分在周期末加宽限后过期、不结转；权益沿用免费档，模型授权由后台给予，激活前须覆盖免费档（D2）。
  // 放在积分包之后：同步按数组顺序进行，订阅模型检查不通过时积分包已同步完成、不受阻塞。
  {
    key: 'plus',
    name: 'Plus',
    type: 'subscription',
    credits: 400,
    creditExpiryDays: null,
    rollover: false,
    features: DEFAULT_FREE_FEATURES,
    sort: 30,
    active: true,
    prices: tablePrices('plus'),
  },
  {
    key: 'premium',
    name: 'Premium',
    type: 'subscription',
    credits: 1000,
    creditExpiryDays: null,
    rollover: false,
    features: DEFAULT_FREE_FEATURES,
    sort: 40,
    active: true,
    prices: tablePrices('premium'),
  },
] satisfies (Omit<typeof plan.$inferInsert, 'id'> & {
  prices: CatalogPrice[]
})[]

/** 写入任何数据或调用平台之前校验目录金额：TWD 必须是整元等币种约束 */
function assertCatalogAmounts() {
  for (const entry of EXAMPLE_CATALOG)
    for (const price of entry.prices as CatalogPrice[])
      assertMinorAmount(price.amount, price.currency)
}

/**
 * 订阅首发只经这些平台提供（enable-subscriptions-daily-credits D3）：PayPal 不建订阅价格行，
 * 结账因找不到该平台的价格返回 BILLING_PRICE_UNAVAILABLE，页面也就不显示 PayPal 的订阅选项。
 */
export const SUBSCRIPTION_PROVIDERS: readonly PlanPrice['provider'][] = ['stripe']

/** 该平台要建价格行的目录价格：PayPal 只建 USD（localize-checkout-currency 决策 2），且只建一次性价格 */
function providerPrices(prices: readonly CatalogPrice[], provider: PlanPrice['provider']) {
  return prices.filter(
    (price) =>
      providerSettlesIn(provider, price.currency) &&
      (price.interval === null || SUBSCRIPTION_PROVIDERS.includes(provider)),
  )
}

export interface SubscriptionModelGap {
  readonly key: string
  /** 免费档已授权、该订阅套餐缺少的模型 */
  readonly missing: readonly string[]
}

/** 套餐模型授权是否覆盖某个模型：`*` 表示全部 */
function grants(models: readonly string[], model: string) {
  return models.includes('*') || models.includes(model)
}

/**
 * 在售订阅套餐的模型授权必须覆盖免费档（D2）：权益取最高生效套餐，订阅套餐少授权会让用户订阅后反而失去模型。
 * 纯函数，供同步前断言与只读诊断共用；免费档缺失时没有比较基线，视为无缺口。
 */
export function subscriptionModelGaps(
  plans: readonly {
    readonly key: string
    readonly type: string
    readonly active: boolean
    readonly features: { readonly models: readonly string[] }
  }[],
): SubscriptionModelGap[] {
  const free = plans.find((row) => row.key === 'free')?.features.models ?? []
  return plans
    .filter((row) => row.type === 'subscription' && row.active && row.key !== 'free')
    .filter((row) =>
      EXAMPLE_CATALOG.some((entry) => entry.key === row.key && entry.prices.length > 0),
    )
    .map((row) => ({
      key: row.key,
      missing: free.filter((model) => !grants(row.features.models, model)),
    }))
}

/** 只读诊断：每个在售订阅套餐一行，列出是否覆盖免费档模型；不写库、不调用平台 */
export async function describeSubscriptionModels(db: Database): Promise<string[]> {
  const gaps = subscriptionModelGaps(
    await db.select().from(plan).where(eq(plan.type, 'subscription')),
  )
  return gaps.map(({ key, missing }) =>
    missing.length
      ? `Model grants: ${key} MISSING free models: ${missing.join(', ')}`
      : `Model grants: ${key} OK (covers free tier)`,
  )
}

function assertSubscriptionModels(plans: Parameters<typeof subscriptionModelGaps>[0], key: string) {
  const gap = subscriptionModelGaps(plans).find((row) => row.key === key)
  if (gap?.missing.length)
    throw new Error(
      `Subscription plan ${key} must be granted every free-tier model before activation (missing: ${gap.missing.join(', ')})`,
    )
}

const PROVIDERS = ['stripe', 'paypal'] as const
function tuple(
  planId: string,
  provider: PlanPrice['provider'],
  { interval, amount, currency }: CatalogPrice,
) {
  return and(
    eq(planPrice.planId, planId),
    eq(planPrice.provider, provider),
    interval === null ? isNull(planPrice.interval) : eq(planPrice.interval, interval),
    eq(planPrice.amount, amount),
    eq(planPrice.currency, currency satisfies EnabledCurrency),
  )
}

/** Database only: no provider construction, credentials, or network access. */
export async function seedCatalog(db: Database): Promise<void> {
  assertCatalogAmounts()
  await db.transaction(async (tx) => {
    for (const { prices, ...values } of EXAMPLE_CATALOG) {
      const [localPlan] = await tx
        .insert(plan)
        .values(values)
        .onConflictDoUpdate({
          target: plan.key,
          set: {
            ...values,
            // 重跑 seed 保留后台授权；在同一个 upsert 内合并，避免覆盖并发编辑。
            features: sql`excluded.features || jsonb_build_object('models', ${plan.features}->'models')`,
          },
        })
        .returning()
      if (!localPlan) throw new Error('Catalog plan upsert returned no row')
      // The upsert locks the plan until commit, serializing tuple creation across seed runs.
      for (const provider of PROVIDERS) {
        for (const price of providerPrices(prices, provider)) {
          const existing = await tx
            .select()
            .from(planPrice)
            .where(tuple(localPlan.id, provider, price))
          if (existing.length) continue
          const id = newId()
          await tx.insert(planPrice).values({
            id,
            planId: localPlan.id,
            provider,
            providerPriceId: `unsynced:${provider}:${id}`,
            interval: price.interval,
            amount: price.amount,
            currency: price.currency,
            active: false,
          })
        }
      }
    }
  })
}

/** Database-only activation: never constructs a provider or changes subscription prices. */
export async function activateCreditPackMappings(
  db: Database,
  provider: 'paypal',
): Promise<number> {
  return db.transaction(async (tx) => {
    let changed = 0
    const packs = await tx.select().from(plan).where(eq(plan.type, 'credit_pack')).for('update')
    for (const pack of packs) {
      const example = EXAMPLE_CATALOG.find(
        (entry) => entry.type === 'credit_pack' && entry.key === pack.key,
      )
      const currentIds = new Set<string>()
      for (const intended of providerPrices(example?.prices ?? [], provider)) {
        const prices = await tx
          .select()
          .from(planPrice)
          .where(tuple(pack.id, provider, intended))
        if (prices.length !== 1)
          throw new Error(
            `Expected one seeded price for ${pack.key}/${provider}/${intended.currency}`,
          )
        const price = prices[0] as PlanPrice
        currentIds.add(price.id)
        const mapping = creditPackId(price.id)
        if (price.providerPriceId === mapping && price.active === pack.active) continue
        await tx
          .update(planPrice)
          .set({ providerPriceId: mapping, active: pack.active })
          .where(eq(planPrice.id, price.id))
        changed++
      }
      // 旧金额、币种或已移出目录的积分包保留映射，只停止售卖。
      const prices = await tx
        .select()
        .from(planPrice)
        .where(and(eq(planPrice.planId, pack.id), eq(planPrice.provider, provider)))
      for (const price of prices) {
        if (currentIds.has(price.id) || !price.active) continue
        await tx.update(planPrice).set({ active: false }).where(eq(planPrice.id, price.id))
        changed++
      }
    }
    return changed
  })
}

/** Sync only current example tuples; obsolete immutable prices retain their historical mapping. */
export async function syncCatalog(
  db: Database,
  providers: readonly PaymentProvider[],
): Promise<number> {
  assertCatalogAmounts()
  let synced = 0
  // 免费档本身也是 subscription 类型，同一查询即可取到比较基线
  const plans = await db.select().from(plan).where(eq(plan.type, 'subscription'))
  for (const provider of providers) {
    for (const example of EXAMPLE_CATALOG) {
      if (!example.prices.length) continue // Free has no remote price or checkout.
      const [localPlan] = await db.select().from(plan).where(eq(plan.key, example.key))
      if (!localPlan) throw new Error(`Seed catalog before syncing ${example.key}`)
      // 激活订阅价格前检查模型授权，在任何远程调用之前失败
      if (localPlan.type === 'subscription' && providerPrices(example.prices, provider.id).length)
        assertSubscriptionModels(plans, example.key)
      for (const intended of providerPrices(example.prices, provider.id)) {
        const prices = await db
          .select()
          .from(planPrice)
          .where(tuple(localPlan.id, provider.id, intended))
        if (prices.length !== 1)
          throw new Error(
            `Expected one seeded price for ${example.key}/${provider.id}/${intended.currency}`,
          )
        const price = prices[0] as PlanPrice
        const existingId = price.providerPriceId.startsWith('unsynced:')
          ? undefined
          : price.providerPriceId
        // Remote I/O is deliberately outside a database transaction. Desired activation is
        // separate from local readiness: placeholders must remain inactive on failure.
        const remote = await provider.syncPlan({
          plan: localPlan as Plan,
          price: { ...price, active: true },
          ...(existingId ? { providerPriceId: existingId } : {}),
          idempotencyKey: `catalog:${provider.id}:${price.id}`,
        })
        if (!remote.providerPriceId || remote.providerPriceId.startsWith('unsynced:'))
          throw new Error('Provider returned an invalid catalog mapping')
        if (existingId && remote.providerPriceId !== existingId)
          throw new Error('Provider changed an immutable catalog mapping')
        if (price.providerPriceId === remote.providerPriceId && price.active === localPlan.active) {
          synced++
          continue
        }
        const updated = await db
          .update(planPrice)
          .set({ providerPriceId: remote.providerPriceId, active: localPlan.active })
          .where(
            and(eq(planPrice.id, price.id), eq(planPrice.providerPriceId, price.providerPriceId)),
          )
          .returning()
        if (!updated.length) {
          const [current] = await db.select().from(planPrice).where(eq(planPrice.id, price.id))
          if (current?.providerPriceId !== remote.providerPriceId)
            throw new Error('Concurrent catalog mapping changed')
        }
        synced++
      }
    }
  }
  return synced
}
