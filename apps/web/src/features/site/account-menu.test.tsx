import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// openspec fix-seo-canonical-indexing 3.2：公开页面的页头登录链接不随页面变化，
// 回跳地址只在点击时附加，避免每个公开页都生成一个可抓取的 `/login?redirect=…` 变体。
const state = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => state.locale }
})
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/app">{children}</a>,
}))
vi.mock('../workspace/viewer.functions.ts', () => ({ getViewerSpaces: vi.fn() }))

const { AccountMenu, loginWithReturn } = await import('./account-menu.tsx')

describe('页头登录入口', () => {
  it.each([
    ['en', '/login'],
    ['zh-Hant', '/zh-hant/login'],
    ['ko', '/ko/login'],
  ])('%s 页面渲染不带查询参数、带 nofollow 的登录链接', (locale, href) => {
    state.locale = locale
    const html = renderToString(<AccountMenu />)
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain('rel="nofollow"')
    expect(html).not.toContain('redirect')
  })

  it('点击时附加当前页面（含语言前缀与查询）作为回跳地址', () => {
    expect(loginWithReturn('/login', '/tarot')).toBe('/login?redirect=%2Ftarot')
    expect(loginWithReturn('/ko/login', '/ko/pricing?ref=nav')).toBe(
      '/ko/login?redirect=%2Fko%2Fpricing%3Fref%3Dnav',
    )
  })
})
