import { describe, expect, it } from 'vitest'
import { adminMoney, partialRefundAmount } from './admin-display.ts'

describe('后台多币种金额（localize-checkout-currency 5.4）', () => {
  it('按各行币种显示，零小数币种不显示小数', () => {
    expect(adminMoney(199, 'USD')).toBe('$1.99')
    expect(adminMoney(22700, 'TWD')).toBe('NT$227')
    expect(adminMoney(2800, 'KRW')).toBe('₩2,800')
  })

  it('部分退款按显示单位输入并换算成最小单位，TWD 与 KRW 只接受整数', () => {
    expect(partialRefundAmount('1.50', 'USD', 699)).toBe(150)
    expect(partialRefundAmount('100', 'TWD', 22700)).toBe(10000)
    expect(partialRefundAmount('100.5', 'TWD', 22700)).toBeNull()
    expect(partialRefundAmount('1400', 'KRW', 2800)).toBe(1400)
    expect(partialRefundAmount('1400.5', 'KRW', 2800)).toBeNull()
    // 不小于可退余额时走全额退款按钮
    expect(partialRefundAmount('28', 'KRW', 28)).toBeNull()
    expect(partialRefundAmount('0', 'USD', 699)).toBeNull()
    expect(partialRefundAmount('abc', 'USD', 699)).toBeNull()
  })
})
