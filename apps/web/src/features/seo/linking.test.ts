import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { assertSeoPages, validateSeoPages } from './linking.ts'
import type { SeoPage } from './metadata.ts'
import { publicPages } from './pages.ts'

const en = templateConfig.i18n.defaultLocale
const page = (path: string, fields: Partial<SeoPage> = {}): SeoPage => ({
  path,
  locale: en,
  title: path,
  description: path,
  titleMain: path,
  ...(path !== '/' && { parent: '/' }),
  ...fields,
})
const home = page('/')

const content = {
  posts: [
    {
      slug: 'hello',
      locale: en,
      title: 'Hello',
      summary: 'Hello summary',
      date: '2026-01-01',
      tags: ['intro'],
      draft: false,
      anchor_short: 'Hi',
      related: ['/terms'],
    },
  ],
  // 本项目的法律页在根路径（/terms），按站点分开
  legal: [{ slug: 'terms', locale: en, title: 'Terms', description: 'Terms of service' }],
  docs: [],
  guides: [
    {
      slug: 'free',
      locale: en,
      title: 'Is it free?',
      answer_summary: 'Yes.',
      draft: false,
      parent: '/blog',
    },
  ],
}
const config = {
  ...templateConfig,
  marketing: { ...templateConfig.marketing, enabled: true },
  features: { ...templateConfig.features, blog: true, guides: true, docs: false },
}

describe('页面层级与主词声明（1.2–1.4）', () => {
  const pages = publicPages(content, new Date('2026-10-01'), config).filter(
    (page) => page.locale === en,
  )
  const find = (path: string) => pages.find((page) => page.path === path)

  it('静态页由 pages.project.ts 补上上级与主词，首页没有上级', () => {
    expect(find('/')).toMatchObject({ titleMain: 'Arcanumber', anchorShort: 'Home' })
    expect(find('/')?.parent).toBeUndefined()
    expect(find('/pricing')).toMatchObject({ parent: '/', titleMain: 'Pricing' })
    const zhHant = publicPages(content, new Date('2026-10-01'), config).filter(
      (page) => page.locale === 'zh-Hant',
    )
    expect(zhHant.find((page) => page.path === '/')).toMatchObject({ titleMain: '干支日' })
    expect(zhHant.find((page) => page.path === '/faq')).toMatchObject({
      parent: '/',
      titleMain: '常見問題',
    })
  })

  it('内容集合按目录推导默认 parent，主词取标题，frontmatter 可覆盖', () => {
    expect(find('/blog/hello')).toMatchObject({
      parent: '/blog',
      titleMain: 'Hello',
      anchorShort: 'Hi',
      related: ['/terms'],
      sourceLocale: en,
    })
    expect(find('/terms')).toMatchObject({ parent: '/', titleMain: 'Terms' })
    expect(find('/terms')?.related).toBeUndefined()
    // 答案页默认上级是 /guides，这里由 frontmatter 改为 /blog
    expect(find('/guides/free')).toMatchObject({ parent: '/blog', titleMain: 'Is it free?' })
    expect(find('/blog/tags/intro')).toMatchObject({ parent: '/blog', anchorShort: 'intro' })
  })

  it('东方站语言回退显示的英文文章是跨站回退：不声明 sourceLocale，canonical 与站点地图保持原样（D5）', () => {
    const own = {
      slug: 'own',
      locale: 'zh-Hant',
      title: '自己的文章',
      summary: '摘要',
      date: '2026-01-01',
      tags: [],
      draft: false,
    }
    const list = publicPages(
      { ...content, posts: [...content.posts, own] },
      new Date('2026-10-01'),
      config,
    )
    const at = (locale: string, path: string) =>
      list.find((page) => page.locale === locale && page.path === path)
    expect(at('zh-Hant', '/blog/own')?.sourceLocale).toBe('zh-Hant')
    expect(at('zh-Hant', '/blog/hello')).toMatchObject({ parent: '/blog', titleMain: 'Hello' })
    expect(at('zh-Hant', '/blog/hello')?.sourceLocale).toBeUndefined()
    expect(at('en', '/blog/hello')?.sourceLocale).toBe('en')
  })

  it('工具页、牌义页、数字页与概念页经 pages.project.ts 补上层级与主词，整体通过校验', () => {
    // 牌义页与数字页的标题来自内容集合（toolPages），这里各给一页
    const toolPages: SeoPage[] = [
      { path: '/tarot/cards/the-fool', locale: 'en', title: 'The Fool meaning', description: 'D' },
      { path: '/타로/카드/the-fool', locale: 'ko', title: '바보 카드', description: 'D' },
      { path: '/life-path-number/7', locale: 'en', title: 'Life Path 7 meaning', description: 'D' },
    ]
    // 按生产配置（答案页关闭）生成两站全部语言
    const all = publicPages({ ...content, toolPages }, new Date('2026-10-01'), {
      ...config,
      features: { ...config.features, guides: false },
    })
    expect(validateSeoPages(all).errors).toEqual([])
    const at = (locale: string, path: string) =>
      all.find((page) => page.locale === locale && page.path === path)
    expect(at('en', '/tarot/cards/the-fool')).toMatchObject({
      parent: '/tarot/cards',
      titleMain: 'The Fool',
    })
    expect(at('en', '/tarot/cards')).toMatchObject({
      parent: '/',
      titleMain: 'Tarot Card Meanings',
    })
    expect(at('en', '/life-path-number/7')).toMatchObject({
      parent: '/life-path-number',
      titleMain: 'Life Path 7',
    })
    expect(at('zh-Hant', '/八字/十神')).toMatchObject({ parent: '/八字排盤', titleMain: '十神' })
    expect(at('ko', '/타로/카드/the-fool')?.parent).toBe('/타로/카드')
  })
})

