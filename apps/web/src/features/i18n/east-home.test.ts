import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { eastHomeRedirect } from './east-home.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'

function visit(origin: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, { headers })
}

describe('东方站根路径直接进入语言首页', () => {
  it('按浏览器语言跳到对应语言的首页', () => {
    const ko = eastHomeRedirect(
      visit(EAST, '/', { 'accept-language': 'ko-KR,ko;q=0.9' }),
      templateConfig,
    )
    expect(ko?.status).toBe(302)
    expect(ko?.headers.get('location')).toBe('/ko/')
    expect(
      eastHomeRedirect(
        visit(EAST, '/', { 'accept-language': 'zh-CN' }),
        templateConfig,
      )?.headers.get('location'),
    ).toBe('/zh-hans/')
    expect(
      eastHomeRedirect(
        visit(EAST, '/', { 'accept-language': 'zh-TW' }),
        templateConfig,
      )?.headers.get('location'),
    ).toBe('/zh-hant/')
  })

  it('浏览器语言不在东方站语言内时用繁体中文', () => {
    const response = eastHomeRedirect(
      visit(EAST, '/', { 'accept-language': 'ja-JP' }),
      templateConfig,
    )
    expect(response?.headers.get('location')).toBe('/zh-hant/')
  })

  it('已有手动选择时优先于浏览器语言，并保留查询参数', () => {
    const response = eastHomeRedirect(
      visit(EAST, '/?from=share', {
        'accept-language': 'ko-KR',
        cookie: 'locale-preference=zh-Hans',
      }),
      templateConfig,
    )
    expect(response?.headers.get('location')).toBe('/zh-hans/?from=share')
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
