import { readFileSync } from 'node:fs'
import { CARD_MEANINGS, CARDS, type SpreadId } from '@xuanxue/tarot'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { sitemap } from '../../seo/crawlers.ts'
import { pageHead } from '../../seo/metadata.ts'
import { publicPages } from '../../seo/pages.ts'
import { CardFace } from './card.tsx'
import { TarotIndexContent } from './index-page.tsx'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { splitMeaningHtml } from './meaning-page.tsx'
import {
  tarotIndexPath,
  tarotIndexSeo,
  tarotLocalizedSeoPages,
  tarotMeaningPath,
  tarotMeaningSeoPages,
} from './meaning-routes.ts'
import { majorNumeral, relatedAnchorIsShort, relatedCards, THEME_PAIRS } from './pairings.ts'
import {
  TAROT_LOCALES,
  type TarotLocale,
  tarotDescription,
  tarotPath,
  tarotSeoTitle,
  tarotTitle,
} from './routes.ts'

const messages = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

// 与已有 numerology SEO 测试一致，读取 typecheck / build 生成的真实正文，避免 fixture 掩盖缺译文。
const content: TarotMeaningPage[] = JSON.parse(
  readFileSync(
    new URL('../../../../.content-collections/generated/allTarots.js', import.meta.url),
    'utf8',
  )
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
)

afterEach(() => {
  messages.locale = 'en'
  setLocale('en', { reload: false })
})