describe('元数据静态校验（1.5）', () => {
  it('同一语言地址重复时失败；不同语言同一 path 不算重复', () => {
    const { errors } = validateSeoPages([
      home,
      page('/a'),
      page('/a', { title: 'Again' }),
      { ...page('/a'), locale: 'zh' },
      { ...home, locale: 'zh' },
    ])
    expect(errors).toEqual([expect.stringMatching(/^\/a: 同一语言中地址重复/)])
  })

  it('缺少 parent 或 titleMain 时失败并给出页面地址', () => {
    const { errors } = validateSeoPages([
      home,
      { ...page('/tarot/the-fool'), parent: undefined },
      page('/b', { titleMain: ' ' }),
    ])
    expect(errors).toEqual([
      expect.stringMatching(/^\/tarot\/the-fool: 缺少 parent/),
      '/b: 缺少 titleMain（主词）',
    ])
  })

  it('parent、group、related 指向不存在的页面时失败，指出页面与目标地址', () => {
    const { errors } = validateSeoPages([
      home,
      page('/tarot/the-fool', {
        parent: '/tarot',
        group: '/tarot/major',
        related: ['/numbers/1'],
      }),
    ])
    expect(errors).toEqual([
      expect.stringMatching(/^\/tarot\/the-fool: parent 指向不存在的页面 \/tarot/),
      expect.stringMatching(/^\/tarot\/the-fool: group 指向不存在的页面 \/tarot\/major/),
      expect.stringMatching(/^\/tarot\/the-fool: related 指向不存在的页面 \/numbers\/1/),
    ])
  })

  it('目标存在但不可索引时失败', () => {
    const { errors } = validateSeoPages([
      home,
      page('/hidden', { indexable: false, parent: undefined, titleMain: undefined }),
      page('/a', { related: ['/hidden'] }),
      page('/b', { parent: '/hidden' }),
      page('/c', { group: '/hidden' }),
    ])
    expect(errors).toEqual([
      '/a: related 指向不可索引的页面 /hidden',
      '/b: parent 指向不可索引的页面 /hidden',
      '/c: group 指向不可索引的页面 /hidden',
    ])
  })

  it('parent 指向自身、成环与首页声明 parent 时失败', () => {
    const { errors } = validateSeoPages([
      { ...home, parent: '/x' },
      page('/self', { parent: '/self' }),
      page('/x', { parent: '/y' }),
      page('/y', { parent: '/x' }),
    ])
    expect(errors).toEqual([
      '/: 首页不能声明 parent',
      '/self: parent 不能指向自身',
      '/x: parent 链成环',
      '/y: parent 链成环',
    ])
  })

  it('回退页与不可索引页不检查自身声明，地址按语言加前缀', () => {
    const zh = (path: string, fields: Partial<SeoPage> = {}) => ({
      ...page(path, fields),
      locale: 'zh',
    })
    const report = validateSeoPages([
      zh('/'),
      zh('/fallback', { sourceLocale: en, parent: '/missing' }),
      zh('/private', { indexable: false, parent: undefined }),
      zh('/broken', { parent: '/missing' }),
    ])
    expect(report.errors).toEqual([
      expect.stringMatching(/^\/zh\/broken: parent 指向不存在的页面 \/zh\/missing/),
    ])
  })

  it('同一语言主词重复只警告并列出两页', () => {
    const report = validateSeoPages([
      home,
      page('/a', { titleMain: 'Tarot' }),
      page('/b', { titleMain: 'Tarot' }),
      { ...page('/c', { titleMain: 'Tarot' }), locale: 'zh' },
      { ...home, locale: 'zh' },
    ])
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([`主词「Tarot」在 ${en} 中重复：/a、/b`])
    const warn = vi.fn()
    expect(() => assertSeoPages([home, page('/a', { titleMain: '/' })], warn)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[seo] 主词「/」'))
    expect(() => assertSeoPages([home, page('/a', { parent: '/nope' })], warn)).toThrow(
      /公开页面元数据校验失败（1 项）：\n\/a: parent 指向不存在的页面 \/nope/,
    )
  })
})
