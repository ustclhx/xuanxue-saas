import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { eastHomeRedirect } from './east-home.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'

function visit(origin: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, { headers })
}

describe('东方站根路径直接进入语言首页', () => {
  it('按浏览器语言跳到对应语言的首页：其他东方站语言 302，繁体中文 301，地址不带结尾斜杠', () => {
    const ko = eastHomeRedirect(
      visit(EAST, '/', { 'accept-language': 'ko-KR,ko;q=0.9' }),
      templateConfig,
    )
    expect(ko?.status).toBe(302)
    expect(ko?.headers.get('location')).toBe(`${EAST}/ko`)
    const hans = eastHomeRedirect(visit(EAST, '/', { 'accept-language': 'zh-CN' }), templateConfig)
    expect(hans?.status).toBe(302)
    expect(hans?.headers.get('location')).toBe(`${EAST}/zh-hans`)
    const hant = eastHomeRedirect(visit(EAST, '/', { 'accept-language': 'zh-TW' }), templateConfig)
    expect(hant?.status).toBe(301)
    expect(hant?.headers.get('location')).toBe(`${EAST}/zh-hant`)
    // 跳转按访客偏好变化：声明 Vary 且不缓存，避免把一个访客的跳转复用给另一个访客
    for (const response of [ko, hans, hant]) {
      expect(response?.headers.get('vary')).toBe('accept-language, cookie')
      expect(response?.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  it('爬虫（不带 Accept-Language 与 Cookie）与不属于东方站的浏览器语言 301 到繁体中文首页', () => {
    for (const headers of [{}, { 'accept-language': 'ja-JP' }, { 'accept-language': 'en-US' }]) {
      const response = eastHomeRedirect(visit(EAST, '/', headers), templateConfig)
      expect(response?.status).toBe(301)
      expect(response?.headers.get('location')).toBe(`${EAST}/zh-hant`)
    }
  })

  it('已有手动选择时优先于浏览器语言，并保留查询参数', () => {
    const response = eastHomeRedirect(
      visit(EAST, '/?from=share', {
        'accept-language': 'ko-KR',
        cookie: 'locale-preference=zh-Hans',
      }),
      templateConfig,
    )
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toBe(`${EAST}/zh-hans?from=share`)
    const hant = eastHomeRedirect(
      visit(EAST, '/?from=share', { 'accept-language': 'ko', cookie: 'locale-preference=zh-Hant' }),
      templateConfig,
    )
    expect(hant?.status).toBe(301)
    expect(hant?.headers.get('location')).toBe(`${EAST}/zh-hant?from=share`)
  })

  it('HEAD 请求与 GET 一样跳转', () => {
    const head = eastHomeRedirect(
      new Request(`${EAST}/`, { method: 'HEAD', headers: { 'accept-language': 'ko' } }),
      templateConfig,
    )
    expect(head?.status).toBe(302)
    expect(head?.headers.get('location')).toBe(`${EAST}/ko`)
  })

  it('其他路径、西方站与非 GET 请求不处理', () => {
    expect(
      eastHomeRedirect(visit(EAST, '/pricing', { 'accept-language': 'ko' }), templateConfig),
    ).toBeNull()
    expect(
      eastHomeRedirect(visit(EAST, '/ko/', { 'accept-language': 'zh-CN' }), templateConfig),
    ).toBeNull()
    expect(
      eastHomeRedirect(visit(WEST, '/', { 'accept-language': 'ko' }), templateConfig),
    ).toBeNull()
    expect(
      eastHomeRedirect(
        new Request(`${EAST}/`, { method: 'POST', headers: { 'accept-language': 'ko' } }),
        templateConfig,
      ),
    ).toBeNull()
  })
})
