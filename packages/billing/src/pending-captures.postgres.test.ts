import {
  auditLog,
  billingCustomer,
  createDb,
  creditGrant,
  creditLedger,
  member,
  organization,
  payment,
  plan,
  planPrice,
  purchase,
  user,
  webhookEvent,
} from '@xuanxue/db'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PENDING_CAPTURE_LIMIT, runPendingCaptures } from './cron.ts'
import { createBillingEventHandler } from './events.ts'
import { createPayPalProvider } from './paypal/index.ts'
import { processWebhook } from './pipeline.ts'
import type { NormalizedEvent } from './provider.ts'
import { type BillingServiceContext, confirmCheckout } from './services.ts'

const url = process.env.BILLING_TEST_DATABASE_URL
if (
  !url ||
  (!/^\/xuanxue_wt_[a-z0-9_]+$/.test(new URL(url).pathname) &&
    !(process.env.CI && new URL(url).pathname === '/xuanxue_ci'))
)
  throw new Error('Pending capture tests require an isolated billing database')
const db = createDb({ connectionString: url })
const migrator = createDb({ connectionString: process.env.MIGRATION_DATABASE_URL ?? '' })
const id = () => crypto.randomUUID()
const now = new Date('2026-10-26T12:00:00Z')
const minutes = (value: number) => new Date(now.getTime() - value * 60_000)

type Remote = { status?: number; order?: string; onGet?: () => Promise<void> }
let ws: string, uid: string, pid: string, pp: string
let remote: Map<string, Remote>
let captures: { orderId: string; requestId: string | null }[]
let gets: string[]
let ctx: BillingServiceContext

// 离线 PayPal：只模拟 OAuth、订单 GET 与 capture，不发起真实网络请求
const fetchMock: typeof fetch = async (input, init) => {
  const path = new URL(String(input)).pathname
  if (path === '/v1/oauth2/token')
    return Response.json({ access_token: 'offline-token', expires_in: 3600 })
  const match = /^\/v2\/checkout\/orders\/([A-Z0-9]+)(\/capture)?$/.exec(path)
  const orderId = match?.[1] ?? ''
  const state = remote.get(orderId)
  if (match?.[2]) {
    captures.push({
      orderId,
      requestId: new Headers(init?.headers).get('PayPal-Request-Id'),
    })
    if (state?.status === 422)
      return Response.json(
        { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }] },
        { status: 422 },
      )
    return Response.json({ id: orderId, status: 'COMPLETED' })
  }
  gets.push(orderId)
  await state?.onGet?.()
  if (!state || state.status === 404) return Response.json({}, { status: 404 })
  const amount = { currency_code: 'USD', value: '0.99' }
  return Response.json({
    id: orderId,
    status: state.order,
    purchase_units: [
      {
        amount,
        // 已完成的订单带 capture；未完成的订单没有 payments
        ...(state.order === 'COMPLETED'
          ? {
              payments: {
                captures: [
                  {
                    id: `CAP${orderId}`,
                    status: 'COMPLETED',
                    amount,
                    create_time: now.toISOString(),
                  },
                ],
              },
            }
          : {}),
      },
    ],
  })
}

async function seedPurchase(
  createdAt: Date,
  order: string | null,
  status: 'pending' | 'paid' = 'pending',
) {
  const purchaseId = id()
  const orderId = `O${purchaseId.replaceAll('-', '').toUpperCase()}`
  if (order) remote.set(orderId, { order })
  await db.insert(purchase).values({
    id: purchaseId,
    workspaceId: ws,
    userId: uid,
    planId: pid,
    planPriceId: pp,
    provider: 'paypal',
    providerOrderId: orderId,
    status,
    amount: 99,
    currency: 'USD',
    createdAt,
    updatedAt: createdAt,
  })
  return { purchaseId, orderId }
}
async function statusOf(purchaseId: string) {
  const [row] = await db.select().from(purchase).where(eq(purchase.id, purchaseId))
  return row?.status
}

