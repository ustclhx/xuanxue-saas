import type { SiteId } from '@xuanxue/config'
import { birthdayNumber, lifePath } from '@xuanxue/numerology'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { m } from '../../../paraglide/messages.js'
import { readingDefinition } from '../../readings/catalog.ts'
import { checkCompliance } from '../../readings/compliance.ts'
import { SiteContext } from '../../site/context.tsx'
import { SAMPLE_BIRTH_DATE } from '../../tools/charts/samples.ts'
import { directoryGroups, siteTools } from '../../tools/directory.ts'
import { badgeText } from '../../tools/hub/badge.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { dailyEntryHref, FEATURED_SECONDARY_LIMIT, hubFeatured } from './data.ts'
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
const HOMES = [
  ['east', 'zh-Hant', `/zh-hant/${encodeURI('八字排盤')}`, '八字排盤'],
  ['east', 'zh-Hans', `/zh-hans/${encodeURI('八字排盘')}`, '八字排盘'],
  ['east', 'ko', `/ko/${encodeURI('만세력')}`, '만세력'],
  ['west', 'en', '/life-path-number', 'life path number'],
] as const

/** 季节窗口之前的固定日期：首页渲染与精选测试不随运行当天变化 */
const BEFORE_SEASON = '2026-11-30'

