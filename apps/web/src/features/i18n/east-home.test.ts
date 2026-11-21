import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { gateSiteRequest } from '../site/gate.ts'
import { eastDefaultLocale } from './east-home.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'

const gate = (url: string, headers: Record<string, string> = {}) =>
  gateSiteRequest(new Request(url, { headers }), templateConfig, (request) =>
    Response.json({ path: new URL(request.url).pathname }),
  )

// 使用者 2026-11-20 网址规则：两站 `/` 都是英文首页、不跳转；语言只由地址决定
describe('东方站根路径是英文首页', () => {
  it('任何浏览器语言与 Cookie 都直接返回 `/`，不跳转', async () => {
    for (const headers of [
      {},
      { 'accept-language': 'ko-KR,ko;q=0.9' },
      { 'accept-language': 'zh-CN' },
      { cookie: 'locale-preference=ko' },
    ]) {
      const response = await gate(`${EAST}/`, headers)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ path: '/' })
    }
  })

  it('旧英文入口页 `/en` 301 到 `/`，保留查询参数；西方站 `/en` 照旧 301 到 `/`', async () => {
    const east = await gate(`${EAST}/en?utm_source=x`)
    expect(east.status).toBe(301)
    expect(east.headers.get('location')).toBe(`${EAST}/?utm_source=x`)
    const west = await gate(`${WEST}/en`)
    expect(west.status).toBe(301)
    expect(west.headers.get('location')).toBe(`${WEST}/`)
    // 东方站英文已发布（2026-11-21）：`/en/<英文页面>` 301 到无前缀地址（ML-01：`/` 与 `/en` 不并存）
    const english = await gate(`${EAST}/en/pricing?x=1`)
    expect(english.status).toBe(301)
    expect(english.headers.get('location')).toBe(`${EAST}/pricing?x=1`)
    // 其他 `/en/*` 仍是 404（改写到本站 404 路径）
    const other = await gate(`${EAST}/en/tarot`)
    expect(((await other.json()) as { path: string }).path).not.toBe('/en/tarot')
  })

  it('其他语言首页地址不变', async () => {
    for (const path of ['/zh-hant', '/zh-hans', '/ko', '/ja']) {
      const response = await gate(`${EAST}${path}`, { 'accept-language': 'en-US' })
      expect(await response.json()).toEqual({ path })
    }
  })

  it('无前缀地址的固定落点是东方站第一个已发布语言', () => {
    expect(eastDefaultLocale(templateConfig)).toBe('zh-Hant')
  })
})