beforeEach(async () => {
  ws = id()
  uid = id()
  pid = id()
  pp = id()
  remote = new Map()
  captures = []
  gets = []
  await db.insert(user).values({ id: uid, name: 'Owner', email: `${uid}@test.example` })
  await db.insert(organization).values({ id: ws, name: 'Capture tests', slug: ws })
  await db.insert(member).values({ id: id(), userId: uid, organizationId: ws, role: 'owner' })
  await db.insert(plan).values({
    id: pid,
    key: pid,
    name: 'Single',
    type: 'credit_pack',
    credits: 100,
    sort: 1,
    features: {
      models: [],
      maxConcurrentTasks: 1,
      maxSeats: 1,
      storageGb: 1,
      publicApi: false,
      priorityQueue: false,
      watermark: false,
    },
  })
  await db.insert(planPrice).values({
    id: pp,
    planId: pid,
    provider: 'paypal',
    providerPriceId: `paypal:credit_pack:${pp}`,
    interval: null,
    amount: 99,
    currency: 'USD',
  })
  const values = new Map<string, string>()
  const paypal = createPayPalProvider({
    environment: 'sandbox',
    clientId: 'offline-client',
    clientSecret: 'offline-secret',
    fetch: fetchMock,
    cache: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        values.set(key, value)
      },
    },
  })
  ctx = { db, providers: { paypal }, enabledProviders: ['paypal'] }
  // 共享隔离库中其他用例遗留的待付款订单不参与本文件的断言
  await db.update(purchase).set({ status: 'failed' }).where(eq(purchase.status, 'pending'))
})
afterEach(async () => {
  await db.delete(creditLedger).where(eq(creditLedger.workspaceId, ws))
  await db.delete(creditGrant).where(eq(creditGrant.workspaceId, ws))
  await db.delete(payment).where(eq(payment.workspaceId, ws))
  await db.delete(purchase).where(eq(purchase.workspaceId, ws))
  await db.delete(billingCustomer).where(eq(billingCustomer.workspaceId, ws))
  await db.delete(member).where(eq(member.organizationId, ws))
  await migrator.delete(auditLog).where(eq(auditLog.workspaceId, ws))
  await db.delete(organization).where(eq(organization.id, ws))
  await db.delete(user).where(eq(user.id, uid))
  await db.delete(planPrice).where(eq(planPrice.planId, pid))
  await db.delete(plan).where(eq(plan.id, pid))
})
afterAll(async () => {
  await migrator.$client.end()
  await db.$client.end()
})

