import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { SIGNUP_BONUS_NEW_USERS_SINCE, signupBonusCreditsFor } from './signup-eligibility.ts'

describe('注册赠送只发给新用户（2026-11-18「版本 B」）', () => {
  it('决策日起注册的账户可领 15 积分，与当天每日 5 积分合计 20', () => {
    expect(templateConfig.billing.signupBonusCredits).toBe(15)
    expect(signupBonusCreditsFor(SIGNUP_BONUS_NEW_USERS_SINCE)).toBe(15)
    expect(signupBonusCreditsFor(new Date('2026-12-01T00:00:00Z'))).toBe(15)
  })

  it('决策日前注册或查不到账户时不发', () => {
    expect(signupBonusCreditsFor(new Date('2026-11-17T15:59:59Z'))).toBe(0)
    expect(signupBonusCreditsFor(undefined)).toBe(0)
  })
})
