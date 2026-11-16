import type { DailyCreditsClaim } from '@xuanxue/credits'

/** 领取事实独立于余额和 App 布局的 KV 检查结果；用完后仍显示原领取数量。 */
export function billingDailyClaimState(claim: DailyCreditsClaim | null | undefined) {
  return claim ? { status: 'claimed' as const, credits: claim.credits } : null
}
