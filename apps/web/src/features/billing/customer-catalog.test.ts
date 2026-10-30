import type { Database } from '@xuanxue/db'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { expect, it, vi } from 'vitest'
import { customerBilling, customerCatalog } from './customer-data.ts'

vi.mock('@xuanxue/credits', () => ({ getCreditBalance: vi.fn() }))
vi.mock('@xuanxue/entitlements', () => ({ getEntitlements: async () => ({ key: 'pro' }) }))

it('queries only active catalog prices and marks unsynced or unavailable providers unpurchasable', async () => {
  const query = vi.fn(async (sql: string, _params: unknown[]) => ({
    rows: sql.includes('from "plan_price"')
      ? [
          ['ready', 'pack', 'stripe', 199, 'usd', null, true, 'price_1'],
          ['unsynced', 'pack', 'stripe', 399, 'usd', null, true, 'unsynced:price_2'],
          ['missing', 'pack', 'stripe', 499, 'usd', null, true, null],
          ['disabled', 'pack', 'paypal', 699, 'usd', null, true, 'price_3'],
        ]
      : [],
  }))
  const catalog = await customerCatalog(drizzle(query) as unknown as Database, [
    { id: 'stripe', available: true },
    { id: 'paypal', available: false },
  ])
  const priceQuery = query.mock.calls.find(([sql]) => sql.includes('from "plan_price"'))
  expect(priceQuery?.[0]).toContain('where "plan_price"."active" = $1')
  expect(priceQuery?.[1]).toEqual([true])
  expect(catalog.prices.filter((price) => price.available).map((price) => price.id)).toEqual([
    'ready',
  ])
})

it('retains the existing subscription price without requiring that price to be active', async () => {
  const query = vi.fn(async (_sql: string, _params: unknown[]) => ({
    rows: [['sub', 'stripe', 'old', 'Pro', 399, 'usd', 'month', false, 'active', null, false]],
  }))
  const workspaceId = '9e4f8378-149f-440a-bf9b-50c014ecb457'
  const billing = await customerBilling(
    drizzle(query) as unknown as Database,
    workspaceId,
    'member',
    3,
  )
  expect(billing.subscriptions).toEqual([
    expect.objectContaining({
      planPriceId: 'old',
      amount: 399,
      interval: 'month',
      priceActive: false,
    }),
  ])
  const [sql, params] = query.mock.calls[0] ?? []
  expect(sql).toContain('inner join "plan_price"')
  expect(sql).not.toContain('"plan_price"."active" =')
  expect(params).toContain(workspaceId)
})
