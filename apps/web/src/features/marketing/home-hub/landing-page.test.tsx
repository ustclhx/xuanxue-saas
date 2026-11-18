import type { SiteId } from '@xuanxue/config'
import { settingDefaults } from '@xuanxue/db'
import { birthdayNumber, lifePath } from '@xuanxue/numerology'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { m } from '../../../paraglide/messages.js'
import { readingDefinition } from '../../readings/catalog.ts'
import { checkCompliance } from '../../readings/compliance.ts'
import { SiteContext } from '../../site/context.tsx'
import { SAMPLE_BIRTH_DATE } from '../../tools/charts/samples.ts'
import { DAILY_LOGIN_CREDITS, DEFAULT_READING_CREDITS } from '../pricing-credits.ts'
import type { PricingCatalog } from '../pricing-data.ts'
import { creditPacks } from '../pricing-page.tsx'
import {
  dailyEntryHref,
  FEATURED_LIMIT,
  hubMoreTool,
  hubPriceLine,
  hubPricing,
  hubTools,
} from './data.ts'
import { LandingPage } from './landing-page.tsx'
import {
  HUB_SAMPLE_KIND,
  HUB_SAMPLE_PARAGRAPHS,
  HUB_SAMPLE_SECTIONS,
  hubSampleParagraphs,
  WEST_SAMPLE,
} from './sample.ts'
import { EastSampleChart } from './sample-chart-east.tsx'
import { WestSampleChart } from './sample-chart-west.tsx'
import { todayHeadline } from './today-strip.tsx'

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

const HOMES = [
  ['east', 'zh-Hant', `/zh-hant/${encodeURI('八字排盤')}`, '八字排盤'],
  ['east', 'zh-Hans', `/zh-hans/${encodeURI('八字排盘')}`, '八字排盘'],
  ['east', 'ko', `/ko/${encodeURI('만세력')}`, '만세력'],
  ['west', 'en', '/life-path-number', 'life path number'],
] as const