describe('三语牌义内容与 SEO', () => {
  it('每种语言完整 78 篇，Title 与 canonical 唯一，真实正文、FAQ 与双尺寸本语言 alt 齐全', () => {
    for (const locale of TAROT_LOCALES) {
      messages.locale = locale
      setLocale(locale, { reload: false })
      const pages = content.filter((page) => page.locale === locale)
      expect(pages).toHaveLength(78)
      expect(new Set(pages.map((page) => page.cardId))).toEqual(
        new Set(CARDS.map((card) => card.id)),
      )
      const titles = new Set<string>()
      const canonicals = new Set<string>()
      const alts = new Set<string>()
      for (const page of pages) {
        const seo = tarotMeaningSeoPages([page])[0]
        expect(seo).toBeDefined()
        if (!seo) continue
        const head = pageHead(seo, '')
        titles.add(head.meta.find((meta) => 'title' in meta)?.title ?? '')
        canonicals.add(head.links.find((link) => link.rel === 'canonical')?.href ?? '')
        if (locale === 'ja')
          expect(page.html.match(/<h2>/g)?.length ?? 0, page.cardId).toBeGreaterThanOrEqual(6)
        else expect(page.html.match(/<h2>/g), page.cardId).toHaveLength(10)
        for (const faq of page.faq) {
          const escaped = renderToString(<h3>{faq.q}</h3>)
          expect(page.html, page.cardId).toContain(escaped)
        }
        for (const reversed of [false, true]) {
          const html = renderToString(
            <CardFace card={{ cardId: page.cardId, reversed }} locale={locale} loading="lazy" />,
          )
          const alt = /alt="([^"]+)"/.exec(html)?.[1] ?? ''
          expect(alt).toContain(CARD_MEANINGS[locale][page.cardId]?.name)
          expect(alt).toContain(
            {
              en: ['Upright', 'Reversed'],
              'zh-Hant': ['正位', '逆位'],
              'zh-Hans': ['正位', '逆位'],
              ko: ['정방향', '역방향'],
              es: ['Al derecho', 'Invertida'],
              ja: ['正位置', '逆位置'],
            }[locale][Number(reversed)],
          )
          expect(html).toContain(
            `srcSet="/tarot/${page.cardId}-240.webp 240w, /tarot/${page.cardId}-480.webp 480w"`,
          )
          alts.add(alt)
        }
      }
      expect(titles.size).toBe(78)
      expect(canonicals.size).toBe(78)
      expect(alts.size).toBe(156)
    }
  })

  it('每张牌的 hreflang 只在同站内互指（D5），站点地图与预渲染收录全部牌义页', () => {
    const toolPages = tarotMeaningSeoPages(content)
    const entries = new Set(prerenderEntryPages(templateConfig).map((entry) => entry.path))
    const pages = publicPages({ posts: [], legal: [], docs: [], toolPages })
    const xml = sitemap(pages, '')
    for (const page of toolPages) {
      const head = pageHead(page, '')
      const alternate = Object.fromEntries(
        head.links.flatMap((link) => ('hrefLang' in link ? [[link.hrefLang, link.href]] : [])),
      )
      const slug = page.path.split('/').at(-1) ?? ''
      const en = `https://arcanumber.com${tarotMeaningPath(slug, 'en')}`
      // es 属于西方站（2026-11-21 发布）：西方站 en 与 es 互指，x-default 为英文版本
      const es = new URL(`https://arcanumber.com/es${tarotMeaningPath(slug, 'es')}`).href
      // 东方站页面另与 ja 和东方站英文 as feelings 牌页互指（2026-11-21 发布），x-default 为东方站英文版本
      const eastEn = new URL(`https://ganjiday.com${tarotMeaningPath(slug, 'en', 'east')}`).href
      expect(alternate).toEqual(
        page.locale === 'en' || page.locale === 'es'
          ? { en, es, 'x-default': en }
          : {
              'zh-Hant': new URL(`https://ganjiday.com/zh-hant${tarotMeaningPath(slug, 'zh-Hant')}`)
                .href,
              'zh-Hans': new URL(`https://ganjiday.com/zh-hans${tarotMeaningPath(slug, 'zh-Hans')}`)
                .href,
              ko: new URL(`https://ganjiday.com/ko${tarotMeaningPath(slug, 'ko')}`).href,
              ja: new URL(`https://ganjiday.com/ja${tarotMeaningPath(slug, 'ja')}`).href,
              en: eastEn,
              // x-default 为同一牌义的东方站英文版本，不是会跳转的根路径
              'x-default': eastEn,
            },
      )
      expect(xml).toContain(`<loc>${alternate[page.locale]}</loc>`)
      expect(
        entries.has(`${page.locale === 'en' ? '' : `/${page.locale.toLowerCase()}`}${page.path}`),
      ).toBe(true)
    }
    for (const site of ['west', 'east'] as const) {
      const selected = publicPages(
        { posts: [], legal: [], docs: [], toolPages },
        new Date(),
        templateConfig,
        site,
      ).filter((page) => /\/(cards|牌義|牌义|카드)\//.test(page.path))
      expect(selected).toHaveLength(site === 'west' ? 78 : 234)
    }
    expect(
      publicPages({ posts: [], legal: [], docs: [], toolPages }, new Date(), {
        ...templateConfig,
        marketing: { ...templateConfig.marketing, enabled: false },
      }),
    ).toEqual([])
  })

  it('延伸牌义固定 4 条：同序列前 1 张、后 2 张与 1 张主题对应牌，78 张牌都不重复、不指向自己', () => {
    expect(Object.keys(THEME_PAIRS).sort()).toEqual(CARDS.map((card) => card.id).sort())
    for (const card of CARDS) {
      const related = relatedCards(card)
      expect(related.map((item) => item.role)).toEqual(['before', 'after', 'after-2', 'pair'])
      const ids = related.map((item) => item.card.id)
      expect(new Set([...ids, card.id]).size, card.id).toBe(5)
      // 前后三张与本牌同序列；大牌的对应牌仍是大牌，小牌的对应牌是另一花色的同序号牌
      for (const item of related.slice(0, 3)) expect(item.card.suit).toBe(card.suit)
      const pair = related[3]?.card
      if (card.suit === 'major') expect(pair?.suit).toBe('major')
      else {
        expect(pair?.suit).not.toBe(card.suit)
        expect(pair?.suit).not.toBe('major')
        expect(pair?.number).toBe(card.number)
      }
      // 配对是相互的
      expect(THEME_PAIRS[THEME_PAIRS[card.id] ?? '']).toBe(card.id)
    }
    const ids = (id: string) =>
      relatedCards(CARDS.find((card) => card.id === id) as (typeof CARDS)[number]).map(
        (item) => item.card.id,
      )
    // 设计稿样例：太阳 → 月亮、审判、世界、力量
    expect(ids('major-19')).toEqual(['major-18', 'major-20', 'major-21', 'major-08'])
    // 序列首尾相接：世界之后是愚者、魔术师；国王之后是王牌、二
    expect(ids('major-21')).toEqual(['major-20', 'major-00', 'major-01', 'major-10'])
    expect(ids('wands-14')).toEqual(['wands-13', 'wands-01', 'wands-02', 'swords-14'])
    expect([0, 4, 9, 14, 19, 21].map(majorNumeral)).toEqual(['0', 'IV', 'IX', 'XIV', 'XIX', 'XXI'])
  })

  it('延伸牌义锚文本两种表述各半：每张牌的 4 条入链 2 条用牌义索引的短表述（seo-fix-tdk-links 决策 5）', () => {
    const counts = new Map<string, { short: number; long: number }>()
    for (const source of CARDS)
      for (const { card } of relatedCards(source)) {
        const entry = counts.get(card.id) ?? { short: 0, long: 0 }
        if (relatedAnchorIsShort(source, card)) entry.short += 1
        else entry.long += 1
        counts.set(card.id, entry)
      }
    expect(counts.size).toBe(78)
    for (const [id, entry] of counts) expect(entry, id).toEqual({ short: 2, long: 2 })
  })

  it('牌义索引页：四语各 78 条服务端输出的牌义链接，锚文本带「Tarot / 塔罗牌」，罗马数字在链接之外', () => {
    const anchors = {
      en: ['The Moon Tarot', 'Ace of Wands Tarot'],
      'zh-Hans': ['月亮塔罗牌', '权杖王牌塔罗牌'],
      'zh-Hant': ['月亮塔羅牌', '權杖王牌塔羅牌'],
      ko: ['달 타로 카드', '완드 에이스 타로 카드'],
      es: ['La Luna en el tarot', 'As de Bastos en el tarot'],
      ja: ['月', 'ワンドのエース'],
    } as const
    for (const locale of TAROT_LOCALES) {
      messages.locale = locale
      setLocale(locale, { reload: false })
      const main = renderToString(<TarotIndexContent locale={locale} />)
      const links = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(
        ([, href = '', text = '']) => ({
          href: decodeURI(href),
          text: text.replace(/<[^>]+>/g, ''),
        }),
      )
      const prefix = locale === 'en' ? '' : `/${locale.toLowerCase()}`
      const cards = links.filter((link) =>
        link.href.startsWith(`${prefix}${tarotIndexPath(locale)}/`),
      )
      expect(cards, locale).toHaveLength(78)
      expect(new Set(cards.map((link) => link.href)).size).toBe(78)
      for (const anchor of anchors[locale]) expect(cards.map((link) => link.text)).toContain(anchor)
      // 罗马数字不在锚文本里
      expect(cards.some((link) => /^[IVX0]+\b/.test(link.text))).toBe(false)
      expect(main).toContain('>XVIII</span>')
      // 导语里的两条牌阵链接；其余只有面包屑的首页与页内目录锚点
      const others = links.filter((link) => !cards.includes(link))
      expect(others.filter((link) => link.href.startsWith('#'))).toHaveLength(5)
      expect(others.filter((link) => !link.href.startsWith('#')).map((link) => link.href)).toEqual([
        prefix || '/',
        ...[tarotPath('three-card', locale), tarotPath('daily', locale)].map(
          (path) => `${prefix}${path}`,
        ),
      ])
      // 索引页不加载牌图，也不跨站链接
      expect(main).not.toContain('<img')
      expect(main).not.toMatch(/https?:\/\//)
    }
  })

  it('牌义索引进站点地图与预渲染，hreflang 只在同站内互指', () => {
    const entries = new Set(prerenderEntryPages(templateConfig).map((entry) => entry.path))
    for (const site of ['west', 'east'] as const) {
      const pages = publicPages(
        { posts: [], legal: [], docs: [] },
        new Date(),
        templateConfig,
        site,
      )
      const xml = sitemap(pages, '')
      for (const locale of TAROT_LOCALES) {
        // 与路由相同按站点生成（meaning-route.tsx）：东方站页面的 en 指向东方站英文牌页索引
        const seo = tarotIndexSeo(locale, site)
        const listed = pages.filter((page) => page.path === seo.path && page.locale === locale)
        const west = locale === 'en' || locale === 'es'
        expect(listed, `${site} ${locale}`).toHaveLength((site === 'west') === west ? 1 : 0)
        if (listed.length === 0) continue
        const head = pageHead(seo, '')
        const alternate = Object.fromEntries(
          head.links.flatMap((link) => ('hrefLang' in link ? [[link.hrefLang, link.href]] : [])),
        )
        expect(Object.keys(alternate).sort()).toEqual(
          west ? ['en', 'es', 'x-default'] : ['en', 'ja', 'ko', 'x-default', 'zh-Hans', 'zh-Hant'],
        )
        // 东方站页面的 en 是东方站英文牌页索引，不跨站
        if (!west) expect(alternate.en).toBe('https://ganjiday.com/tarot-feelings')
        // 站点地图路由按发布状态过滤语言（crawlers.ts），这里的 sitemap() 不过滤，es 与 ja 同样列出
        expect(xml).toContain(`<loc>${alternate[locale]}</loc>`)
        expect(entries.has(`${locale === 'en' ? '' : `/${locale.toLowerCase()}`}${seo.path}`)).toBe(
          true,
        )
      }
    }
  })

  it('牌义正文拆分：FAQ 与文末声明移出长文，正文里的牌阵链接只保留文字', () => {
    for (const page of content) {
      const { body, note } = splitMeaningHtml(page.html)
      if (page.locale === 'ja')
        expect(body.match(/<h2>/g)?.length ?? 0, page.cardId).toBeGreaterThanOrEqual(5)
      else expect(body.match(/<h2>/g), page.cardId).toHaveLength(9)
      expect(body).not.toContain('<a ')
      expect(note.length, page.cardId).toBeGreaterThan(20)
      expect(note).not.toMatch(/[<>]|&\w+;/)
      for (const faq of page.faq) expect(body).not.toContain(renderToString(<h3>{faq.q}</h3>))
    }
  })
})

