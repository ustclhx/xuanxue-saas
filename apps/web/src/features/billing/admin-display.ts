import {
  enabledCurrency,
  formatMoney,
  isValidMinorAmount,
  toMinor,
} from '@xuanxue/billing/currency'

/** 后台按各行的币种格式化（TWD、KRW 无小数）；不在启用集合的历史币种按 Intl 默认两位小数显示 */
export function adminMoney(amount: number, currency = 'USD') {
  if (enabledCurrency(currency)) return formatMoney(amount, currency, 'en')
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
}

/**
 * 后台部分退款输入（localize-checkout-currency D6）：管理员按币种的显示单位输入（USD 可到美分，TWD、KRW 只能整元），
 * 换算成最小单位；格式不符、不满足币种约束或不小于可退余额（全额退款另有按钮）时返回 null。
 */
export function partialRefundAmount(
  value: string,
  currency: string,
  remainingRefundable: number,
): number | null {
  const code = enabledCurrency(currency)
  const minor = code ? toMinor(value, code) : null
  if (minor === null || minor <= 0 || minor >= remainingRefundable) return null
  return isValidMinorAmount(minor, currency) ? minor : null
}
