import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { LOCALE_RELEASE } from '../i18n/rollout.ts'
import { overrideRelease } from '../i18n/rollout-fixture.ts'
import { llmsTxt, sitemap, sitemapLocales } from '../seo/crawlers.ts'
import { alternateLinks, pageHead } from '../seo/metadata.ts'
import { publicPages } from '../seo/pages.ts'
import { siteNavLocale, siteServesLocale } from '../site/site.ts'
import { mainToolPath, toolsForSite } from '../tools/registry.ts'
import { meaningAlternates } from '../tools/tarot/meaning-routes.ts'
import { tarotAlternates, tarotPath } from '../tools/tarot/routes.ts'
import { FAQ_PAGE } from './copy/faq.ts'
import { LANDING } from './copy/landing.ts'
import { FEELINGS_INDEX, SPREADS } from './copy/tarot.ts'
import { BAZI, ZIWEI } from './copy/tools.ts'
import { EAST_EN_LINKS, linkKeys } from './links.tsx'
import { isEastEnglishOnlyPath, isEastEnglishPath } from './paths.ts'
import { eastEnToolHead, toHead } from './route-data.ts'
import { tarotFeelingsSeoPages } from './seo-pages.ts'

// route-data.ts 经 feelings.functions.ts 读取内容集合（只在构建 / 服务端可用），这里不需要牌页数据
vi.mock('./feelings.functions.ts', () => ({ getTarotFeelings: vi.fn() }))

/**
 * 东方站根路径英文（openspec add-locales-eu-ja 5b）：两站英文页面互不链接、hreflang 不跨 host，
 * 东方站页面的 x-default 有英文版本时指向英文版本、否则为繁中（使用者 2026-11-20）。
 * 东方站 en 已于 2026-11-21 发布：每个用例先改回 pending 验证发布前的输出，「发布后」用例再改为 released，
 * 结束后恢复真实发布表。
 */
const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const east = LOCALE_RELEASE.east as Record<string, string>
const hrefs = (links: readonly { hrefLang?: string; href: string }[]) =>
  Object.fromEntries(links.flatMap((l) => (l.hrefLang ? [[l.hrefLang, l.href]] : [])))

let restore = () => {}
beforeEach(() => {
  restore = overrideRelease({ east: { en: 'pending' } })
})
afterEach(() => restore())

describe('东方站英文页面地址', () => {
  it('注册表登记东方站英文路径，与西方站英文路径不重叠', () => {
    expect(mainToolPath('en')).toBe('/life-path-number')
    expect(mainToolPath('en', undefined, 'east')).toBe('/bazi-calculator')
    expect(tarotPath('daily', 'en')).toBe('/tarot/daily')
    expect(tarotPath('daily', 'en', 'east')).toBe('/tarot-spreads/one-card')
    for (const path of [
      '/bazi-calculator',
      '/tarot-spreads/pick-a-card',
      '/tarot-feelings/the-sun',
    ])
      expect(isEastEnglishOnlyPath(path), path).toBe(true)
    for (const path of ['/faq', '/pricing', '/privacy']) {
      expect(isEastEnglishPath(path), path).toBe(true)
      expect(isEastEnglishOnlyPath(path), path).toBe(false)
    }
    expect(isEastEnglishPath('/tarot')).toBe(false)
    expect(isEastEnglishPath('/life-path-number')).toBe(false)
  })

  it('发布前东方站的导航语言不变（繁中）；发布后英文成为东方站语言', () => {
    expect(siteServesLocale('east', 'en', templateConfig)).toBe(false)
    expect(siteNavLocale('east', 'en', templateConfig)).toBe('zh-Hant')
    east.en = 'released'
    expect(siteServesLocale('east', 'en', templateConfig)).toBe(true)
    expect(siteNavLocale('east', 'en', templateConfig)).toBe('en')
    expect(toolsForSite('east', 'en').map((tool) => tool.path)).toEqual([
      '/bazi-calculator',
      '/zi-wei-dou-shu',
      '/bazi-compatibility',
      '/tarot-spreads',
      // content-growth-v2-tools 第 11 组：生肖枢纽进页头「历法与生肖」分组
      '/chinese-zodiac',
    ])
  })
})