function render(site: SiteId, locale: string, props: Parameters<typeof LandingPage>[0] = {}) {
  language.locale = locale
  return renderToStaticMarkup(
    <SiteContext value={site}>
      <LandingPage
        catalog={catalog(true)}
        sampleChart={site === 'east' ? <EastSampleChart /> : <WestSampleChart />}
        {...props}
      />
    </SiteContext>,
  )
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
/** 按块级元素分段的纯文字，供合规检查按段落判断 */
const blocks = (html: string) =>
  html.replace(/<\/(?:p|li|h[1-6]|summary|dt|dd|div|section)>/g, '\n\n').replace(/<[^>]+>/g, ' ')
const block = (html: string, name: string) =>
  html.match(new RegExp(`<section[^>]*data-landing-block="${name}"[\\s\\S]*?</section>`))?.[0] ?? ''
const order = (html: string) =>
  [...html.matchAll(/data-landing-block="(\w+)"/g)].map((match) => match[1])

describe('落地页数据', () => {
  it.each([
    ['east', 'zh-Hant', ['bazi', 'ziwei', 'tarot-three-card', 'mingpan'], '八紫牌盤'],
    ['east', 'zh-Hans', ['bazi', 'ziwei', 'tarot-three-card', 'mingpan'], '八紫牌盘'],
    ['east', 'ko', ['bazi', 'saju-gunghap', 'tarot-three-card'], '사합타'],
    ['west', 'en', ['life-path', 'numerology-calculator', 'tarot-three-card'], '1922'],
  ] as const)('%s %s：精选入口 3–4 个，顺序与字形按设计稿', (site, locale, ids, glyphs) => {
    language.locale = locale
    const tools = hubTools(site, locale)
    expect(tools.map((tool) => tool.id)).toEqual(ids)
    expect(tools.length).toBeGreaterThanOrEqual(3)
    expect(tools.length).toBeLessThanOrEqual(FEATURED_LIMIT)
    expect(tools.map((tool) => tool.glyph).join('')).toBe(glyphs)
    for (const tool of tools) {
      expect(tool.title).toBeTruthy()
      expect(tool.summary).toBeTruthy()
      expect(tool.action).toMatch(/→$/)
      // 站内地址：不跨站、不链接到其他域名
      expect(tool.href).toMatch(/^\/(?!\/)/)
    }
  })

  it('韩语首页只列有韩语页面的东方站工具，链接带 /ko 前缀', () => {
    language.locale = 'ko'
    const tools = hubTools('east', 'ko')
    for (const tool of tools) expect(tool.href.startsWith('/ko/')).toBe(true)
    expect(tools.map((tool) => tool.id)).not.toEqual(expect.arrayContaining(['ziwei', 'mingpan']))
  })

  it('西方站不含东方工具；Compatibility 为文字链接，不占入口', () => {
    language.locale = 'en'
    expect(hubTools('west', 'en').map((tool) => tool.id)).not.toEqual(
      expect.arrayContaining([
        'bazi',
        'ziwei',
        'mingpan',
        'saju-gunghap',
        'life-path-compatibility',
      ]),
    )
    expect(hubTools('west', 'en')[0]).toMatchObject({
      title: 'Life Path Number',
      href: '/life-path-number',
    })
    expect(hubMoreTool('west', 'en')).toEqual({
      id: 'life-path-compatibility',
      href: '/life-path-compatibility',
    })
    expect(hubMoreTool('east', 'zh-Hant')).toBeNull()
  })

  it('一行价格的两个数字与定价页同一份配置', () => {
    // 定价页：每份详批积分取 DEFAULT_READING_CREDITS，每日赠送数写在文案 pricing_free_daily 中
    expect(settingDefaults['credits.dailyAmount']).toBe(DAILY_LOGIN_CREDITS)
    for (const [, locale] of HOMES) {
      language.locale = locale
      expect(m.pricing_free_daily()).toContain(String(DAILY_LOGIN_CREDITS))
      expect(hubPriceLine(catalog(true), locale, { enabled: true, dailyEnabled: true })).toEqual({
        readingCredits: DEFAULT_READING_CREDITS,
        dailyCredits: DAILY_LOGIN_CREDITS,
      })
      // 是否有可购买方案与定价页同一快照、同一选价规则
      expect(hubPricing(catalog(true), locale).map((p) => [p.key, p.credits])).toEqual(
        creditPacks(catalog(true), locale).map((p) => [p.key, p.credits]),
      )
    }
  })

  it('未开启每日赠送时不给每日数；没有可购买方案时不给任何数字', () => {
    expect(hubPriceLine(catalog(true), 'en', { enabled: true, dailyEnabled: false })).toEqual({
      readingCredits: DEFAULT_READING_CREDITS,
      dailyCredits: null,
    })
    expect(hubPriceLine(catalog(false), 'zh-Hant')).toBeNull()
    expect(hubPriceLine({ plans: [], prices: [], providers: [] } as never, 'en')).toBeNull()
  })

  it('每日运势入口只在登记了公开页时给出链接', () => {
    expect(dailyEntryHref('zh-Hant', {})).toBeNull()
    expect(dailyEntryHref('zh-Hant', { 'zh-Hant': '/每日運勢' })).toBe(
      `/zh-hant/${encodeURI('每日運勢')}`,
    )
    expect(dailyEntryHref('en', { en: '/daily-numerology' })).toBe('/daily-numerology')
  })

  it('样例段落与 catalog 同源；审定开关关闭时为空', () => {
    expect(hubSampleParagraphs(false)).toEqual({})
    const approved = hubSampleParagraphs(true)
    for (const [locale, kind] of Object.entries(HUB_SAMPLE_KIND)) {
      const paragraph = approved[locale as keyof typeof approved]
      expect(paragraph).toBeTruthy()
      expect(paragraph).toBe(readingDefinition(kind, locale)?.sample)
    }
  })

  it('样例大纲与详批 catalog 当前默认提示词的章节一致', () => {
    for (const [locale, kind] of Object.entries(HUB_SAMPLE_KIND)) {
      const definition = readingDefinition(kind, locale)
      expect(HUB_SAMPLE_SECTIONS[locale as keyof typeof HUB_SAMPLE_SECTIONS]).toEqual(
        definition?.prompt.sections,
      )
    }
  })

  it('西方站样例的固化数字与数字命理包一致', () => {
    expect(lifePath(SAMPLE_BIRTH_DATE).value).toBe(WEST_SAMPLE.lifePath)
    expect(birthdayNumber(SAMPLE_BIRTH_DATE).value).toBe(WEST_SAMPLE.birthday)
  })
})

describe('落地页', () => {
  it.each(HOMES)('%s %s：区块顺序与入口数量', (site, locale) => {
    const html = render(site, locale)
    expect(order(html)).toEqual([
      'hero',
      'tools',
      'sample',
      'today',
      'steps',
      'price',
      'trust',
      'faq',
    ])
    const entries = [...block(html, 'tools').matchAll(/data-tool="([\w-]+)"/g)]
    expect(entries.length).toBeGreaterThanOrEqual(3)
    expect(entries.length).toBeLessThanOrEqual(4)
    // 一个 H1；没有工具表单
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toMatch(/<(?:form|input|select|textarea)\b/)
    expect(html).not.toContain('即將')
  })

  it.each(HOMES)(
    '%s %s：唯一主按钮指向主工具页，锚文本含工具关键词',
    (site, locale, href, keyword) => {
      const html = render(site, locale)
      const hero = block(html, 'hero')
      const primary = [...html.matchAll(/<a\b[^>]*\bbg-brand\b[^>]*>([\s\S]*?)<\/a>/g)]
      expect(primary).toHaveLength(1)
      expect(primary[0]?.[0]).toContain(`href="${href}"`)
      expect(primary[0]?.[1]?.toLowerCase()).toContain(keyword)
      // 首屏只有主按钮与一个页内文字链接
      const links = [...hero.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1])
      expect(links).toEqual([href, '#sample'])
      expect(html).toContain('id="sample"')
      // 首屏属于免费区，不写 AI
      expect(text(hero)).not.toMatch(/\bAI\b/)
    },
  )

  it.each(HOMES)('%s %s：每个站内链接在正文中只出现一次', (site, locale) => {
    const html = render(site, locale)
    const hrefs = [...html.matchAll(/<a\b[^>]*href="(\/[^"]*)"/g)].map((match) => match[1] ?? '')
    // 主工具页出现两次：首屏主按钮与工具入口卡片（设计稿如此），其余各一次
    const counts = new Map<string, number>()
    for (const href of hrefs) counts.set(href, (counts.get(href) ?? 0) + 1)
    const repeated = [...counts].filter(([, count]) => count > 1).map(([href]) => href)
    expect(repeated).toEqual([hrefs[0]])
    expect(counts.get(hrefs[0] ?? '')).toBe(2)
  })

  it('样例报告标明示例、附 AI 声明，不放按钮；段落与 catalog 一致', () => {
    const html = render('east', 'zh-Hant')
    const sample = block(html, 'sample')
    expect(sample).toContain('data-sample-badge')
    expect(sample).toContain('示例段落')
    expect(sample).toContain('虛構命盤')
    expect(sample).toContain('data-testid="ai-disclaimer"')
    expect(sample).not.toMatch(/<a\b/)
    expect(HUB_SAMPLE_PARAGRAPHS['zh-Hant']).toBeTruthy()
    expect(sample).toContain(HUB_SAMPLE_PARAGRAPHS['zh-Hant'])
    for (const section of HUB_SAMPLE_SECTIONS['zh-Hant']) expect(sample).toContain(section)
    // 样例命盘：庚午 辛巳 庚辰 辛巳，日柱标日主
    expect(text(sample)).toMatch(
      /年柱 庚 金 午 火 月柱 辛 金 巳 火 日柱 · 日主 庚 金 辰 土 時柱 辛 金 巳 火/,
    )
    const west = block(render('west', 'en'), 'sample')
    expect(west).toContain('aria-label="Life Path 3"')
    expect(text(west)).toContain('3 · expression')
    expect(text(west)).toContain('6 · from the 15th')
  })

  it.each(HOMES)('%s %s：免费区块不出现 AI 字样，全页文字通过合规检查', (site, locale) => {
    const html = render(site, locale)
    for (const name of ['hero', 'tools', 'today', 'trust']) {
      const part = block(html, name)
      expect(part, name).toBeTruthy()
      expect(text(part), name).not.toMatch(/\bAI\b/)
    }
    expect(checkCompliance(blocks(html), locale).violations).toEqual([])
    const paragraph = HUB_SAMPLE_PARAGRAPHS[locale]
    expect(paragraph).toBeTruthy()
    expect(checkCompliance(paragraph ?? '', locale).violations).toEqual([])
  })

  it.each([
    [
      'east',
      'zh-Hant',
      '排盤免費；AI 詳批每份 10 積分，每天登入送 5 積分，可以先免費體驗。',
      '/zh-hant/pricing',
    ],
    [
      'east',
      'ko',
      '만세력은 무료입니다. AI 상세 풀이는 1회 10 크레딧이며, 매일 로그인하면 5 크레딧을 드리니 먼저 무료로 체험해 보세요.',
      '/ko/pricing',
    ],
    [
      'west',
      'en',
      'Every calculator is free. A full reading costs 10 credits, and you get 5 free credits each day you sign in, so you can try one first.',
      '/pricing',
    ],
  ] as const)('%s %s：一行价格写积分数并链接定价页，不显示金额', (site, locale, line, href) => {
    const price = block(render(site, locale), 'price')
    expect(text(price)).toContain(line)
    expect(price).toContain(`href="${href}"`)
    expect(price).not.toMatch(/NT\$|US\$|\$\d|₩/)
  })

  it('没有可购买方案时一行价格只写免费说明与定价页链接，没有数字', () => {
    const price = block(render('east', 'zh-Hant', { catalog: catalog(false) }), 'price')
    expect(text(price)).toContain(m.home_hub_plans_free())
    expect(price).toContain('href="/zh-hant/pricing"')
    expect(text(price)).not.toMatch(/\d/)
  })

  it('今日条：服务端只输出骨架与链接，不写入日期', () => {
    const today = block(render('east', 'zh-Hant'), 'today')
    expect(today).toContain('data-today="pending"')
    expect(today.match(/data-today-skeleton/g)).toHaveLength(2)
    expect(today).toContain(`href="/zh-hant/${encodeURI('每日運勢')}"`)
    expect(text(today)).not.toMatch(/\d/)
    expect(text(today)).not.toMatch(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/)
    expect(block(render('west', 'en'), 'today')).toContain('href="/daily-numerology"')
  })

  it('每日运势页未登记时不渲染今日条，其余区块顺序不变', () => {
    const html = render('east', 'zh-Hant', { dailyPages: {} })
    expect(order(html)).toEqual(['hero', 'tools', 'sample', 'steps', 'price', 'trust', 'faq'])
    expect(html).not.toContain('data-today')
    expect(html).not.toContain(encodeURI('每日運勢'))
    expect(html).not.toContain('即將')
  })

  it('今日条填入的内容：东方站当日干支（韩语加读音），西方站 Universal Day', () => {
    const date = { year: 2026, month: 11, day: 17 }
    language.locale = 'zh-Hant'
    expect(todayHeadline('east', date)).toBe('乙未日')
    language.locale = 'ko'
    expect(todayHeadline('east', date)).toBe('을미일 乙未')
    language.locale = 'en'
    expect(todayHeadline('west', date)).toBe('Universal Day 2')
  })

  it('品牌级 FAQ 三条取自定价页问答，第一条默认展开', () => {
    language.locale = 'zh-Hant'
    const faq = block(render('east', 'zh-Hant'), 'faq')
    expect(faq.match(/<details\b/g)).toHaveLength(3)
    expect(faq.match(/<details\b[^>]*\bopen\b/g)).toHaveLength(1)
    for (const question of [
      m.pricing_faq_free_q(),
      m.pricing_faq_accuracy_q(),
      m.pricing_faq_pay_q(),
    ])
      expect(faq).toContain(question)
  })

  it('首屏插画位对读屏隐藏，传入插画不改变结构', () => {
    const empty = block(render('east', 'zh-Hant'), 'hero')
    expect(empty).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-landing-art[^>]*><\/div>/)
    const filled = block(render('east', 'zh-Hant', { art: <svg data-art="east" /> }), 'hero')
    expect(filled).toContain('data-art="east"')
    expect(filled.replace(/<svg data-art="east"><\/svg>/, '')).toBe(empty)
  })
})
