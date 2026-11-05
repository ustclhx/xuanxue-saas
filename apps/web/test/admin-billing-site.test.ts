import {
  attributeWebhookEvent,
  markManualRefund,
  type PaymentProvider,
  type RefundServiceOptions,
  retryRefundNotification,
  reviewRefundRequest,
} from '@xuanxue/billing'
import type { SiteId } from '@xuanxue/config'
import { newId } from '@xuanxue/shared'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { runAdminAction } from '../src/features/admin/action.ts'
import { assertAdminSite } from '../src/features/admin/site.ts'
import {
  listAdminPayments,
  listAdminPurchases,
  listAdminRefunds,
  listAdminSubscriptions,
  listAdminWebhooks,
} from '../src/features/billing/admin-data.ts'
import {
  requestRefundNotificationRetry,
  requestWebhookReplay,
} from '../src/features/billing/admin-writes.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// 账务后台按站点（split-site-accounts 决策 7）：同一邮箱在两站各有一个管理员与一个申请人账户，
// 各自拥有本站空间与账务记录；东站管理员对西站记录的写操作返回 403 且不改变任何数据。

const db = createAdminTestDb()
const migrator = createAdminTestDb('migrator')
const sites = ['east', 'west'] as const
const adminEmail = `${newId()}@admin-billing-site.example`
const applicantEmail = `${newId()}@admin-billing-site.example`
type Fixture = {
  admin: string
  applicant: string
  ws: string
  payment: string
  refund: string
  webhook: string
}
const f = {} as Record<SiteId, Fixture>
const plan = newId()
const price = newId()
const unresolved = newId()
const notify = vi.fn(async () => {})
const options: RefundServiceOptions = {
  db,
  providers: {
    // 手动退款平台：审核不调用支付平台 API，便于只验证站点校验与状态
    stripe: { id: 'stripe', capabilities: { refundsViaApi: false } } as PaymentProvider,
  },
  config: { refundWindowDays: 30 },
  notify,
}
const east = (site: SiteId) => assertAdminSite(site, 'east')
const context = () => ({ db, admin: { id: f.east.admin }, ip: '203.0.113.9' })
const refundRow = async (id: string) =>
  (
    await db.$client`select status,approved_amount,reviewer_id from refund_request where id=${id}`
  )[0]
const auditsFor = async (targetId: string) =>
  migrator.$client`select action from audit_log where target_id=${targetId}`
const otherSite = { code: 'ADMIN_OTHER_SITE', status: 403, details: { site: 'west' } }

beforeAll(async () => {
  await db.$client`insert into plan(id,key,name,type,credits,features) values(${plan},${plan},'Fixture','credit_pack',100,'{"models":[],"maxConcurrentTasks":1,"maxSeats":1,"storageGb":1,"publicApi":false,"priorityQueue":false,"watermark":false}'::jsonb)`
  await db.$client`insert into plan_price(id,plan_id,provider,provider_price_id,amount,currency) values(${price},${plan},'stripe',${price},1234,'USD')`
  for (const site of sites) {
    const row: Fixture = {
      admin: newId(),
      applicant: newId(),
      ws: newId(),
      payment: newId(),
      refund: newId(),
      webhook: newId(),
    }
    f[site] = row
    const order = newId()
    const sub = newId()
    await db.$client`insert into "user"(id,name,email,role,site) values(${row.admin},'Admin',${adminEmail},'admin',${site}),(${row.applicant},'Applicant',${applicantEmail},null,${site})`
    await db.$client`insert into organization(id,name,slug,site) values(${row.ws},'Site billing',${row.ws},${site})`
    await db.$client`insert into member(id,organization_id,user_id,role) values(${newId()},${row.ws},${row.applicant},'owner')`
    await db.$client`insert into purchase(id,workspace_id,user_id,plan_id,plan_price_id,provider,provider_order_id,status,amount,currency) values(${order},${row.ws},${row.applicant},${plan},${price},'stripe',${order},'paid',1234,'USD')`
    await db.$client`insert into payment(id,workspace_id,provider,provider_payment_id,purchase_id,kind,amount,currency,paid_at) values(${row.payment},${row.ws},'stripe',${row.payment},${order},'one_time',1234,'USD',now())`
    await db.$client`insert into subscription(id,workspace_id,plan_id,plan_price_id,provider,provider_subscription_id,status,last_event_at) values(${sub},${row.ws},${plan},${price},'stripe',${sub},'active',now())`
    await db.$client`insert into refund_request(id,workspace_id,user_id,payment_id,reason,contact_email) values(${row.refund},${row.ws},${row.applicant},${row.payment},'Fixture refund',${applicantEmail})`
    // 关联方式各取一种：西站按本地付款平台 ID，东站按结账元数据
    const payload =
      site === 'west'
        ? { data: { object: { payment_intent: row.payment } } }
        : { data: { object: { metadata: { workspaceId: row.ws } } } }
    await db.$client`insert into webhook_event(id,provider,provider_event_id,type,payload,status) values(${row.webhook},'stripe',${row.webhook},'fixture',${JSON.stringify(payload)}::jsonb,'failed')`
    await db.transaction((tx) => attributeWebhookEvent(tx, row.webhook))
  }
  await db.$client`insert into webhook_event(id,provider,provider_event_id,type,payload,status) values(${unresolved},'stripe',${unresolved},'fixture','{}'::jsonb,'failed')`
  await db.transaction((tx) => attributeWebhookEvent(tx, unresolved))
})

