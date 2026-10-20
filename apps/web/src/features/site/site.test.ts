import { defineTemplateConfig } from '@xuanxue/config'
import { describe, expect, it } from 'vitest'
import { gateSiteRequest, routeSite } from './gate.ts'
import { requestSiteOrigin, resolveSite, siteHosts, siteOfLocale, siteOrigin } from './site.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const config = defineTemplateConfig({
  app: { name: 'xuanxue', url: WEST, supportEmail: 'support@arcanumber.com' },
  i18n: { locales: ['en', 'zh-Hant', 'ko'], defaultLocale: 'en' },
  sites: {
    east: { hosts: ['ganjiday.com'], locales: ['zh-Hant', 'ko'], defaultLocale: null },
    west: {
      hosts: ['arcanumber.com', 'www.arcanumber.com'],
      locales: ['en'],
      defaultLocale: 'en',
    },
  },
})
const route = (url: string) => routeSite(new URL(url), config)
const pass = { kind: 'pass', noindex: false }

describe('按域名识别站点（specs/multi-site）', () => {
  it('登记的 Host 识别为对应站点，忽略端口与大小写', () => {
    expect(resolveSite('ganjiday.com', config)).toEqual({ id: 'east', known: true })
    expect(resolveSite('GANJIDAY.COM:443', config)).toEqual({ id: 'east', known: true })
    expect(resolveSite('www.arcanumber.com', config)).toEqual({ id: 'west', known: true })
  })

  it('本地开发用 <站点>.localhost 访问对应站点', () => {
    expect(resolveSite('east.localhost:23330', config)).toEqual({ id: 'east', known: true })
    expect(resolveSite('west.localhost', config)).toEqual({ id: 'west', known: true })
  })

  it('访问东方站：东方站的 /zh-hant/ 正常进入应用', () => {
    expect(route(`${EAST}/zh-hant/`)).toEqual(pass)
    expect(route(`${EAST}/ko/manseryeok/`)).toEqual(pass)
  })

  it('预览地址：未登记的 Host 按西方站渲染且 noindex，不跨站跳转', () => {
    for (const host of ['xuanxue-web-staging.acme.workers.dev', 'localhost:23330'])
      expect(resolveSite(host, config)).toEqual({ id: 'west', known: false })
    const preview = 'https://xuanxue-web-staging.acme.workers.dev'
    for (const path of ['/', '/pricing', '/ko/manseryeok/', '/zh-hant/pricing'])
      expect(route(`${preview}${path}`)).toEqual({ kind: 'pass', noindex: true })
    // 默认语言前缀仍去掉
    expect(route(`${preview}/en/pricing`)).toEqual({
      kind: 'redirect',
      status: 307,
      location: `${preview}/pricing`,
    })
  })
})

