/**
 * 解锁卡与定价页的价格展示（localize-checkout-currency D2/D5）：价格行已按界面语言与支付平台选出
 * （见 marketing/pricing-data.ts 的 `selectDisplayPrice`），这里只负责按积分折算与格式化。
 * zh-Hant、ko 显示实际结算的本地币种价格；zh-Hans 显示美元价格并附固定汇率的人民币参考价；en 显示美元。
 * 不再请求实时汇率：参考价使用价目表的汇率快照（packages/billing/src/price-table.ts）。
 */
import { currencyFor, enabledCurrency, formatMoney, minorStep } from '@xuanxue/billing/currency'
import { cnyReference } from '@xuanxue/billing/price-table'

export interface PricedPack {
  readonly credits: number
  /** 最小货币单位 */
  readonly amount: number
  readonly currency: string
}

export interface Money {
  readonly amount: number
  readonly currency: string
}

/**
 * 所需积分对应的价格：取能覆盖所需积分的最小积分包按比例折算（不足时取最大的积分包），
 * 按币种步长取整（TWD 整元）。积分包应已是同一平台、同一币种的展示行；没有积分包时返回 null。
 */
export function priceForCredits(credits: number, packs: readonly PricedPack[]): Money | null {
  const sorted = [...packs].filter((p) => p.credits > 0).sort((a, b) => a.credits - b.credits)
  const pack = sorted.find((p) => p.credits >= credits) ?? sorted.at(-1)
  if (!pack) return null
  const code = enabledCurrency(pack.currency)
  const step = code ? minorStep(code) : 1
  return {
    amount: Math.round((pack.amount * credits) / pack.credits / step) * step,
    currency: pack.currency,
  }
}

export interface PriceDisplay {
  /** 实际结算币种的价格文字 */
  readonly text: string
  /** zh-Hans 的人民币参考价文字（只用于 USD 价格）；其他语言为 null */
  readonly reference: string | null
}

/** 价格文字：`NT$65`、`₩2,800`、`US$1.99`（en 为 `$1.99`），zh-Hans 另给 `¥13` 参考价 */
export function displayPrice(price: Money, locale: string): PriceDisplay {
  return {
    text: formatMoney(price.amount, price.currency, locale),
    reference:
      locale === 'zh-Hans' && price.currency.toUpperCase() === 'USD'
        ? formatMoney(cnyReference(price.amount), 'CNY', locale)
        : null,
  }
}

/** Stripe 以本地币种结算的语言（zh-Hant、ko）选择 PayPal 时提示以美元结算（PayPal 恒为 USD，决策 2） */
export function paypalUsdNotice(locale: string, provider: string): boolean {
  return provider === 'paypal' && currencyFor(locale, 'stripe') !== 'USD'
}
