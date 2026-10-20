import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  brandName,
  defineTemplateConfig,
  localeUrlSegment,
  type MediaProviderId,
  type PaymentProvider,
  type PricingMode,
  siteBrandName,
  type TemplateConfig,
  templateConfigDefaults,
} from './template.ts'

const app = {
  name: 'xuanxue',
  url: 'https://arcanumber.com',
  supportEmail: 'support@arcanumber.com',
}

describe('defineTemplateConfig', () => {
  it('fills every omitted option with the documented default', () => {
    const config = defineTemplateConfig({ app })
    expect(config).toEqual({ app, ...templateConfigDefaults, sites: expect.any(Object) })
    expect(config.billing.enabled).toBe(true)
    expect(config.credits.enabled).toBe(true)
    expect(config.marketing.enabled).toBe(true)
    expect(config.i18n.enabled).toBe(true)
    expect(config.features.analytics).toBe(false)
    expect(config.analytics.cloudflareToken).toBe('')
    expect(config.analytics.posthogKey).toBe('')
    expect(config.billing.overage).toEqual({
      maxRatio: 0.2,
      maxCredits: 50,
      dailyBudgetPerWorkspace: 200,
    })
  })

  it('merges nested sections field by field', () => {
    const config = defineTemplateConfig({
      app,
      billing: { overage: { maxCredits: 10 } },
      ai: { video: false, defaultPricingMode: { video: 'per_unit' } },
      features: { analytics: 'posthog' },
      analytics: { posthogKey: 'public-project-key' },
    })
    expect(config.billing.overage).toEqual({
      maxRatio: 0.2,
      maxCredits: 10,
      dailyBudgetPerWorkspace: 200,
    })
    expect(config.billing.refundWindowDays).toBe(30)
    expect(config.analytics).toEqual({
      cloudflareToken: '',
      posthogKey: 'public-project-key',
      posthogHost: 'https://us.i.posthog.com',
    })
    expect(config.ai).toEqual({
      text: templateConfigDefaults.ai.text,
      image: true,
      video: false,
      mediaProviders: ['fal', 'workers-ai'],
      defaultPricingMode: { text: 'token', image: 'per_call', video: 'per_unit' },
    })
  })

  it('does not require email verification by default', () => {
    expect(defineTemplateConfig({ app }).auth.requireEmailVerification).toBe(false)
    const strict = defineTemplateConfig({ app, auth: { requireEmailVerification: true } })
    expect(strict.auth).toMatchObject({ requireEmailVerification: true, emailPassword: true })
  })

  it('replaces arrays instead of merging them', () => {
    const config = defineTemplateConfig({
      app,
      auth: { oauth: ['github'] },
      ai: { mediaProviders: [] },
    })
    expect(config.ai.mediaProviders).toEqual([])
    expect(config.auth.oauth).toEqual(['github'])
    expect(config.auth.emailPassword).toBe(true)
  })

  it('defaults defaultLocale to the first locale', () => {
    const config = defineTemplateConfig({ app, i18n: { locales: ['ja', 'en'] } })
    expect(config.i18n).toEqual({ enabled: true, locales: ['ja', 'en'], defaultLocale: 'ja' })
    expectTypeOf(config.i18n.defaultLocale).toEqualTypeOf<'ja' | 'en'>()
  })

  it('rejects an empty locale list at runtime', () => {
    expect(() => defineTemplateConfig({ app, i18n: { locales: [] } })).toThrow(RangeError)
  })

  it('accepts all modules disabled while retaining their existing parameters', () => {
    const config = defineTemplateConfig({
      app,
      billing: { enabled: false },
      credits: { enabled: false },
      marketing: { enabled: false },
      i18n: { enabled: false, locales: ['ja', 'en'], defaultLocale: 'ja' },
      ai: { text: { enabled: false }, image: false, video: false },
    })
    expect(config.billing).toEqual({ ...templateConfigDefaults.billing, enabled: false })
    expect(config.credits.enabled).toBe(false)
    expect(config.marketing.enabled).toBe(false)
    expect(config.i18n).toEqual({ enabled: false, locales: ['ja', 'en'], defaultLocale: 'ja' })
    expect(config.auth).toEqual(templateConfigDefaults.auth)
  })

  it('accepts credits without billing when AI is disabled', () => {
    const config = defineTemplateConfig({
      app,
      billing: { enabled: false },
      ai: { text: { enabled: false }, image: false, video: false },
    })
    expect(config.credits.enabled).toBe(true)
  })

  it('rejects billing without credits', () => {
    expect(() =>
      defineTemplateConfig({
        app,
        credits: { enabled: false },
        ai: { text: { enabled: false }, image: false, video: false },
      }),
    ).toThrow('billing.enabled requires credits.enabled')
  })

  it.each(['text', 'image', 'video'] as const)('rejects %s AI without billing', (modality) => {
    expect(() =>
      defineTemplateConfig({
        app,
        billing: { enabled: false },
        ai: {
          text: { enabled: modality === 'text' },
          image: modality === 'image',
          video: modality === 'video',
        },
      }),
    ).toThrow('AI requires billing.enabled and credits.enabled')
  })

  it('does not share nested objects with the defaults', () => {
    const config = defineTemplateConfig({ app })
    expect(config.billing.overage).not.toBe(templateConfigDefaults.billing.overage)
  })
})

