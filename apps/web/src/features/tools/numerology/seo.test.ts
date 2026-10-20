import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../../marketing/prerender.ts'
import { sitemap } from '../../seo/crawlers.ts'
import { pageHead } from '../../seo/metadata.ts'
import { publicPages } from '../../seo/pages.ts'
import { TAROT_LOCALES, TAROT_SPREADS, tarotPath } from '../tarot/routes.ts'
import {
  LIFE_PATH_NUMBERS,
  lifePathPath,
  numerologyContentPath,
  numerologySeoPages,
} from './routes.ts'
import { faqItems, faqPageData } from './seo.ts'

// content-collections 的生成数据（typecheck / dev / build 前生成，CI 中 typecheck 先于 test）
type Entry = {
  slug: string
  locale: string
  title: string
  description: string
  number: number | null
  faq: { q: string; a: string }[]
  html: string
}
const content: Entry[] = JSON.parse(
  readFileSync(
    new URL('../../../../.content-collections/generated/allNumerologies.js', import.meta.url),
    'utf8',
  )
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
)
const origin = 'https://arcanumber.com'

describe('数字命理页 SEO（tasks.md 2.3）', () => {
  const contentPages = content.filter((page) => page.slug !== 'life-path-number')

  it('12 个数字页 + 2 个枢纽页齐全，路径正确', () => {
    expect(contentPages.map((page) => numerologyContentPath(page.slug)).sort()).toEqual(
      [...LIFE_PATH_NUMBERS.map(lifePathPath), '/soul-urge-number', '/destiny-number'].sort(),
    )
    for (const page of contentPages)
      if (page.number !== null)
        expect(numerologyContentPath(page.slug)).toBe(lifePathPath(page.number))
  })

  it('14 页 Title、canonical 唯一，FAQ 非空且 FAQPage 与之一致', () => {
    const titles = new Set<string>()
    const canonicals = new Set<string>()
    for (const page of contentPages) {
      const path = numerologyContentPath(page.slug)
      const head = pageHead({ path, ...page }, origin, [faqPageData(faqItems(page.faq))])
      const title = head.meta.find((meta) => 'title' in meta)?.title
      const canonical = head.links.find((link) => link.rel === 'canonical')?.href
      expect(title && !titles.has(title), path).toBe(true)
      expect(canonical && !canonicals.has(canonical), path).toBe(true)
      titles.add(title ?? '')
      canonicals.add(canonical ?? '')
      expect(new URL(canonical ?? '').pathname).toBe(path)
      expect(page.faq.length, path).toBeGreaterThanOrEqual(3)
      const ld = JSON.parse(head.scripts[0]?.children ?? '{}')
      expect(ld['@type']).toBe('FAQPage')
      expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(page.faq.map((q) => q.q))
      // 正文已去掉 FAQ 与互链段，由页面组件统一渲染
      expect(page.html).not.toMatch(/<h2[^>]*>FAQ<\/h2>/)
    }
    expect(titles.size).toBe(14)
  })

  it('站点地图包含首页、四个工具页与 14 个内容页，且都预渲染', () => {
    const pages = publicPages(
      { posts: [], legal: [], docs: [], toolPages: numerologySeoPages(content) },
      new Date(),
      templateConfig,
      'west',
    )
    const xml = sitemap(pages, origin)
    const paths = [
      '/',
      '/numerology-calculator',
      '/numerology-chart',
      '/name-numerology',
      '/life-path-compatibility',
      ...contentPages.map((page) => numerologyContentPath(page.slug)),
    ]
    for (const path of paths) {
      expect(xml, path).toContain(`<loc>${origin}${path === '/' ? '/' : path}</loc>`)
      expect(isPrerenderedPath(path, templateConfig.i18n.locales), path).toBe(true)
    }
    const entries = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    for (const path of paths) expect(entries, path).toContain(path)
    // 首页 Title 用长文 frontmatter，不是导航名
    expect(pages.find((page) => page.path === '/')?.title).toMatch(/Life Path Number Calculator/)
    // 东方站语言前缀下没有数字命理页
    expect(isPrerenderedPath('/ko/numerology-calculator', templateConfig.i18n.locales)).toBe(false)
  })

  it('西方站首页 hreflang 只含 en 与 x-default，东方站各语言首页不再指向它', () => {
    const hreflangs = (locale: string) =>
      pageHead({ path: '/', title: 'Home', description: 'Home', locale }, origin).links.flatMap(
        (link) => (link.rel === 'alternate' && 'hrefLang' in link ? [link.hrefLang] : []),
      )
    expect(hreflangs('en')).toEqual(['en', 'x-default'])
    for (const locale of ['zh-Hant', 'ko']) expect(hreflangs(locale)).not.toContain('en')
  })

  it('跨站登记的塔罗页三语仍互指（同路径排除规则只作用于未登记的页面）', () => {
    for (const spread of TAROT_SPREADS)
      for (const locale of TAROT_LOCALES) {
        const links = pageHead(
          { path: tarotPath(spread, locale), title: 'T', description: 'T', locale },
          origin,
        ).links.flatMap((link) =>
          link.rel === 'alternate' && 'hrefLang' in link ? [[link.hrefLang, link.href]] : [],
        )
        expect(Object.fromEntries(links), `${spread} ${locale}`).toEqual({
          en: `https://arcanumber.com${tarotPath(spread, 'en')}`,
          'zh-Hant': new URL(`https://ganjiday.com/zh-hant${tarotPath(spread, 'zh-Hant')}`).href,
          ko: new URL(`https://ganjiday.com/ko${tarotPath(spread, 'ko')}`).href,
          'x-default': `https://arcanumber.com${tarotPath(spread, 'en')}`,
        })
      }
  })
})