afterAll(async () => {
  const spaces = sites.map((site) => f[site].ws)
  const users = sites.flatMap((site) => [f[site].admin, f[site].applicant])
  const webhooks = [...sites.map((site) => f[site].webhook), unresolved]
  await migrator.$client`delete from audit_log where actor_user_id in ${db.$client(users)} or workspace_id in ${db.$client(spaces)} or target_id in ${db.$client(webhooks)}`
  await db.$client`delete from credit_ledger where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from credit_grant where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from refund_request where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from payment_refund where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from payment where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from purchase where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from subscription where workspace_id in ${db.$client(spaces)}`
  await db.$client`delete from webhook_event where id in ${db.$client(webhooks)}`
  await db.$client`delete from member where organization_id in ${db.$client(spaces)}`
  await db.$client`delete from organization where id in ${db.$client(spaces)}`
  await db.$client`delete from "user" where id in ${db.$client(users)}`
  await db.$client`delete from plan_price where id=${price}`
  await db.$client`delete from plan where id=${plan}`
  await Promise.all([db.$client.end(), migrator.$client.end()])
})

describe('账务后台列表按站点', () => {
  it.each([
    ['订阅', listAdminSubscriptions],
    ['一次性购买', listAdminPurchases],
    ['付款', listAdminPayments],
    ['退款审核', listAdminRefunds],
  ] as const)('%s 默认只列当前站点，全部站点视图带站点列', async (_name, list) => {
    const { ws: westWs } = f.west
    expect((await list(db, { workspaceId: westWs, offset: 0 }, 'east')).rows).toHaveLength(0)
    const all = await list(db, { workspaceId: westWs, offset: 0, site: 'all' }, 'east')
    expect(all.rows.map((row) => [row.workspaceId, row.site])).toEqual([[westWs, 'west']])
    const current = await list(db, { workspaceId: f.east.ws, offset: 0 }, 'east')
    expect(current.rows.map((row) => row.site)).toEqual(['east'])
  })

  it('回调按关联空间解析站点：另一站的事件只在全部站点视图出现，未关联事件两站都列出', async () => {
    const westOnly = { workspaceId: f.west.ws, offset: 0 }
    expect((await listAdminWebhooks(db, westOnly, 'east')).rows).toHaveLength(0)
    expect(
      (await listAdminWebhooks(db, { ...westOnly, site: 'all' }, 'east')).rows.map((row) => [
        row.id,
        row.sites,
      ]),
    ).toEqual([[f.west.webhook, ['west']]])
    expect(
      (await listAdminWebhooks(db, { workspaceId: f.east.ws, offset: 0 }, 'east')).rows.map(
        (row) => row.sites,
      ),
    ).toEqual([['east']])
    for (const site of sites) {
      const rows = (await listAdminWebhooks(db, { offset: 0 }, site)).rows
      expect(rows.find((row) => row.id === unresolved)?.sites).toEqual([])
      expect(rows.some((row) => row.id === f[site === 'east' ? 'west' : 'east'].webhook)).toBe(
        false,
      )
    }
  })

  it('回调按保存的归属显示：本地账务记录删除后站点不变，不会变成两站可重放的未知事件', async () => {
    const order = newId()
    const event = newId()
    await db.$client`insert into purchase(id,workspace_id,user_id,plan_id,plan_price_id,provider,provider_order_id,status,amount,currency) values(${order},${f.west.ws},${f.west.applicant},${plan},${price},'stripe',${order},'paid',1234,'USD')`
    await db.$client`insert into webhook_event(id,provider,provider_event_id,type,payload,status) values(${event},'stripe',${event},'fixture',${JSON.stringify({ data: { object: { id: order } } })}::jsonb,'failed')`
    try {
      await db.transaction((tx) => attributeWebhookEvent(tx, event))
      await db.$client`delete from purchase where id=${order}`
      const all = await listAdminWebhooks(
        db,
        { workspaceId: f.west.ws, offset: 0, site: 'all' },
        'east',
      )
      expect(all.rows.find((row) => row.id === event)?.sites).toEqual(['west'])
      expect(
        (await listAdminWebhooks(db, { offset: 0 }, 'east')).rows.some((row) => row.id === event),
      ).toBe(false)
    } finally {
      await db.$client`delete from webhook_event where id=${event}`
      await db.$client`delete from purchase where id=${order}`
    }
  })
})

