import { readFile } from 'node:fs/promises'
import { createDb, setting, webhookEvent } from '@xuanxue/db'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { processWebhook, replayWebhook, type WebhookTransaction } from './pipeline.ts'
import type { NormalizedEvent, PaymentProvider, VerifiedWebhook } from './provider.ts'
import { attributeWebhookEvent } from './webhook-attribution.ts'

// 回调事件的空间与站点归属（openspec webhook-event-site）：规则覆盖、管线三处写入与迁移回填等价。

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env
const url = env.BILLING_TEST_DATABASE_URL
if (!url) throw new Error('Missing isolated billing test database')
const db = createDb({ connectionString: url })
const id = () => crypto.randomUUID()
const prefix = `attribution-${id()}`
let sequence = 0
const east = id()
const west = id()
const user = id()
const plan = id()
const price = id()
const sub = id()
const paid = id()
const order = id()

async function insertEvent(payload: unknown, provider = 'stripe') {
  const event = id()
  await db.$client`insert into webhook_event(id,provider,provider_event_id,type,payload) values(${event},${provider},${`${prefix}-${sequence++}`},'fixture',${JSON.stringify(payload)}::jsonb)`
  return event
}
async function attribution(event: string) {
  const [row] = await db
    .select({ workspaceIds: webhookEvent.workspaceIds, sites: webhookEvent.sites })
    .from(webhookEvent)
    .where(eq(webhookEvent.id, event))
  return row
}
async function insertPurchase(workspace: string, providerOrderId: string) {
  await db.$client`insert into purchase(id,workspace_id,user_id,plan_id,plan_price_id,provider,provider_order_id,status,amount,currency) values(${id()},${workspace},${user},${plan},${price},'stripe',${providerOrderId},'paid',1234,'USD')`
}

beforeAll(async () => {
  await db.$client`insert into "user"(id,name,email,site) values(${user},'Attribution',${`${user}@attribution.example`},'west')`
  await db.$client`insert into organization(id,name,slug,site) values(${east},'East',${east},'east'),(${west},'West',${west},'west')`
  await db.$client`insert into plan(id,key,name,type,credits,features) values(${plan},${plan},'Fixture','credit_pack',100,'{"models":[],"maxConcurrentTasks":1,"maxSeats":1,"storageGb":1,"publicApi":false,"priorityQueue":false,"watermark":false}'::jsonb)`
  await db.$client`insert into plan_price(id,plan_id,provider,provider_price_id,amount,currency) values(${price},${plan},'stripe',${price},1234,'USD')`
  await db.$client`insert into subscription(id,workspace_id,plan_id,plan_price_id,provider,provider_subscription_id,status,last_event_at) values(${id()},${west},${plan},${price},'stripe',${sub},'active',now())`
  await insertPurchase(west, order)
  const eastPurchase = id()
  await db.$client`insert into purchase(id,workspace_id,user_id,plan_id,plan_price_id,provider,provider_order_id,status,amount,currency) values(${eastPurchase},${east},${user},${plan},${price},'stripe',${eastPurchase},'paid',1234,'USD')`
  await db.$client`insert into payment(id,workspace_id,provider,provider_payment_id,purchase_id,kind,amount,currency,paid_at) values(${id()},${east},'stripe',${paid},${eastPurchase},'one_time',1234,'USD',now())`
})

afterAll(async () => {
  await db.delete(setting).where(like(setting.key, `${prefix}%`))
  await db.delete(webhookEvent).where(like(webhookEvent.providerEventId, `${prefix}%`))
  await db.$client`delete from payment where workspace_id in (${east},${west})`
  await db.$client`delete from purchase where workspace_id in (${east},${west})`
  await db.$client`delete from subscription where workspace_id in (${east},${west})`
  await db.$client`delete from plan_price where id=${price}`
  await db.$client`delete from plan where id=${plan}`
  await db.$client`delete from organization where id in (${east},${west})`
  await db.$client`delete from "user" where id=${user}`
  await db.$client.end()
})

const cases: [string, () => unknown, string, string[], string[]][] = [
  [
    '结账元数据 workspaceId',
    () => ({ data: { object: { metadata: { workspaceId: east } } } }),
    'stripe',
    [east],
    ['east'],
  ],
  [
    'PayPal custom_id',
    () => ({ resource: { custom_id: JSON.stringify([1, west, price, user]) } }),
    'paypal',
    [west],
    ['west'],
  ],
  ['本地订阅平台 ID', () => ({ data: { object: { id: sub } } }), 'stripe', [west], ['west']],
  [
    '本地付款平台 ID',
    () => ({ data: { object: { payment_intent: paid } } }),
    'stripe',
    [east],
    ['east'],
  ],
  ['本地订单平台 ID', () => ({ data: { object: { id: order } } }), 'stripe', [west], ['west']],
  ['本地记录属于另一支付平台时不关联', () => ({ resource: { id: order } }), 'paypal', [], []],
  [
    '跨两站',
    () => ({ data: { object: { id: order, metadata: { workspaceId: east } } } }),
    'stripe',
    [east, west].sort(),
    ['east', 'west'],
  ],
  [
    '无效 UUID 与不存在的空间',
    () => ({ data: { object: { metadata: { workspaceId: 'not-a-uuid' }, custom_id: id() } } }),
    'stripe',
    [],
    [],
  ],
  ['无法关联', () => ({}), 'stripe', [], []],
]

