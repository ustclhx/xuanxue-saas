import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { AUTH_PAGE_PATHS, isAuthPagePath } from '../i18n/auth-locale.ts'
import { robots } from './crawlers.ts'
import { AUTH_ROBOTS, authPageHead } from './metadata.ts'

// openspec fix-seo-canonical-indexing（specs/seo「认证页不进索引」）：GSC 中的
// `/login?redirect=<公开页>` 变体应为 noindex，canonical 指向不带查询参数的同语言认证页。

const state = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => state.locale }
})

const locales = templateConfig.i18n.locales

describe('认证页 noindex 与 canonical', () => {
  it('响应头判定覆盖两站全部语言前缀的认证页，不误伤公开页面', () => {
    for (const path of AUTH_PAGE_PATHS) {
      expect(isAuthPagePath(path, locales), path).toBe(true)
      for (const segment of ['zh-hant', 'zh-hans', 'ko', 'en'])
        expect(isAuthPagePath(`/${segment}${path}`, locales), `/${segment}${path}`).toBe(true)
    }
    for (const path of [
      '/',
      '/pricing',
      '/zh-hant',
      '/zh-hant/pricing',
      '/tarot',
      '/life-path-number/22',
      '/loginx',
      '/app',
      '/blog',
    ])
      expect(isAuthPagePath(path, locales), path).toBe(false)
  })

  it('head 输出 noindex 与当前语言、不带查询参数的 canonical', () => {
    const cases = [
      ['/login', 'en', 'https://arcanumber.com/login'],
      ['/register', 'en', 'https://arcanumber.com/register'],
      ['/login', 'zh-Hant', 'https://ganjiday.com/zh-hant/login'],
      ['/register', 'ko', 'https://ganjiday.com/ko/register'],
      ['/forgot-password', 'zh-Hans', 'https://ganjiday.com/zh-hans/forgot-password'],
    ] as const
    for (const [path, locale, canonical] of cases) {
      const head = authPageHead(path, locale, 'Sign in')
      expect(head.meta).toContainEqual({ name: 'robots', content: AUTH_ROBOTS })
      expect(head.links).toEqual([{ rel: 'canonical', href: canonical }])
    }
    expect(AUTH_ROBOTS).toContain('noindex')
  })

  it('认证路由 head 使用该规则：登录页的 ?redirect= 变体声明同一个 canonical', async () => {
    const { Route: Login } = await import('../../routes/(auth)/login.tsx')
    const { Route: Register } = await import('../../routes/(auth)/register.tsx')
    const { Route: Forgot } = await import('../../routes/(auth)/forgot-password.tsx')
    const { Route: Reset } = await import('../../routes/(auth)/reset-password.tsx')
    const { Route: Verify } = await import('../../routes/(auth)/verify-email.tsx')
    const { Route: Invitation } = await import('../../routes/(auth)/accept-invitation.tsx')
    const routes = [
      [Login, '/login'],
      [Register, '/register'],
      [Forgot, '/forgot-password'],
      [Reset, '/reset-password'],
      [Verify, '/verify-email'],
      [Invitation, '/accept-invitation'],
    ] as const
    for (const [locale, origin] of [
      ['en', 'https://arcanumber.com'],
      ['ko', 'https://ganjiday.com/ko'],
    ] as const) {
      state.locale = locale
      for (const [route, path] of routes) {
        const head = await route.options.head?.({
          match: { search: { redirect: '/life-path-number/22' } },
        } as never)
        expect(head?.meta, path).toContainEqual({ name: 'robots', content: AUTH_ROBOTS })
        expect(head?.links, path).toEqual([{ rel: 'canonical', href: `${origin}${path}` }])
      }
    }
  })

  it('robots.txt 不禁止抓取认证页，爬虫才能读到 noindex', () => {
    const rules = robots('https://arcanumber.com')
    for (const path of AUTH_PAGE_PATHS)
      expect(rules).not.toMatch(new RegExp(`Disallow: [^\\n]*${path}`))
  })
})
