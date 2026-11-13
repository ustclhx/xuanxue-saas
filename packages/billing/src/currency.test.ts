import { describe, expect, it } from 'vitest'
import {
  CURRENCY_EXPONENT,
  currencyFor,
  enabledCurrency,
  formatMoney,
  isValidMinorAmount,
  selectCurrencyPrice,
  toMajor,
  toMinor,
} from './currency.ts'

describe('currency rules', () => {
  it('maps interface language and provider to the settlement currency', () => {
    const table = {
      'zh-Hant': { stripe: 'TWD', paypal: 'USD' },
      ko: { stripe: 'KRW', paypal: 'USD' },
      'zh-Hans': { stripe: 'USD', paypal: 'USD' },
      en: { stripe: 'USD', paypal: 'USD' },
    } as const
    for (const [locale, providers] of Object.entries(table))
      for (const [provider, currency] of Object.entries(providers))
        expect(currencyFor(locale, provider as 'stripe' | 'paypal')).toBe(currency)
    expect(currencyFor('ja', 'stripe')).toBe('USD')
  })

  it('locks platform exponents independently of Intl', () => {
    expect(CURRENCY_EXPONENT).toMatchObject({ USD: 2, TWD: 2, KRW: 0 })
    expect(enabledCurrency('twd')).toBe('TWD')
    expect(enabledCurrency('CNY')).toBeNull()
    expect(enabledCurrency('EUR')).toBeNull()
  })

  it('formats localized prices without nonexistent decimals', () => {
    expect(formatMoney(6500, 'TWD', 'zh-Hant')).toBe('NT$65')
    expect(formatMoney(2800, 'KRW', 'ko')).toBe('₩2,800')
    expect(formatMoney(199, 'USD', 'zh-Hans')).toBe('US$1.99')
    expect(formatMoney(199, 'USD', 'ko')).toBe('US$1.99')
    expect(formatMoney(199, 'usd', 'en')).toBe('$1.99')
    expect(formatMoney(1300, 'CNY', 'zh-Hans')).toBe('¥13')
  })

  it('rejects TWD amounts that are not whole dollars', () => {
    expect(isValidMinorAmount(6500, 'TWD')).toBe(true)
    expect(isValidMinorAmount(6550, 'TWD')).toBe(false)
    expect(isValidMinorAmount(2850, 'KRW')).toBe(true)
    expect(isValidMinorAmount(-1, 'USD')).toBe(false)
    expect(isValidMinorAmount(1.5, 'USD')).toBe(false)
    expect(isValidMinorAmount(100, 'EUR')).toBe(false)
  })

  it('converts between minor and major units per currency exponent', () => {
    expect(toMajor(199, 'USD')).toBe('1.99')
    expect(toMajor(5, 'USD')).toBe('0.05')
    expect(toMajor(6500, 'TWD')).toBe('65.00')
    expect(toMajor(2800, 'KRW')).toBe('2800')
    expect(toMinor('1.99', 'USD')).toBe(199)
    expect(toMinor('2', 'USD')).toBe(200)
    expect(toMinor('100', 'TWD')).toBe(10000)
    expect(toMinor('2800', 'KRW')).toBe(2800)
    expect(toMinor('65.5', 'TWD')).toBeNull()
    expect(toMinor('1.999', 'USD')).toBeNull()
    expect(toMinor('-1', 'KRW')).toBeNull()
  })

  it('selects the target currency and falls back to USD', () => {
    const usd = { id: 'usd', currency: 'USD' }
    const twd = { id: 'twd', currency: 'TWD' }
    expect(selectCurrencyPrice([usd, twd], 'TWD')).toBe(twd)
    expect(selectCurrencyPrice([usd], 'TWD')).toBe(usd)
    expect(selectCurrencyPrice([twd], 'USD')).toBeUndefined()
    expect(selectCurrencyPrice([], 'KRW')).toBeUndefined()
  })
})
