import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { authLocaleRedirect } from './auth-locale.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'

function visit(origin: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, { headers })
}

// 使用者 2026-11-20 网址规则：语言只由地址决定，不按浏览器语言或 Cookie 选择
describe('无前缀认证页的语言', () => {
  it('东方站无前缀认证页固定 302 到繁体中文的同一页面，与浏览器语言和 Cookie 无关', () => {
    for (const path of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/accept-invitation',
    ])
      for (const headers of [
        {},
        { 'accept-language': 'ko-KR,ko;q=0.9' },
        { 'accept-language': 'zh-CN', cookie: 'locale-preference=zh-Hans' },
      ]) {
        const response = authLocaleRedirect(visit(EAST, `${path}?token=t`, headers), templateConfig)
        expect(response?.status).toBe(302)
        expect(response?.headers.get('location')).toBe(`/zh-hant${path}?token=t`)
        expect(response?.headers.get('vary')).toBeNull()
      }
    const head = authLocaleRedirect(
      new Request(`${EAST}/login`, { method: 'HEAD' }),
      templateConfig,
    )
    expect(head?.headers.get('location')).toBe('/zh-hant/login')
  })

  it('西方站无前缀认证页是英文页面，任何浏览器语言都不跳转', () => {
    for (const headers of [{}, { 'accept-language': 'ko-KR' }, { 'accept-language': 'zh-TW' }])
      expect(authLocaleRedirect(visit(WEST, '/login', headers), templateConfig)).toBeNull()
  })

  it('非认证页与非 GET/HEAD 请求不处理', () => {
    expect(authLocaleRedirect(visit(EAST, '/pricing'), templateConfig)).toBeNull()
    expect(
      authLocaleRedirect(new Request(`${EAST}/login`, { method: 'POST' }), templateConfig),
    ).toBeNull()
  })
})
