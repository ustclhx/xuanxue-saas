import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { assertSeoPages, validateSeoPages } from './linking.ts'
import type { SeoPage } from './metadata.ts'
import { isFallbackPage, localizedPath, sameSiteLocales } from './metadata.ts'
import { publicPages } from './pages.ts'

const en = templateConfig.i18n.defaultLocale
// 另一种语言取项目配置中的非默认语言（衍生项目不一定有 zh，默认语言也不一定是 en）
const other = templateConfig.i18n.locales.find((locale) => locale !== en) ?? `${en}-x`
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

  it('东方站语言回退显示的英文文章是跨站回退：声明 sourceLocale，但不按回退页处理，canonical 与站点地图保持原样（D5，模板 0.7.4 seo.linking.sites）', () => {
    const own = {
      slug: 'own',
      locale: 'zh-Hant',
      title: '自己的文章',
      summary: '摘要',
      date: '2026-01-01',
      tags: [],
      draft: false,
    }
    // 模板 0.8.0 默认 'hide'：东方站语言不再列出英文文章；'fallback' 下才有跨站回退条目
    const hidden = publicPages(
      { ...content, posts: [...content.posts, own] },
      new Date('2026-10-01'),
      config,
    )
    expect(hidden.find((page) => page.locale === 'zh-Hant' && page.path === '/blog/hello')).toBe(
      undefined,
    )
    const list = publicPages(
      { ...content, posts: [...content.posts, own] },
      new Date('2026-10-01'),
      { ...config, i18n: { ...config.i18n, untranslated: 'fallback' } },
    )
    const at = (locale: string, path: string) =>
      list.find((page) => page.locale === locale && page.path === path)
    expect(at('zh-Hant', '/blog/own')?.sourceLocale).toBe('zh-Hant')
    expect(at('zh-Hant', '/blog/hello')).toMatchObject({ parent: '/blog', titleMain: 'Hello' })
    expect(at('zh-Hant', '/blog/hello')?.sourceLocale).toBe('en')
    expect(isFallbackPage(at('zh-Hant', '/blog/hello') ?? { locale: 'zh-Hant' })).toBe(false)
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
      { ...page('/a'), locale: other },
      { ...home, locale: other },
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

  it('回退页与不可索引页不检查自身声明，地址按语言加前缀', ({ skip }) => {
    // 跨站同文页会各自索引，只有同站的两种语言才能构造回退页。先按模板取与默认语言同站的语言；
    // 本项目 en 独占西方站（seo.linking.sites），退而取东方站内有同站语言的一种，原语言取其同站语言。
    const { locales } = templateConfig.i18n
    const sameSite = (locale: string) =>
      locales.find((source) => source !== locale && sameSiteLocales(source, locale))
    const candidates = templateConfig.i18n.enabled ? locales.filter((locale) => locale !== en) : []
    const locale =
      candidates.find((locale) => sameSiteLocales(locale, en)) ??
      candidates.find((locale) => sameSite(locale) !== undefined)
    if (!locale) return skip()
    const sameSiteSource = sameSiteLocales(locale, en) ? en : sameSite(locale)

    const translated = (path: string, fields: Partial<SeoPage> = {}) => ({
      ...page(path, fields),
      locale,
    })
    const pages = [
      translated('/'),
      // 回退页的原语言须与页面语言同站（seo.linking.sites）
      translated('/fallback', { sourceLocale: sameSiteSource, parent: '/missing' }),
      translated('/private', { indexable: false, parent: undefined }),
      translated('/broken', { parent: '/missing' }),
    ]
    const broken = expect.stringContaining(
      `${localizedPath('/broken', locale)}: parent 指向不存在的页面 ${localizedPath('/missing', locale)}（`,
    )
    expect(validateSeoPages(pages, { untranslated: 'fallback' }).errors).toEqual([broken])
    // 'hide'（默认）下回退页不发布：清单中出现回退页即构建失败
    expect(validateSeoPages(pages, { untranslated: 'hide' }).errors).toEqual([
      broken,
      expect.stringContaining(`${localizedPath('/fallback', locale)}: 缺少译文的回退页`),
    ])
  })

  it('同一语言主词重复只警告并列出两页', () => {
    const report = validateSeoPages([
      home,
      page('/a', { titleMain: 'Tarot' }),
      page('/b', { titleMain: 'Tarot' }),
      { ...page('/c', { titleMain: 'Tarot' }), locale: other },
      { ...home, locale: other },
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

// 本地化 slug（openspec multilingual-seo 3.2）：英文 /four-pillars 与韩语 /만세력 互为语言版本
describe.runIf(templateConfig.i18n.enabled)('alternates 静态校验', () => {
  const options = { locales: [en, 'ko'], untranslated: 'hide' as const }
  const ko = (path: string, fields: Partial<SeoPage> = {}) => ({
    ...page(path, fields),
    locale: 'ko',
  })
  const pillars = page('/four-pillars', { alternates: { ko: '/만세력' } })
  const manse = ko('/만세력', { alternates: { [en]: '/four-pillars' } })
  const base = [home, ko('/')]

  it('双向声明且语言合法时通过', () => {
    expect(validateSeoPages([...base, pillars, manse], options).errors).toEqual([])
    // alternates 可以包含自身（与本页地址一致）
    const withSelf = { ...pillars, alternates: { [en]: '/four-pillars', ko: '/만세력' } }
    expect(validateSeoPages([...base, withSelf, manse], options).errors).toEqual([])
  })

  it('键不是已配置语言、目标缺失、未反向声明或组不一致时失败', () => {
    const unknown = page('/a', { alternates: { fr: '/a-fr' } })
    expect(validateSeoPages([...base, unknown], options).errors).toEqual([
      '/a: alternates 的键 fr 不是已配置的语言（i18n.locales）',
    ])
    expect(validateSeoPages([...base, pillars], options).errors).toEqual([
      `/four-pillars: alternates.ko 指向不存在的页面 ${localizedPath('/만세력', 'ko')}`,
    ])
    expect(validateSeoPages([...base, pillars, ko('/만세력')], options).errors).toEqual([
      `/four-pillars: alternates.ko 指向的 ${localizedPath('/만세력', 'ko')} 没有反向声明 ${en}=/four-pillars`,
    ])
    const noindex = ko('/만세력', { alternates: { [en]: '/four-pillars' }, indexable: false })
    expect(validateSeoPages([...base, pillars, noindex], options).errors).toEqual([
      `/four-pillars: alternates.ko 指向不可索引的页面 ${localizedPath('/만세력', 'ko')}`,
    ])
    const self = page('/b', { alternates: { [en]: '/c' } })
    expect(validateSeoPages([...base, self], options).errors).toEqual([
      `/b: alternates.${en} 必须是本页地址 /b`,
    ])
  })

  it('各成员声明的语言版本组不一致时失败', () => {
    const three = { ...options, locales: [en, 'ko', 'ja'] }
    const all = page('/four-pillars', { alternates: { ko: '/만세력', ja: '/shichu' } })
    const ja = {
      ...page('/shichu', { alternates: { [en]: '/four-pillars', ko: '/만세력' } }),
      locale: 'ja',
    }
    const errors = validateSeoPages(
      [...base, { ...home, locale: 'ja' }, all, manse, ja],
      three,
    ).errors
    expect(errors).toContainEqual(
      expect.stringContaining(
        `/four-pillars: 与 ${localizedPath('/만세력', 'ko')} 声明的语言版本不一致`,
      ),
    )
  })

  it('同路径的其他语言页面未声明 alternates 时失败（hreflang 无法互指）', () => {
    const errors = validateSeoPages([...base, pillars, manse, ko('/four-pillars')], options).errors
    expect(errors).toEqual([
      `${localizedPath('/four-pillars', 'ko')}: 同路径的 /four-pillars 声明了 alternates，本页也需声明`,
    ])
  })
})
