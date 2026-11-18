import type { Database } from '@xuanxue/db'
import { templateConfig } from '../../server/template-config.ts'

/**
 * 2026-11-18「版本 B」：只有新用户首次登录送积分（注册赠送 + 当天每日领取）。
 * 此前注册的账户不再补发注册赠送：账户页不显示领取入口，验证邮箱或手动领取都按「未开放」处理。
 * 每个规范化邮箱只发一次、两站共享，由 grantSignupBonus 的全局 sourceRef 保证。
 */
// 决策日按使用者所在时区（UTC+8）计：2026-11-18 00:00 +08:00 = 2026-11-17 16:00 UTC
export const SIGNUP_BONUS_NEW_USERS_SINCE = new Date('2026-11-18T00:00:00+08:00')

/** 该账户可领的注册赠送积分；0 表示不适用（grantSignupBonus 返回 disabled） */
export function signupBonusCreditsFor(createdAt: Date | null | undefined): number {
  if (!templateConfig.credits.enabled) return 0
  if (!createdAt || createdAt.getTime() < SIGNUP_BONUS_NEW_USERS_SINCE.getTime()) return 0
  return templateConfig.billing.signupBonusCredits
}

/** 按数据库中的注册时间给出 grantSignupBonus 的配置，不信任会话里的用户字段 */
export async function signupBonusConfig(db: Database, userId: string) {
  const row = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { createdAt: true },
  })
  return { signupBonusCredits: signupBonusCreditsFor(row?.createdAt) }
}
