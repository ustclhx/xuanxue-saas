import { readFileSync } from 'node:fs'
import { CARD_MEANINGS, CARDS } from '@xuanxue/tarot'
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
  tarotMeaningPath,
  tarotMeaningSeoPages,
} from './meaning-routes.ts'
import { majorNumeral, relatedAnchorIsShort, relatedCards, THEME_PAIRS } from './pairings.ts'
import { TAROT_LOCALES, tarotPath } from './routes.ts'

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
      // es 属于西方站但尚未发布（rollout.ts）：英文页不列 es；es 页面自指并列出英文版本，不进站点地图
      const es = new URL(`https://arcanumber.com/es${tarotMeaningPath(slug, 'es')}`).href
      // ja 未发布（features/i18n/rollout.ts）：页面自身保留自指；已发布语言的页面不列 ja（站点地图按发布状态过滤在 crawlers.ts）
      if (page.locale === 'ja') {
        expect(alternate.ja).toBe(
          new URL(`https://ganjiday.com/ja${tarotMeaningPath(slug, 'ja')}`).href,
        )
        continue
      }
      expect(alternate).toEqual(
        page.locale === 'en'
          ? { en, 'x-default': en }
          : page.locale === 'es'
            ? { en, es, 'x-default': en }
            : {
                'zh-Hant': new URL(
                  `https://ganjiday.com/zh-hant${tarotMeaningPath(slug, 'zh-Hant')}`,
                ).href,
                'zh-Hans': new URL(
                  `https://ganjiday.com/zh-hans${tarotMeaningPath(slug, 'zh-Hans')}`,
                ).href,
                ko: new URL(`https://ganjiday.com/ko${tarotMeaningPath(slug, 'ko')}`).href,
                // x-default 为同一牌义的繁中版本，不是会跳转的根路径
                'x-default': new URL(
                  `https://ganjiday.com/zh-hant${tarotMeaningPath(slug, 'zh-Hant')}`,
                ).href,
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
        const seo = tarotIndexSeo(locale)
        const listed = pages.filter((page) => page.path === seo.path && page.locale === locale)
        const west = locale === 'en' || locale === 'es'
        expect(listed, `${site} ${locale}`).toHaveLength((site === 'west') === west ? 1 : 0)
        if (listed.length === 0) continue
        const head = pageHead(seo, '')
        const alternate = Object.fromEntries(
          head.links.flatMap((link) => ('hrefLang' in link ? [[link.hrefLang, link.href]] : [])),
        )
        expect(Object.keys(alternate).sort()).toEqual(
          locale === 'en'
            ? ['en', 'x-default']
            : locale === 'es'
              ? ['en', 'es', 'x-default']
              : locale === 'ja'
                ? ['ja', 'ko', 'x-default', 'zh-Hans', 'zh-Hant']
                : ['ko', 'x-default', 'zh-Hans', 'zh-Hant'],
        )
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