describe('账务后台写操作按站点', () => {
  it('退款审核：另一站的申请返回 403 且保持待审核，本站正常审核', async () => {
    await expect(
      reviewRefundRequest(options, {
        userId: f.east.admin,
        requestId: f.west.refund,
        decision: 'approve',
        approvedAmount: 500,
        assertSite: east,
      }),
    ).rejects.toMatchObject(otherSite)
    expect(await refundRow(f.west.refund)).toMatchObject({ status: 'pending', reviewer_id: null })
    expect(await auditsFor(f.west.refund)).toHaveLength(0)

    const saved = await reviewRefundRequest(options, {
      userId: f.east.admin,
      requestId: f.east.refund,
      decision: 'approve',
      approvedAmount: 500,
      assertSite: east,
    })
    expect(saved).toMatchObject({ status: 'approved', approvedAmount: 500 })
  })

  it('手动退款：另一站已批准的申请返回 403 且不结算，本站正常结算', async () => {
    // 西站申请由西站管理员批准，排除「未批准」等其他拒绝原因
    await reviewRefundRequest(options, {
      userId: f.west.admin,
      requestId: f.west.refund,
      decision: 'approve',
      approvedAmount: 500,
      assertSite: (site) => assertAdminSite(site, 'west'),
    })
    const evidence = { providerRefundId: `manual-${newId()}`, proof: 'Platform receipt' }
    await expect(
      markManualRefund(options, {
        userId: f.east.admin,
        requestId: f.west.refund,
        ...evidence,
        assertSite: east,
      }),
    ).rejects.toMatchObject(otherSite)
    expect(await refundRow(f.west.refund)).toMatchObject({ status: 'approved' })
    expect(
      (await db.$client`select refunded_amount from payment where id=${f.west.payment}`)[0],
    ).toMatchObject({ refunded_amount: 0 })
    expect(
      await db.$client`select id from payment_refund where payment_id=${f.west.payment}`,
    ).toHaveLength(0)

    const settled = await markManualRefund(options, {
      userId: f.east.admin,
      requestId: f.east.refund,
      providerRefundId: `manual-${newId()}`,
      proof: 'Platform receipt',
      assertSite: east,
    })
    expect(settled.status).toBe('refunded')
  })

  it('重发退款邮件：另一站的申请返回 403、无审计、不发信，本站正常重发', async () => {
    notify.mockClear()
    await expect(
      runAdminAction(context(), 'billing.refund_notification_retry_requested', (scope) =>
        requestRefundNotificationRetry(scope, f.west.refund, 'east'),
      ),
    ).rejects.toMatchObject(otherSite)
    await expect(
      retryRefundNotification(options, {
        userId: f.east.admin,
        requestId: f.west.refund,
        assertSite: east,
      }),
    ).rejects.toMatchObject(otherSite)
    expect(notify).not.toHaveBeenCalled()
    expect(
      (await auditsFor(f.west.refund)).filter(
        (row) => row.action === 'billing.refund_notification_retry_requested',
      ),
    ).toHaveLength(0)

    await runAdminAction(context(), 'billing.refund_notification_retry_requested', (scope) =>
      requestRefundNotificationRetry(scope, f.east.refund, 'east'),
    )
    await retryRefundNotification(options, {
      userId: f.east.admin,
      requestId: f.east.refund,
      assertSite: east,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect((await auditsFor(f.east.refund)).map((row) => row.action)).toContain(
      'billing.refund_notification_retry_requested',
    )
  })

  it('回调重放：关联另一站的事件返回 403 且无审计，本站与未关联事件可请求重放', async () => {
    const replay = (id: string) =>
      runAdminAction(context(), 'billing.webhook_replay', (scope) =>
        requestWebhookReplay(scope, id, 'east', () => true),
      )
    await expect(replay(f.west.webhook)).rejects.toMatchObject(otherSite)
    expect(await auditsFor(f.west.webhook)).toHaveLength(0)
    expect(
      (await db.$client`select status,attempts from webhook_event where id=${f.west.webhook}`)[0],
    ).toMatchObject({ status: 'failed', attempts: 0 })

    for (const id of [f.east.webhook, unresolved]) {
      expect(await replay(id)).toEqual({ provider: 'stripe' })
      expect((await auditsFor(id)).map((row) => row.action)).toEqual([
        'billing.webhook_replay_requested',
      ])
    }
  })
})
