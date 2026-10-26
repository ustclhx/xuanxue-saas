import { execFileSync } from 'node:child_process'
import { createDb, plan, planPrice } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { activateCreditPackMappings, seedCatalog, syncCatalog } from './catalog.ts'
import { creditPackId } from './paypal/metadata.ts'
import type { PaymentProvider, PlanSyncInput } from './provider.ts'

const url = readLocalEnv('CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE')
const migrationUrl = readLocalEnv('MIGRATION_DATABASE_URL')
if (!url || !migrationUrl)
  throw new Error('Catalog tests require both isolated worktree database URLs')
const app = new URL(url)
const migration = new URL(migrationUrl)
if (
  app.host !== migration.host ||
  app.pathname !== migration.pathname ||
  !(
    /^\/xuanxue_wt_[a-z0-9_]+$/.test(app.pathname) ||
    (process.env.CI && app.pathname === '/xuanxue_ci')
  )
)
  throw new Error('Catalog tests require matching isolated xuanxue_wt_* databases')
const db = createDb({ connectionString: url })
afterAll(() => db.$client.end())
function provider(id: 'stripe' | 'paypal') {
  return {
    id,
    syncPlan: vi.fn(async (input: PlanSyncInput) => ({
      providerPriceId: input.providerPriceId ?? `mock:${id}:${input.price.id}`,
    })),
  } as unknown as PaymentProvider
}