describe('webhook 事件归属', () => {
  it.each(cases)('%s', async (_name, payload, provider, workspaceIds, sites) => {
    const event = await insertEvent(payload(), provider)
    await db.transaction((tx) => attributeWebhookEvent(tx, event))
    expect(await attribution(event)).toEqual({ workspaceIds, sites })
  })

  it('迁移 0019 的回填 SQL 与运行时规则结果一致', async () => {
    const fixtures = await Promise.all(
      cases.map(([, payload, provider]) => insertEvent(payload(), provider)),
    )
    const runtime = new Map<string, unknown>()
    for (const event of fixtures) {
      await db.transaction((tx) => attributeWebhookEvent(tx, event))
      runtime.set(event, await attribution(event))
    }
    const migration = await readFile(
      new URL('../../db/migrations/0019_webhook_event_site.sql', import.meta.url),
      'utf8',
    )
    const backfill = migration
      .split('-- BACKFILL BEGIN')[1]
      ?.split('-- BACKFILL END')[0]
      ?.replaceAll('--> statement-breakpoint', '')
      .trim()
      .replace(/;$/, '')
    if (!backfill) throw new Error('Missing backfill SQL')
    // 只改本测试的行：先清空归属，再执行原样的回填语句（附加 id 限定）
    await db
      .update(webhookEvent)
      .set({ workspaceIds: [], sites: [] })
      .where(inArray(webhookEvent.id, fixtures))
    await db.$client.unsafe(`${backfill} AND w."id" = ANY($1::uuid[])`, [`{${fixtures.join(',')}}`])
    for (const event of fixtures) expect(await attribution(event)).toEqual(runtime.get(event))
  })
})

describe('回调管线写入归属', () => {
  function delivery(payload: Record<string, unknown>) {
    const providerEventId = `${prefix}-${sequence++}`
    const body = { id: providerEventId, ...payload }
    const event: NormalizedEvent = {
      type: 'payment.disputed',
      provider: 'stripe',
      occurredAt: new Date(),
      raw: body,
      providerPaymentId: providerEventId,
      providerDisputeId: providerEventId,
      amount: 100,
      currency: 'USD',
    }
    const normalized: VerifiedWebhook = { providerEventId, type: 'test.delivery', events: [event] }
    const provider = {
      id: 'stripe',
      verifyWebhook: vi.fn(async () => normalized),
    } as unknown as PaymentProvider
    return {
      db,
      provider,
      normalized,
      request: new Request('https://example.test/webhook'),
      rawBody: JSON.stringify(body),
    }
  }
  const effect = async (tx: WebhookTransaction, event: NormalizedEvent) => {
    if (event.type !== 'payment.disputed') throw new Error('Unexpected test event')
    await tx.insert(setting).values({ key: event.providerDisputeId, value: { applied: true } })
  }

  it('提交时带上 handler 在同一事务写入的本地记录', async () => {
    const providerOrderId = `${prefix}-order-${sequence++}`
    const opts = delivery({ data: { object: { id: providerOrderId } } })
    const result = await processWebhook({
      ...opts,
      handler: async (tx, event) => {
        await effect(tx, event)
        await tx.execute(
          sql`insert into purchase(id,workspace_id,user_id,plan_id,plan_price_id,provider,provider_order_id,status,amount,currency) values(${id()},${east},${user},${plan},${price},'stripe',${providerOrderId},'paid',1234,'USD')`,
        )
      },
    })
    expect(result.status).toBe('processed')
    expect(result.delivery).toMatchObject({ workspaceIds: [east], sites: ['east'] })
  })

  it('失败事件保留载荷中的归属；重放按最新本地记录重算；重复投递不改已保存的归属', async () => {
    const providerOrderId = `${prefix}-order-${sequence++}`
    const opts = delivery({
      data: { object: { id: providerOrderId, metadata: { workspaceId: west } } },
    })
    const failed = await processWebhook({
      ...opts,
      handler: async () => {
        throw new Error('temporary')
      },
    })
    expect(failed.status).toBe('failed')
    expect(failed.delivery).toMatchObject({ workspaceIds: [west], sites: ['west'] })

    await insertPurchase(east, providerOrderId)
    const replayed = await replayWebhook({
      db,
      handler: effect,
      webhookEventId: failed.delivery.id,
      providerId: 'stripe',
      normalize: async () => opts.normalized,
    })
    expect(replayed.status).toBe('processed')
    const both = { workspaceIds: [east, west].sort(), sites: ['east', 'west'] }
    expect(replayed.delivery).toMatchObject(both)

    await db.$client`delete from purchase where provider_order_id=${providerOrderId}`
    expect((await processWebhook({ ...opts, handler: effect })).status).toBe('duplicate')
    expect(await attribution(failed.delivery.id)).toEqual(both)
  })
})
