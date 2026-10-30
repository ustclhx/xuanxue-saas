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
  getLanguageSuggestion: vi.fn(),
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

  it('语言控件只列本站语言：西方站没有中文与韩语项，东方站另有指向 /en 的 English', () => {
    const west = render('west', <SiteHeader />)
    expect(languageItems(west)).not.toContain('zh-Hant')
    expect(languageItems(west)).not.toContain('ko')
    expect(west).not.toContain('繁體中文')
    state.locale = 'zh-Hant'
    state.pathname = '/'
    const east = render('east', <SiteHeader />)
    expect(languageItems(east)).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'en'])
    expect(east).toContain('href="/en"')
    expect(hrefs(east).some((href) => href.includes('arcanumber'))).toBe(false)
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

  it('当前语言没有已发布文章时不显示博客入口，有文章后恢复', () => {
    expect(hrefs(render('west', <SiteHeader />))).not.toContain('/blog')
    expect(hrefs(render('west', <SiteFooter />))).not.toContain('/blog')
    // 其他语言的文章不算
    state.blogLocales = ['zh-Hant']
    expect(hrefs(render('west', <SiteHeader />))).not.toContain('/blog')
    state.blogLocales = ['en']
    expect(hrefs(render('west', <SiteHeader />))).toContain('/blog')
    expect(hrefs(render('west', <SiteFooter />))).toContain('/blog')
  })
})