describe('catalog on isolated PostgreSQL', () => {
  it('activates only current PayPal packs, retires old tuples and respects inactive plans', async () => {
    await seedCatalog(db)
    const rollback = new Error('rollback activation fixture')
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'))
    try {
      await expect(
        db.transaction(async (tx) => {
          const fixture = tx as unknown as typeof db
          const packs = await tx.select().from(plan).where(eq(plan.type, 'credit_pack'))
          const single = packs.find((row) => row.key === 'reading_single')
          const five = packs.find((row) => row.key === 'reading_five')
          if (!single || !five) throw new Error('Missing seeded packs')
          await tx.update(plan).set({ active: false }).where(eq(plan.id, five.id))
          const [pro] = await tx.select().from(plan).where(eq(plan.key, 'pro'))
          if (!pro) throw new Error('Missing seeded subscription')
          await tx.insert(planPrice).values({
            planId: pro.id,
            provider: 'paypal',
            providerPriceId: 'P-UNCHANGED',
            interval: 'month',
            amount: 1000,
            currency: 'USD',
            active: true,
          })
          const before = await tx.select().from(planPrice).orderBy(planPrice.id)
          expect(await activateCreditPackMappings(fixture, 'paypal')).toBe(2)
          expect(await activateCreditPackMappings(fixture, 'paypal')).toBe(0)
          const activated = await tx.select().from(planPrice).orderBy(planPrice.id)
          for (const row of activated) {
            if (row.provider === 'paypal' && packs.some((pack) => pack.id === row.planId)) {
              expect(row.providerPriceId).toBe(creditPackId(row.id))
              expect(row.active).toBe(row.planId === single.id)
            } else expect(row).toEqual(before.find((price) => price.id === row.id))
          }
          const old = activated.find((row) => row.provider === 'paypal' && row.planId === single.id)
          if (!old) throw new Error('Missing active pack price')
          // 模拟调价后 seed：当前目录元组有新 id，旧金额的映射必须保留并停用。
          await tx.update(planPrice).set({ amount: 149 }).where(eq(planPrice.id, old.id))
          const [replacement] = await tx
            .insert(planPrice)
            .values({
              ...old,
              id: crypto.randomUUID(),
              active: false,
              providerPriceId: 'unsynced:replacement',
            })
            .returning()
          if (!replacement) throw new Error('Missing replacement price')
          expect(await activateCreditPackMappings(fixture, 'paypal')).toBe(2)
          expect(
            (await tx.select().from(planPrice).where(eq(planPrice.id, old.id)))[0],
          ).toMatchObject({ active: false, providerPriceId: old.providerPriceId })
          expect(
            (await tx.select().from(planPrice).where(eq(planPrice.id, replacement.id)))[0],
          ).toMatchObject({ active: true, providerPriceId: creditPackId(replacement.id) })
          expect(await activateCreditPackMappings(fixture, 'paypal')).toBe(0)
          expect(network).not.toHaveBeenCalled()
          throw rollback
        }),
      ).rejects.toBe(rollback)
    } finally {
      network.mockRestore()
    }
  })

  it('runs the confirmed CLI against this isolated database without HTTP calls or URL output', async () => {
    await seedCatalog(db)
    const prices = await db.select().from(planPrice)
    const env = {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: url,
      BILLING_ACTIVATE_CONFIRM: decodeURIComponent(app.pathname.slice(1)),
    }
    const run = () =>
      execFileSync(
        process.execPath,
        [
          '--import',
          'data:text/javascript,globalThis.fetch%20%3D%20()%20%3D%3E%20%7Bthrow%20new%20Error(%22HTTP%20forbidden%22)%7D',
          '--experimental-strip-types',
          'scripts/activate-credit-packs.ts',
        ],
        { cwd: new URL('../', import.meta.url), env, encoding: 'utf8' },
      )
    try {
      expect(run()).toMatch(/^Activated \d+ credit pack price mapping changes\.\n$/)
      expect(run()).toBe('Activated 0 credit pack price mapping changes.\n')
    } finally {
      for (const price of prices)
        await db
          .update(planPrice)
          .set({ providerPriceId: price.providerPriceId, active: price.active })
          .where(eq(planPrice.id, price.id))
    }
  })

  it('preserves admin model permissions across repeated and concurrent seeds', async () => {
    await seedCatalog(db)
    const before = await db
      .select()
      .from(plan)
      .where(inArray(plan.key, ['free', 'pro', 'team']))
    const grants = { free: ['text-example', 'retired-model'], pro: ['*'], team: [] }
    try {
      for (const row of before) {
        await db
          .update(plan)
          .set({ features: { ...row.features, models: grants[row.key as keyof typeof grants] } })
          .where(eq(plan.id, row.id))
      }
      await Promise.all([seedCatalog(db), seedCatalog(db)])
      await seedCatalog(db)
      const after = await db
        .select()
        .from(plan)
        .where(inArray(plan.key, ['free', 'pro', 'team']))
      for (const row of after)
        expect(row.features.models).toEqual(grants[row.key as keyof typeof grants])
    } finally {
      for (const row of before)
        await db.update(plan).set({ features: row.features }).where(eq(plan.id, row.id))
    }
  })

  it('serializes concurrent seeds, preserves historical prices, and retries partial sync', async () => {
    await Promise.all([seedCatalog(db), seedCatalog(db)])
    // Roll back mock mappings and historical fixture, retaining the seeded catalog.
    const rollback = new Error('rollback catalog fixture')
    await expect(
      db.transaction(async (tx) => {
        const fixture = tx as unknown as typeof db
        await seedCatalog(fixture)
        const plans = await tx
          .select()
          .from(plan)
          .where(inArray(plan.key, ['free', 'pro', 'team', 'reading_single', 'reading_five']))
        const catalogIds = plans.map((p) => p.id)
        expect(plans.find((p) => p.key === 'free')?.features).toEqual(DEFAULT_FREE_FEATURES)
        expect(
          plans.filter((p) =>
            ['free', 'pro', 'team', 'reading_single', 'reading_five'].includes(p.key),
          ),
        ).toHaveLength(5)
        let prices = await tx
          .select()
          .from(planPrice)
          .where(inArray(planPrice.planId, catalogIds))
          .orderBy(planPrice.id)
        expect(prices).toHaveLength(4)
        const first = prices[0]
        if (!first) throw new Error('Missing seeded price')
        const [historical] = await tx
          .insert(planPrice)
          .values({
            ...first,
            id: crypto.randomUUID(),
            amount: 123,
            providerPriceId: `historical:${crypto.randomUUID()}`,
          })
          .returning()
        const stripe = provider('stripe')
        const paypal = provider('paypal')
        vi.mocked(stripe.syncPlan)
          .mockImplementationOnce(async (i) => ({ providerPriceId: `mock:stripe:${i.price.id}` }))
          .mockRejectedValueOnce(new Error('partial failure'))
        await expect(syncCatalog(fixture, [stripe, paypal])).rejects.toThrow('partial failure')
        prices = await tx
          .select()
          .from(planPrice)
          .where(inArray(planPrice.planId, catalogIds))
          .orderBy(planPrice.id)
        expect(prices.filter((p) => p.active && p.id !== historical?.id)).toHaveLength(1)
        expect(
          prices
            .filter((p) => !p.active && p.id !== historical?.id)
            .every((p) => p.providerPriceId.startsWith('unsynced:')),
        ).toBe(true)
        await syncCatalog(fixture, [stripe, paypal])
        const before = await tx
          .select()
          .from(planPrice)
          .where(inArray(planPrice.planId, catalogIds))
          .orderBy(planPrice.id)
        await seedCatalog(fixture)
        await syncCatalog(fixture, [stripe, paypal])
        expect(
          await tx
            .select()
            .from(planPrice)
            .where(inArray(planPrice.planId, catalogIds))
            .orderBy(planPrice.id),
        ).toEqual(before)
        expect(
          await tx
            .select()
            .from(planPrice)
            .where(eq(planPrice.id, historical?.id ?? '')),
        ).toEqual([historical])
        throw rollback
      }),
    ).rejects.toBe(rollback)
  })
})
