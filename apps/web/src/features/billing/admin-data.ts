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
import { and, arrayContained, arrayContains, desc, eq, inArray, sql } from 'drizzle-orm'
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

/**
 * 回调表保存了事件关联的空间与站点（`workspace_ids` / `sites`，由回调管线写入，openspec webhook-event-site），
 * 筛选走 GIN 索引并先于分页。当前站点视图列出只关联当前站点的事件与无法关联任何站点的事件（空数组；
 * 两站后台都可重放后者，见 admin-writes.ts）；关联到另一站的事件只在只读的全部站点视图中出现。
 */
export async function listAdminWebhooks(db: Database, data: BillingListInput, currentSite: SiteId) {
  const scope = adminSiteFilter(data.site, currentSite)
  const rows = await db
    .select({
      id: webhookEvent.id,
      provider: webhookEvent.provider,
      providerEventId: webhookEvent.providerEventId,
      type: webhookEvent.type,
      status: webhookEvent.status,
      attempts: webhookEvent.attempts,
      sites: webhookEvent.sites,
    })
    .from(webhookEvent)
    .where(
      and(
        data.workspaceId ? arrayContains(webhookEvent.workspaceIds, [data.workspaceId]) : undefined,
        scope ? arrayContained(webhookEvent.sites, [scope]) : undefined,
      ),
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
