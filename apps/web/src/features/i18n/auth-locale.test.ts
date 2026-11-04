import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { authLocaleRedirect } from './auth-locale.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'

function visit(origin: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, { headers })
}

describe('认证页首次访问的语言', () => {
  it('没有偏好记录时按浏览器语言 302 到带前缀的同一页面', () => {
    const response = authLocaleRedirect(
      visit(EAST, '/login?redirect=%2Fko%2F', { 'accept-language': 'ko-KR,ko;q=0.9' }),
      templateConfig,
    )
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toBe('/ko/login?redirect=%2Fko%2F')
  })

  it('西方站已有手动选择记录时不改写地址', () => {
    const response = authLocaleRedirect(
      visit(WEST, '/login', { 'accept-language': 'ko-KR', cookie: 'locale-preference=en' }),
      templateConfig,
    )
    expect(response).toBeNull()
  })

  it('西方站英文浏览器在无前缀认证页原地渲染', () => {
    for (const path of ['/login', '/register'])
      expect(
        authLocaleRedirect(visit(WEST, path, { 'accept-language': 'en-US' }), templateConfig),
      ).toBeNull()
  })

  // 回归：东方站没有无前缀默认语言，无前缀认证页原地渲染会落到 baseLocale（英文 + Arcanumber）
  it('东方站英文浏览器访问无前缀认证页时跳到东方站第一个语言（繁体中文）', () => {
    for (const path of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/accept-invitation',
    ]) {
      const response = authLocaleRedirect(
        visit(EAST, `${path}?token=t`, { 'accept-language': 'en-US,en;q=0.9' }),
        templateConfig,
      )
      expect(response?.status).toBe(302)
      expect(response?.headers.get('location')).toBe(`/zh-hant${path}?token=t`)
    }
  })

  it('东方站的手动选择属于本站时优先，不属于本站时按浏览器语言选择', () => {
    const chosen = authLocaleRedirect(
      visit(EAST, '/register', { 'accept-language': 'ko-KR', cookie: 'locale-preference=zh-Hans' }),
      templateConfig,
    )
    expect(chosen?.headers.get('location')).toBe('/zh-hans/register')
    const west = authLocaleRedirect(
      visit(EAST, '/login', { 'accept-language': 'ko-KR', cookie: 'locale-preference=en' }),
      templateConfig,
    )
    expect(west?.headers.get('location')).toBe('/ko/login')
    const head = authLocaleRedirect(
      new Request(`${EAST}/login`, { method: 'HEAD' }),
      templateConfig,
    )
    expect(head?.headers.get('location')).toBe('/zh-hant/login')
  })

  it('浏览器语言不属于本站时保留原地址', () => {
    expect(
      authLocaleRedirect(visit(WEST, '/login', { 'accept-language': 'ko-KR' }), templateConfig),
    ).toBeNull()
  })

  it('非认证页与非 GET 请求不处理', () => {
    expect(
      authLocaleRedirect(visit(EAST, '/pricing', { 'accept-language': 'ko' }), templateConfig),
    ).toBeNull()
    expect(
      authLocaleRedirect(
        new Request(`${EAST}/login`, { method: 'POST', headers: { 'accept-language': 'ko' } }),
        templateConfig,
      ),
    ).toBeNull()
  })
})