const sites = {
  east: { hosts: ['ganjiday.com'], locales: ['zh-Hant', 'ko'], defaultLocale: null },
  west: { hosts: ['arcanumber.com'], locales: ['en'], defaultLocale: 'en' },
} as const

describe('sites', () => {
  const i18n = { locales: ['en', 'zh-Hant', 'ko'] } as const

  it('puts every locale on the west site when no registry is configured', () => {
    expect(defineTemplateConfig({ app }).sites).toEqual({
      east: { hosts: [], locales: [], defaultLocale: null, brand: { name: 'xuanxue', names: {} } },
      west: {
        hosts: ['arcanumber.com'],
        locales: ['en', 'zh-Hant', 'ko'],
        defaultLocale: 'en',
        brand: { name: 'xuanxue', names: {} },
      },
    })
  })

  it('keeps the configured registry and defaults brand to the app name', () => {
    const config = defineTemplateConfig({
      app,
      i18n,
      sites: {
        ...sites,
        east: { ...sites.east, brand: { name: 'Ganjiday', names: { 'zh-Hant': '干支日' } } },
      },
    })
    expect(config.sites.east).toEqual({
      ...sites.east,
      brand: { name: 'Ganjiday', names: { 'zh-Hant': '干支日' } },
    })
    expect(config.sites.west).toEqual({ ...sites.west, brand: { name: 'xuanxue', names: {} } })
    expectTypeOf(config.sites.east.defaultLocale).toEqualTypeOf<'en' | 'zh-Hant' | 'ko' | null>()
  })

  it('resolves the brand name by locale: locale name, then site name, then app name', () => {
    const config = defineTemplateConfig({
      app,
      i18n,
      sites: {
        ...sites,
        east: { ...sites.east, brand: { name: 'Ganjiday', names: { 'zh-Hant': '干支日' } } },
      },
    })
    expect(brandName(config, 'zh-Hant')).toBe('干支日')
    expect(brandName(config, 'ko')).toBe('Ganjiday')
    expect(brandName(config, 'en')).toBe('xuanxue')
    expect(brandName(config, null)).toBe('xuanxue')
    expect(brandName(config, 'fr')).toBe('xuanxue')
    expect(brandName(config, 'zh-TW')).toBe('干支日')
    expect(brandName(config, 'ko-KR')).toBe('Ganjiday')
    expect(siteBrandName(config, 'east')).toBe('Ganjiday')
  })

  it.each([
    [
      'a locale on two sites',
      { west: { ...sites.west, locales: ['en', 'ko'] } },
      'more than one site',
    ],
    [
      'a locale on no site',
      { east: { ...sites.east, locales: ['zh-Hant'] } },
      'ko does not belong',
    ],
    [
      'a foreign default locale',
      { east: { ...sites.east, defaultLocale: 'en' } },
      'east.defaultLocale',
    ],
    ['a site with locales but no host', { east: { ...sites.east, hosts: [] } }, 'east.hosts'],
    [
      'a brand name for a foreign locale',
      { east: { ...sites.east, brand: { names: { en: 'x' } } } },
      'brand.names.en',
    ],
    ['a duplicated host', { east: { ...sites.east, hosts: ['arcanumber.com'] } }, 'listed twice'],
    [
      'an uppercase host',
      { east: { ...sites.east, hosts: ['Xuanxue-East.example'] } },
      'lowercase',
    ],
    [
      'an i18n default that no site serves unprefixed',
      { west: { ...sites.west, defaultLocale: null } },
      'i18n.defaultLocale',
    ],
  ] as const)('rejects %s', (_, override, message) => {
    expect(() => defineTemplateConfig({ app, i18n, sites: { ...sites, ...override } })).toThrow(
      message,
    )
  })

  it('rejects a site locale missing from i18n.locales', () => {
    expect(() =>
      defineTemplateConfig({
        app,
        i18n: { locales: ['en', 'zh-Hant'] },
        sites: sites as never,
      }),
    ).toThrow('ko is not in i18n.locales')
  })
})

