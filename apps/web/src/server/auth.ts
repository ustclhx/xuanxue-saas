import { type AuthEnv, type CreateAuthDeps, createAuth } from '@xuanxue/auth'
import { grantSignupBonus } from '@xuanxue/billing'
import { grantDailyCredits } from '@xuanxue/credits'
import type { Database } from '@xuanxue/db'
import { log } from '@xuanxue/shared/log'
import { signupBonusConfig } from '../features/billing/signup-eligibility.ts'
import { templateConfig } from './template-config.ts'
import { resolveWorkspaceMaxSeats } from './workspace-data.ts'

/** 中立认证工厂；发信、注册准入与删除外部能力由 composition root 注入。 */
export function createWebAuth(config: AuthEnv, db: Database, deps: Omit<CreateAuthDeps, 'config'>) {
  return createAuth(config, db, {
    ...deps,
    config: templateConfig,
    resolveMaxSeats: deps.resolveMaxSeats ?? resolveWorkspaceMaxSeats,
    onEmailVerified:
      deps.onEmailVerified ??
      (async (user) => {
        if (!templateConfig.credits.enabled) return
        const bonus = await grantSignupBonus({
          db,
          userId: user.id,
          config: await signupBonusConfig(db, user.id),
        })
        // 「版本 B」首次登录即到账 20 = 注册赠送 + 当天每日领取：邮箱验证（OAuth / 验证码注册即已验证）时
        // 顺带领取当天每日积分，不必等进入 App 区。同一事务路径按「邮箱 + 日期」幂等，失败不影响验证与注册。
        if (templateConfig.credits.dailyEnabled) {
          try {
            await grantDailyCredits({ db, userId: user.id, enabled: true })
          } catch {
            log.warn('credits.daily.verify_claim_failed', { userId: user.id })
          }
        }
        return bonus
      }),
  })
}
