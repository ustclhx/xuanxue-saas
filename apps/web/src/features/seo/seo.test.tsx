import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { robots, sitemap, sitemapIndex } from './crawlers.ts'
import { alternateLinks, localizedPath, pageBrand, pageHead, privateMeta } from './metadata.ts'
import { OgCard } from './og-card.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'
import { publicPages } from './pages.ts'
import { articleData, organizationData, pricingData, websiteData } from './structured-data.ts'

const origin = 'https://seo.example'
const content = {
  posts: [
    {
      slug: 'published',
      locale: 'en',
      title: 'Published article',
      summary: 'A published summary',
      date: '2026-01-01',
      tags: ['guide'],
      draft: false,
    },
    {
      slug: 'published',
      locale: 'zh-Hant',
      title: '已發布文章',
      summary: '已發布摘要',
      date: '2026-01-01',
      tags: ['guide'],
      draft: false,
    },
    {
      slug: 'draft',
      locale: 'en',
      title: 'Draft',
      summary: 'Draft',
      date: '2026-01-01',
      tags: ['secret'],
      draft: true,
    },
    {
      slug: 'future',
      locale: 'en',
      title: 'Future',
      summary: 'Future',
      date: '2099-01-01',
      tags: ['future'],
      draft: false,
    },
  ],
  legal: [
    { slug: 'terms', locale: 'en', title: 'Terms', description: 'Terms of service' },
    { slug: 'terms', locale: 'zh-Hant', title: '服務條款', description: '服務使用條款' },
  ],
  docs: [
    { slug: 'guide', locale: 'en', title: 'Getting started', description: 'Setup guide' },
    { slug: 'guide', locale: 'zh-Hant', title: '入門指南', description: '設定說明' },
  ],
}
const config = {
  ...templateConfig,
  marketing: { ...templateConfig.marketing, enabled: true },
  features: {
    ...templateConfig.features,
    blog: true,
    docs: true,
    newsletter: true,
    waitlist: true,
  },
}
const pages = publicPages(content, new Date('2026-10-01'), config)
const locales = config.i18n.enabled ? config.i18n.locales : [config.i18n.defaultLocale]
const locale = locales.includes('en') ? 'en' : config.i18n.defaultLocale

