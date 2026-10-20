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
import type { TarotMeaningPage } from './meaning.functions.ts'
import { relatedCards, tarotMeaningPath, tarotMeaningSeoPages } from './meaning-routes.ts'
import { TAROT_LOCALES } from './routes.ts'

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
        expect(page.html.match(/<h2>/g), page.cardId).toHaveLength(10)
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
            { en: ['Upright', 'Reversed'], 'zh-Hant': ['正位', '逆位'], ko: ['정방향', '역방향'] }[
              locale
            ][Number(reversed)],
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

  it('每张牌的三语 hreflang 跨站互指，站点地图与预渲染收录全部 234 页', () => {
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
      expect(alternate).toEqual({
        en,
        'zh-Hant': new URL(`https://ganjiday.com/zh-hant${tarotMeaningPath(slug, 'zh-Hant')}`).href,
        ko: new URL(`https://ganjiday.com/ko${tarotMeaningPath(slug, 'ko')}`).href,
        'x-default': en,
      })
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
      ).filter((page) => /\/(cards|牌義|카드)\//.test(page.path))
      expect(selected).toHaveLength(site === 'west' ? 78 : 156)
    }
    expect(
      publicPages({ posts: [], legal: [], docs: [], toolPages }, new Date(), {
        ...templateConfig,
        marketing: { ...templateConfig.marketing, enabled: false },
      }),
    ).toEqual([])
  })

  it('权杖王牌链接权杖二及其他三张王牌，大牌与小牌序号不混用', () => {
    const ace = CARDS.find((card) => card.id === 'wands-01')
    const fool = CARDS.find((card) => card.id === 'major-00')
    if (!ace || !fool) throw new Error('Required cards missing')
    expect(relatedCards(ace).map((card) => card.id)).toEqual([
      'wands-02',
      'cups-01',
      'swords-01',
      'pentacles-01',
    ])
    expect(relatedCards(fool).map((card) => card.id)).toEqual(['major-01'])
  })
})
