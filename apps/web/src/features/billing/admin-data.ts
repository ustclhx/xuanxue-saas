import type { SiteId } from '@xuanxue/config'
import {
  creditGrant,
  type Database,
  organization,
  payment,
  purchase,
  refundRequest,
  subscription,
  webhookEvent,
} from '@xuanxue/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { ADMIN_PAGE_SIZE } from '../admin/list.ts'
import { adminSiteFilter } from '../admin/site.ts'

/**
 * 账务列表按站点（split-site-accounts 决策 7）：默认只列当前站点空间的记录，
 * `site: 'all'` 为只读的全部站点视图；记录的站点取其空间的 `organization.site`。
 */
export interface BillingListInput {
  offset: number
  workspaceId?: string | undefined
  site?: string | undefined
}
const siteScope = (data: BillingListInput, currentSite: SiteId) => {
  const scope = adminSiteFilter(data.site, currentSite)
  return scope ? eq(organization.site, scope) : undefined
}
const pageResult = <T>(rows: T[]) => ({
  rows: rows.slice(0, ADMIN_PAGE_SIZE),
  hasMore: rows.length > ADMIN_PAGE_SIZE,
})

export async function listAdminPayments(db: Database, data: BillingListInput, currentSite: SiteId) {
  const rows = await db
    .select({
      id: payment.id,
      workspaceId: payment.workspaceId,
      site: organization.site,
      provider: payment.provider,
      amount: payment.amount,
      refundedAmount: payment.refundedAmount,
      currency: payment.currency,
      status: payment.status,
      kind: payment.kind,
    })
    // biome-ignore lint/plugin: Fresh platform-admin middleware authorizes bounded cross-workspace billing reads.
    .from(payment)
    .innerJoin(organization, eq(organization.id, payment.workspaceId))
    .where(
      and(
        siteScope(data, currentSite),
        data.workspaceId ? eq(payment.workspaceId, data.workspaceId) : undefined,
      ),
    )
    .orderBy(desc(payment.createdAt), desc(payment.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset(data.offset)
  return pageResult(rows)
}
export async function listAdminSubscriptions(
  db: Database,
  data: BillingListInput,
  currentSite: SiteId,
) {
  const rows = await db
    .select({
      id: subscription.id,
      workspaceId: subscription.workspaceId,
      site: organization.site,
      provider: subscription.provider,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })
    // biome-ignore lint/plugin: Fresh platform-admin middleware authorizes bounded cross-workspace billing reads, including overlapping subscriptions.
    .from(subscription)
    .innerJoin(organization, eq(organization.id, subscription.workspaceId))
    .where(
      and(
        siteScope(data, currentSite),
        data.workspaceId ? eq(subscription.workspaceId, data.workspaceId) : undefined,
      ),
    )
    .orderBy(desc(subscription.createdAt), desc(subscription.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset(data.offset)
  return pageResult(rows)
}
export async function listAdminPurchases(
  db: Database,
  data: BillingListInput,
  currentSite: SiteId,
) {
  const rows = await db
    .select({
      id: purchase.id,
      workspaceId: purchase.workspaceId,
      site: organization.site,
      provider: purchase.provider,
      status: purchase.status,
      amount: purchase.amount,
      currency: purchase.currency,
      paidAt: purchase.paidAt,
    })
    // biome-ignore lint/plugin: Fresh platform-admin middleware authorizes bounded cross-workspace billing reads.
    .from(purchase)
    .innerJoin(organization, eq(organization.id, purchase.workspaceId))
    .where(
      and(
        siteScope(data, currentSite),
        data.workspaceId ? eq(purchase.workspaceId, data.workspaceId) : undefined,
      ),
    )
    .orderBy(desc(purchase.createdAt), desc(purchase.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset(data.offset)
  return pageResult(rows)
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const webhookStrings = sql`select v #>> '{}' from jsonb_path_query(${webhookEvent.payload}, '$.** ? (@.type() == "string")') v`

/**
 * 回调事件关联到的站点（升序去重，split-site-accounts 决策 7）。回调表没有空间与站点列，
 * 两站共用同一个支付回调入口，因此沿用下方空间筛选的关联规则：载荷中的结账元数据
 * `workspaceId`、PayPal `custom_id` 中的空间 ID，以及与本地订阅 / 付款 / 订单平台 ID 相同的字符串，
 * 取这些空间的 `organization.site`。无法关联任何空间时为空数组。
 * 引用外层查询的 `webhook_event` 行，只能用在 from webhook_event 的查询中。
 */
const webhookSiteArray = sql`array(
  select distinct ${organization.site} from ${organization} where ${organization.id} in (
    select case when m.v ~* ${`^${UUID}$`} then m.v::uuid end from (
      select w #>> '{}' as v from jsonb_path_query(${webhookEvent.payload}, '$.**.workspaceId') w
      union all
      select (regexp_matches(c #>> '{}', ${UUID}, 'gi'))[1] from jsonb_path_query(${webhookEvent.payload}, '$.**.custom_id') c
    ) m
    union all
    select ${subscription.workspaceId} from ${subscription} where ${subscription.provider} = ${webhookEvent.provider} and ${subscription.providerSubscriptionId} in (${webhookStrings})
    union all
    select ${payment.workspaceId} from ${payment} where ${payment.provider} = ${webhookEvent.provider} and ${payment.providerPaymentId} in (${webhookStrings})
    union all
    select ${purchase.workspaceId} from ${purchase} where ${purchase.provider} = ${webhookEvent.provider} and ${purchase.providerOrderId} in (${webhookStrings})
  ) order by 1
)`
/** 同上，以 jsonb 数组返回（驱动不解析 text[]） */
export const webhookEventSites = sql<SiteId[]>`to_jsonb(${webhookSiteArray})`

/**
 * 回调表没有空间列：按已验证载荷中的结账元数据或本地账务的平台 ID 关联，筛选先于分页。
 * 当前站点视图列出只关联当前站点的事件与无法关联任何站点的事件（两站后台都可重放后者，
 * 见 admin-writes.ts）；关联到另一站的事件只在只读的全部站点视图中出现。
 */
export async function listAdminWebhooks(db: Database, data: BillingListInput, currentSite: SiteId) {
  const scope = adminSiteFilter(data.site, currentSite)
  const workspace = data.workspaceId
  const hasIdentity = (
    id:
      | typeof subscription.providerSubscriptionId
      | typeof payment.providerPaymentId
      | typeof purchase.providerOrderId,
  ) =>
    sql`jsonb_path_exists(${webhookEvent.payload}, '$.** ? (@ == $id)', jsonb_build_object('id', ${id}))`
  const association = workspace
    ? sql`(
    jsonb_path_exists(${webhookEvent.payload}, '$.**.workspaceId ? (@ == $id)', jsonb_build_object('id', ${workspace}::text))
    or jsonb_path_exists(${webhookEvent.payload}, ${`$.**.custom_id ? (@ like_regex "${workspace}" flag "i")`}::jsonpath)
    or exists (select 1 from ${subscription} where ${subscription.workspaceId} = ${workspace} and ${subscription.provider} = ${webhookEvent.provider} and ${hasIdentity(subscription.providerSubscriptionId)})
    or exists (select 1 from ${payment} where ${payment.workspaceId} = ${workspace} and ${payment.provider} = ${webhookEvent.provider} and ${hasIdentity(payment.providerPaymentId)})
    or exists (select 1 from ${purchase} where ${purchase.workspaceId} = ${workspace} and ${purchase.provider} = ${webhookEvent.provider} and ${hasIdentity(purchase.providerOrderId)})
  )`
    : undefined
  const rows = await db
    .select({
      id: webhookEvent.id,
      provider: webhookEvent.provider,
      providerEventId: webhookEvent.providerEventId,
      type: webhookEvent.type,
      status: webhookEvent.status,
      attempts: webhookEvent.attempts,
      sites: webhookEventSites,
    })
    .from(webhookEvent)
    .where(
      and(association, scope ? sql`${webhookSiteArray} <@ array[${scope}]::text[]` : undefined),
    )
    .orderBy(desc(webhookEvent.receivedAt), desc(webhookEvent.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset(data.offset)
  return pageResult(rows)
}

export async function listAdminRefunds(db: Database, data: BillingListInput, currentSite: SiteId) {
  const found = await db
    .select({
      id: refundRequest.id,
      workspaceId: refundRequest.workspaceId,
      site: organization.site,
      reason: refundRequest.reason,
      requestedAmount: refundRequest.requestedAmount,
      approvedAmount: refundRequest.approvedAmount,
      status: refundRequest.status,
      reviewNote: refundRequest.reviewNote,
      reviewerId: refundRequest.reviewerId,
      providerRefundId: refundRequest.providerRefundId,
      paymentId: payment.id,
      provider: payment.provider,
      currency: payment.currency,
      paymentAmount: payment.amount,
      refundedAmount: payment.refundedAmount,
    })
    // biome-ignore lint/plugin: Fresh platform-admin middleware authorizes bounded cross-workspace refund reads.
    .from(refundRequest)
    .innerJoin(
      payment,
      and(
        eq(payment.id, refundRequest.paymentId),
        eq(payment.workspaceId, refundRequest.workspaceId),
      ),
    )
    .innerJoin(organization, eq(organization.id, refundRequest.workspaceId))
    .where(
      and(
        siteScope(data, currentSite),
        data.workspaceId ? eq(refundRequest.workspaceId, data.workspaceId) : undefined,
      ),
    )
    .orderBy(desc(refundRequest.createdAt), desc(refundRequest.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset(data.offset)
  const { rows, hasMore } = pageResult(found)
  const totals = rows.length
    ? await db
        .select({
          paymentId: creditGrant.paymentId,
          original: sql<number>`coalesce(sum(${creditGrant.amount}),0)::int`,
          remaining: sql<number>`coalesce(sum(${creditGrant.remaining}),0)::int`,
        })
        // biome-ignore lint/plugin: Platform-admin reads credit totals only for the bounded page of owned payment references.
        .from(creditGrant)
        .where(
          inArray(
            creditGrant.paymentId,
            rows.map((row) => row.paymentId),
          ),
        )
        .groupBy(creditGrant.paymentId)
    : []
  return {
    rows: rows.map((row) => ({
      ...row,
      remainingRefundable: row.paymentAmount - row.refundedAmount,
      originalCredits: totals.find((t) => t.paymentId === row.paymentId)?.original ?? 0,
      remainingCredits: totals.find((t) => t.paymentId === row.paymentId)?.remaining ?? 0,
    })),
    hasMore,
  }
}
