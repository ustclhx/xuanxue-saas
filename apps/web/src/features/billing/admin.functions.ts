import { isNotFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import {
  createBillingEventHandler,
  createCompensationFailureHandler,
  createPaymentRuntime,
  markManualRefund,
  notifyRefundRequest,
  type RefundServiceOptions,
  replayWebhook,
  retryRefundNotification,
  reviewRefundRequest,
} from '@xuanxue/billing'
import { siteBrandName } from '@xuanxue/config'
import type { Database } from '@xuanxue/db'
import { requireCapability } from '@xuanxue/platform'
import { AppError } from '@xuanxue/shared'
import { withRequestId } from '@xuanxue/shared/log'
import { z } from 'zod'
import { withBilling } from '../../server/feature-gates.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { withAdminAction, withDelegatedAdminAction } from '../admin/action.server.ts'
import { adminMiddleware } from '../admin/admin.functions.ts'
import { adminWorkspaceIdFilter } from '../admin/list.ts'
import { ADMIN_ALL_SITES, ADMIN_OTHER_SITE, assertAdminSite } from '../admin/site.ts'
import { enqueueServerAnalytics } from '../analytics/server.ts'

import {
  listAdminPayments,
  listAdminPurchases,
  listAdminRefunds,
  listAdminSubscriptions,
  listAdminWebhooks,
} from './admin-data.ts'
import { requestRefundNotificationRetry, requestWebhookReplay } from './admin-writes.ts'

const page = z.object({
  offset: z.number().int().min(0).max(100_000).default(0),
  workspaceId: adminWorkspaceIdFilter,
  // 列表默认当前站点；`all` 为只读的全部站点视图（split-site-accounts 决策 7）
  site: z.literal(ADMIN_ALL_SITES).optional(),
})
const request = z.object({ requestId: z.uuid() })
function runtime(db: Database) {
  try {
    return createPaymentRuntime(getWebRuntime().config, templateConfig.billing.providers, {
      cache: getWebRuntime().cache,
      db,
    })
  } catch (error) {
    if (error instanceof AppError && error.status === 503) setResponseStatus(503)
    throw error
  }
}
function refundOptions(db: Database): RefundServiceOptions {
  const queue = requireCapability(getWebRuntime().emailQueue, 'Email queue')
  return {
    db,
    providers: runtime(db).providers,
    config: templateConfig.billing,
    notify: (notification) =>
      notifyRefundRequest(
        {
          db,
          queue: {
            send: async (message) => {
              await queue.send(withRequestId(message))
            },
          },
          appName: (locale, site) => siteBrandName(templateConfig, site, locale),
          supportEmail: (_locale, site) => templateConfig.sites[site].supportEmail,
        },
        notification,
      ),
  }
}
async function safe(action: () => Promise<string>) {
  try {
    return { ok: true as const, status: await action() }
  } catch (error) {
    // 写事务内发现管理员已失效：与守卫一样返回 404，不当作业务失败
    if (isNotFound(error)) throw error
    if (error instanceof AppError && (error.status === 503 || error.code === ADMIN_OTHER_SITE))
      setResponseStatus(error.status)
    return {
      ok: false as const,
      error: error instanceof AppError ? error.code : 'BILLING_UNAVAILABLE',
    }
  }
}

export const getAdminBilling = createServerFn({ method: 'GET' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(page)
  .handler(async ({ context, data }) => {
    const current = runtime(context.db)
    return {
      ...(await listAdminPayments(context.db, data, context.site)),
      mode: current.mode,
      readiness: current.readiness,
    }
  })

export const getAdminSubscriptions = createServerFn({ method: 'GET' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(page)
  .handler(({ context, data }) => listAdminSubscriptions(context.db, data, context.site))

export const getAdminPurchases = createServerFn({ method: 'GET' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(page)
  .handler(({ context, data }) => listAdminPurchases(context.db, data, context.site))

export const getAdminWebhooks = createServerFn({ method: 'GET' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(page)
  .handler(async ({ context, data }) => {
    const result = await listAdminWebhooks(context.db, data, context.site)
    const current = runtime(context.db)
    return {
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        replayAvailable: Boolean(current.normalizers[row.provider]),
      })),
    }
  })

export const getAdminRefunds = createServerFn({ method: 'GET' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(page)
  .handler(async ({ context, data }) => {
    const result = await listAdminRefunds(context.db, data, context.site)
    const providers = runtime(context.db).providers
    return {
      ...result,
      rows: result.rows.map((row) => ({
        ...row,
        providerAvailable: Boolean(providers[row.provider]),
        manualAvailable: Boolean(
          providers[row.provider] && !providers[row.provider]?.capabilities.refundsViaApi,
        ),
      })),
    }
  })

export const replayAdminWebhook = createServerFn({ method: 'POST' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(z.object({ webhookEventId: z.uuid() }))
  .handler(({ context, data }) =>
    safe(async () => {
      const current = runtime(context.db)
      const queue = requireCapability(getWebRuntime().eventsQueue, 'Events queue')
      // 校验（含站点）与「已请求重放」审计同事务提交；重放本身在提交后执行（自行管理事务与队列通知），
      // 重放失败记录在回调事件上，可再次重试
      const delivery = await withAdminAction(context, 'billing.webhook_replay', (scope) =>
        requestWebhookReplay(scope, data.webhookEventId, context.site, (provider) =>
          Boolean(current.normalizers[provider]),
        ),
      )
      const normalize = current.normalizers[delivery.provider]
      if (!normalize) throw new AppError('BILLING_PROVIDER_UNAVAILABLE', 'Provider unavailable')
      const result = await replayWebhook({
        db: context.db,
        webhookEventId: data.webhookEventId,
        providerId: delivery.provider,
        normalize,
        ...createBillingEventHandler({
          db: context.db,
          providers: current.providers,
          subscriptionCreditGraceHours: templateConfig.billing.subscriptionCreditGraceHours,
        }),
        onFailure: createCompensationFailureHandler(context.db),
        notify: async ({ delivery, events }) => {
          await queue.send(withRequestId({ v: 1, deliveryId: delivery.id }))
          // 首次处理失败的付款经重放才真正入账，此时才产生 payment_success。
          for (const event of events)
            if (event.type === 'payment.succeeded' && event.payment.status === 'succeeded')
              await enqueueServerAnalytics(queue, {
                event: 'payment_success',
                provider: event.provider,
                providerPaymentId: event.payment.providerPaymentId,
              })
        },
      })
      return result.status === 'failed'
        ? 'Replay failed; record remains available for retry.'
        : 'notification' in result && result.notification.status === 'failed'
          ? `${result.status}; notification queue failed`
          : result.status
    }),
  )

// 退款审核 / 手动退款 / 重发通知：@xuanxue/billing 在自己的决策事务内写审计，并在提交后才调用支付平台与邮件队列，
// 因此只经 adminAction 的实时角色校验（withDelegatedAdminAction），不包进外层事务；
// 站点校验以 assertSite 传入，在其决策事务内持锁执行（split-site-accounts 决策 7）
export const reviewAdminRefund = createServerFn({ method: 'POST' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(
    request.extend({
      decision: z.enum(['approve', 'reject']),
      approvedAmount: z.number().int().positive().max(2_147_483_647).optional(),
      reviewNote: z.string().trim().max(2000),
    }),
  )
  .handler(({ context, data }) =>
    safe(async () =>
      withDelegatedAdminAction(
        context,
        async (db) =>
          (
            await reviewRefundRequest(refundOptions(db), {
              requestId: data.requestId,
              ip: context.ip,
              decision: data.decision,
              reviewNote: data.reviewNote,
              ...(data.approvedAmount === undefined ? {} : { approvedAmount: data.approvedAmount }),
              userId: context.admin.id,
              assertSite: (site) => assertAdminSite(site, context.site),
            })
          ).status,
      ),
    ),
  )

export const completeAdminRefund = createServerFn({ method: 'POST' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(
    request.extend({
      providerRefundId: z.string().trim().min(1).max(2000),
      proof: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(({ context, data }) =>
    safe(async () =>
      withDelegatedAdminAction(
        context,
        async (db) =>
          (
            await markManualRefund(refundOptions(db), {
              ...data,
              userId: context.admin.id,
              ip: context.ip,
              assertSite: (site) => assertAdminSite(site, context.site),
            })
          ).status,
      ),
    ),
  )

export const retryAdminRefundEmail = createServerFn({ method: 'POST' })
  .middleware([withBilling, adminMiddleware])
  .inputValidator(request)
  .handler(({ context, data }) =>
    safe(async () =>
      withDelegatedAdminAction(context, async (db) => {
        const options = refundOptions(db)
        await withAdminAction(context, 'billing.refund_notification_retry_requested', (scope) =>
          requestRefundNotificationRetry(scope, data.requestId, context.site),
        )
        await retryRefundNotification(options, {
          ...data,
          userId: context.admin.id,
          assertSite: (site) => assertAdminSite(site, context.site),
        })
        return 'Email queued or already delivered'
      }),
    ),
  )
