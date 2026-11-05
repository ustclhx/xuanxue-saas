import { attributeWebhookEvent } from '@xuanxue/billing'
import type { SiteId } from '@xuanxue/config'
import { organization, type PaymentProviderId, refundRequest, webhookEvent } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { eq } from 'drizzle-orm'
import type { AdminActionScope } from '../admin/action.ts'
import { assertAdminSite } from '../admin/site.ts'

// 账务后台写操作在 adminAction 事务内的校验与审计（split-site-accounts 决策 7）：
// 站点校验与审计同一事务，拒绝时整体回滚，不留下审计或状态变化。

/**
 * 回调重放请求：只重放失败的事件；事件关联到另一站的空间时拒绝（ADMIN_OTHER_SITE）。
 * 无法关联任何空间的事件两站后台都可重放：两站共用同一个回调入口，重放只是用已验证的原始载荷
 * 重跑同一条幂等处理管线，写入目标由载荷与支付平台数据决定，不由操作者的站点决定。
 */
export async function requestWebhookReplay(
  { tx, audit }: AdminActionScope,
  webhookEventId: string,
  currentSite: SiteId,
  providerAvailable: (provider: PaymentProviderId) => boolean,
) {
  const select = () =>
    tx
      .select({
        provider: webhookEvent.provider,
        status: webhookEvent.status,
        sites: webhookEvent.sites,
      })
      .from(webhookEvent)
      .where(eq(webhookEvent.id, webhookEventId))
  const [current] = await select()
  if (current?.status !== 'failed')
    throw new AppError('WEBHOOK_NOT_REPLAYABLE', 'Only failed records can be replayed')
  // 失败事件的归属可能早于后来补齐的本地账务（如订阅由另一事件建立）：校验前按最新记录重算，
  // 避免以过期的「未知站点」放行另一站的重放；已处理事件的归属保持不变
  await attributeWebhookEvent(tx, webhookEventId)
  const [found] = await select()
  if (found?.status !== 'failed')
    throw new AppError('WEBHOOK_NOT_REPLAYABLE', 'Only failed records can be replayed')
  const other = found.sites.find((site) => site !== currentSite)
  if (other) assertAdminSite(other, currentSite)
  if (!providerAvailable(found.provider))
    throw new AppError('BILLING_PROVIDER_UNAVAILABLE', 'Provider unavailable')
  await audit({
    action: 'billing.webhook_replay_requested',
    targetType: 'webhook_event',
    targetId: webhookEventId,
  })
  return { provider: found.provider }
}

/** 退款通知重发请求：只处理当前站点空间的退款申请，审计记录申请所属空间 */
export async function requestRefundNotificationRetry(
  { tx, audit }: AdminActionScope,
  requestId: string,
  currentSite: SiteId,
) {
  const [found] = await tx
    .select({ request: refundRequest, site: organization.site })
    // biome-ignore lint/plugin: 实时管理员守卫已通过，按退款申请 ID 获取明确空间再记录重试审计。
    .from(refundRequest)
    .innerJoin(organization, eq(organization.id, refundRequest.workspaceId))
    .where(eq(refundRequest.id, requestId))
  if (!found) throw new AppError('NOT_FOUND', 'Refund request unavailable', { status: 404 })
  assertAdminSite(found.site, currentSite)
  await audit({
    workspaceId: found.request.workspaceId,
    action: 'billing.refund_notification_retry_requested',
    targetType: 'refund_request',
    targetId: found.request.id,
    meta: { status: found.request.status },
  })
}
