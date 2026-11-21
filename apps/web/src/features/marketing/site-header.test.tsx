import type { SiteId } from '@xuanxue/config'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withRelease } from '../i18n/rollout-fixture.ts'
import { SiteContext } from '../site/context.tsx'

const state = vi.hoisted(() => ({
  locale: 'en',
  pathname: '/',
  blogLocales: [] as string[],
  // 浏览器地址（含语言前缀）与本页 head 中的 hreflang；未设置时按没有 hreflang 的页面处理
  publicHref: undefined as string | undefined,
  links: [] as { rel: string; hrefLang: string; href: string }[],
}))

vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => state.locale }
})
// 路由器 Link 按当前语言加前缀（features/i18n/routing.ts 的 localeRewrite），这里按同样规则输出
vi.mock('@tanstack/react-router', async () => {
  const { localizeHref } = await import('../../paraglide/runtime.js')
  return {
    Link: ({ to, children, className }: { to: string; children: ReactNode; className: string }) => (
      <a href={localizeHref(to, { locale: state.locale as never })} className={className}>
        {children}
      </a>
    ),
    useLocation: ({
      select,
    }: {
      select: (location: { pathname: string; publicHref: string; searchStr: string }) => string
    }) =>
      select({
        pathname: state.pathname,
        publicHref: state.publicHref ?? state.pathname,
        searchStr: '',
      }),
    useRouterState: ({ select }: { select: (value: unknown) => unknown }) =>
      select({
        matches: [{ loaderData: { blogLocales: state.blogLocales }, links: state.links }],
      }),
  }
})
vi.mock('../i18n/preference.functions.ts', () => ({
  saveLanguagePreference: vi.fn(),
}))
vi.mock('../site/account-menu.tsx', () => ({ AccountMenu: () => null }))

const { SiteHeader } = await import('./site-header.tsx')
const { SiteFooter } = await import('./site-footer.tsx')

function render(site: SiteId, node: ReactNode) {
  return renderToString(<SiteContext value={site}>{node}</SiteContext>)
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? '')
/** 语言控件的各项：`<a href hreflang lang>`（多语言 SEO 规范 ML-08，不再有按钮） */
const languageLinks = (html: string) =>
  [
    ...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*hrefLang="([^"]+)"[^>]*lang="([^"]+)"[^>]*>/g),
  ].map(([tag, href, hrefLang, lang]) => ({
    href,
    hrefLang,
    lang,
    current: tag.includes('aria-current="page"'),
  }))
const languageItems = (html: string) => languageLinks(html).map((link) => link.lang)
/** 页头右上角的语言菜单（第一个含语言链接的 <details>；手机导航面板里的设置行在它之后） */
const headerLanguageMenu = (html: string) =>
  html
    .split('<details')
    .map((part) => part.split('</details>')[0] ?? '')
    .find((part) => part.includes('hrefLang=')) ?? ''
const alternate = (hrefLang: string, path: string) => ({
  rel: 'alternate',
  hrefLang,
  href: `https://ganjiday.com${path}`,
})

beforeEach(() => {
  state.locale = 'en'
  state.pathname = '/'
  state.blogLocales = []
  state.publicHref = undefined
  state.links = []
})

