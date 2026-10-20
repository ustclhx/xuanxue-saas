import type { DeletionStep } from '@xuanxue/auth'
import {
  type BillingProviders,
  createBillingDeletionStep,
  createPaymentRuntime,
  type PaymentRuntimeEnv,
} from '@xuanxue/billing'
import type { Database } from '@xuanxue/db'
import type { KeyValueStore } from '@xuanxue/platform'
import { AppError } from '@xuanxue/shared'
import { templateConfig } from '../../server/template-config.ts'

export function createBillingDeletionSteps(
  config: PaymentRuntimeEnv,
  db: Database,
  cache: KeyValueStore,
): DeletionStep[] {
  if (!templateConfig.billing.enabled) return []
  // 普通认证不依赖支付配置；只有真正执行删除时才初始化支付能力。
  let step: DeletionStep
  return [
    {
      async before(context) {
        let providers: BillingProviders
        try {
          ;({ providers } = createPaymentRuntime(config, templateConfig.billing.providers, {
            cache,
            db,
          }))
        } catch (error) {
          // 生产未开通支付时不设 PAYMENT_MODE；此时没有可取消的订阅，删号不应被支付配置阻断。
          // 若仍有未终止订阅，下面的步骤会因缺少 provider 拒绝；模式非法或密钥不匹配照旧拒绝。
          if (
            config.PAYMENT_MODE !== undefined ||
            !(error instanceof AppError && error.code === 'BILLING_UNAVAILABLE')
          )
            throw error
          providers = {}
        }
        step = createBillingDeletionStep({
          providers,
          refundWindowDays: templateConfig.billing.refundWindowDays,
        })
        await step.before?.(context)
      },
      async execute(context, sql) {
        await step.execute?.(context, sql)
      },
    },
  ]
}
