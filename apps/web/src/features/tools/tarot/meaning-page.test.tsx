import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { m } from '../../../paraglide/messages.js'
import { setLocale } from '../../../paraglide/runtime.js'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { TarotMeaningArticle } from './meaning-page.tsx'

const messages = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})
vi.mock('../../marketing/marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

// 读取 typecheck / build 生成的真实正文（与 meanings.test.tsx 相同）
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

function page(locale: string, cardId: string): TarotMeaningPage {
  const found = content.find((entry) => entry.locale === locale && entry.cardId === cardId)
  if (!found) throw new Error(`missing ${locale}/${cardId}`)
  return found
}

function render(content: TarotMeaningPage): string {
  messages.locale = content.locale
  setLocale(content.locale, { reload: false })
  return renderToStaticMarkup(<TarotMeaningArticle content={content} />)
}

/** 去掉三个逐牌字段，得到「缺字段」时的页面数据 */
function withoutCopy(content: TarotMeaningPage): TarotMeaningPage {
  const { lede: _lede, try_prompt: _try, related_note: _related, ...rest } = content
  return rest as TarotMeaningPage
}

/** 文字按 React 的转义规则输出，用于在渲染结果中查找 */
const markup = (text: string) => renderToStaticMarkup(<i>{text}</i>).slice(3, -4)
const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
const links = (html: string) => [...html.matchAll(LINK)].map((match) => `${match[1]} ${match[2]}`)

describe('牌义页组件段逐牌文案（content-growth-phase1 2.1）', () => {
  it('有字段时：导语显示 lede，抽一张与延伸牌义显示逐牌说明，meta description 不上页面', () => {
    const base = withoutCopy(page('en', 'major-19'))
    const html = render({
      ...base,
      lede: 'A child on a white horse rides under a blazing sun.',
      try_prompt: 'Carry one thing you would gladly share in the open.',
      related_note: 'Strength pairs with this card; Judgement and The World follow.',
    })
    expect(html).toContain(markup('A child on a white horse rides under a blazing sun.'))
    expect(html).toContain(markup('Carry one thing you would gladly share in the open.'))
    expect(html).toContain(markup('Strength pairs with this card; Judgement and The World follow.'))
    expect(html).not.toContain(markup(base.description))
    expect(html).not.toContain(markup(m.tarot_meaning_try_intro()))
    expect(html).not.toContain(markup(m.tarot_related_intro_major({ name: 'The Sun' })))
    // 标题、按钮与链接不变
    expect(html).toContain(markup(m.tarot_meaning_try()))
    expect(html).toContain(markup(m.tarot_meaning_draw()))
    expect(links(html)).toEqual(links(render(base)))
  })

  it('缺字段时：沿用 description 与 messages 通用句（小牌用 minor 句式）', () => {
    const base = withoutCopy(page('en', 'cups-05'))
    const html = render(base)
    expect(html).toContain(markup(base.description))
    expect(html).toContain(markup(m.tarot_meaning_try_intro()))
    expect(html).toContain(markup(m.tarot_related_intro_minor({ name: 'Five of Cups' })))
  })

  it('东方站与 ja 牌义页没有逐牌字段，输出与去掉字段后的渲染逐字相同', () => {
    for (const locale of ['zh-Hans', 'zh-Hant', 'ko', 'ja']) {
      for (const cardId of ['major-00', 'wands-11', 'pentacles-14']) {
        const entry = page(locale, cardId)
        expect(entry.lede, `${locale}/${cardId}`).toBeUndefined()
        expect(entry.try_prompt).toBeUndefined()
        expect(entry.related_note).toBeUndefined()
        const html = render(entry)
        expect(html).toBe(render(withoutCopy(entry)))
        expect(html).toContain(markup(entry.description))
        expect(html).toContain(markup(m.tarot_meaning_try_intro()))
      }
    }
  })

  it('en、es 78 张牌都有三段逐牌文案，字数在决策 2、3 的区间内，且不含链接与 Markdown', () => {
    const count = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)?.length ?? 0
    const ranges = {
      en: { lede: [45, 70], try_prompt: [30, 50], related_note: [30, 60] },
      es: { lede: [55, 75], try_prompt: [30, 55], related_note: [30, 65] },
    } as const
    for (const locale of ['en', 'es'] as const) {
      const pages = content.filter((entry) => entry.locale === locale)
      expect(pages).toHaveLength(78)
      for (const entry of pages)
        for (const [field, [min, max]] of Object.entries(ranges[locale])) {
          const text = entry[field as keyof typeof ranges.en]
          expect(text, `${locale}/${entry.cardId}.${field}`).toBeTypeOf('string')
          const words = count(text ?? '')
          expect(words, `${locale}/${entry.cardId}.${field}`).toBeGreaterThanOrEqual(min)
          expect(words, `${locale}/${entry.cardId}.${field}`).toBeLessThanOrEqual(max)
          expect(text, `${locale}/${entry.cardId}.${field}`).not.toMatch(/[[\]<>*]|\]\(|https?:/)
          expect(text).not.toMatch(/\bA\.?I\.?\b|\bIA\b/)
        }
    }
  })
})