describe('页头按站点生成（openspec product-improve-ai-content-20261030 4.1、4.2、4.6）', () => {
  it('西方站 + 繁体偏好的应用区：只列西方站工具，所有链接留在西方站', () => {
    state.locale = 'zh-Hant'
    state.pathname = '/app/personal'
    const html = render('west', <SiteHeader />)
    const links = hrefs(html)
    expect(links).toContain('/tarot')
    expect(links).toContain('/pricing')
    expect(links).toContain('/')
    for (const href of links) {
      expect(href, href).not.toMatch(/^\/(zh-hant|zh-hans|ko)(\/|$)/)
      expect(href, href).not.toMatch(/^https?:/)
    }
    // 东方站工具名不出现
    expect(html).not.toContain('八字排盤')
  })

  it('东方站英文未发布时，英语偏好的应用区使用东方站默认语言（繁中）的工具', () => {
    state.locale = 'en'
    state.pathname = '/app/personal'
    const links = withRelease({ east: { en: 'pending' } }, () =>
      hrefs(render('east', <SiteHeader />)),
    )
    expect(links).toContain('/zh-hant')
    expect(links).toContain('/zh-hant/pricing')
    expect(links).not.toContain('/tarot')
    expect(links).not.toContain('/pricing')
  })

  it('东方站英文发布后（2026-11-21），英语应用区用东方站英文工具，不出现西方站工具', () => {
    state.locale = 'en'
    state.pathname = '/app/personal'
    const html = render('east', <SiteHeader />)
    const links = hrefs(html)
    expect(links).toContain('/bazi-calculator')
    expect(links).toContain('/pricing')
    expect(links).not.toContain('/zh-hant/pricing')
    expect(links).not.toContain('/tarot')
    expect(links).not.toContain('/life-path-number')
    expect(html).not.toContain('Arcanumber')
  })

  it('语言控件只列本站语言：西方站没有中文与韩语项，东方站另有指向英文首页 / 的 English', () => {
    const west = render('west', <SiteHeader />)
    expect(languageItems(west)).not.toContain('zh-Hant')
    expect(languageItems(west)).not.toContain('ko')
    expect(west).not.toContain('繁體中文')
    state.locale = 'zh-Hant'
    state.pathname = '/'
    const east = render('east', <SiteHeader />)
    expect(languageItems(headerLanguageMenu(east))).toEqual([
      'zh-Hant',
      'zh-Hans',
      'ko',
      'ja',
      'en',
    ])
    expect(headerLanguageMenu(east)).not.toContain('<button')
    // 使用者 2026-11-20：东方站英文首页对外地址为 `/`
    expect(east).toMatch(/<a[^>]*href="\/"[^>]*hrefLang="en"/)
    expect(hrefs(east).some((href) => href.includes('arcanumber'))).toBe(false)
  })

  it('语言菜单每一项是指向对应页面的链接：取本页 hreflang 的地址，没有对应页面的语言去该语言首页', () => {
    state.locale = 'zh-Hant'
    state.pathname = '/紫微斗數排盤'
    state.publicHref = encodeURI('/zh-hant/紫微斗數排盤')
    // 紫微斗数只有繁中与简中版本
    state.links = [
      alternate('zh-Hant', encodeURI('/zh-hant/紫微斗數排盤')),
      alternate('zh-Hans', encodeURI('/zh-hans/紫微斗数排盘')),
      alternate('x-default', encodeURI('/zh-hant/紫微斗數排盤')),
    ]
    const html = render('east', <SiteHeader />)
    expect(languageLinks(headerLanguageMenu(html))).toEqual([
      {
        href: encodeURI('/zh-hant/紫微斗數排盤'),
        hrefLang: 'zh-Hant',
        lang: 'zh-Hant',
        current: true,
      },
      {
        href: encodeURI('/zh-hans/紫微斗数排盘'),
        hrefLang: 'zh-Hans',
        lang: 'zh-Hans',
        current: false,
      },
      { href: '/ko', hrefLang: 'ko', lang: 'ko', current: false },
      { href: '/ja', hrefLang: 'ja', lang: 'ja', current: false },
      { href: '/', hrefLang: 'en', lang: 'en', current: false },
    ])
    // 页脚设置行同样是链接；东方站英文发布后（2026-11-21）English 是完整的本站语言，同样列出
    const footer = render('east', <SiteFooter />)
    expect(languageLinks(footer).map((link) => link.href)).toEqual([
      encodeURI('/zh-hant/紫微斗數排盤'),
      encodeURI('/zh-hans/紫微斗数排盘'),
      '/ko',
      '/ja',
      '/',
    ])
    // 发布前不列只有首页的 English
    const before = withRelease({ east: { en: 'pending', ja: 'pending' } }, () =>
      render('east', <SiteFooter />),
    )
    expect(languageLinks(before).map((link) => link.href)).toEqual([
      encodeURI('/zh-hant/紫微斗數排盤'),
      encodeURI('/zh-hans/紫微斗数排盘'),
      '/ko',
    ])
    expect(footer).not.toContain('role="combobox"')
  })

  it('应用区没有语言版本：各语言指向语言首页，当前语言指向当前页', () => {
    state.locale = 'ko'
    state.pathname = '/app/personal'
    const links = languageLinks(headerLanguageMenu(render('east', <SiteHeader />)))
    expect(links.map((link) => link.href)).toEqual([
      '/zh-hant',
      '/zh-hans',
      '/app/personal',
      '/ja',
      '/',
    ])
    expect(links.find((link) => link.current)?.lang).toBe('ko')
  })

  it('韩语页面的页头与页脚品牌名为「간지데이」，工具入口指向 /ko/만세력', () => {
    state.locale = 'ko'
    state.pathname = '/ko'
    const header = render('east', <SiteHeader />)
    expect(header).toContain('간지데이')
    expect(header).not.toContain('Ganjiday')
    expect(hrefs(header)).toContain(encodeURI('/ko/만세력'))
    const footer = render('east', <SiteFooter />)
    expect(footer).toContain('간지데이')
    expect(footer).not.toContain('Ganjiday')
  })

  it('东方站英文未发布时的英文入口页：页头不列工具，品牌回到 /en，页脚链接到繁中页面', () => {
    state.locale = 'en'
    state.pathname = '/en'
    const [header, footerHtml] = withRelease({ east: { en: 'pending' } }, () => [
      render('east', <SiteHeader />),
      render('east', <SiteFooter />),
    ])
    expect(header).not.toContain('八字排盤')
    expect(header).not.toContain('Life Path')
    const footer = hrefs(footerHtml ?? '')
    expect(footer).toContain('/zh-hant/privacy')
    expect(footer).not.toContain('/privacy')
  })

  it('博客入口只在页脚：当前语言没有已发布文章时不显示，有文章后恢复；页头不列博客', () => {
    expect(hrefs(render('west', <SiteFooter />))).not.toContain('/blog')
    // 其他语言的文章不算
    state.blogLocales = ['zh-Hant']
    expect(hrefs(render('west', <SiteFooter />))).not.toContain('/blog')
    state.blogLocales = ['en']
    expect(hrefs(render('west', <SiteFooter />))).toContain('/blog')
    expect(hrefs(render('west', <SiteHeader />))).not.toContain('/blog')
  })
})

