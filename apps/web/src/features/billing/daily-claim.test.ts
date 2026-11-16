import { expect, it } from 'vitest'
import { billingDailyClaimState } from './daily-claim.ts'

it('领取记录决定今日已领和数量，与剩余余额无关', () => {
  expect(billingDailyClaimState({ credits: 10, day: '2026-11-16' })).toEqual({
    status: 'claimed',
    credits: 10,
  })
})

it('没有当天领取记录时不显示今日已领', () => {
  expect(billingDailyClaimState(null)).toBeNull()
})
