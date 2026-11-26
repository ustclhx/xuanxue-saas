import { setResponseStatus } from '@tanstack/react-start/server'
import {
  createPaymentRuntime,
  notifyRefundRequest,
  type RefundServiceOptions,
  reviewRefundRequest,
} from '@xuanxue/billing'
import { siteBrandName } from '@xuanxue/config'
import type { Database } from '@xuanxue/db'
import { requireCapability } from '@xuanxue/platform'
import { AppError } from '@xuanxue/shared'
import { withRequestId } from '@xuanxue/shared/log'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'

// 后台退款与回调重放使用的支付运行时与退款服务选项。后台退款页与 admin-mcp 的确认执行
// （退款审核经管理员确认后执行，add-admin-step-up 任务 3.4）共用，只能在 server function handler 内调用。

export function adminPaymentRuntime(db: Database) {
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
export function adminRefundOptions(db: Database): RefundServiceOptions {
  const queue = requireCapability(getWebRuntime().emailQueue, 'Email queue')
  return {
    db,
    providers: adminPaymentRuntime(db).providers,
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
          // 退款通知按申请所属站点的品牌与客服邮箱发送（split-site-accounts）
          appName: (locale, site) => siteBrandName(templateConfig, site, locale),
          supportEmail: (_locale, site) => templateConfig.sites[site].supportEmail,
        },
        notification,
      ),
  }
}

/** 后台退款审核（含确认执行 AI 发起的审核）：插件经此调用，不直接依赖 @xuanxue/billing */
export function reviewAdminRefundRequest(
  db: Database,
  input: Parameters<typeof reviewRefundRequest>[1],
) {
  return reviewRefundRequest(adminRefundOptions(db), input)
}