describe('页头导航（refresh-visual-system-warm D7，site-visual-system「页头单行与链接不重复」）', () => {
  /** 桌面导航（md 及以上显示的 <nav>）里的一级项：工具下拉的 summary 与直接链接 */
  const desktopNav = (html: string) =>
    html.match(/<nav[^>]*class="hidden[^"]*md:flex[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? ''
  const topLevel = (nav: string) =>
    // 去掉下拉面板里的链接后，统计 summary 与剩余链接
    (
      nav.replace(/<details[\s\S]*?<\/details>/g, '<summary></summary>').match(/<summary|<a /g) ??
      []
    ).length

  it('东方站：工具下拉、每日運勢、定價三项导航，加语言与账户共不超过 5 项', () => {
    state.locale = 'zh-Hant'
    const html = render('east', <SiteHeader />)
    const nav = desktopNav(html)
    expect(topLevel(nav)).toBe(3)
    expect(nav).toContain('排盤工具')
    expect(nav).toContain('今日運勢')
    // 工具在下拉面板里，每日运势不进下拉
    const panel = nav.match(/<details[\s\S]*?<\/details>/)?.[0] ?? ''
    expect(panel).toContain('紫微斗數')
    expect(panel).not.toContain('今日運勢')
  })

  it('西方站：Tools、Number of the Day、Pricing 三项导航', () => {
    const nav = desktopNav(render('west', <SiteHeader />))
    expect(topLevel(nav)).toBe(3)
    expect(nav).toContain('Tools')
  })

  it('手机导航面板用 <details> 输出完整结构（不依赖水合），含工具、定价、主题切换与语言', () => {
    state.locale = 'zh-Hant'
    const html = render('east', <SiteHeader />)
    const panel = html.match(/<details[^>]*class="[^"]*md:hidden[\s\S]*?<\/details>/)?.[0] ?? ''
    expect(panel).toContain('aria-label="選單"')
    expect(panel).toContain('紫微斗數')
    expect(panel).toContain('/zh-hant/pricing')
    expect(panel).toContain('data-slot="theme-toggle"')
    // 语言下拉是 <details> 加链接，不依赖水合（不再是 Select）
    expect(html).not.toContain('role="combobox"')
    expect(html.slice(html.indexOf('md:hidden'))).toContain('hrefLang="ko"')
    // 西方站 es 已发布（2026-11-21）：页头与面板的语言下拉只列西方站的 en / es，仍有主题切换
    const west = render('west', <SiteHeader />)
    expect(west).toContain('data-slot="theme-toggle"')
    expect([...new Set(languageItems(west))]).toEqual(['en', 'es'])
    // 西方站只有一种已发布语言时不渲染语言下拉
    const single = withRelease({ west: { es: 'pending' } }, () => render('west', <SiteHeader />))
    expect(languageItems(single)).toEqual([])
  })
})

describe('页脚设置行', () => {
  it('两站页脚都带 data-site-footer 并在版权上方渲染主题切换，桌面与手机同样显示', () => {
    const east = render('east', <SiteFooter />)
    expect(east).toContain('data-site-footer')
    expect(east).toContain('data-slot="theme-toggle"')
    // 两站设置行都含语言下拉（链接），只列本站已发布语言
    expect(languageItems(east)).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'ja', 'en'])
    const west = render('west', <SiteFooter />)
    expect(west).toContain('data-site-footer')
    expect(west).toContain('data-slot="theme-toggle"')
    expect(languageItems(west)).toEqual(['en', 'es'])
    // 只有一种已发布语言时不渲染
    const single = withRelease({ west: { es: 'pending' } }, () => render('west', <SiteFooter />))
    expect(languageItems(single)).toEqual([])
    // 合规声明为 caption 小字，用批准的全文
    expect(west).toContain(
      'For reference and self-reflection only; it does not predict the future.',
    )
    // 设置行不再只在手机端显示（refresh-visual-system-warm D4）
    for (const html of [east, west])
      expect(html).not.toMatch(/md:hidden[^"]*"[^>]*>\s*<span[^>]*>[^<]*<\/span><fieldset/)
  })
})
