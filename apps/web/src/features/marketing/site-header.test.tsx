import type { SiteId } from '@xuanxue/config'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../site/context.tsx'

const state = vi.hoisted(() => ({
  locale: 'en',
  pathname: '/',
  blogLocales: [] as string[],
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
    useLocation: ({ select }: { select: (location: { pathname: string }) => string }) =>
      select({ pathname: state.pathname }),
    useRouterState: ({ select }: { select: (value: unknown) => unknown }) =>
      select({ matches: [{ loaderData: { blogLocales: state.blogLocales } }] }),
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
const languageItems = (html: string) =>
  [...html.matchAll(/<(?:button|a)[^>]*lang="([^"]+)"/g)].map((match) => match[1])

beforeEach(() => {
  state.locale = 'en'
  state.pathname = '/'
  state.blogLocales = []
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

  it('东方站 + 英语偏好的应用区：使用东方站默认语言（繁中）的工具', () => {
    state.locale = 'en'
    state.pathname = '/app/personal'
    const links = hrefs(render('east', <SiteHeader />))
    expect(links).toContain('/zh-hant')
    expect(links).toContain('/zh-hant/pricing')
    expect(links).not.toContain('/tarot')
    expect(links).not.toContain('/pricing')
  })

  it('语言控件只列本站语言：西方站没有中文与韩语项，东方站另有指向英文首页 / 的 English', () => {
    const west = render('west', <SiteHeader />)
    expect(languageItems(west)).not.toContain('zh-Hant')
    expect(languageItems(west)).not.toContain('ko')
    expect(west).not.toContain('繁體中文')
    state.locale = 'zh-Hant'
    state.pathname = '/'
    const east = render('east', <SiteHeader />)
    expect(languageItems(east)).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'en'])
    // 使用者 2026-11-20：东方站英文首页对外地址为 `/`
    expect(east).toMatch(/<a[^>]*href="\/"[^>]*hrefLang="en"/)
    expect(hrefs(east).some((href) => href.includes('arcanumber'))).toBe(false)
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

  it('东方站英文入口页：页头不列工具，品牌回到 /en，页脚链接到繁中页面', () => {
    state.locale = 'en'
    state.pathname = '/en'
    const header = render('east', <SiteHeader />)
    expect(header).not.toContain('八字排盤')
    expect(header).not.toContain('Life Path')
    const footer = hrefs(render('east', <SiteFooter />))
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
    expect(panel).toContain('role="combobox"')
    // 西方站只有一种语言：面板里没有语言下拉，仍有主题切换
    const west = render('west', <SiteHeader />)
    const westPanel = west.match(/<details[^>]*class="[^"]*md:hidden[\s\S]*?<\/details>/)?.[0] ?? ''
    expect(westPanel).toContain('data-slot="theme-toggle"')
    expect(westPanel).not.toContain('role="combobox"')
  })
})

describe('页脚设置行', () => {
  it('两站页脚都带 data-site-footer 并在版权上方渲染主题切换，桌面与手机同样显示', () => {
    const east = render('east', <SiteFooter />)
    expect(east).toContain('data-site-footer')
    expect(east).toContain('data-slot="theme-toggle"')
    // 东方站设置行含语言下拉；西方站只有一种语言，不渲染
    expect(east).toContain('role="combobox"')
    const west = render('west', <SiteFooter />)
    expect(west).toContain('data-site-footer')
    expect(west).toContain('data-slot="theme-toggle"')
    expect(west).not.toContain('role="combobox"')
    // 合规声明为 caption 小字，用批准的全文
    expect(west).toContain(
      'For reference and self-reflection only; it does not predict the future.',
    )
    // 设置行不再只在手机端显示（refresh-visual-system-warm D4）
    for (const html of [east, west])
      expect(html).not.toMatch(/md:hidden[^"]*"[^>]*>\s*<span[^>]*>[^<]*<\/span><fieldset/)
  })
})
