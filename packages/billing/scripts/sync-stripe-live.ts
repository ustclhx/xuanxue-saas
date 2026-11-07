#!/usr/bin/env -S node --experimental-strip-types
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, plan, planPrice } from '@xuanxue/db'
import { and, eq } from 'drizzle-orm'
import { EXAMPLE_CATALOG, syncCatalog } from '../src/catalog.ts'
import { createStripeProvider } from '../src/stripe/adapter.ts'
import { activationDatabaseUrl } from './activate-credit-packs.ts'

/**
 * 生产 Stripe 积分包映射：在 live 账户按目录创建一次性 Product / Price 并写回 plan_price。
 * 目录里只有积分包带价格（订阅停售、无价格），因此不会创建任何订阅价格。
 * 只读显式注入的进程环境；未设置 BILLING_SYNC_CONFIRM=stripe-live 时只列出现状，不调用 Stripe、不写库。
 */
export function liveSyncConfig(env: NodeJS.ProcessEnv = process.env) {
  const secretKey = env.STRIPE_SECRET_KEY
  if (!secretKey || !/^(sk|rk)_live_/.test(secretKey))
    throw new Error('Explicit Stripe live credentials are required')
  if (EXAMPLE_CATALOG.some((entry) => entry.type !== 'credit_pack' && entry.prices.length))
    throw new Error('Live sync only supports credit pack prices')
  return {
    secretKey,
    connectionString: activationDatabaseUrl({
      ...env,
      BILLING_ACTIVATE_CONFIRM: env.BILLING_SYNC_DATABASE_CONFIRM,
    }),
    apply: env.BILLING_SYNC_CONFIRM === 'stripe-live',
  }
}

async function run({ secretKey, connectionString, apply }: ReturnType<typeof liveSyncConfig>) {
  const db = createDb({ connectionString })
  try {
    const rows = await db
      .select({ key: plan.key, amount: planPrice.amount, mapping: planPrice.providerPriceId })
      .from(planPrice)
      .innerJoin(plan, eq(plan.id, planPrice.planId))
      .where(and(eq(planPrice.provider, 'stripe'), eq(plan.type, 'credit_pack')))
    for (const row of rows)
      console.log(
        `${row.key} ${row.amount} ${row.mapping.startsWith('unsynced:') ? 'unsynced' : row.mapping}`,
      )
    if (!apply) {
      console.log('Dry run: set BILLING_SYNC_CONFIRM=stripe-live to create live mappings.')
      return
    }
    const stripe = createStripeProvider({ secretKey, webhookSecret: '', expectedMode: 'live' })
    console.log(`Synced ${await syncCatalog(db, [stripe])} live Stripe credit pack mappings.`)
  } finally {
    await db.$client.end()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let config: ReturnType<typeof liveSyncConfig>
  try {
    // 校验错误只包含固定文本；驱动与 Stripe 错误可能含连接信息或请求细节，不直接打印。
    config = liveSyncConfig()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid live sync configuration')
    process.exit(1)
  }
  try {
    await run(config)
  } catch {
    console.error('Live Stripe sync failed')
    process.exitCode = 1
  }
}
