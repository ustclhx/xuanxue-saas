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

  it('已有手动选择记录时不改写地址', () => {
    const response = authLocaleRedirect(
      visit(EAST, '/login', {
        'accept-language': 'ko-KR',
        cookie: 'locale-preference=zh-Hant',
      }),
      templateConfig,
    )
    expect(response).toBeNull()
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