function render(site: SiteId, locale: string, props: Parameters<typeof LandingPage>[0] = {}) {
  language.locale = locale
  return renderToStaticMarkup(
    <SiteContext value={site}>
      <LandingPage
        sampleChart={site === 'east' ? <EastSampleChart /> : <WestSampleChart />}
        featured={hubFeatured(site, locale, TOOL_ROUTES, BEFORE_SEASON)}
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

const ids = (featured: ReturnType<typeof hubFeatured>) => ({
  main: featured.main?.id,
  season: featured.season && [
    featured.season.kind,
    featured.season.primary.id,
    featured.season.secondary?.id,
  ],
  secondary: featured.secondary.map((tool) => tool.id),
})

describe('落地页数据', () => {
  it.each([
    [
      'east',
      'zh-Hant',
      'bazi',
      ['saju-gunghap', 'ziwei', 'tarot-three-card', 'almanac'],
      'daily',
      '八合紫牌農',
    ],
    [
      'east',
      'zh-Hans',
      'bazi',
      ['saju-gunghap', 'ziwei', 'zodiac-pair', 'tarot-three-card'],
      'daily',
      '八合紫生牌',
    ],
    [
      'east',
      'ko',
      'bazi',
      ['saju-gunghap', 'tarot-three-card', 'tojeong', 'zodiac'],
      'daily',
      '사합타토띠',
    ],
    ['east', 'ja', 'bazi', ['saju-gunghap', 'ziwei', 'tarot-three-card'], null, '四合紫22'],
    [
      'east',
      'en',
      'bazi',
      ['saju-gunghap', 'ziwei', 'tarot-three-card', 'tarot-card-index'],
      null,
      '八合紫2278',
    ],
    [
      'west',
      'en',
      'tarot-three-card',
      ['moon-phase-today', 'western-zodiac-compatibility', 'life-path'],
      'daily-numerology',
      '22☾♌1',
    ],
    [
      'west',
      'es',
      'tarot-three-card',
      ['life-path', 'numerology-calculator', 'life-path-compatibility'],
      null,
      '22192',
    ],
  ] as const)(
    '%s %s：主卡 1 张、副卡不超过上限，季节窗口之前季节位为每日入口',
    (site, locale, main, secondary, daily, glyphs) => {
      language.locale = locale
      // 季节窗口之前：季节位为每日运势；没有每日页的语言不出季节位
      const featured = hubFeatured(site, locale, TOOL_ROUTES, BEFORE_SEASON)
      expect(featured.main?.id).toBe(main)
      expect(featured.secondary.map((tool) => tool.id)).toEqual(secondary)
      expect(featured.secondary.length).toBeLessThanOrEqual(FEATURED_SECONDARY_LIMIT[site])
      expect(featured.season?.kind ?? null).toBe(daily ? 'daily' : null)
      expect(featured.season?.primary.id ?? null).toBe(daily)
      const cards = [featured.main, ...featured.secondary]
      expect(cards.map((tool) => tool?.glyph).join('')).toBe(glyphs)
      for (const tool of cards) {
        expect(tool?.title).toBeTruthy()
        expect(tool?.summary).toBeTruthy()
        // 入口卡只标动作式免费标签：不写 AI、不标付费
        expect(tool?.label).toBeTruthy()
        expect(`${tool?.title}${tool?.summary}${tool?.label}${tool?.action}`).not.toMatch(
          /\bAI\b|付费|付費|유료|有料|paid|de pago/i,
        )
        // 站内地址：不跨站、不链接到其他域名
        expect(tool?.href).toMatch(/^\/(?!\/)/)
      }
      expect(featured.hub?.href).toBeTruthy()
    },
  )

  it.each([
    ['2026-11-30', 'daily'],
    ['2026-12-01', 'year'],
    ['2027-02-28', 'year'],
    ['2027-03-01', 'daily'],
  ] as const)('季节窗口边界 %s：季节位为 %s', (today, kind) => {
    language.locale = 'zh-Hans'
    const featured = hubFeatured('east', 'zh-Hans', TOOL_ROUTES, today)
    expect(featured.main?.id).toBe('bazi')
    expect(featured.season?.kind).toBe(kind)
    if (kind === 'year') {
      // 按钮指向个人流年工具，文字链接指向 2027 生肖枢纽；小标与装饰大字取窗口配置
      expect(ids(featured).season).toEqual(['year', 'yearly-tool', 'yearly-2027'])
      expect(featured.season).toMatchObject({ badge: '2027', mark: '丁未' })
      expect(featured.season?.primary.href).toBe(`/zh-hans/${encodeURI('2027流年')}`)
    } else {
      expect(ids(featured).season).toEqual(['daily', 'daily', undefined])
      expect(featured.season).toMatchObject({ badge: null, mark: null })
    }
    // 季节位用到的工具不占副卡；副卡按配置顺序取前 4 个有页面的
    expect(ids(featured).secondary).toEqual([
      'saju-gunghap',
      'ziwei',
      'zodiac-pair',
      'tarot-three-card',
    ])
  })

  it('当前语言没有该工具时由下一个有页面的工具顺补，季节位的链接同样只取本语言的页面', () => {
    language.locale = 'ko'
    // 韩语没有紫微与生肖配对页：副卡顺补到띠；季节位按钮为토정비결，文字链接为신년 사주
    const season = hubFeatured('east', 'ko', TOOL_ROUTES, '2026-12-10')
    expect(ids(season)).toEqual({
      main: 'bazi',
      season: ['year', 'tojeong', 'yearly-tool'],
      secondary: ['saju-gunghap', 'tarot-three-card', 'zodiac'],
    })
    // 季节之外토정비결回到副卡（design 决策 5「토정비결（季节外）」）
    expect(ids(hubFeatured('east', 'ko', TOOL_ROUTES, '2027-03-01'))).toEqual({
      main: 'bazi',
      season: ['daily', 'daily', undefined],
      secondary: ['saju-gunghap', 'tarot-three-card', 'tojeong', 'zodiac'],
    })
    // 繁中有个人流年与 2027 生肖枢纽（第 9 组）：季节位按钮与文字链接都取本语言的页面
    language.locale = 'zh-Hant'
    expect(ids(hubFeatured('east', 'zh-Hant', TOOL_ROUTES, '2026-12-10')).season).toEqual([
      'year',
      'yearly-tool',
      'yearly-2027',
    ])
    // 日语既没有 2027 内容也没有每日页：不出季节位，主卡占满整行
    language.locale = 'ja'
    expect(hubFeatured('east', 'ja', TOOL_ROUTES, '2026-12-10').season).toBeNull()
    // 东方站英文：第 11 组补上 `/chinese-zodiac-2027`，季节位与简中相同（生肖枢纽加个人流年）
    language.locale = 'en'
    expect(ids(hubFeatured('east', 'en', TOOL_ROUTES, '2026-12-10')).season).toEqual([
      'year',
      'yearly-2027',
      'yearly-tool',
    ])
  })

  it('西方站：季节位为月相，副卡 3 张；不含东方工具，链接不跨站', () => {
    language.locale = 'en'
    expect(ids(hubFeatured('west', 'en', TOOL_ROUTES, '2026-12-10'))).toEqual({
      main: 'tarot-three-card',
      season: ['year', 'moon-phase-today', 'full-moon-calendar'],
      secondary: ['western-zodiac-compatibility', 'life-path', 'numerology-calculator'],
    })
    const off = hubFeatured('west', 'en', TOOL_ROUTES, '2027-03-01')
    expect(ids(off)).toEqual({
      main: 'tarot-three-card',
      season: ['daily', 'daily-numerology', undefined],
      secondary: ['moon-phase-today', 'western-zodiac-compatibility', 'life-path'],
    })
    const all = [off.main, ...off.secondary].map((tool) => tool?.id)
    expect(all).not.toEqual(
      expect.arrayContaining(['bazi', 'ziwei', 'mingpan', 'saju-gunghap', 'zodiac']),
    )
    expect(off.secondary.find((tool) => tool.id === 'life-path')).toMatchObject({
      title: 'Life Path Number',
      href: '/life-path-number',
    })
    expect(off.hub).toEqual({ href: '/tools', label: 'All tools' })
  })

  it('小标到期后不渲染；未发布语言不显示入口与小标', () => {
    language.locale = 'ko'
    const badgeOf = (today: string, locale: string, id: string) =>
      [...siteTools('east', locale, TOOL_ROUTES, today).values()].find((tool) => tool.id === id)
    // 到期日当天仍显示，次日起不再显示
    expect(badgeText(badgeOf('2027-02-28', 'ko', 'tojeong')?.badge)).toBe('2027')
    expect(badgeOf('2027-03-01', 'ko', 'tojeong')?.badge).toBeUndefined()
    expect(badgeText(badgeOf('2027-02-28', 'ko', 'yearly-tool')?.badge)).toBe('2027')
    expect(badgeText(badgeOf('2027-03-01', 'ko', 'yearly-tool')?.badge)).toBeNull()
    // 首页卡片与枢纽页取同一份条目：副卡上的小标随构建日期消失
    const card = (today: string) =>
      hubFeatured('east', 'ko', TOOL_ROUTES, today).secondary.find((tool) => tool.id === 'tojeong')
    expect(card('2027-03-01')).toMatchObject({ badge: null })
    // 繁中没有登记토정비결与生肖配对：入口与小标都不存在；2027 生肖枢纽由第 9 组登记
    expect(badgeOf('2026-12-10', 'zh-Hant', 'tojeong')).toBeUndefined()
    expect(badgeText(badgeOf('2026-12-10', 'zh-Hant', 'yearly-2027')?.badge)).toBe('2027')
    const zhHant = directoryGroups('east', 'zh-Hant', TOOL_ROUTES, '2026-12-10').flatMap((group) =>
      group.tools.map((tool) => tool.id),
    )
    for (const id of ['tojeong', 'zodiac-pair']) expect(zhHant).not.toContain(id)
    expect(zhHant).toContain('yearly-2027')
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
      // ja 样例段落未经使用者审定（readings/samples-ja.ts），首页只显示章节大纲
      if (locale === 'ja') {
        expect(approved.ja).toBeUndefined()
        continue
      }
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
    // 当季内容未上线时季节位就是每日运势入口，不再单独渲染今日条（每个工具在首页只链接一次）
    expect(order(html)).toEqual(['hero', 'tools', 'sample', 'steps', 'price', 'trust', 'faq'])
    const tools = block(html, 'tools')
    // 1 张主卡、1 个季节位、副卡不超过 4 张；下方一行「全部工具」链接
    expect(tools.match(/data-featured="main"/g)).toHaveLength(1)
    expect(tools.match(/data-featured="season"/g)).toHaveLength(1)
    const cards = tools.match(/data-tool-card="stack"/g) ?? []
    expect(cards.length).toBeGreaterThanOrEqual(2)
    expect(cards.length).toBeLessThanOrEqual(4)
    expect(tools).toContain('data-tool="tools-hub"')
    // 入口卡只有动作式免费标签，没有付费标签
    expect(tools).toContain('data-tool-label="free"')
    expect(tools).not.toContain('data-tool-label="paid"')
    // 一个 H1；没有工具表单
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toMatch(/<(?:form|input|select|textarea)\b/)
    expect(html).not.toContain('即將')
  })

  it('季节窗口内：季节位显示 2027 入口与小标，今日条照常在样例之后', () => {
    language.locale = 'zh-Hans'
    const html = render('east', 'zh-Hans', {
      featured: hubFeatured('east', 'zh-Hans', TOOL_ROUTES, '2026-12-10'),
    })
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
    const season = html.match(/<article data-featured="season"[\s\S]*?<\/article>/)?.[0] ?? ''
    expect(season).toContain('data-season="year"')
    expect(text(season)).toContain('2027')
    expect(text(season)).toContain('丁未')
    expect(season).toContain(`href="/zh-hans/${encodeURI('2027流年')}"`)
    expect(season).toContain(`href="/zh-hans/${encodeURI('2027生肖运势')}"`)
    expect(season).not.toContain('data-today')
    // 3-01 构建：季节位换回每日运势，2027 入口与小标都不再出现在首页
    const after = render('east', 'zh-Hans', {
      featured: hubFeatured('east', 'zh-Hans', TOOL_ROUTES, '2027-03-01'),
    })
    const tools = block(after, 'tools')
    expect(tools).toContain('data-season="daily"')
    expect(tools).not.toContain('2027')
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

  it('样例报告标明示例、附参考说明，不放按钮；段落与 catalog 一致', () => {
    const html = render('east', 'zh-Hant')
    const sample = block(html, 'sample')
    expect(sample).toContain('data-sample-badge')
    expect(sample).toContain('示例段落')
    expect(sample).toContain('虛構命盤')
    expect(sample).toContain(m.tools_disclaimer())
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

  it.each([
    ...HOMES.map(([site, locale]) => [site, locale] as const),
    ['east', 'ja'],
    ['west', 'es'],
  ] as const)('%s %s：首页文案合规，并保留定价页链接', (site, locale) => {
    const html = render(site, locale)
    expect(text(html)).not.toMatch(
      /\b(?:AI|IA|credits?|créditos?)\b|積分|积分|크레딧|クレジット(?!カード)|띠별 운세/i,
    )
    expect(checkCompliance(blocks(html), locale).violations).toEqual([])
    expect(html.includes('href="#sample"')).toBe(Boolean(block(html, 'sample')))
    const price = block(html, 'price')
    expect(text(price)).toContain(m.home_hub_plans_free())
    expect(price).toContain(
      locale === 'en' ? 'href="/pricing"' : `href="/${locale.toLowerCase()}/pricing"`,
    )
  })

  it('今日条：服务端只输出骨架与链接，不写入日期', () => {
    language.locale = 'zh-Hans'
    const today = block(
      render('east', 'zh-Hans', {
        featured: hubFeatured('east', 'zh-Hans', TOOL_ROUTES, '2026-12-10'),
      }),
      'today',
    )
    expect(today).toContain('data-today="pending"')
    expect(today.match(/data-today-skeleton/g)).toHaveLength(2)
    expect(today).toContain(`href="/zh-hans/${encodeURI('每日运势')}"`)
    expect(text(today)).not.toMatch(/\d/)
    expect(text(today)).not.toMatch(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/)
    language.locale = 'en'
    expect(
      block(
        render('west', 'en', { featured: hubFeatured('west', 'en', TOOL_ROUTES, '2026-12-10') }),
        'today',
      ),
    ).toContain('href="/daily-numerology"')
  })

  it('季节位为每日运势入口时带当日一行：服务端只输出骨架，不写入日期', () => {
    const season =
      render('east', 'zh-Hant').match(/<article data-featured="season"[\s\S]*?<\/article>/)?.[0] ??
      ''
    expect(season).toContain('data-season="daily"')
    expect(season).toContain('data-today="pending"')
    expect(season.match(/data-today-skeleton/g)).toHaveLength(2)
    expect(season).toContain(`href="/zh-hant/${encodeURI('每日運勢')}"`)
    expect(text(season)).not.toMatch(/\d/)
    expect(text(season)).not.toMatch(/\bAI\b/)
    expect(
      render('west', 'en').match(/<article data-featured="season"[\s\S]*?<\/article>/)?.[0],
    ).toContain('href="/daily-numerology"')
  })

  it('每日运势页未登记时不渲染今日条与每日入口，其余区块顺序不变', () => {
    language.locale = 'zh-Hant'
    const html = render('east', 'zh-Hant', {
      dailyPages: {},
      featured: { ...hubFeatured('east', 'zh-Hant'), season: null },
    })
    expect(order(html)).toEqual(['hero', 'tools', 'sample', 'steps', 'price', 'trust', 'faq'])
    expect(html).not.toContain('data-today')
    expect(html).not.toContain('data-featured="season"')
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

  it('品牌级 FAQ 保留三条问答，第一条默认展开', () => {
    language.locale = 'zh-Hant'
    const faq = block(render('east', 'zh-Hant'), 'faq')
    expect(faq.match(/<details\b/g)).toHaveLength(3)
    expect(faq.match(/<details\b[^>]*\bopen\b/g)).toHaveLength(1)
    for (const question of [
      m.home_hub_faq_free_q(),
      m.home_hub_faq_accuracy_q(),
      m.home_hub_faq_pay_q(),
    ])
      expect(faq).toContain(question)
  })

  it('信任说明第一条链接到本语言的数字命理入门页（content-growth-phase1 6.4），东方站不链接', () => {
    for (const [locale, href, anchor] of [
      ['en', '/numerology', 'what is numerology'],
      ['es', '/es/numerologia', 'qué es la numerología'],
    ] as const) {
      language.locale = locale
      const trust = block(render('west', locale), 'trust')
      expect(trust.match(/<a\b/g)).toHaveLength(1)
      expect(trust).toContain(
        `<a href="${href}" class="text-brand-ink hover:decoration-2">${anchor}</a>`,
      )
      expect(text(trust)).not.toContain('[')
    }
    language.locale = 'zh-Hant'
    expect(block(render('east', 'zh-Hant'), 'trust')).not.toContain('<a ')
  })

  it('首屏插画位对读屏隐藏，传入插画不改变结构', () => {
    const empty = block(render('east', 'zh-Hant'), 'hero')
    expect(empty).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-landing-art[^>]*><\/div>/)
    const filled = block(render('east', 'zh-Hant', { art: <svg data-art="east" /> }), 'hero')
    expect(filled).toContain('data-art="east"')
    expect(filled.replace(/<svg data-art="east"><\/svg>/, '')).toBe(empty)
  })
})