describe('hreflang 与 x-default', () => {
  const bazi = {
    'zh-Hant': '/八字排盤',
    'zh-Hans': '/八字排盘',
    ko: '/만세력',
    en: '/bazi-calculator',
  }

  it('发布前：东方站中文页面不列英文，x-default 为繁中；英文页面自指，地址都在东方站', () => {
    const zh = hrefs(alternateLinks(EAST, '/八字排盤', undefined, bazi, 'zh-Hant'))
    expect(zh.en).toBeUndefined()
    expect(zh['x-default']).toBe(`${EAST}/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4`)
    const en = hrefs(alternateLinks(EAST, '/bazi-calculator', undefined, bazi, 'en', 'east'))
    expect(en.en).toBe(`${EAST}/bazi-calculator`)
    expect(en['x-default']).toBe(`${EAST}/bazi-calculator`)
    expect(Object.values(en).every((href) => href.startsWith(EAST))).toBe(true)
  })

  it('发布后：东方站有英文版本的页面 x-default 指向英文版本，没有的仍为繁中；不跨 host', () => {
    east.en = 'released'
    const zh = hrefs(alternateLinks(EAST, '/八字排盤', undefined, bazi, 'zh-Hant'))
    expect(zh.en).toBe(`${EAST}/bazi-calculator`)
    expect(zh['x-default']).toBe(`${EAST}/bazi-calculator`)
    const card = hrefs(
      alternateLinks(
        EAST,
        '/塔羅/牌義/the-sun',
        undefined,
        meaningAlternates('the-sun', 'east'),
        'zh-Hant',
      ),
    )
    expect(card.en).toBe(`${EAST}/tarot-feelings/the-sun`)
    expect(card['x-default']).toBe(`${EAST}/tarot-feelings/the-sun`)
    const spread = hrefs(
      alternateLinks(
        EAST,
        '/塔羅/是非',
        undefined,
        tarotAlternates('yes-or-no', 'east'),
        'zh-Hant',
      ),
    )
    expect(spread.en).toBe(`${EAST}/tarot-spreads/pick-a-card`)
    // 东方站英文没有通讯页：不列英文，x-default 仍为繁中
    const newsletter = hrefs(alternateLinks(EAST, '/newsletter', undefined, undefined, 'zh-Hant'))
    expect(newsletter.en).toBeUndefined()
    expect(newsletter['x-default']).toBe(`${EAST}/zh-hant/newsletter`)
    // 只有东方站的中文页（命盘查询）没有英文版本：x-default 为繁中
    const mingpan = hrefs(
      alternateLinks(
        EAST,
        '/命盤查詢',
        undefined,
        { 'zh-Hant': '/命盤查詢', 'zh-Hans': '/命盘查询' },
        'zh-Hant',
      ),
    )
    expect(mingpan['x-default']).toBe(`${EAST}/zh-hant/%E5%91%BD%E7%9B%A4%E6%9F%A5%E8%A9%A2`)
    // 西方站英文页面不受影响，不出现东方站地址
    const west = hrefs(
      alternateLinks(WEST, '/tarot/daily', undefined, tarotAlternates('daily', 'west'), 'en'),
    )
    // 西方站 es 已发布（2026-11-21）：西方站页面只列西方站的 en / es，x-default 为英文
    expect(west).toEqual({
      en: `${WEST}/tarot/daily`,
      es: `${WEST}/es/tarot/carta-del-dia`,
      'x-default': `${WEST}/tarot/daily`,
    })
    for (const links of [zh, card, spread])
      expect(Object.values(links).every((href) => href.startsWith(EAST))).toBe(true)
  })

  it('发布后的站点地图与 llms.txt：东方站 en 子图只含东方站英文页面，西方站 en 子图不变', () => {
    east.en = 'released'
    const content = {
      posts: [],
      legal: [],
      docs: [],
      toolPages: tarotFeelingsSeoPages([
        { slug: 'the-sun', title: 'The Sun as Feelings', description: 'd' },
      ]),
    }
    expect(sitemapLocales('east')).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'ja', 'en'])
    const eastXml = sitemap(publicPages(content, new Date(), templateConfig), EAST, 'en', 'east')
    expect(eastXml).toContain(`<loc>${EAST}/bazi-calculator</loc>`)
    expect(eastXml).toContain(`<loc>${EAST}/tarot-feelings/the-sun</loc>`)
    expect(eastXml).toContain(`<loc>${EAST}/pricing</loc>`)
    expect(eastXml).not.toContain('arcanumber.com')
    expect(eastXml).not.toContain('/life-path-number')
    const westXml = sitemap(publicPages(content, new Date(), templateConfig), WEST, 'en', 'west')
    expect(westXml).not.toContain('ganjiday.com')
    expect(westXml).not.toContain('/bazi-calculator')
    const llms = llmsTxt('east') ?? ''
    expect(llms).toContain(`(${EAST}/bazi-calculator)`)
    expect(llms).not.toContain('arcanumber.com')
  })

  it('发布后：八字、紫微英文页与东方站各语言版本声明同一组 hreflang（ML-05 互指，含 ja）', () => {
    east.en = 'released'
    for (const [id, zhPath] of [
      ['bazi', '/八字排盤'],
      ['ziwei', '/紫微斗數排盤'],
    ] as const) {
      const en = hrefs(toHead(eastEnToolHead(id)).links)
      const zh = hrefs(
        pageHead({ path: zhPath, locale: 'zh-Hant', title: 't', description: 'd' }, '').links,
      )
      expect(en, id).toEqual(zh)
      expect(en.ja, id).toBeDefined()
      expect(
        Object.values(en).every((href) => href.startsWith(EAST)),
        id,
      ).toBe(true)
    }
  })

  it('东方站英文页面的 head：站名 Ganjiday、canonical 在东方站', () => {
    const head = pageHead(
      { path: '/pricing', locale: 'en', site: 'east', title: 'Pricing', description: 'd' },
      '',
    )
    expect(head.meta[0]).toEqual({ title: 'Pricing | Ganjiday' })
    expect(head.links[0]).toEqual({ rel: 'canonical', href: `${EAST}/pricing` })
  })
})

