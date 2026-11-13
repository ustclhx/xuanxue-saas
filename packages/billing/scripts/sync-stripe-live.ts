#!/usr/bin/env -S node --experimental-strip-types
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, plan, planPrice } from '@xuanxue/db'
import { and, eq, inArray } from 'drizzle-orm'
import { describeSubscriptionModels, EXAMPLE_CATALOG, syncCatalog } from '../src/catalog.ts'
import { createStripeProvider } from '../src/stripe/adapter.ts'
import { activationDatabaseUrl } from './activate-credit-packs.ts'

/**
 * 生产 Stripe 价格映射：在 live 账户按目录创建积分包（一次性）与订阅（月付）Product / Price 并写回 plan_price，
 * 同时补齐东方站各语言的本地化积分包 Product / Price（不写库，见 src/stripe/localized.ts）。
 * TWD / KRW 价格行（localize-checkout-currency）各对应一个独立 Price，分别挂在 zh-Hant / ko 本地化商品上。
 * 订阅只允许月付价格（enable-subscriptions-daily-credits D9）；激活前在售订阅的模型授权必须覆盖免费档，
 * 演练输出逐档诊断，写入时不满足即在调用 Stripe 前失败（catalog.ts）。
 * 只读显式注入的进程环境；未设置 BILLING_SYNC_CONFIRM=stripe-live 时只列出现状，不调用 Stripe、
 * 不写库，因此演练不需要 Stripe 密钥（可用只读库连接）；写入时才要求 live 密钥。
 */
export function liveSyncConfig(env: NodeJS.ProcessEnv = process.env) {
  const apply = env.BILLING_SYNC_CONFIRM === 'stripe-live'
  const secretKey = env.STRIPE_SECRET_KEY
  if (apply && (!secretKey || !/^(sk|rk)_live_/.test(secretKey)))
    throw new Error('Explicit Stripe live credentials are required')
  // 订阅只卖月付：目录出现年付或其他周期的订阅价格时拒绝，避免未经评审的周期进入 live
  if (
    EXAMPLE_CATALOG.some(
      (entry) =>
        entry.type === 'subscription' &&
        entry.prices.some((price: { interval: string | null }) => price.interval !== 'month'),
    )
  )
    throw new Error('Live sync only supports credit pack and monthly subscription prices')
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
  /** 订阅周期；积分包为 null（缺省视为积分包） */
  interval?: string | null
}

const TARGET: Record<string, string> = {
  USD: 'canonical product + zh-Hant/zh-Hans/ko localized USD variants',
  TWD: 'zh-Hant localized product',
  KRW: 'ko localized product',
}

/** USD 订阅只建规范价格：续费与换档按 plan_price 的平台价格 ID 对账，不建 lookup_key 变体 */
function target(row: LiveSyncRow) {
  if (row.interval && row.currency === 'USD') return 'canonical product'
  return TARGET[row.currency] ?? 'unsupported currency'
}

const label = (row: LiveSyncRow) =>
  `${row.key} ${row.currency} ${row.amount}${row.interval ? ` /${row.interval}` : ''}`

/** 现状清单与演练要创建的价格；只用数据库数据，不调用 Stripe */
export function describeLiveSync(rows: readonly LiveSyncRow[]): string[] {
  const unsynced = (row: LiveSyncRow) => row.mapping.startsWith('unsynced:')
  const pending = rows.filter(unsynced)
  return [
    ...rows.map((row) => `${label(row)} ${unsynced(row) ? 'unsynced' : row.mapping}`),
    `Would create ${pending.length} live Stripe prices:`,
    ...pending.map((row) => `  + ${label(row)} on ${target(row)}`),
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
        interval: planPrice.interval,
      })
      .from(planPrice)
      .innerJoin(plan, eq(plan.id, planPrice.planId))
      .where(
        and(
          eq(planPrice.provider, 'stripe'),
          inArray(
            plan.key,
            EXAMPLE_CATALOG.filter((entry) => entry.prices.length > 0).map((entry) => entry.key),
          ),
        ),
      )
      .orderBy(plan.key, planPrice.currency)
    for (const line of describeLiveSync(rows)) console.log(line)
    // 只读诊断：订阅激活前模型授权须覆盖免费档（D2），不满足时写入会在调用 Stripe 前失败
    for (const line of await describeSubscriptionModels(db)) console.log(line)
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
      `Synced ${await syncCatalog(db, [stripe])} live Stripe price mappings (credit packs with localized variants, monthly subscriptions).`,
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
