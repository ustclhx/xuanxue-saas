import { type Database, type Plan, type PlanPrice, plan, planPrice } from '@xuanxue/db'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { newId } from '@xuanxue/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { creditPackId } from './paypal/metadata.ts'
import type { PaymentProvider } from './provider.ts'

/** Template examples in USD cents, not approved business prices. Model permissions are managed in the admin console. */
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
  // 详批积分包（add-reading-monetization design 决策 4）：1 次详批 = 100 积分；价格为种子值，后台可改。
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
    prices: [{ interval: null, amount: 99 }],
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
    prices: [{ interval: null, amount: 399 }],
  },
] satisfies (Omit<typeof plan.$inferInsert, 'id'> & {
  prices: { interval: PlanPrice['interval']; amount: number }[]
})[]

const PROVIDERS = ['stripe', 'paypal'] as const
function tuple(
  planId: string,
  provider: PlanPrice['provider'],
  interval: PlanPrice['interval'],
  amount: number,
) {
  return and(
    eq(planPrice.planId, planId),
    eq(planPrice.provider, provider),
    interval === null ? isNull(planPrice.interval) : eq(planPrice.interval, interval),
    eq(planPrice.amount, amount),
    eq(planPrice.currency, 'USD'),
  )
}

/** Database only: no provider construction, credentials, or network access. */
export async function seedCatalog(db: Database): Promise<void> {
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
        for (const price of prices) {
          const existing = await tx
            .select()
            .from(planPrice)
            .where(tuple(localPlan.id, provider, price.interval, price.amount))
          if (existing.length) continue
          const id = newId()
          await tx.insert(planPrice).values({
            id,
            planId: localPlan.id,
            provider,
            providerPriceId: `unsynced:${provider}:${id}`,
            interval: price.interval,
            amount: price.amount,
            currency: 'USD',
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
      for (const intended of example?.prices ?? []) {
        const prices = await tx
          .select()
          .from(planPrice)
          .where(tuple(pack.id, provider, intended.interval, intended.amount))
        if (prices.length !== 1)
          throw new Error(`Expected one seeded price for ${pack.key}/${provider}`)
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
  let synced = 0
  for (const provider of providers) {
    for (const example of EXAMPLE_CATALOG) {
      if (!example.prices.length) continue // Free has no remote price or checkout.
      const [localPlan] = await db.select().from(plan).where(eq(plan.key, example.key))
      if (!localPlan) throw new Error(`Seed catalog before syncing ${example.key}`)
      for (const intended of example.prices) {
        const prices = await db
          .select()
          .from(planPrice)
          .where(tuple(localPlan.id, provider.id, intended.interval, intended.amount))
        if (prices.length !== 1)
          throw new Error(`Expected one seeded price for ${example.key}/${provider.id}`)
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