describe('东方站英文正文的链接', () => {
  const texts: [string, string][] = [
    ...LANDING.sections.flatMap((s) => s.paragraphs.map((p): [string, string] => ['landing', p])),
    ...LANDING.faq.map((f): [string, string] => ['landing', f.a]),
    ...[BAZI, ZIWEI].flatMap((copy) => [
      ...copy.sections.flatMap((s) => s.paragraphs.map((p): [string, string] => [copy.nav, p])),
      ...copy.faq.map((f): [string, string] => [copy.nav, f.a]),
    ]),
    ...Object.entries(SPREADS).flatMap(([id, copy]) => [
      [id, copy.feelingsNote] as [string, string],
      ...Object.values(copy.more).map((t): [string, string] => [id, t ?? '']),
      ...copy.sections.flatMap((s) => s.paragraphs.map((p): [string, string] => [id, p])),
      ...copy.faq.map((f): [string, string] => [id, f.a]),
    ]),
    ['index', FEELINGS_INDEX.intro],
    ...FAQ_PAGE.methods.map((f): [string, string] => ['faq', f.a]),
    ...FAQ_PAGE.sections.flatMap((s) => s.items.map((f): [string, string] => ['faq', f.a])),
  ]

  it('只链接东方站英文页面（两站互不链接），每页正文 2–5 条', () => {
    const perPage = new Map<string, number>()
    for (const [page, text] of texts) {
      for (const key of linkKeys(text)) expect(EAST_EN_LINKS[key], `${page}: ${key}`).toBeDefined()
      expect(text, page).not.toMatch(/arcanumber/i)
      perPage.set(page, (perPage.get(page) ?? 0) + linkKeys(text).length)
    }
    for (const [page, count] of perPage) expect(count, page).toBeLessThanOrEqual(5)
    for (const page of ['BaZi Calculator', 'Zi Wei Dou Shu Chart', 'three-card', 'faq'])
      expect(perPage.get(page) ?? 0, page).toBeGreaterThanOrEqual(2)
  })
})
