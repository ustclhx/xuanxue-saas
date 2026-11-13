import { type Database, plan, planPrice } from '@xuanxue/db'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { seedCatalog, syncCatalog } from './catalog.ts'
import type { PaymentProvider, PlanSyncInput } from './provider.ts'

vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  eq: (column: { name: string }, value: unknown) => (row: Record<string, unknown>) =>
    row[column.name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] === value,
  isNull: (column: { name: string }) => (row: Record<string, unknown>) => row[column.name] === null,
  and:
    (...filters: ((row: Record<string, unknown>) => boolean)[]) =>
    (row: Record<string, unknown>) =>
      filters.every((filter) => filter(row)),
}))

type Row = Record<string, unknown>
function memoryDb() {
  const plans: Row[] = []
  const prices: Row[] = []
  let inTransaction = false
  const rows = (table: unknown) => (table === plan ? plans : prices)
  const api = {
    async transaction(fn: (tx: unknown) => Promise<void>) {
      inTransaction = true
      try {
        await fn(api)
      } finally {
        inTransaction = false
      }
    },
    insert(table: unknown) {
      return {
        values(value: Row) {
          if (table === planPrice) {
            prices.push({ ...value })
            return Promise.resolve()
          }
          return {
            onConflictDoUpdate({ set }: { set: Row }) {
              return {
                async returning() {
                  let row = plans.find((p) => p.key === value.key)
                  if (row) {
                    // SQL 合并的实际行为由 catalog.postgres.test.ts 验证；这里只模拟 upsert。
                    const features =
                      set.features instanceof SQL
                        ? { ...(value.features as Row), models: (row.features as Row).models }
                        : set.features
                    Object.assign(row, set, { features })
                  } else {
                    row = { ...value, id: crypto.randomUUID() }
                    plans.push(row)
                  }
                  return [row]
                },
              }
            },
          }
        },
      }
    },
    select() {
      return {
        from(table: unknown) {
          return {
            async where(filter: (row: Row) => boolean) {
              return rows(table)
                .filter(filter)
                .map((r) => ({ ...r }))
            },
          }
        },
      }
    },
    update(table: unknown) {
      return {
        set(value: Row) {
          return {
            where(filter: (row: Row) => boolean) {
              return {
                async returning() {
                  const matched = rows(table).filter(filter)
                  for (const row of matched) Object.assign(row, value)
                  return matched
                },
              }
            },
          }
        },
      }
    },
  }
  return { db: api as unknown as Database, plans, prices, inTransaction: () => inTransaction }
}
function provider(id: 'stripe' | 'paypal', callback?: (input: PlanSyncInput) => void) {
  return {
    id,
    syncPlan: vi.fn(async (input: PlanSyncInput) => {
      callback?.(input)
      return { providerPriceId: input.providerPriceId ?? `${id}:${input.price.id}` }
    }),
  } as unknown as PaymentProvider
}

describe('offline catalog', () => {
  it('reuses immutable tuples across repeated seed and sync, excluding free and historical prices', async () => {
    const state = memoryDb()
    await seedCatalog(state.db)
    const free = state.plans.find((p) => p.key === 'free')
    expect(free?.features).toEqual(DEFAULT_FREE_FEATURES)
    // 每个积分包：Stripe 按价目表建 USD/TWD/KRW 三行，PayPal 只建 USD（决策 2）
    expect(state.prices).toHaveLength(8)
    expect(state.prices.map((p) => `${p.provider}:${p.currency}:${p.amount}`).sort()).toEqual([
      'paypal:USD:199',
      'paypal:USD:699',
      'stripe:KRW:2800',
      'stripe:KRW:9800',
      'stripe:TWD:22700',
      'stripe:TWD:6500',
      'stripe:USD:199',
      'stripe:USD:699',
    ])
    expect(
      state.prices.every((p) => !p.active && String(p.providerPriceId).startsWith('unsynced:')),
    ).toBe(true)
    const stripe = provider('stripe', () => expect(state.inTransaction()).toBe(false))
    const paypal = provider('paypal')
    await syncCatalog(state.db, [stripe, paypal])
    const before = structuredClone(state.prices)
    state.prices.push({
      ...before[0],
      id: crypto.randomUUID(),
      amount: 123,
      providerPriceId: 'old-immutable',
    })
    await seedCatalog(state.db)
    await syncCatalog(state.db, [stripe, paypal])
    expect(state.plans).toHaveLength(6)
    expect(state.prices.slice(0, 8)).toEqual(before)
    expect(state.prices).toHaveLength(9)
    for (const [adapter, perRun] of [
      [stripe, 6],
      [paypal, 2],
    ] as const) {
      const calls = vi.mocked(adapter.syncPlan).mock.calls
      expect(calls).toHaveLength(perRun * 2)
      expect(calls.every(([i]) => i.plan.key !== 'free' && i.price.active)).toBe(true)
      // Stripe 本地化积分包按 plan.key 选译名、按 credits 写说明，同步必须带上两者
      expect(calls.map(([i]) => [i.plan.key, i.plan.credits])).toContainEqual(['reading_five', 500])
      expect(
        calls
          .slice(perRun)
          .every(([i]) => i.providerPriceId && !i.providerPriceId.startsWith('unsynced:')),
      ).toBe(true)
      expect(calls[0]?.[0].idempotencyKey).toBe(calls[perRun]?.[0].idempotencyKey)
    }
    expect(vi.mocked(paypal.syncPlan).mock.calls.every(([i]) => i.price.currency === 'USD')).toBe(
      true,
    )
  })

  it('commits successful prices and keeps failed or unattempted mappings inactive for retry', async () => {
    const state = memoryDb()
    await seedCatalog(state.db)
    const stripe = provider('stripe')
    vi.mocked(stripe.syncPlan)
      .mockImplementationOnce(async (i) => ({ providerPriceId: `stripe:${i.price.id}` }))
      .mockRejectedValueOnce(new Error('platform failure'))
    await expect(syncCatalog(state.db, [stripe])).rejects.toThrow('platform failure')
    expect(state.prices.filter((p) => p.active)).toHaveLength(1)
    expect(
      state.prices
        .filter((p) => !p.active)
        .every((p) => String(p.providerPriceId).startsWith('unsynced:')),
    ).toBe(true)
    await seedCatalog(state.db)
    await syncCatalog(state.db, [stripe])
    expect(state.prices.filter((p) => p.active)).toHaveLength(6)
  })

  it('propagates immutable remote mismatch without recreating or rewriting the mapping', async () => {
    const state = memoryDb()
    await seedCatalog(state.db)
    const stripe = provider('stripe')
    await syncCatalog(state.db, [stripe])
    const before = structuredClone(state.prices)
    vi.mocked(stripe.syncPlan).mockRejectedValueOnce(new Error('Immutable price mismatch'))
    await expect(syncCatalog(state.db, [stripe])).rejects.toThrow('Immutable price mismatch')
    expect(state.prices).toEqual(before)
    expect(vi.mocked(stripe.syncPlan).mock.lastCall?.[0].providerPriceId).toBe(
      before[0]?.providerPriceId,
    )
  })
})
