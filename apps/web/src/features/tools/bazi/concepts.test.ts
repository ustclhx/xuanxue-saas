import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../../marketing/prerender.ts'
import { publicPages } from '../../seo/pages.ts'
import { TOOL_ROUTES } from '../registry.ts'
import { type ConceptPage, conceptHead, conceptPageData, conceptPagePath } from './concepts.ts'

// typecheck / build-content 生成实际 MDX 集合，避免用手写 fixture 掩盖内容和注册表不同步。
const pages = JSON.parse(
  readFileSync(
    new URL('../../../../.content-collections/generated/allConcepts.js', import.meta.url),
    'utf8',
  )
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
) as ConceptPage[]

describe('八字与 사주概念页 SEO', () => {
  it('16 页正文、唯一标题、FAQ 与首页和概念内链均来自内容集合', () => {
    expect(pages).toHaveLength(16)
    expect(new Set(pages.map((page) => page.title)).size).toBe(16)
    for (const locale of ['zh-Hant', 'ko'])
      expect(pages.filter((page) => page.locale === locale)).toHaveLength(8)
    for (const page of pages) {
      expect(page.html.replace(/<[^>]*>/g, '').replace(/\s/g, '').length).toBeGreaterThanOrEqual(
        600,
      )
      expect(page.html).not.toContain('<h1')
      const data = conceptPageData(pages, page)
      const head = conceptHead(data, 'https://east.example')
      expect(head.meta.filter((meta) => 'title' in meta)).toHaveLength(1)
      const faq = JSON.parse(head.scripts[0]?.children ?? '')
      expect(faq['@type']).toBe('FAQPage')
      expect(
        faq.mainEntity.map((item: { name: string; acceptedAnswer: { text: string } }) => [
          item.name,
          item.acceptedAnswer.text,
        ]),
      ).toEqual(page.faq.map(({ q, a }) => [q, a]))
      expect(data.links).toHaveLength(7)
    }
  })

  it('按 conceptKey 互指译文，单语概念不伪造对应页；注册表、地图和预渲染覆盖全部页面', () => {
    const sitemapPages = publicPages({ posts: [], legal: [], docs: [] })
    const entries = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    for (const page of pages) {
      const data = conceptPageData(pages, page)
      const expected = pages.filter((other) => other.conceptKey === page.conceptKey)
      const alternates = conceptHead(data, 'https://east.example').links.filter(
        (link) => 'hrefLang' in link && link.hrefLang !== 'x-default',
      )
      expect(alternates).toHaveLength(expected.length)
      for (const other of expected) {
        const link = alternates.find(
          (entry) => 'hrefLang' in entry && entry.hrefLang === other.locale,
        )
        expect(decodeURI(new URL(link?.href ?? '').pathname)).toBe(
          `/${other.locale.toLowerCase()}${conceptPagePath(other)}`,
        )
        expect(conceptPageData(pages, other).alternates[page.locale]).toBe(data.path)
      }
      const registered = TOOL_ROUTES.find((route) => route.id === `bazi-concept-${page.conceptKey}`)
      expect(registered?.paths[page.locale]).toBe(data.path)
      expect(
        sitemapPages.some((entry) => entry.path === data.path && entry.locale === page.locale),
      ).toBe(true)
      const localized = `/${page.locale.toLowerCase()}${data.path}`
      expect(entries).toContain(localized)
      expect(isPrerenderedPath(localized, templateConfig.i18n.locales)).toBe(true)
    }
  })
})