describe('公开页面 SEO（4.1–4.3）', () => {
  it('每种语言的所有公开页面具有唯一标题、描述、canonical 和分享元数据', () => {
    const canonicals = new Set<string>()
    for (const locale of locales) {
      const titles = new Set<string>()
      for (const page of pages.filter((page) => page.locale === locale)) {
        const head = pageHead(page, origin)
        const title = head.meta.find((meta) => 'title' in meta)?.title
        const canonical = head.links.find((link) => link.rel === 'canonical')?.href
        expect(title).toBeTruthy()
        expect(titles.has(title ?? '')).toBe(false)
        expect(canonicals.has(canonical ?? '')).toBe(false)
        titles.add(title ?? '')
        canonicals.add(canonical ?? '')
        // 中文 / 韩文路径按 URL 规范百分号编码
        expect(canonical).toBe(
          new URL(`${localeOrigin(locale)}${localizedPath(page.path, locale)}`).href,
        )
        for (const key of [
          'description',
          'twitter:card',
          'twitter:title',
          'twitter:description',
          'twitter:image',
        ]) {
          expect(
            head.meta.find((meta) => 'name' in meta && meta.name === key)?.content,
          ).toBeTruthy()
        }
        for (const key of ['og:title', 'og:description', 'og:url', 'og:image']) {
          expect(
            head.meta.find((meta) => 'property' in meta && meta.property === key)?.content,
          ).toBeTruthy()
        }
        // 注册在 TOOL_ROUTES 的工具页（繁中首页同为 `/`）只与工具各语言版本互指，
        // 见 features/tools/bazi/bazi.test.tsx
        if (!page.alternates) {
          expect(head.links.filter((link) => link.rel === 'alternate')).toHaveLength(
            locales.length + 1,
          )
          expect(head.links).toContainEqual({
            rel: 'alternate',
            hrefLang: 'x-default',
            href: `${seoSiteOrigin('west')}${page.path}`,
          })
        }
      }
    }
  })

  it('私有路径禁止索引，公开页面保持可索引', () => {
    for (const path of ['/app', '/app/me/chat', '/account', '/admin', '/api/health']) {
      expect(privateMeta(path)).toContainEqual({ name: 'robots', content: 'noindex, nofollow' })
    }
    for (const path of ['/', '/pricing', '/blog/published', '/terms', '/docs/guide'])
      expect(privateMeta(path)).toEqual([])
  })

  it('地图包含已发布文章的全部语言，排除草稿、未来文章与关闭的功能', () => {
    const xml = sitemap(pages, origin)
    for (const locale of locales) {
      const prefix =
        !config.i18n.enabled || locale === config.i18n.defaultLocale ? '' : localePrefix(locale)
      expect(xml).toContain(`<loc>${localeOrigin(locale)}${prefix}/blog/published</loc>`)
    }
    for (const path of [
      '/app',
      '/admin',
      '/account',
      '/api',
      '/blog/draft',
      '/blog/future',
      '/blog/tags/secret',
    ])
      expect(xml).not.toContain(path)
    const disabled = publicPages(content, new Date('2026-10-01'), {
      ...config,
      features: {
        ...templateConfig.features,
        docs: false,
        blog: false,
        newsletter: false,
        waitlist: false,
      },
    })
    for (const prefix of ['/docs', '/blog', '/newsletter', '/waitlist'])
      expect(sitemap(disabled, origin)).not.toContain(prefix)
    expect(robots(origin)).toContain(`Sitemap: ${origin}/sitemap.xml`)
    for (const path of ['/app', '/admin', '/api'])
      expect(robots(origin)).toContain(`Disallow: ${path}`)
  })

  it('三类页面 JSON-LD 为合法 JSON 且具备类型所需字段，价格来自套餐目录', () => {
    const home = pages.find((page) => page.path === '/' && page.locale === locale)
    if (!home) throw new Error('Missing homepage')
    const article = pages.find((page) => page.path === '/blog/published' && page.locale === locale)
    if (!article) throw new Error('Missing article')
    const catalog = {
      plans: [
        {
          id: 'plan-1',
          key: 'pro',
          name: 'Pro',
          credits: 500,
          type: 'subscription' as const,
          creditExpiryDays: null,
          features: {
            models: [],
            maxConcurrentTasks: 1,
            maxSeats: 1,
            storageGb: 1,
            publicApi: false,
            priorityQueue: false,
            watermark: false,
          },
        },
      ],
      prices: [
        {
          id: 'price-1',
          planId: 'plan-1',
          provider: 'stripe' as const,
          interval: 'month' as const,
          amount: 2345,
          currency: 'usd',
          active: true,
          available: true,
        },
      ],
      providers: [],
    }
    const products = pricingData(catalog, origin, locale)
    const data = [
      organizationData(origin, 'Arcanumber'),
      websiteData(origin, 'Arcanumber'),
      articleData(article, origin),
      ...products,
    ]
    const head = pageHead(home, origin, data)
    const fields: Record<string, string[]> = {
      Organization: ['name', 'url'],
      WebSite: ['name', 'url'],
      BlogPosting: ['headline', 'datePublished', 'author', 'image', 'mainEntityOfPage'],
      Product: ['name', 'image', 'offers'],
    }
    for (const script of head.scripts) {
      const schema = JSON.parse(script.children)
      expect(schema['@context']).toBe('https://schema.org')
      expect(fields[schema['@type']]).toBeDefined()
      for (const field of fields[schema['@type']] ?? []) expect(schema[field], field).toBeTruthy()
    }
    expect(products[0]?.offers[0]).toMatchObject({
      '@type': 'Offer',
      price: '23.45',
      priceCurrency: 'USD',
      url: `${origin}${localizedPath('/pricing', locale)}`,
    })
    expect(articleData(article, origin).author.name).toBe(templateConfig.app.name)
    expect(
      pageHead(home, origin, [{ text: '</script><script>' }]).scripts[0]?.children,
    ).not.toContain('</script>')
  })
})

