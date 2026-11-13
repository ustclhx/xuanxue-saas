import type { TextModelEnv } from '@xuanxue/ai'
import type { SiteId } from '@xuanxue/config'
import type { Database, SettingKey, SettingsContext } from '@xuanxue/db'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReadingAvailabilityDeps } from '../readings/availability.ts'
import type { PricingCatalog } from './pricing-data.ts'
import { PricingPage } from './pricing-page.tsx'
import { siteReadingPricing } from './reading-pricing.server.ts'

const language = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => ({
  ...(await original<typeof import('../../paraglide/runtime.js')>()),
  getLocale: () => language.locale,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock('./marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('../growth/forms.tsx', () => ({ GrowthForm: () => null }))
vi.mock('../readings/readings.functions.ts', () => ({}))

function settings(overrides: Partial<Record<SettingKey, unknown>> = {}): SettingsContext {
  return {
    store: {
      find: vi.fn(async (key: SettingKey) => {
        if (Object.hasOwn(overrides, key)) return overrides[key]
        return key.endsWith('.modelKey') ? 'deepseek-flash' : undefined
      }),
    },
  }
}

/** 生产配置：direct 出口、DeepSeek 直连 */
const READY_ENV: TextModelEnv = { AI_TEXT_EGRESS: 'direct', DEEPSEEK_API_KEY: 'test-key' }

function deps(
  overrides: Partial<Record<SettingKey, unknown>> = {},
  options: { model?: boolean; env?: TextModelEnv | null } = {},
): ReadingAvailabilityDeps & { settings: SettingsContext } {
  const rows =
    options.model === false
      ? []
      : [{ key: 'deepseek-flash', provider: 'deepseek', providerModelId: 'deepseek-chat' }]
  const query = { from: () => query, where: () => query, limit: async () => rows }
  return {
    settings: settings(overrides),
    db: { select: () => query } as unknown as Database,
    aiEnv: options.env === undefined ? READY_ENV : options.env,
  }
}

describe('定价页可解锁目录', () => {
  it.each([
    [
      'west',
      'en',
      ['numerology-full', 'tarot-spread'],
      ['Your full numerology reading', 'Full spread reading'],
    ],
    [
      'east',
      'zh-Hant',
      ['bazi-full', 'ziwei-full', 'tarot-spread'],
      ['完整命盤分析', '完整紫微命盤分析', '完整牌陣解讀'],
    ],
    [
      'east',
      'zh-Hans',
      ['bazi-full', 'ziwei-full', 'tarot-spread'],
      ['完整命盘分析', '完整紫微命盘分析', '完整牌阵解读'],
    ],
    [
      'east',
      'ko',
      ['saju-full', 'saju-compat', 'tarot-spread'],
      ['사주 상세 풀이', '궁합 상세 풀이', '스프레드 상세 리딩'],
    ],
  ] as const)(
    '%s / %s 只列出本站本语言可解析的详批（包含塔罗）',
    async (site, locale, kinds, labels) => {
      language.locale = locale
      const readings = await siteReadingPricing(site, locale, deps())
      expect(readings.map((reading) => reading.kind)).toEqual(kinds)
      const html = renderToStaticMarkup(
        <PricingPage catalog={{ plans: [], prices: [], providers: [] }} readings={readings} />,
      )
      const list = html.match(/<section aria-labelledby="pricing-readings"[\s\S]*?<\/section>/)?.[0]
      expect([...(list?.matchAll(/<li>(.*?)<\/li>/g) ?? [])].map((match) => match[1])).toEqual(
        labels,
      )
    },
  )

  it.each([
    ['west', 'zh-Hans'],
    ['east', 'en'],
  ] as const)('拒绝 %s 站不提供的 %s 语言且不读取运营设置', async (site: SiteId, locale) => {
    const ctx = deps()
    expect(await siteReadingPricing(site, locale, ctx)).toEqual([])
    expect(ctx.settings.store.find).not.toHaveBeenCalled()
  })

  it('关闭、未配置模型或零积分的详批不出现在可解锁清单', async () => {
    const ctx = deps({
      'readings.saju-full.enabled': false,
      'readings.saju-compat.modelKey': '',
      'readings.tarot-spread.credits': 0,
    })
    const readings = await siteReadingPricing('east', 'ko', ctx)
    expect(readings).toEqual([])
    const html = renderToStaticMarkup(
      <PricingPage catalog={{ plans: [], prices: [], providers: [] }} readings={readings} />,
    )
    expect(html).not.toContain('aria-labelledby="pricing-readings"')
  })
})

describe('定价页与详批可用性一致', () => {
  it.each([
    ['模型不存在或已停用', deps({}, { model: false })],
    ['生产缺 DEEPSEEK_API_KEY 且无 Gateway', deps({}, { env: { AI_TEXT_EGRESS: 'direct' } })],
    ['未装配 AI 能力', deps({}, { env: null })],
  ])('%s时不列出任何详批', async (_label, ctx) => {
    expect(await siteReadingPricing('east', 'zh-Hant', ctx)).toEqual([])
  })

  const catalog = (available: boolean): PricingCatalog =>
    ({
      plans: [
        {
          id: 'p1',
          key: 'reading_single',
          name: 'Single',
          type: 'credit_pack',
          credits: 100,
          creditExpiryDays: 365,
          features: {},
        },
      ],
      prices: [
        {
          id: 'pp1',
          planId: 'p1',
          provider: 'paypal',
          interval: null,
          amount: 199,
          currency: 'usd',
          active: available,
          available,
        },
      ],
      providers: [{ id: 'paypal', available: true }],
    }) as unknown as PricingCatalog

  const render = (props: Parameters<typeof PricingPage>[0]) =>
    renderToStaticMarkup(<PricingPage {...props} />)

  it.each(['zh-Hant', 'zh-Hans', 'ko', 'en'])(
    '%s：详批未开放时即使付款可用也不提供购买入口，并说明原因',
    (locale) => {
      language.locale = locale
      const html = render({ catalog: catalog(true), readings: [] })
      expect(html).toContain('data-testid="pricing-not-purchasable"')
      expect(html).not.toContain('href="/app"')
      expect(html).toContain('$1.99')
    },
  )

  it('详批开放且价格可购买时显示购买入口，不显示提示', () => {
    language.locale = 'zh-Hant'
    const html = render({
      catalog: catalog(true),
      readings: [{ kind: 'bazi-full', credits: 100 }],
    })
    expect(html).toContain('href="/app"')
    expect(html).not.toContain('pricing-not-purchasable')
    expect(html).toContain('aria-labelledby="pricing-readings"')
  })

  it('详批开放但付款未开通时沿用「线上付款即将开放」', () => {
    language.locale = 'zh-Hant'
    const html = render({
      catalog: catalog(false),
      readings: [{ kind: 'bazi-full', credits: 100 }],
    })
    expect(html).not.toContain('href="/app"')
    expect(html).toContain('線上付款即將開放')
  })

  const localCatalog = (twdAvailable: boolean): PricingCatalog =>
    ({
      plans: catalog(true).plans,
      prices: [
        ['stripe', 'USD', 199, true],
        ['stripe', 'TWD', 6500, twdAvailable],
        ['stripe', 'KRW', 2800, true],
        ['paypal', 'USD', 199, true],
      ].map(([provider, currency, amount, available], index) => ({
        id: `price-${index}`,
        planId: 'p1',
        provider,
        interval: null,
        amount,
        currency,
        active: available,
        available,
      })),
      providers: [
        { id: 'stripe', available: true },
        { id: 'paypal', available: true },
      ],
    }) as unknown as PricingCatalog
  const shownPrice = (html: string) =>
    html.match(/data-testid="pricing-pack-price">([^<]*)</)?.[1] ?? ''

  it.each([
    ['zh-Hant', 'NT$65'],
    ['ko', '₩2,800'],
    ['zh-Hans', 'US$1.99'],
    ['en', '$1.99'],
  ])('%s 按结算币种显示实价：%s', (locale, expected) => {
    language.locale = locale
    const html = render({
      catalog: localCatalog(true),
      readings: [{ kind: 'bazi-full', credits: 100 }],
    })
    expect(shownPrice(html)).toBe(expected)
    expect(html).not.toContain('≈')
    expect(html.includes('¥13')).toBe(locale === 'zh-Hans')
    expect(html).not.toMatch(/exchangerate/i)
  })

  it('本地价格不可购买时显示美元价格，与结账回退一致', () => {
    language.locale = 'zh-Hant'
    const html = render({
      catalog: localCatalog(false),
      readings: [{ kind: 'bazi-full', credits: 100 }],
    })
    expect(shownPrice(html)).toBe('US$1.99')
  })
})

describe('定价页订阅档位（enable-subscriptions-daily-credits 4.1）', () => {
  const plan = (id: string, key: string, type: string, credits: number) => ({
    id,
    key,
    name: key === 'plus' ? 'Plus' : key === 'premium' ? 'Premium' : key,
    type,
    credits,
    creditExpiryDays: type === 'credit_pack' ? 365 : null,
    features: {},
  })
  const row = (
    planId: string,
    provider: string,
    interval: string | null,
    currency: string,
    amount: number,
    available: boolean,
  ) => ({
    id: `${planId}-${provider}-${currency}`,
    planId,
    provider,
    interval,
    amount,
    currency,
    active: available,
    available,
  })
  const catalog = (subsAvailable: boolean): PricingCatalog =>
    ({
      plans: [
        plan('free', 'free', 'subscription', 0),
        plan('single', 'reading_single', 'credit_pack', 100),
        plan('five', 'reading_five', 'credit_pack', 500),
        plan('plus', 'plus', 'subscription', 400),
        plan('premium', 'premium', 'subscription', 1000),
      ],
      prices: [
        row('single', 'stripe', null, 'USD', 199, true),
        row('single', 'stripe', null, 'TWD', 6500, true),
        row('single', 'paypal', null, 'USD', 199, true),
        row('five', 'stripe', null, 'USD', 699, true),
        row('five', 'stripe', null, 'TWD', 22700, true),
        row('five', 'paypal', null, 'USD', 699, true),
        row('plus', 'stripe', 'month', 'USD', 499, subsAvailable),
        row('plus', 'stripe', 'month', 'TWD', 16200, subsAvailable),
        row('plus', 'stripe', 'month', 'KRW', 7000, subsAvailable),
        row('premium', 'stripe', 'month', 'USD', 999, subsAvailable),
        row('premium', 'stripe', 'month', 'TWD', 32500, subsAvailable),
        row('premium', 'stripe', 'month', 'KRW', 14000, subsAvailable),
      ],
      providers: [
        { id: 'stripe', available: true },
        { id: 'paypal', available: true },
      ],
    }) as unknown as PricingCatalog
  const readings = [{ kind: 'numerology-full', credits: 100 }]
  const html = (props: Parameters<typeof PricingPage>[0]) =>
    renderToStaticMarkup(<PricingPage {...props} />)
  const count = (text: string, pattern: string) => text.split(pattern).length - 1

  it('英文页并列两档订阅与两个积分包，标明每月续费、可随时取消与每日领取', () => {
    language.locale = 'en'
    const page = html({ catalog: catalog(true), readings })
    expect(count(page, 'data-testid="pricing-sub"')).toBe(2)
    expect(count(page, 'data-testid="pricing-pack"')).toBe(2)
    expect(page).toContain('$4.99')
    expect(page).toContain('$9.99')
    expect(page).toContain('400 credits every month (about 4 full readings)')
    expect(page).toContain('1000 credits every month (about 10 full readings)')
    expect(page).toContain('Cancel anytime')
    expect(page).toContain('Renews automatically every month in US dollars (USD) through Stripe')
    expect(page).toContain('10 credits each day you sign in (up to 10 days a month)')
    expect(page).toContain('daily free credits → subscription credits → purchased credits')
    // 订阅入口与积分包入口都在：2 档订阅 + 2 个积分包
    expect(count(page, 'href="/app"')).toBe(4)
    expect(page).not.toContain('pricing-sub-soon')
    expect(page).toContain('Do unused subscription credits roll over?')
  })

  it('订阅价格未同步时显示「即将开放」且没有订阅入口，积分包照常可买', () => {
    language.locale = 'zh-Hant'
    const page = html({ catalog: catalog(false), readings })
    expect(count(page, 'data-testid="pricing-sub-soon"')).toBe(2)
    expect(page).toContain('即將開放')
    expect(count(page, 'href="/app"')).toBe(2)
    expect(page).not.toContain('pricing-not-purchasable')
    // 未同步时仍按繁中结算币种展示金额
    expect(page).toContain('NT$162')
    expect(page).toContain('NT$325')
  })

  it.each([
    [
      'zh-Hant',
      ['NT$162', 'NT$325', 'NT$0'],
      '以新台幣（TWD）透過 Stripe',
      '以美元結帳（US$1.99 / US$6.99）',
    ],
    ['ko', ['₩7,000', '₩14,000', '₩0'], '원화(KRW)로 Stripe', null],
    [
      'zh-Hans',
      ['US$4.99', 'US$9.99', 'US$0', '¥33', '¥67'],
      '以美元（USD）通过 Stripe',
      '信用卡与 PayPal 均以美元结账',
    ],
  ] as const)('%s 按结算币种显示订阅价格与付款说明', (locale, prices, subNote, payNote) => {
    language.locale = locale
    const page = html({ catalog: catalog(true), readings })
    for (const price of prices) expect(page).toContain(price)
    expect(page).toContain(subNote)
    if (payNote) expect(page).toContain(payNote)
  })

  it('PayPal 排在首位时订阅仍按 Stripe 价格展示，PayPal 不出现订阅选项', () => {
    language.locale = 'zh-Hant'
    const base = catalog(true)
    const page = html({
      catalog: { ...base, providers: [...base.providers].reverse() } as PricingCatalog,
      readings,
    })
    expect(page).toContain('NT$162')
    expect(page).toContain('以新台幣（TWD）透過 Stripe')
  })

  it('详批未开放时订阅与积分包都不提供入口', () => {
    language.locale = 'en'
    const page = html({ catalog: catalog(true), readings: [] })
    expect(page).not.toContain('href="/app"')
    expect(page).toContain('data-testid="pricing-not-purchasable"')
  })

  it('每日领取说明随开关显示', async () => {
    const { templateConfig } = await import('../../server/template-config.ts')
    const original = templateConfig.credits.dailyEnabled
    language.locale = 'en'
    try {
      ;(templateConfig.credits as { dailyEnabled: boolean }).dailyEnabled = false
      const off = html({ catalog: catalog(true), readings })
      expect(off).not.toContain('each day you sign in')
      expect(off).toContain('subscription credits → purchased credits')
      expect(off).not.toContain('daily free credits')
    } finally {
      ;(templateConfig.credits as { dailyEnabled: boolean }).dailyEnabled = original
    }
    expect(html({ catalog: catalog(true), readings })).toContain('each day you sign in')
  })

  it('没有订阅档位时只显示积分包（模板示例 pro/team 没有价格不出现）', () => {
    language.locale = 'en'
    const only = catalog(true)
    const page = html({
      catalog: {
        ...only,
        plans: [
          ...only.plans.filter((p) => p.type === 'credit_pack'),
          plan('pro', 'pro', 'subscription', 1000),
        ],
        prices: only.prices.filter((p) => p.interval === null),
      } as PricingCatalog,
      readings,
    })
    expect(page).not.toContain('pricing-sub')
    expect(page).not.toContain('pricing-free')
    expect(count(page, 'data-testid="pricing-pack"')).toBe(2)
  })
})