describe('pending PayPal captures on PostgreSQL', () => {
  it('captures approved orders, skips completed ones and never grants credits locally', async () => {
    const approved = await seedPurchase(minutes(30), 'APPROVED')
    const completed = await seedPurchase(minutes(30), 'COMPLETED')
    const result = await runPendingCaptures(ctx, now)
    expect(result).toMatchObject({ captured: 1, failedPurchases: 0, failures: [] })
    expect(captures.map((call) => call.orderId)).toEqual([approved.orderId])
    // 入账只由付款回调完成：capture 后购买仍待付款，COMPLETED 订单也只刷新轮转时间
    expect(await statusOf(approved.purchaseId)).toBe('pending')
    expect(await statusOf(completed.purchaseId)).toBe('pending')
    const [touched] = await db.select().from(purchase).where(eq(purchase.id, completed.purchaseId))
    expect(touched?.updatedAt.getTime()).toBe(now.getTime())
  })

  it('shares one PayPal-Request-Id with a concurrent return-page capture', async () => {
    const approved = await seedPurchase(minutes(15), 'APPROVED')
    await Promise.all([
      runPendingCaptures(ctx, now),
      confirmCheckout(ctx, {
        workspaceId: ws,
        userId: uid,
        provider: 'paypal',
        providerRef: approved.orderId,
      }),
    ])
    expect(captures).toHaveLength(2)
    expect(new Set(captures.map((call) => call.requestId)).size).toBe(1)
    expect(captures[0]?.requestId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('marks voided, missing, stale unapproved and expired orders failed', async () => {
    const voided = await seedPurchase(minutes(20), 'VOIDED')
    const missing = await seedPurchase(minutes(20), null)
    const stale = await seedPurchase(minutes(4 * 60), 'CREATED')
    const action = await seedPurchase(minutes(4 * 60), 'PAYER_ACTION_REQUIRED')
    const fresh = await seedPurchase(minutes(60), 'CREATED')
    const expired = await seedPurchase(minutes(73 * 60), 'APPROVED')
    const young = await seedPurchase(minutes(5), 'APPROVED')
    const result = await runPendingCaptures(ctx, now)
    expect(result.failures).toEqual([])
    expect(result.failedPurchases).toBe(5)
    for (const row of [voided, missing, stale, action, expired])
      expect(await statusOf(row.purchaseId)).toBe('failed')
    expect(await statusOf(fresh.purchaseId)).toBe('pending')
    expect(await statusOf(young.purchaseId)).toBe('pending')
    // 超过 72 小时与不足 10 分钟的订单都不查询远端
    expect(gets).not.toContain(expired.orderId)
    expect(gets).not.toContain(young.orderId)
    expect(captures).toEqual([])
  })

  it('does not overwrite a purchase that became paid while the order was being read', async () => {
    const paid = await seedPurchase(minutes(20), 'COMPLETED', 'paid')
    const racing = await seedPurchase(minutes(20), 'VOIDED')
    remote.set(racing.orderId, {
      order: 'VOIDED',
      onGet: async () => {
        await db.update(purchase).set({ status: 'paid' }).where(eq(purchase.id, racing.purchaseId))
      },
    })
    const result = await runPendingCaptures(ctx, now)
    expect(result.failedPurchases).toBe(0)
    expect(gets).toEqual([racing.orderId])
    expect(await statusOf(racing.purchaseId)).toBe('paid')
    expect(await statusOf(paid.purchaseId)).toBe('paid')
  })

  it('bounds each round and rotates through waiting orders', async () => {
    expect(PENDING_CAPTURE_LIMIT).toBe(50)
    const rows = [
      await seedPurchase(minutes(40), 'COMPLETED'),
      await seedPurchase(minutes(30), 'COMPLETED'),
      await seedPurchase(minutes(20), 'COMPLETED'),
    ]
    await runPendingCaptures(ctx, now, { limit: 2 })
    expect(gets).toEqual([rows[0]?.orderId, rows[1]?.orderId])
    await runPendingCaptures(ctx, new Date(now.getTime() + 600_000), { limit: 2 })
    // 上一轮已检查的订单刷新了 updated_at，未检查的订单排在下一轮最前
    expect(gets[2]).toBe(rows[2]?.orderId)
    expect(gets).toHaveLength(4)
  })

  it('returns a retry link for declined return-page captures and leaves the scan quiet', async () => {
    const declined = await seedPurchase(minutes(20), 'APPROVED')
    remote.set(declined.orderId, { order: 'APPROVED', status: 422 })
    await expect(
      confirmCheckout(ctx, {
        workspaceId: ws,
        userId: uid,
        provider: 'paypal',
        providerRef: declined.orderId,
      }),
    ).rejects.toMatchObject({
      code: 'BILLING_PAYMENT_DECLINED',
      details: {
        retryUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${declined.orderId}`,
      },
    })
    const result = await runPendingCaptures(ctx, now)
    expect(result.failures).toEqual([])
    expect(await statusOf(declined.purchaseId)).toBe('pending')
  })

  it('restores a scan-failed purchase to paid when the verified capture arrives, granting once', async () => {
    const late = await seedPurchase(minutes(73 * 60), 'COMPLETED')
    await runPendingCaptures(ctx, now)
    expect(await statusOf(late.purchaseId)).toBe('failed')
    const event: NormalizedEvent = {
      provider: 'paypal',
      type: 'payment.succeeded',
      occurredAt: now,
      raw: {},
      payment: {
        providerPaymentId: `CAP${late.orderId}`,
        providerOrderId: late.orderId,
        providerPriceId: `paypal:credit_pack:${pp}`,
        kind: 'one_time',
        period: null,
        providerCustomerId: null,
        amount: 99,
        currency: 'USD',
        paidAt: now,
        refundedAmount: 0,
        status: 'succeeded',
        metadata: { workspaceId: ws, userId: uid, planPriceId: pp },
        raw: {},
      },
    }
    const deliveries = [id(), id()]
    try {
      // 迟到的 PAYMENT.CAPTURE.COMPLETED 及其重复投递
      for (const delivery of deliveries) {
        const verified = {
          providerEventId: delivery,
          type: 'PAYMENT.CAPTURE.COMPLETED',
          events: [event],
        }
        const result = await processWebhook({
          db,
          provider: { ...ctx.providers.paypal!, verifyWebhook: async () => verified },
          request: new Request('https://example.test'),
          rawBody: '{}',
          ...createBillingEventHandler({ db, providers: ctx.providers, now: () => now }),
        })
        expect(result.status).toBe('processed')
      }
      expect(await statusOf(late.purchaseId)).toBe('paid')
      expect(await db.select().from(payment).where(eq(payment.workspaceId, ws))).toHaveLength(1)
      const grants = await db.select().from(creditGrant).where(eq(creditGrant.workspaceId, ws))
      expect(grants).toHaveLength(1)
      expect(grants[0]?.amount).toBe(100)
    } finally {
      await db.delete(webhookEvent).where(inArray(webhookEvent.providerEventId, deliveries))
    }
  })

  it('does nothing when PayPal is not an enabled provider', async () => {
    await seedPurchase(minutes(20), 'APPROVED')
    const result = await runPendingCaptures({ ...ctx, enabledProviders: ['stripe'] }, now)
    expect(result).toMatchObject({ processed: 0, captured: 0, failures: [] })
    expect(gets).toEqual([])
  })
})