describe('localeUrlSegment', () => {
  it('lowercases the BCP 47 locale id for the URL prefix', () => {
    expect(localeUrlSegment('zh-Hant')).toBe('zh-hant')
    expect(localeUrlSegment('ko')).toBe('ko')
  })
})

describe('defineTemplateConfig types', () => {
  it('resolves every option to a non-optional value', () => {
    const config = defineTemplateConfig({ app })
    expectTypeOf(config).toEqualTypeOf<TemplateConfig<'en' | 'zh-Hant' | 'ko'>>()
    expectTypeOf(config.billing.overage.maxRatio).toEqualTypeOf<number>()
    expectTypeOf(config.ai.defaultPricingMode.video).toEqualTypeOf<PricingMode>()
    expectTypeOf(config.ai.mediaProviders).toEqualTypeOf<readonly MediaProviderId[]>()
    expectTypeOf(config.billing.providers).toEqualTypeOf<readonly PaymentProvider[]>()
  })

  it('rejects invalid values at type-check time', () => {
    // 每个 @ts-expect-error 都要求下一行确实有类型错误，否则 typecheck 失败
    const invalid = () => [
      // @ts-expect-error 未定义的计费方式
      defineTemplateConfig({ app, ai: { defaultPricingMode: { video: 'per_minute' } } }),
      // @ts-expect-error 未支持的媒体服务商
      defineTemplateConfig({ app, ai: { mediaProviders: ['replicate'] } }),
      // @ts-expect-error 未知的 OAuth 登录方式
      defineTemplateConfig({ app, auth: { oauth: ['google', 'facebook'] } }),
      // @ts-expect-error 未知的支付方式
      defineTemplateConfig({ app, billing: { providers: ['alipay'] } }),
      // @ts-expect-error 未知的配置项
      defineTemplateConfig({ app, billing: { overage: { maxPercent: 10 } } }),
      // @ts-expect-error 未支持的产品分析服务
      defineTemplateConfig({ app, features: { analytics: 'unknown' } }),
      // @ts-expect-error 类型错误的取值
      defineTemplateConfig({ app, tenancy: { multiTenant: 'yes' } }),
      // @ts-expect-error defaultLocale 不在 locales 中
      defineTemplateConfig({ app, i18n: { locales: ['en', 'ko'], defaultLocale: 'fr' } }),
      defineTemplateConfig({
        app,
        i18n: { locales: ['en'] },
        // @ts-expect-error 站点语言不在 i18n.locales 中
        sites: { ...sites, east: { ...sites.east, locales: ['ja'] } },
      }),
      // @ts-expect-error 省略 locales 时 defaultLocale 只能是默认语言之一
      defineTemplateConfig({ app, i18n: { defaultLocale: 'fr' } }),
      // @ts-expect-error app 必填
      defineTemplateConfig({}),
    ]
    expectTypeOf(invalid).toBeFunction()
  })
})

it('merges text policy defaults and rejects invalid text policy values', () => {
  const config = defineTemplateConfig({
    app,
    ai: { text: { enabled: false, thinking: { userToggle: true } } },
  })
  expect(config.ai.text).toEqual({
    enabled: false,
    thinking: { default: 'off', userToggle: true },
    reasoning: { display: false },
    failedReplyRefund: 'no-visible-output',
  })
  for (const text of [
    { enabled: 'false' },
    { thinking: { default: 'auto' } },
    { reasoning: { display: 1 } },
    { failedReplyRefund: 'none' },
    { extra: true },
  ]) {
    // 外部配置可能绕过 TypeScript，运行时也必须拒绝非法策略。
    expect(() => defineTemplateConfig({ app, ai: { text: text as never } })).toThrow()
  }
})