it('关闭营销时没有公开页面，单语言只生成默认语言页面', () => {
  expect(
    publicPages(content, new Date('2026-10-01'), {
      ...config,
      marketing: { ...config.marketing, enabled: false },
    }),
  ).toEqual([])
  const single = publicPages(content, new Date('2026-10-01'), {
    ...config,
    i18n: { ...config.i18n, enabled: false, defaultLocale: 'zh-Hant' },
  })
  expect(new Set(single.map((page) => page.locale))).toEqual(new Set(['zh-Hant']))
  // 繁中首页注册为八字排盤工具（TOOL_ROUTES）
  expect(single.find((page) => page.path === '/')).toMatchObject({
    locale: 'zh-Hant',
    title: '八字排盤',
  })
  expect(single.find((page) => page.path === '/blog/published')?.title).toBe('已發布文章')
  if (!templateConfig.i18n.enabled) {
    for (const locale of ['en', 'zh-Hant', 'fr']) {
      expect(localizedPath('/pricing/', locale)).toBe('/pricing')
      expect(localizedPath('/', locale)).toBe('/')
    }
  }
})

describe('分享图与缓存（4.4）', () => {
  it('无封面页面的卡片包含站点名称和页面标题', () => {
    const page = pages.find((page) => page.path === '/terms' && page.locale === locale)
    if (!page) throw new Error('Missing legal page')
    const markup = renderToStaticMarkup(
      <OgCard title={page.title} brand={pageBrand(page)} host="arcanumber.com" />,
    )
    expect(markup).toContain('Arcanumber')
    expect(markup).toContain('arcanumber.com')
    expect(markup).toContain(page.title)
  })
})

const bazi = {
  id: 'bazi',
  site: 'east' as const,
  paths: { 'zh-Hant': '/八字排盤/', ko: '/' },
  titles: { 'zh-Hant': '八字排盤', ko: '만세력' },
}

it('跨站定价 hreflang 使用 BCP 47 语言码与西方英语 x-default', () => {
  const links = alternateLinks(origin, '/pricing')
  expect(links).toContainEqual({
    rel: 'alternate',
    hrefLang: 'zh-Hant',
    href: 'https://ganjiday.com/zh-hant/pricing',
  })
  expect(links).toContainEqual({
    rel: 'alternate',
    hrefLang: 'ko',
    href: 'https://ganjiday.com/ko/pricing',
  })
  expect(links).toContainEqual({
    rel: 'alternate',
    hrefLang: 'x-default',
    href: 'https://arcanumber.com/pricing',
  })
})

it('异名工具路由互指；无英语版本时 x-default 指向本站入口', () => {
  const tools = publicPages(content, new Date('2026-10-01'), config, 'east', [bazi])
  const page = tools.find((p) => p.path === '/八字排盤/')
  if (!page) throw new Error('Missing tool page')
  const links = pageHead(page, origin).links
  expect(links).toContainEqual({
    rel: 'alternate',
    hrefLang: 'ko',
    href: 'https://ganjiday.com/ko',
  })
  expect(links).toContainEqual({
    rel: 'alternate',
    hrefLang: 'x-default',
    href: 'https://ganjiday.com/',
  })
  expect(links.some((link) => 'hrefLang' in link && link.hrefLang === 'en')).toBe(false)
  expect(tools.every((p) => p.locale !== 'en')).toBe(true)
  const xml = sitemap(tools, origin, 'zh-Hant')
  expect(xml).toContain('/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4')
  expect(xml).toContain('hreflang="ko" href="https://ganjiday.com/ko"')
  expect(xml).not.toContain('<loc>https://ganjiday.com/ko')
})

it('两站地图索引只列本站语言；未知 Host 与分享结果禁止抓取', () => {
  expect(sitemapIndex('east')).toContain('https://ganjiday.com/sitemap/zh-hant.xml')
  expect(sitemapIndex('east')).toContain('/sitemap/ko.xml')
  expect(sitemapIndex('east')).not.toContain('/sitemap/en.xml')
  expect(sitemapIndex('west')).not.toContain('/sitemap/ko.xml')
  expect(robots(origin)).toContain('Disallow: /*?r=')
  expect(robots(origin)).toContain('Disallow: /*&r=')
  expect(robots(origin, false)).toBe('User-agent: *\nDisallow: /\n')
})
