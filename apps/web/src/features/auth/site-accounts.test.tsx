import type { SiteId } from '@xuanxue/config'
import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { baseLocale, type Locale, overwriteGetLocale } from '../../paraglide/runtime.js'
import { SiteContext } from '../site/context.tsx'
import { authErrorMessage } from './errors.ts'
import type { AuthUiOptions } from './options.ts'
import { SignInFailure } from './site-accounts.tsx'

const state = vi.hoisted(() => ({
  options: {
    emailPassword: true,
    emailOtp: true,
    magicLink: false,
    oauth: ['google'],
    turnstileSiteKey: null,
  } as AuthUiOptions,
  search: {} as { error?: string },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => state.options,
    useSearch: () => state.search,
  }),
  Link: ({ children }: { children: ReactNode }) => <a href="/login">{children}</a>,
}))
vi.mock('./options.functions.ts', () => ({ getAuthUiOptions: vi.fn() }))

const { Route: RegisterRoute } = await import('../../routes/(auth)/register.tsx')

beforeEach(() => {
  state.options = {
    emailPassword: true,
    emailOtp: true,
    magicLink: false,
    oauth: ['google'],
    turnstileSiteKey: null,
  }
  state.search = {}
})

afterEach(() => overwriteGetLocale(() => baseLocale))

function render(node: ReactNode, site: SiteId, locale: Locale) {
  overwriteGetLocale(() => locale)
  return renderToString(<SiteContext.Provider value={site}>{node}</SiteContext.Provider>)
}

// 每种语言只属于一个站点：en 为西方站，繁简中文与韩语为东方站
const cases = [
  ['en', 'west', 'Arcanumber', 'Ganjiday'],
  ['zh-Hant', 'east', '干支日', 'Arcanumber'],
  ['zh-Hans', 'east', '干支日', 'Arcanumber'],
  ['ko', 'east', '간지데이', 'Arcanumber'],
] as const

describe('两站账户分开的提示（split-site-accounts D3）', () => {
  it.each(cases)(
    '%s：密码错误与账户不存在的登录失败文案完全相同，并附提示',
    (locale, site, own, other) => {
      // Better Auth 两种情况都返回 INVALID_EMAIL_OR_PASSWORD；个别路径的 USER_NOT_FOUND / INVALID_PASSWORD 也归一
      const failure = (code: string) => {
        const error = { code, status: 401 }
        return render(
          <SignInFailure message={authErrorMessage(error)} failure={error} />,
          site,
          locale,
        )
      }
      const wrongPassword = failure('INVALID_EMAIL_OR_PASSWORD')
      const noAccount = failure('INVALID_EMAIL_OR_PASSWORD')
      expect(noAccount).toBe(wrongPassword)
      expect(failure('USER_NOT_FOUND')).toBe(wrongPassword)
      expect(failure('INVALID_PASSWORD')).toBe(wrongPassword)
      overwriteGetLocale(() => locale)
      const hint = m.auth_site_accounts_signin_hint({ site: own, otherSite: other })
      expect(wrongPassword).toContain(m.auth_error_invalid_email_or_password())
      expect(wrongPassword).toContain(hint)
      expect(hint).toContain(own)
      expect(hint).toContain(other)
    },
  )

  it('其他错误（如限流）只显示对应错误，不附提示', () => {
    const error = { code: 'RATE_LIMITED', status: 429 }
    const html = render(
      <SignInFailure message={authErrorMessage(error)} failure={error} />,
      'west',
      'en',
    )
    expect(html).toContain(m.auth_error_rate_limited())
    expect(html).not.toContain('role="note"')
  })

  it.each(cases)('%s：注册页显示两站账户分开的提示', (locale, site, own, other) => {
    const Component = RegisterRoute.options.component as ComponentType
    const html = render(<Component />, site, locale)
    overwriteGetLocale(() => locale)
    expect(html).toContain(m.auth_site_accounts_signup_hint({ site: own, otherSite: other }))
    expect(html).toContain(m.auth_continue_with_google())
    expect(html).toContain(m.auth_divider_email())
  })
})

describe('注册页可用认证入口', () => {
  function registerHtml() {
    const Component = RegisterRoute.options.component as ComponentType
    return render(<Component />, 'west', 'en')
  }

  it('未配置 OAuth 时只显示邮箱注册', () => {
    state.options = { ...state.options, oauth: [] }
    const html = registerHtml()
    expect(html).not.toContain(m.auth_continue_with_google())
    expect(html).not.toContain(m.auth_divider_email())
    expect(html).toContain('autoComplete="new-password"')
  })

  it('只启用 OAuth 时显示 Google 注册，不显示邮箱注册不可用提示', () => {
    state.options = { ...state.options, emailPassword: false }
    const html = registerHtml()
    expect(html).toContain(m.auth_continue_with_google())
    expect(html).not.toContain('autoComplete="new-password"')
    expect(html).not.toContain(m.auth_sign_up_with_email_and_password_is_not())
  })

  it('OAuth 失败回到注册页时显示本地化错误', () => {
    state.search = { error: 'SIGNUP_DISABLED' }
    expect(registerHtml()).toContain(m.auth_error_signup_disabled())
  })
})
