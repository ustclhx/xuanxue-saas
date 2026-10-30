import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})

import { Route } from '../../routes/faq.tsx'
import { ToolFaq } from '../tools/faq.tsx'
import { faqSections } from './faq.ts'

const matches = [{ routeId: '__root__', loaderData: { appUrl: 'https://seo.example' } }]

async function headFor(locale: 'en' | 'zh-Hant' | 'zh-Hans' | 'ko') {
  runtime.locale = locale
  const head = Route.options.head
  if (!head) throw new Error('FAQ head is missing')
  const result = await head({ matches } as unknown as Parameters<typeof head>[0])
  if (!result) throw new Error('FAQ head is empty')
  return result
}

describe('FAQ 汇总页（4.7）', () => {
  it.each([
    ['zh-Hant', 'https://ganjiday.com/zh-hant/faq', '積分'],
    ['zh-Hans', 'https://ganjiday.com/zh-hans/faq', '积分'],
    ['ko', 'https://ganjiday.com/ko/faq', '크레딧'],
    ['en', 'https://arcanumber.com/faq', 'credits'],
  ] as const)('%s 输出本站 canonical、唯一标题与 FAQPage 结构化数据', async (locale, url, word) => {
    const head = await headFor(locale)
    expect(head.links).toContainEqual({ rel: 'canonical', href: url })
    const title = head.meta?.find((meta) => meta && 'title' in meta)?.title
    expect(title).toContain(word)
    const scripts = (head.scripts ?? []).map((script) => JSON.parse(String(script?.children)))
    const faq = scripts.find((data) => data['@type'] === 'FAQPage')
    const items = faqSections(locale).flatMap((section) => section.items)
    // 结构化数据与页面可见问答来自同一份数据
    expect(
      faq.mainEntity.map((q: { name: string; acceptedAnswer: { text: string } }) => [
        q.name,
        q.acceptedAnswer.text,
      ]),
    ).toEqual(items.map((item) => [item.question, item.answer]))
    const html = renderToString(
      faqSections(locale).map((section) => (
        <ToolFaq key={section.title} title={section.title} items={section.items} />
      )),
    )
    for (const item of items) expect(html).toContain(item.question)
  })

  it('汇集积分、退款、失败退回、隐私与计算方式，东方站不出现灵数问答', () => {
    const zh = faqSections('zh-Hant').flatMap((section) => section.items)
    const text = zh.map((item) => `${item.question}${item.answer}`).join('\n')
    for (const word of ['積分', '退款', '退回積分', '瀏覽器', '紫微']) expect(text).toContain(word)
    expect(text).not.toMatch(/numerology|靈數/i)
    const en = faqSections('en')
      .flatMap((section) => section.items)
      .map((item) => `${item.question}${item.answer}`)
      .join('\n')
    for (const word of ['refund', 'credits', 'browser', 'life path'])
      expect(en).toMatch(new RegExp(word, 'i'))
    expect(en).not.toMatch(/八字|BaZi/)
  })
})