describe('语言归属站点', () => {
  it('每种语言只属于一个站点', () => {
    expect(siteOfLocale('zh-Hant', config)).toBe('east')
    expect(siteOfLocale('ko', config)).toBe('east')
    expect(siteOfLocale('en', config)).toBe('west')
    expect(siteOfLocale('fr', config)).toBeUndefined()
  })

  it('在西方站访问韩语路径：301 到东方站的同一路径，保留查询串', () => {
    expect(route(`${WEST}/ko/manseryeok/`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/ko/manseryeok/`,
    })
    expect(route(`${WEST}/zh-hant/pricing?ref=nav`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/pricing?ref=nav`,
    })
  })

  it('在东方站访问英语前缀：301 到西方站的无前缀地址', () => {
    expect(route(`${EAST}/en/pricing`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${WEST}/pricing`,
    })
  })

  it('西方站的默认语言前缀 307 到无前缀地址', () => {
    expect(route(`${WEST}/en`)).toEqual({ kind: 'redirect', status: 307, location: `${WEST}/` })
    expect(route(`${WEST}/en/blog/welcome`)).toEqual({
      kind: 'redirect',
      status: 307,
      location: `${WEST}/blog/welcome`,
    })
    expect(route(`${WEST}/pricing`)).toEqual(pass)
  })

  it('未登记的预览 Host 不跳到规范域名，保留请求 origin', () => {
    const preview = 'https://xuanxue-web-staging.example.workers.dev'
    expect(siteOrigin('east', new URL(`${preview}/app/x`), config)).toBe(preview)
    expect(siteOrigin('west', new URL(`${preview}/`), config)).toBe(preview)
    expect(siteOrigin('east', new URL('https://arcanumber.com/'), config)).toBe(
      'https://ganjiday.com',
    )
  })

  it('本地 <站点>.localhost 跨站跳转保留协议与端口', () => {
    expect(siteOrigin('east', new URL('http://west.localhost:23330/ko/'), config)).toBe(
      'http://east.localhost:23330',
    )
    expect(route('http://west.localhost:23330/ko/manseryeok')).toEqual({
      kind: 'redirect',
      status: 301,
      location: 'http://east.localhost:23330/ko/manseryeok',
    })
  })
})

describe('东方站入口页与无前缀路径', () => {
  it('根路径是入口页，不按 Accept-Language 跳转', async () => {
    expect(route(`${EAST}/`)).toEqual(pass)
    const response = await gateSiteRequest(
      new Request(`${EAST}/`, { headers: { 'accept-language': 'ko-KR,ko;q=0.9' } }),
      config,
      () => new Response('entry'),
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('entry')
  })

  it('其他无前缀的公开页面 302 到入口页', () => {
    for (const path of ['/pricing', '/blog/welcome', '/terms?x=1'])
      expect(route(`${EAST}${path}`)).toEqual({
        kind: 'redirect',
        status: 302,
        location: `${EAST}/`,
      })
  })

  it('应用区、认证页、接口与技术路径不跳转', () => {
    for (const path of [
      '/app',
      '/app/personal/chat',
      '/account',
      '/admin/users',
      '/api/health',
      '/api/auth/callback/google',
      '/login',
      '/register',
      '/reset-password',
      '/verify-email',
      '/accept-invitation',
      '/_serverFn/abc',
      '/sitemap.xml',
      '/robots.txt',
      '/og/ko/index.png',
    ])
      expect(route(`${EAST}${path}`), path).toEqual(pass)
  })

  it('带语言前缀的应用区不跳转，由语言守卫返回 404', () => {
    for (const url of [`${WEST}/en/app`, `${WEST}/ko/admin`, `${EAST}/zh-hant/api/health`])
      expect(route(url), url).toEqual(pass)
  })

  it('未配置与已移除的语言前缀不跳转，由路由器返回 404', () => {
    for (const path of ['/fr/', '/zh/pricing', '/ja', '/zh-Hant/pricing'])
      expect(route(`${EAST}${path}`), path).toEqual(pass)
    expect(route(`${WEST}/zh/pricing`)).toEqual(pass)
  })

  it('西方站的无前缀路径正常进入应用', () => {
    for (const path of ['/', '/pricing', '/blog/welcome'])
      expect(route(`${WEST}${path}`)).toEqual(pass)
  })
})

describe('gateSiteRequest', () => {
  it('跳转直接返回，不进入后续处理', async () => {
    let called = false
    const response = await gateSiteRequest(new Request(`${WEST}/ko/`), config, () => {
      called = true
      return new Response('page')
    })
    expect(called).toBe(false)
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(`${EAST}/ko/`)
  })

  it('未登记 Host 的响应带 X-Robots-Tag: noindex，登记的 Host 不带', async () => {
    const next = () => Response.redirect(`${WEST}/somewhere`, 302)
    const preview = await gateSiteRequest(new Request('https://x.workers.dev/'), config, next)
    expect(preview.headers.get('x-robots-tag')).toBe('noindex')
    expect(preview.status).toBe(302)
    const known = await gateSiteRequest(new Request(`${WEST}/`), config, next)
    expect(known.headers.get('x-robots-tag')).toBeNull()
  })

  it('关闭多语言时只做 noindex 判断', async () => {
    const single = { ...config, i18n: { ...config.i18n, enabled: false } }
    expect(routeSite(new URL(`${WEST}/ko/`), single)).toEqual(pass)
    expect(routeSite(new URL(`${EAST}/pricing`), single)).toEqual(pass)
  })
})

describe('两站各自登录的 Host 白名单（决策 4）', () => {
  it('生产只接受注册表中的域名；APP_URL 指向本机时加入同端口的 <站点>.localhost', () => {
    expect(siteHosts(config, WEST)).toEqual([
      'ganjiday.com',
      'arcanumber.com',
      'www.arcanumber.com',
    ])
    expect(siteHosts(config, 'http://localhost:27070')).toEqual([
      'ganjiday.com',
      'arcanumber.com',
      'www.arcanumber.com',
      'east.localhost:27070',
      'west.localhost:27070',
    ])
  })

  it('支付回跳使用请求所在站点；未登记的 Host 回退到 APP_URL', () => {
    expect(requestSiteOrigin(`${EAST}/_serverFn/x`, config, WEST)).toBe(EAST)
    expect(requestSiteOrigin('https://evil.example/_serverFn/x', config, WEST)).toBe(WEST)
    expect(
      requestSiteOrigin(
        'http://east.localhost:27070/_serverFn/x',
        config,
        'http://localhost:27070',
      ),
    ).toBe('http://east.localhost:27070')
  })
})
