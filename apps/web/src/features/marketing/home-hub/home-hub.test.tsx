import type { SiteId } from '@xuanxue/config'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { readingDefinition } from '../../readings/catalog.ts'
import { checkCompliance } from '../../readings/compliance.ts'
import { SiteContext } from '../../site/context.tsx'
import type { PricingCatalog } from '../pricing-data.ts'
import { creditPacks } from '../pricing-page.tsx'
import { dailyEntryHref, hubPricing, hubTools } from './data.ts'
import { HomeHub } from './home-hub.tsx'
import { HUB_SAMPLE_KIND, HUB_SAMPLE_PARAGRAPHS, HUB_SAMPLE_SECTIONS } from './sample.ts'

const language = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => ({
  ...(await original<typeof import('../../../paraglide/runtime.js')>()),
  getLocale: () => language.locale,
}))
vi.mock('../../growth/forms.tsx', () => ({ GrowthForm: () => null }))
// 构建期常量 __PRICING_SNAPSHOT__ 只在 Vite 构建中注入；测试显式传入 catalog
vi.mock('../pricing-snapshot.ts', () => ({
  pricingSnapshot: { plans: [], prices: [], providers: [] },
}))

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
      {
        id: 'p2',
        key: 'reading_five',
        name: 'Five',
        type: 'credit_pack',
        credits: 500,
        creditExpiryDays: 365,
        features: {},
      },
    ],
    prices: [
      ['p1', 'USD', 199],
      ['p1', 'TWD', 6500],
      ['p1', 'KRW', 2800],
      ['p2', 'USD', 799],
      ['p2', 'TWD', 25500],
      ['p2', 'KRW', 11000],
    ].map(([planId, currency, amount], index) => ({
      id: `price-${index}`,
      planId,
      provider: 'stripe',
      interval: null,
      amount,
      currency,
      active: available,
      available,
    })),
    providers: [{ id: 'stripe', available: true }],
  }) as unknown as PricingCatalog

function render(site: SiteId, locale: string, props: Parameters<typeof HomeHub>[0] = {}) {
  language.locale = locale
  return renderToStaticMarkup(
    <SiteContext value={site}>
      <HomeHub catalog={catalog(true)} {...props} />
    </SiteContext>,
  )
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ')

describe('首页枢纽数据', () => {
  it('韩语首页只列有韩语页面的东方站工具，链接带 /ko 前缀', () => {
    language.locale = 'ko'
    const tools = hubTools('east', 'ko')
    const ids = tools.map((tool) => tool.id)
    expect(ids).toContain('saju-gunghap')
    expect(ids).not.toContain('ziwei')
    expect(ids).not.toContain('mingpan')
    for (const tool of tools) expect(tool.href.startsWith('/ko')).toBe(true)
  })

  it('西方站不含东方工具，也不链接到其他域名', () => {
    language.locale = 'en'
    const tools = hubTools('west', 'en')
    expect(tools.map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining(['bazi', 'ziwei', 'mingpan', 'saju-gunghap']),
    )
    expect(tools[0]?.id).toBe('life-path')
    for (const tool of tools) expect(tool.href).toMatch(/^\/(?!\/)/)
  })

  it.each([
    ['zh-Hant', 'NT$65'],
    ['ko', '₩2,800'],
    ['en', '$1.99'],
  ])('%s：价格与定价页同一快照、同一选价规则', (locale, single) => {
    language.locale = locale
    const prices = hubPricing(catalog(true), locale)
    const packs = creditPacks(catalog(true), locale)
    expect(prices.map((p) => [p.key, p.credits])).toEqual(packs.map((p) => [p.key, p.credits]))
    expect(prices[0]?.price).toBe(single)
  })

  it('没有可购买方案时不产出金额', () => {
    expect(hubPricing(catalog(false), 'zh-Hant')).toEqual([])
    expect(hubPricing({ plans: [], prices: [], providers: [] } as never, 'en')).toEqual([])
  })

  it('每日运势入口只在登记了公开页时给出链接', () => {
    expect(dailyEntryHref('zh-Hant', {})).toBeNull()
    expect(dailyEntryHref('zh-Hant', { 'zh-Hant': '/每日運勢' })).toBe(
      `/zh-hant/${encodeURI('每日運勢')}`,
    )
    expect(dailyEntryHref('en', { en: '/daily-numerology' })).toBe('/daily-numerology')
  })

  it('样例大纲与详批 catalog 当前默认提示词的章节一致', () => {
    for (const [locale, kind] of Object.entries(HUB_SAMPLE_KIND)) {
      const definition = readingDefinition(kind, locale)
      expect(HUB_SAMPLE_SECTIONS[locale as keyof typeof HUB_SAMPLE_SECTIONS]).toEqual(
        definition?.prompt.sections,
      )
    }
  })
})

describe('首页枢纽区块', () => {
  it('区块顺序：工具矩阵、样例详批、三步、定价、背书；未登记每日运势页时不渲染入口', () => {
    const html = render('east', 'zh-Hant', { sampleChart: <svg data-chart="sample" /> })
    const blocks = [...html.matchAll(/data-hub-block="(\w+)"/g)].map((match) => match[1])
    expect(blocks).toEqual(['tools', 'sample', 'steps', 'plans', 'trust'])
    expect(html).not.toContain('即將')
    expect(html).toContain('data-chart="sample"')
  })

  it('样例详批标「示例」并附 AI 声明；样例段落审定前不渲染', () => {
    const html = render('east', 'zh-Hant')
    const sample = html.match(/data-hub-block="sample"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(sample).toContain('data-sample-badge')
    expect(sample).toContain('>示例<')
    expect(sample).toContain('data-testid="ai-disclaimer"')
    expect(HUB_SAMPLE_PARAGRAPHS['zh-Hant']).toBeUndefined()
    expect(sample).not.toContain('data-sample-paragraph')
    for (const section of HUB_SAMPLE_SECTIONS['zh-Hant']) expect(sample).toContain(section)
  })

  it('工具矩阵与背书属于免费区，不出现 AI 字样；枢纽文字通过合规检查', () => {
    for (const [site, locale] of [
      ['east', 'zh-Hant'],
      ['east', 'zh-Hans'],
      ['east', 'ko'],
      ['west', 'en'],
    ] as const) {
      const html = render(site, locale)
      for (const block of ['tools', 'trust']) {
        const part = html.match(new RegExp(`data-hub-block="${block}"[\\s\\S]*?</section>`))?.[0]
        expect(part).toBeTruthy()
        expect(text(part ?? '')).not.toMatch(/\bAI\b/)
      }
      expect(checkCompliance(text(html), locale).violations).toEqual([])
    }
  })

  it('有可售积分包时列价格；没有时只写免费说明与定价页链接', () => {
    const priced = render('east', 'zh-Hant')
    expect(priced).toContain('NT$65')
    language.locale = 'zh-Hant'
    const free = renderToStaticMarkup(
      <SiteContext value="east">
        <HomeHub catalog={catalog(false)} />
      </SiteContext>,
    )
    const plans = free.match(/data-hub-block="plans"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(plans).not.toMatch(/NT\$|US\$|\$\d/)
    expect(plans).toContain('href="/zh-hant/pricing"')
  })
})
