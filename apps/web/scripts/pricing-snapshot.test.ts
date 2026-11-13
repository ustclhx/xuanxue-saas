import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPricingCatalog } from '../src/features/marketing/pricing-read.ts'
import { buildPricingSnapshot, examplePricingCatalog } from './pricing-snapshot.ts'

vi.mock('../src/features/marketing/pricing-read.ts', () => ({ readPricingCatalog: vi.fn() }))

describe('构建期定价快照', () => {
  afterEach(() => vi.restoreAllMocks())

  it('数据库可达时保留真实套餐，构建读取失败时警告并使用仓库示例', async () => {
    const catalog = examplePricingCatalog()
    vi.mocked(readPricingCatalog).mockResolvedValueOnce(catalog)
    expect(await buildPricingSnapshot('postgres://build')).toBe(catalog)
    vi.mocked(readPricingCatalog).mockRejectedValueOnce(new Error('Connection refused'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await buildPricingSnapshot('postgres://offline')).toEqual(catalog)
    expect(warn.mock.calls.flat().join(' ')).toContain('pricing.build_fallback')
  })

  it('没有构建数据库配置时仍生成只含在售积分包与月付订阅的快照', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const catalog = await buildPricingSnapshot()
    expect(catalog.plans.map((p) => p.key)).toEqual([
      'free',
      'reading_single',
      'reading_five',
      'plus',
      'premium',
    ])
    expect(new Set(catalog.prices.map((p) => p.interval))).toEqual(new Set([null, 'month']))
    // 订阅只经 Stripe：PayPal 只有一次性价格
    expect(
      catalog.prices.filter((p) => p.provider === 'paypal').every((p) => p.interval === null),
    ).toBe(true)
    expect(catalog.prices.every((p) => !p.available)).toBe(true)
  })
})
