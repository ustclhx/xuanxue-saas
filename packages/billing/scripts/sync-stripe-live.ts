#!/usr/bin/env -S node --experimental-strip-types
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, plan, planPrice } from '@xuanxue/db'
import { and, eq } from 'drizzle-orm'
import { EXAMPLE_CATALOG, syncCatalog } from '../src/catalog.ts'
import { createStripeProvider } from '../src/stripe/adapter.ts'
import { activationDatabaseUrl } from './activate-credit-packs.ts'

/**
 * 生产 Stripe 积分包映射：在 live 账户按目录创建一次性 Product / Price 并写回 plan_price，
 * 同时补齐东方站各语言的本地化 Product / Price（不写库，见 src/stripe/localized.ts）。
 * TWD / KRW 价格行（localize-checkout-currency）各对应一个独立 Price，分别挂在 zh-Hant / ko 本地化商品上。
 * 目录里只有积分包带价格（订阅停售、无价格），因此不会创建任何订阅价格。
 * 只读显式注入的进程环境；未设置 BILLING_SYNC_CONFIRM=stripe-live 时只列出现状，不调用 Stripe、
 * 不写库，因此演练不需要 Stripe 密钥（可用只读库连接）；写入时才要求 live 密钥。
 */
export function liveSyncConfig(env: NodeJS.ProcessEnv = process.env) {
  const apply = env.BILLING_SYNC_CONFIRM === 'stripe-live'
  const secretKey = env.STRIPE_SECRET_KEY
  if (apply && (!secretKey || !/^(sk|rk)_live_/.test(secretKey)))
    throw new Error('Explicit Stripe live credentials are required')
  if (EXAMPLE_CATALOG.some((entry) => entry.type !== 'credit_pack' && entry.prices.length))
    throw new Error('Live sync only supports credit pack prices')
  const connectionString = activationDatabaseUrl({
    ...env,
    BILLING_ACTIVATE_CONFIRM: env.BILLING_SYNC_DATABASE_CONFIRM,
  })
  return apply
    ? { apply: true as const, secretKey: secretKey as string, connectionString }
    : { apply: false as const, connectionString }
}

export interface LiveSyncRow {
  key: string
  currency: string
  amount: number
  mapping: string
}

const TARGET: Record<string, string> = {
  USD: 'canonical product + zh-Hant/zh-Hans/ko localized USD variants',
  TWD: 'zh-Hant localized product',
  KRW: 'ko localized product',
}

/** 现状清单与演练要创建的价格；只用数据库数据，不调用 Stripe */
export function describeLiveSync(rows: readonly LiveSyncRow[]): string[] {
  const unsynced = (row: LiveSyncRow) => row.mapping.startsWith('unsynced:')
  const pending = rows.filter(unsynced)
  return [
    ...rows.map(
      (row) =>
        `${row.key} ${row.currency} ${row.amount} ${unsynced(row) ? 'unsynced' : row.mapping}`,
    ),
    `Would create ${pending.length} live Stripe prices:`,
    ...pending.map(
      (row) =>
        `  + ${row.key} ${row.currency} ${row.amount} on ${TARGET[row.currency] ?? 'unsupported currency'}`,
    ),
  ]
}

async function run(config: ReturnType<typeof liveSyncConfig>) {
  const { connectionString } = config
  const db = createDb({ connectionString })
  try {
    const rows = await db
      .select({
        key: plan.key,
        currency: planPrice.currency,
        amount: planPrice.amount,
        mapping: planPrice.providerPriceId,
      })
      .from(planPrice)
      .innerJoin(plan, eq(plan.id, planPrice.planId))
      .where(and(eq(planPrice.provider, 'stripe'), eq(plan.type, 'credit_pack')))
      .orderBy(plan.key, planPrice.currency)
    for (const line of describeLiveSync(rows)) console.log(line)
    if (!config.apply) {
      console.log('Dry run: set BILLING_SYNC_CONFIRM=stripe-live to create live mappings.')
      return
    }
    const stripe = createStripeProvider({
      secretKey: config.secretKey,
      webhookSecret: '',
      expectedMode: 'live',
    })
    console.log(
      `Synced ${await syncCatalog(db, [stripe])} live Stripe credit pack mappings (with localized variants).`,
    )
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
