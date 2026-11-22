import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../../marketing/prerender.ts'
import { llmsTxt, sitemap } from '../../seo/crawlers.ts'
import { pageHead } from '../../seo/metadata.ts'
import { pageLinks } from '../../seo/page-links.ts'
import { publicPages } from '../../seo/pages.ts'
import { TAROT_LOCALES, TAROT_SPREADS, tarotPath } from '../tarot/routes.ts'
import {
  LIFE_PATH_NUMBERS,
  lifePathPath,
  numerologyContentPath,
  numerologySeoPages,
} from './routes.ts'
import { faqItems, faqPageData } from './seo.ts'
import { numerologySlugPage } from './slug-route.ts'

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

// slug-route.ts 的 loader 引用 server function（content-collections 虚拟模块在单测中不可用），这里只测路径匹配
vi.mock('./content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))

describe('数字命理页 SEO（tasks.md 2.3）', () => {
  // 英文页面（西班牙语页面的路径与 hreflang 另见下方「西班牙语数字命理页」）
  const contentPages = content.filter(
    (page) => page.slug !== 'life-path-number' && page.locale === 'en',
  )

  it('12 个数字页 + 2 个枢纽页 + 入门页齐全，路径正确', () => {
    expect(contentPages.map((page) => numerologyContentPath(page.slug)).sort()).toEqual(
      [
        ...LIFE_PATH_NUMBERS.map(lifePathPath),
        '/soul-urge-number',
        '/destiny-number',
        '/numerology',
      ].sort(),
    )
    for (const page of contentPages)
      if (page.number !== null)
        expect(numerologyContentPath(page.slug)).toBe(lifePathPath(page.number))
  })

  it('15 页 Title、canonical 唯一，FAQ 非空且 FAQPage 与之一致', () => {
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
    expect(titles.size).toBe(15)
  })

  it('站点地图包含首页、Life Path 工具页、四个工具页与 15 个内容页，且都预渲染', () => {
    const pages = publicPages(
      { posts: [], legal: [], docs: [], toolPages: numerologySeoPages(content) },
      new Date(),
      templateConfig,
      'west',
    )
    const xml = sitemap(pages, origin)
    const paths = [
      '/',
      '/life-path-number',
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
    // Life Path 工具页的 Title 用长文 frontmatter（迁移前的首页 Title），不是导航名；首页为品牌标题
    expect(numerologyContentPath('life-path-number')).toBe('/life-path-number')
    expect(pages.find((page) => page.path === '/life-path-number')?.title).toBe(
      'Life Path Number Calculator: Free, With Every Step Shown',
    )
    expect(pages.find((page) => page.path === '/')?.title).toBe(
      'Numerology & Tarot Calculators, Free | Arcanumber',
    )
    // 东方站语言前缀下没有数字命理页
    expect(isPrerenderedPath('/ko/numerology-calculator', templateConfig.i18n.locales)).toBe(false)
  })

  it('西方站首页 hreflang 只含西方站的 en / es 与 x-default，东方站各语言首页不指向它', () => {
    const hreflangs = (locale: string) =>
      pageHead({ path: '/', title: 'Home', description: 'Home', locale }, origin).links.flatMap(
        (link) => (link.rel === 'alternate' && 'hrefLang' in link ? [link.hrefLang] : []),
      )
    expect(hreflangs('en')).toEqual(['en', 'es', 'x-default'])
    // 东方站首页的 en 是东方站自己的英文首页 `/`（使用者 2026-11-20），不是西方站首页
    for (const locale of ['zh-Hant', 'ko', 'ja']) {
      const head = pageHead({ path: '/', title: 'Home', description: 'Home', locale }, origin)
      expect(JSON.stringify(head.links)).not.toContain('arcanumber.com')
      expect(head.links).toContainEqual({
        rel: 'alternate',
        hrefLang: 'en',
        href: 'https://ganjiday.com/',
      })
    }
  })

  it('两站各自登记的塔罗页只与同站语言互指（D5，同路径排除规则只作用于未登记的页面）', () => {
    for (const spread of TAROT_SPREADS)
      for (const locale of TAROT_LOCALES) {
        const links = pageHead(
          { path: tarotPath(spread, locale), title: 'T', description: 'T', locale },
          origin,
        ).links.flatMap((link) =>
          link.rel === 'alternate' && 'hrefLang' in link ? [[link.hrefLang, link.href]] : [],
        )
        const en = `https://arcanumber.com${tarotPath(spread, 'en')}`
        // 东方站英文牌阵页（2026-11-21 发布）：东方站页面的 en 与 x-default 指向它，不指向西方站
        const eastEn = new URL(`https://ganjiday.com${tarotPath(spread, 'en', 'east')}`).href
        expect(Object.fromEntries(links), `${spread} ${locale}`).toEqual(
          locale === 'en' || locale === 'es'
            ? // 西方站：en 与 es 互指，x-default 为英文版本
              {
                en,
                es: new URL(`https://arcanumber.com/es${tarotPath(spread, 'es')}`).href,
                'x-default': en,
              }
            : {
                'zh-Hant': new URL(`https://ganjiday.com/zh-hant${tarotPath(spread, 'zh-Hant')}`)
                  .href,
                'zh-Hans': new URL(`https://ganjiday.com/zh-hans${tarotPath(spread, 'zh-Hans')}`)
                  .href,
                ko: new URL(`https://ganjiday.com/ko${tarotPath(spread, 'ko')}`).href,
                ja: new URL(`https://ganjiday.com/ja${tarotPath(spread, 'ja')}`).href,
                en: eastEn,
                // x-default 为同一牌阵的东方站英文版本，不是会跳转的根路径
                'x-default': eastEn,
              },
        )
      }
  })
})

describe('数字命理入门页（content-growth-phase1 决策 7）', () => {
  const west = publicPages(
    { posts: [], legal: [], docs: [], toolPages: numerologySeoPages(content) },
    new Date(),
    templateConfig,
    'west',
  )
  const related = {
    en: [
      '/life-path-number',
      '/numerology-calculator',
      '/name-numerology',
      '/numerology-chart',
      '/life-path-compatibility',
      '/destiny-number',
      '/soul-urge-number',
    ],
    es: [
      '/numero-de-vida',
      '/calculadora-numerologia',
      '/numerologia-del-nombre',
      '/carta-numerologica',
      '/compatibilidad-numerologica',
      '/numero-del-destino',
      '/numero-del-alma',
    ],
  }

  it('两种语言经 /$slug 承接：英语只放开入门页，其他英文页面仍走各自的路由文件', () => {
    expect(numerologySlugPage('en', 'numerology')).toEqual({ locale: 'en', id: 'numerology' })
    expect(numerologySlugPage('es', 'numerologia')).toEqual({ locale: 'es', id: 'numerology' })
    expect(numerologySlugPage('en', 'destiny-number')).toBeUndefined()
    expect(numerologySlugPage('en', 'numerologia')).toBeUndefined()
    expect(numerologySlugPage('es', 'numerology')).toBeUndefined()
    expect(numerologySlugPage('ko', 'numerology')).toBeUndefined()
  })

  it('进入站点地图与预渲染，互为 hreflang，canonical 自指，父页为首页，主词登记且不进页头导航', () => {
    const xml = sitemap(west, origin)
    for (const [locale, path, url] of [
      ['en', '/numerology', `${origin}/numerology`],
      ['es', '/numerologia', `${origin}/es/numerologia`],
    ] as const) {
      expect(xml).toContain(`<loc>${url}</loc>`)
      const page = west.find((entry) => entry.locale === locale && entry.path === path)
      expect(page?.parent).toBe('/')
      expect(page?.titleMain).toBe(locale === 'en' ? 'What is numerology' : 'Qué es la numerología')
      expect(page?.title).toBe(
        locale === 'en'
          ? "What Is Numerology? A Beginner's Guide"
          : 'Qué es la numerología: guía para empezar',
      )
      const head = pageHead({ path, title: 'T', description: 'D', locale }, origin)
      expect(head.links.find((link) => link.rel === 'canonical')?.href).toBe(url)
      const alternates = Object.fromEntries(
        head.links.flatMap((link) =>
          link.rel === 'alternate' && 'hrefLang' in link ? [[link.hrefLang, link.href]] : [],
        ),
      )
      expect(alternates).toEqual({
        en: `${origin}/numerology`,
        es: `${origin}/es/numerologia`,
        'x-default': `${origin}/numerology`,
      })
    }
    const entries = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    expect(entries).toContain('/numerology')
    expect(entries).toContain('/es/numerologia')
    const llms = llmsTxt('west') ?? ''
    expect(llms).toContain(`[What is numerology](${origin}/numerology)`)
    expect(llms).toContain(`[Qué es la numerología](${origin}/es/numerologia)`)
  })

  it('相关区块列出 7 个计算器页，锚文本为各页 titleMain，说明为各页 description', () => {
    for (const locale of ['en', 'es'] as const) {
      const path = locale === 'en' ? '/numerology' : '/numerologia'
      const links = pageLinks(west, path, locale, templateConfig.seo.linking)
      expect(links.related.map((link) => link.href)).toEqual(related[locale])
      for (const link of links.related) {
        const target = west.find((page) => page.locale === locale && page.path === link.href)
        expect(link.label).toBe(target?.titleMain)
        expect(link.description).toBe(target?.description)
        expect(link.description.length).toBeGreaterThan(0)
      }
      expect(links.breadcrumb.map((crumb) => crumb.href)).toEqual(['/'])
    }
  })
})