/**
 * content-growth-phase1 决策 6：en、zh、ko 给三张牌补 SEO 标题后，tarotLocalizedSeoPages() 的筛选（三张牌的 SEO 标题
 * 是否不同于导航名）会把这些语言的其他牌阵页与牌义索引页一并纳入覆盖清单。这里逐字锁定它们的 Title 与 Description
 * （取自改动前的 main），并核对覆盖条目与注册表条目一致，避免副作用悄悄改掉子词页。
 */
describe('免费塔罗主词归入口页（content-growth-phase1 第 5 组）', () => {
  type Locked = Record<string, readonly [string, string]>
  // 改动前 main 上的值（不含站名后缀）
  const LOCKED: Record<'en' | 'zh-Hans' | 'zh-Hant' | 'ko', Locked> = {
    en: {
      daily: [
        'Card of the Day',
        'Draw one free tarot card of the day as a theme to reflect on, with upright and reversed keywords.',
      ],
      'yes-or-no': [
        'Yes or No Tarot',
        'Free yes or no tarot: draw one card and see Yes, No or Maybe from a fixed, published card mapping.',
      ],
      'celtic-cross': [
        'Celtic Cross Tarot',
        'Free Celtic Cross tarot: a ten-card spread for exploring a situation in depth, with every position explained.',
      ],
      index: [
        'Tarot Card Meanings: All 78 Cards',
        'All 78 tarot card meanings in one list: the 22 Major Arcana and the suits of Wands, Cups, Swords and Pentacles, each with upright and reversed meanings.',
      ],
    },
    'zh-Hans': {
      daily: ['每日一张塔罗', '每天免费抽一张塔罗牌，作为今日省思的主题，附正位与逆位关键词。'],
      'yes-or-no': [
        '是非塔罗',
        '免费是非塔罗：抽一张牌，依公开的固定对照表显示「是／否／也许」与判定依据。',
      ],
      'celtic-cross': [
        '凯尔特十字塔罗',
        '免费凯尔特十字塔罗：十张牌的经典牌阵，逐一说明每个牌位，深入梳理一个处境。',
      ],
      index: [
        '塔罗牌义：78 张牌全览',
        '78 张塔罗牌义一次看完：22 张大阿尔卡那，以及权杖、圣杯、宝剑、钱币四个牌组，每张牌都有正位与逆位解析。',
      ],
    },
    'zh-Hant': {
      daily: ['每日一張塔羅', '每天免費抽一張塔羅牌，作為今日省思的主題，附正位與逆位關鍵詞。'],
      'yes-or-no': [
        '是非塔羅',
        '免費是非塔羅：抽一張牌，依公開的固定對照表顯示「是／否／也許」與判定依據。',
      ],
      'celtic-cross': [
        '凱爾特十字塔羅',
        '免費凱爾特十字塔羅：十張牌的經典牌陣，逐一說明每個牌位，深入梳理一個處境。',
      ],
      index: [
        '塔羅牌義：78 張牌全覽',
        '78 張塔羅牌義一次看完：22 張大阿爾克那，以及權杖、聖杯、寶劍、錢幣四個牌組，每張牌都有正位與逆位解析。',
      ],
    },
    ko: {
      daily: [
        '오늘의 타로 카드',
        '매일 무료로 타로 카드 한 장을 뽑아 오늘 돌아볼 주제로 삼아 보세요. 정방향·역방향 키워드를 함께 보여 줍니다.',
      ],
      'yes-or-no': [
        '예/아니오 타로',
        '무료 예/아니오 타로: 카드 한 장을 뽑고 공개된 고정 대응표에 따른 예·아니요·아마도와 그 근거를 확인하세요.',
      ],
      'celtic-cross': [
        '켈틱 크로스 타로',
        '무료 켈틱 크로스 타로: 열 장으로 상황을 깊이 살펴보는 고전 배열이며, 모든 자리의 의미를 설명합니다.',
      ],
      index: [
        '타로 카드 의미: 78장 전체 보기',
        '타로 카드 78장의 의미를 한곳에서: 메이저 아르카나 22장과 완드·컵·소드·펜타클 수트, 카드마다 정방향과 역방향 해석을 담았습니다.',
      ],
    },
  }
  const KEYWORD = {
    en: 'Free Tarot Reading',
    'zh-Hans': '免费塔罗占卜',
    'zh-Hant': '免費塔羅牌占卜',
    ko: '무료 타로',
  } as const
  const LOCALES = Object.keys(LOCKED) as (keyof typeof LOCKED)[]
  const pathOf = (locale: TarotLocale, page: string) =>
    page === 'index' ? tarotIndexPath(locale) : tarotPath(page as SpreadId, locale)

  it('覆盖清单中其他牌阵页与牌义索引页的 Title、Description 与 main 逐字相同', () => {
    const overrides = tarotLocalizedSeoPages()
    for (const locale of LOCALES)
      for (const [page, [title, description]] of Object.entries(LOCKED[locale])) {
        const entry = overrides.find(
          (item) => item.locale === locale && item.path === pathOf(locale, page),
        )
        expect(entry, `${locale} ${page}`).toBeDefined()
        expect(entry?.title, `${locale} ${page}`).toBe(title)
        expect(entry?.description, `${locale} ${page}`).toBe(description)
      }
  })

  it('有无覆盖清单时，子词页在公开页面清单中的 Title、Description、主词与 hreflang 不变', () => {
    for (const site of ['west', 'east'] as const) {
      const base = publicPages({ posts: [], legal: [], docs: [] }, new Date(), templateConfig, site)
      const merged = publicPages(
        { posts: [], legal: [], docs: [], toolPages: tarotLocalizedSeoPages() },
        new Date(),
        templateConfig,
        site,
      )
      for (const locale of LOCALES)
        for (const page of Object.keys(LOCKED[locale])) {
          const find = (list: typeof base) =>
            list.find(
              (item) => item.locale === locale && item.path === pathOf(locale, page) && !item.site,
            )
          const before = find(base)
          const after = find(merged)
          expect(Boolean(after), `${site} ${locale} ${page}`).toBe(Boolean(before))
          if (!before) continue
          expect(after?.title, `${site} ${locale} ${page}`).toBe(before.title)
          expect(after?.description).toBe(before.description)
          expect(after?.titleMain).toBe(before.titleMain)
          expect(after?.alternates).toEqual(before.alternates)
        }
    }
  })

  it('入口页 Title 以主词开头、H1 含主词；子词页的 Title 与 H1 不以主词开头', () => {
    const messagesOf = (locale: string): Record<string, string> =>
      JSON.parse(
        readFileSync(new URL(`../../../../messages/${locale}/tarot.json`, import.meta.url), 'utf8'),
      )
    const H1_KEYS: Record<string, string> = {
      daily: 'tarot_daily_h1',
      'yes-or-no': 'tarot_yes_or_no_h1',
      'celtic-cross': 'tarot_celtic_cross_h1',
      index: 'tarot_index_title',
    }
    for (const locale of LOCALES) {
      const keyword = KEYWORD[locale]
      const text = messagesOf(locale)
      expect(tarotSeoTitle('three-card', locale).startsWith(keyword)).toBe(true)
      expect(tarotTitle('three-card', locale)).toBe(keyword)
      expect(text.tarot_three_card_h1).toContain(keyword)
      for (const [page, key] of Object.entries(H1_KEYS)) {
        const title =
          page === 'index' ? tarotIndexSeo(locale).title : tarotSeoTitle(page as SpreadId, locale)
        expect(title.startsWith(keyword), `${locale} ${page} Title`).toBe(false)
        expect(text[key]?.startsWith(keyword), `${locale} ${page} H1`).toBe(false)
      }
    }
  })

  it('入口页 Description 带主词，es、ja 的入口页 Title 不变', () => {
    for (const locale of LOCALES)
      expect(tarotDescription('three-card', locale).toLowerCase()).toContain(
        KEYWORD[locale].toLowerCase(),
      )
    expect(tarotSeoTitle('three-card', 'es')).toBe('Tarot gratis: pasado, presente y futuro')
    expect(tarotSeoTitle('three-card', 'ja')).toBe(
      '無料タロット占い｜スリーカードで過去・現在・未来',
    )
  })
})
