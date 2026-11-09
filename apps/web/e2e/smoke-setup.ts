import { aiModel, createDb, plan, planPrice, READING_KINDS, setting } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import { DEFAULT_FREE_FEATURES } from '@xuanxue/entitlements'
import { eq, inArray } from 'drizzle-orm'

export const SMOKE_PRICE_ID = '019a0000-0000-7000-8000-000000000002'
export const SMOKE_PACK_KEY = 'ci-smoke-credit-pack'
const planId = '019a0000-0000-7000-8000-000000000001'
const modelId = '019a0000-0000-7000-8000-000000000003'
const SMOKE_MODEL_KEY = 'ci-smoke-reading-model'
/** 积分只在详批开放时出售：冒烟购买前为全部详批选定夹具模型（Provider 由 e2e 占位 Gateway 满足） */
const readingModelKeys = READING_KINDS.map((kind) => `readings.${kind}.modelKey`)

export default async function setup() {
  const connectionString = readLocalEnv('MIGRATION_DATABASE_URL')
  if (!connectionString) throw new Error('Smoke requires an isolated local database')
  const url = new URL(connectionString)
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !(url.pathname.startsWith('/xuanxue_wt_') || url.pathname === '/xuanxue_ci_e2e')
  )
    throw new Error('Smoke requires a worktree database or xuanxue_ci_e2e on localhost')
  for (const binding of ['HYPERDRIVE', 'HYPERDRIVE_CACHED']) {
    const value = readLocalEnv(`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding}`)
    if (!value) throw new Error(`Smoke requires an explicit local ${binding} connection`)
    const appUrl = new URL(value)
    if (appUrl.host !== url.host || appUrl.pathname !== url.pathname)
      throw new Error('Smoke migration and application connections must use the same database')
  }
  const db = createDb({ connectionString })
  try {
    await db
      .insert(plan)
      .values({
        id: planId,
        key: SMOKE_PACK_KEY,
        name: 'CI smoke credits',
        type: 'credit_pack',
        credits: 100,
        features: DEFAULT_FREE_FEATURES,
        active: true,
      })
      .onConflictDoUpdate({ target: plan.id, set: { active: true } })
    await db
      .insert(planPrice)
      .values({
        id: SMOKE_PRICE_ID,
        planId,
        provider: 'paypal',
        providerPriceId: 'smoke-credit-pack',
        amount: 1000,
        currency: 'usd',
        active: true,
      })
      .onConflictDoUpdate({
        target: planPrice.id,
        set: { provider: 'paypal', active: true },
      })
    await db
      .insert(aiModel)
      .values({
        id: modelId,
        key: SMOKE_MODEL_KEY,
        kind: 'text',
        // anthropic 在 direct 出口缺密钥时回落 Gateway，占位 Gateway 下本地与 CI 都视为已配置
        provider: 'anthropic',
        providerModelId: 'ci-smoke-fixture',
        pricing: { mode: 'token', inputPer1k: 1, outputPer1k: 1 },
        enabled: true,
      })
      .onConflictDoUpdate({ target: aiModel.id, set: { enabled: true, provider: 'anthropic' } })
    for (const key of readingModelKeys)
      await db
        .insert(setting)
        .values({ key, value: SMOKE_MODEL_KEY })
        .onConflictDoUpdate({ target: setting.key, set: { value: SMOKE_MODEL_KEY } })
  } finally {
    await db.$client.end()
  }
  return async () => {
    const db = createDb({ connectionString })
    try {
      // 保留购买记录引用的目录，只撤下本轮 smoke 拥有的测试商品。
      await db.transaction(async (tx) => {
        await tx.update(planPrice).set({ active: false }).where(eq(planPrice.id, SMOKE_PRICE_ID))
        await tx.update(plan).set({ active: false }).where(eq(plan.id, planId))
        await tx.delete(setting).where(inArray(setting.key, readingModelKeys))
        await tx.update(aiModel).set({ enabled: false }).where(eq(aiModel.id, modelId))
      })
    } finally {
      await db.$client.end()
    }
  }
}
