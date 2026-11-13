import { describe, expect, it } from 'vitest'
import { isValidMinorAmount } from './currency.ts'
import {
  cnyReference,
  convertFromUsd,
  FX_SNAPSHOT,
  PRICE_TABLE,
  type TablePrices,
  tablePrices,
} from './price-table.ts'

const entries = Object.entries(PRICE_TABLE).flatMap(([key, intervals]) =>
  Object.entries(intervals as Record<string, TablePrices>).map(
    ([interval, amounts]) => [`${key}/${interval}`, amounts] as const,
  ),
)

describe('fixed exchange price table', () => {
  it.each(entries)('%s literals equal snapshot × rounding rule', (_name, amounts) => {
    expect(amounts.TWD).toBe(convertFromUsd(amounts.USD, 'TWD'))
    expect(amounts.KRW).toBe(convertFromUsd(amounts.USD, 'KRW'))
    expect(amounts.CNY).toBe(cnyReference(amounts.USD))
    for (const currency of ['USD', 'TWD', 'KRW'] as const)
      expect(isValidMinorAmount(amounts[currency], currency)).toBe(true)
  })

  it('keeps the user-confirmed values', () => {
    expect(PRICE_TABLE.reading_single.once).toEqual({ USD: 199, TWD: 6500, KRW: 2800, CNY: 1300 })
    expect(PRICE_TABLE.reading_five.once).toEqual({ USD: 699, TWD: 22700, KRW: 9800, CNY: 4700 })
    expect(PRICE_TABLE.plus.month).toEqual({ USD: 499, TWD: 16200, KRW: 7000, CNY: 3300 })
    expect(PRICE_TABLE.premium.month).toEqual({ USD: 999, TWD: 32500, KRW: 14000, CNY: 6700 })
  })

  it('expands settlement currencies only', () => {
    expect(tablePrices('reading_single')).toEqual([
      { interval: null, amount: 199, currency: 'USD' },
      { interval: null, amount: 6500, currency: 'TWD' },
      { interval: null, amount: 2800, currency: 'KRW' },
    ])
    expect(tablePrices('plus').map((price) => price.interval)).toEqual(['month', 'month', 'month'])
  })

  it('warns (without failing) when the FX snapshot is older than 180 days', () => {
    const age = (Date.now() - Date.parse(`${FX_SNAPSHOT.date}T00:00:00Z`)) / 86_400_000
    expect(Number.isFinite(age)).toBe(true)
    if (age > 180)
      console.warn(
        `[price-table] FX snapshot ${FX_SNAPSHOT.date} is ${Math.floor(age)} days old; review local prices.`,
      )
  })
})
