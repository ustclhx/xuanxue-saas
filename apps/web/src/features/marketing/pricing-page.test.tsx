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
vi.mock('../readings/readings.functions.ts', () => ({ getLocalRates: vi.fn() }))

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
})
