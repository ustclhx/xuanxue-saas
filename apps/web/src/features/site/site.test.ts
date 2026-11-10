import { defineTemplateConfig } from '@xuanxue/config'
import { describe, expect, it } from 'vitest'
import { NOT_FOUND_PATH } from '../admin/gate.ts'
import { canonicalUrl, gateSiteRequest, notFoundPath, routeSite } from './gate.ts'
import {
  accountSiteOf,
  requestSiteOrigin,
  resolveSite,
  siteHosts,
  siteNavLocale,
  siteOfLocale,
  siteOrigin,
} from './site.ts'

const EAST = 'https://ganjiday.com'
const WEST = 'https://arcanumber.com'
const config = defineTemplateConfig({
  app: { name: 'xuanxue', url: WEST, supportEmail: 'support@arcanumber.com' },
  i18n: { locales: ['en', 'zh-Hant', 'zh-Hans', 'ko'], defaultLocale: 'en' },
  sites: {
    east: { hosts: ['ganjiday.com'], locales: ['zh-Hant', 'zh-Hans', 'ko'], defaultLocale: null },
    west: {
      hosts: ['arcanumber.com', 'www.arcanumber.com'],
      locales: ['en'],
      defaultLocale: 'en',
    },
  },
})
const route = (url: string) => routeSite(new URL(url), config)
const pass = { kind: 'pass', noindex: false }

describe('账户站点只来自 Host（openspec split-site-accounts 决策 1）', () => {
  it('staging / 预览 Host 与未知 localhost 解析为西方站', () => {
    for (const url of [
      'https://xuanxue-web-staging.example.workers.dev/login',
      'https://abc123-xuanxue-web.example.workers.dev/api/auth/sign-in/email',
      'http://localhost:3000/app',
    ])
      expect(accountSiteOf(new Request(url), config)).toBe('west')
    expect(accountSiteOf(new Request(`${EAST}/login`), config)).toBe('east')
    expect(accountSiteOf(new Request('http://east.localhost:26990/login'), config)).toBe('east')
  })

  it('请求参数、请求体、Cookie 与其他请求头都不能覆盖站点', () => {
    const forged = (url: string) =>
      new Request(`${url}/api/auth/sign-up/email?site=east&siteId=east`, {
        method: 'POST',
        headers: {
          cookie: 'site=east; xuanxue-site=east',
          'x-site': 'east',
          'x-forwarded-host': 'ganjiday.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: 'a@example.test', site: 'east' }),
      })
    expect(accountSiteOf(forged(WEST), config)).toBe('west')
    expect(accountSiteOf(forged('https://preview.example.workers.dev'), config)).toBe('west')
    expect(
      accountSiteOf(
        new Request(`${EAST}/login?site=west`, { headers: { 'x-site': 'west' } }),
        config,
      ),
    ).toBe('east')
  })
})

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
      status: 301,
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

  it('两站分开经营（D5）：西方站的中文与韩语前缀返回 404，不跳到东方站', () => {
    for (const path of [
      '/zh-hant',
      '/zh-hant/',
      '/zh-hant/pricing?ref=nav',
      '/zh-hans',
      '/zh-hans/pricing',
      '/zh-hant/faq',
      '/ko',
      '/ko/manseryeok/',
    ])
      expect(route(`${WEST}${path}`), path).toEqual({ kind: 'not-found' })
  })

  it('东方站只有 /en 英文入口页，其他英语路径返回 404', () => {
    expect(route(`${EAST}/en`)).toEqual(pass)
    expect(route(`${EAST}/en/`)).toEqual(pass)
    expect(route(`${EAST}/en?utm=x`)).toEqual(pass)
    for (const path of ['/en/pricing', '/en/faq', '/en/tarot', '/en/blog/welcome'])
      expect(route(`${EAST}${path}`), path).toEqual({ kind: 'not-found' })
  })

  it('外站语言前缀的认证页 302 到本站无前缀认证页，保留查询参数，不跨站', () => {
    const query = '?redirect=%2Fapp%3Fbuy%3Dreading_single'
    expect(route(`${WEST}/zh-hans/login${query}`)).toEqual({
      kind: 'redirect',
      status: 302,
      location: `${WEST}/login${query}`,
    })
    expect(route(`${WEST}/ko/register`)).toEqual({
      kind: 'redirect',
      status: 302,
      location: `${WEST}/register`,
    })
    expect(route(`${EAST}/en/login${query}`)).toEqual({
      kind: 'redirect',
      status: 302,
      location: `${EAST}/login${query}`,
    })
    // 本站语言的认证页与非认证页不受影响
    expect(route(`${EAST}/zh-hans/login`)).toEqual(pass)
    expect(route(`${WEST}/zh-hans/loginx`)).toEqual({ kind: 'not-found' })
  })

  it('404 改写路径带本站语言前缀：外站语言换成本站导航语言，本站语言沿用', () => {
    const at = (url: string) => notFoundPath(new URL(url), config)
    expect(at(`${WEST}/zh-hans/pricing`)).toBe(NOT_FOUND_PATH)
    expect(at(`${WEST}/ko/app`)).toBe(NOT_FOUND_PATH)
    expect(at(`${EAST}/en/pricing`)).toBe(`/zh-hant${NOT_FOUND_PATH}`)
    expect(at(`${EAST}/ko/app`)).toBe(`/ko${NOT_FOUND_PATH}`)
    expect(at('https://x.workers.dev/ko/app')).toBe(`/ko${NOT_FOUND_PATH}`)
  })

  it('导航语言：不属于本站的语言改用本站默认语言（东方站取第一个语言）', () => {
    expect(siteNavLocale('west', 'zh-Hant', config)).toBe('en')
    expect(siteNavLocale('west', 'en', config)).toBe('en')
    expect(siteNavLocale('east', 'en', config)).toBe('zh-Hant')
    expect(siteNavLocale('east', 'ko', config)).toBe('ko')
  })

  it('西方站的默认语言前缀 301 到无前缀地址', () => {
    expect(route(`${WEST}/en`)).toEqual({ kind: 'redirect', status: 301, location: `${WEST}/` })
    expect(route(`${WEST}/en/blog/welcome`)).toEqual({
      kind: 'redirect',
      status: 301,
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

  it('本地 <站点>.localhost 同样按站点返回 404', () => {
    expect(siteOrigin('east', new URL('http://west.localhost:23330/ko/'), config)).toBe(
      'http://east.localhost:23330',
    )
    expect(route('http://west.localhost:23330/ko/manseryeok')).toEqual({ kind: 'not-found' })
    expect(route('http://east.localhost:23330/en')).toEqual(pass)
  })
})

describe('东方站入口页与无前缀路径', () => {
  it('根路径由守卫跳到语言首页：爬虫 301 到 /zh-hant，韩语浏览器 302 到 /ko；预渲染请求不跳转', async () => {
    expect(route(`${EAST}/`)).toEqual(pass)
    const next = () => new Response('entry')
    const crawler = await gateSiteRequest(new Request(`${EAST}/`), config, next)
    expect(crawler.status).toBe(301)
    expect(crawler.headers.get('location')).toBe(`${EAST}/zh-hant`)
    const korean = await gateSiteRequest(
      new Request(`${EAST}/`, { headers: { 'accept-language': 'ko-KR,ko;q=0.9' } }),
      config,
      next,
    )
    expect(korean.status).toBe(302)
    expect(korean.headers.get('location')).toBe(`${EAST}/ko`)
    const build = await gateSiteRequest(new Request('http://ganjiday.com/'), config, next, {
      canonicalize: false,
    })
    expect(build.status).toBe(200)
    expect(await build.text()).toBe('entry')
  })

  it('其他无前缀的公开页面 301 到繁体中文的同一路径，不跳到首页', () => {
    for (const path of ['/pricing', '/blog/welcome', '/pricing?ref=x', '/faq'])
      expect(route(`${EAST}${path}`), path).toEqual({
        kind: 'redirect',
        status: 301,
        location: `${EAST}/zh-hant${path}`,
      })
  })

  it('裸法律路径保留对应页面与查询参数，进入东方站默认语言', () => {
    for (const slug of ['privacy', 'terms', 'disclaimer', 'refund']) {
      const path = `/${slug}?ref=external`
      expect(route(`${EAST}${path}`)).toEqual({
        kind: 'redirect',
        status: 301,
        location: `${EAST}/zh-hant${path}`,
      })
      expect(route(`${WEST}${path}`)).toEqual(pass)
    }
    // 不存在的页面同样保留路径，由路由器在目标地址返回 404，而不是跳首页（软 404）
    expect(route(`${EAST}/privacy/unknown`)).toEqual({
      kind: 'redirect',
      status: 301,
      location: `${EAST}/zh-hant/privacy/unknown`,
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

describe('地址规范化（specs/seo「规范地址收敛」）', () => {
  const canonical = (url: string, method = 'GET') =>
    canonicalUrl(new URL(url), method, config)?.href ?? null

  it('已登记域名的 HTTP 升级为 HTTPS，保留路径与查询参数', () => {
    expect(canonical('http://arcanumber.com/login?redirect=/tarot')).toBe(
      `${WEST}/login?redirect=/tarot`,
    )
    expect(canonical('http://ganjiday.com/zh-hant/pricing')).toBe(`${EAST}/zh-hant/pricing`)
    expect(canonical('http://www.arcanumber.com/')).toBe('https://www.arcanumber.com/')
  })

  it('本地开发与未登记的预览 Host 不升级协议', () => {
    expect(canonical('http://east.localhost:23330/zh-hant')).toBeNull()
    expect(canonical('http://localhost:3000/pricing')).toBeNull()
    expect(canonical('http://x.workers.dev/pricing')).toBeNull()
  })

  it('GET/HEAD 的非根路径去掉结尾斜杠；根路径、接口与内部路径不变', () => {
    expect(canonical(`${EAST}/zh-hant/`)).toBe(`${EAST}/zh-hant`)
    expect(canonical(`${EAST}/zh-hant/pricing//?a=1`)).toBe(`${EAST}/zh-hant/pricing?a=1`)
    expect(canonical(`${WEST}/tarot/`, 'HEAD')).toBe(`${WEST}/tarot`)
    expect(canonical('http://east.localhost:23330/ko/')).toBe('http://east.localhost:23330/ko')
    for (const url of [
      `${EAST}/`,
      `${EAST}/zh-hant`,
      `${WEST}/api/auth/callback/google/`,
      `${WEST}/_serverFn/abc/`,
    ])
      expect(canonical(url), url).toBeNull()
    expect(canonical(`${WEST}/tarot/`, 'POST')).toBeNull()
  })

  it('规范化与站点跳转合并为一次永久跳转，保留查询参数', async () => {
    const next = () => new Response('page')
    const cases = [
      ['https://ganjiday.com/zh-hant/', `${EAST}/zh-hant`],
      ['https://ganjiday.com/zh-hant/?a=1', `${EAST}/zh-hant?a=1`],
      ['http://ganjiday.com/', `${EAST}/zh-hant`],
      ['http://ganjiday.com/pricing/?x=1', `${EAST}/zh-hant/pricing?x=1`],
      ['http://arcanumber.com/en/pricing/', `${WEST}/pricing`],
      [
        'http://arcanumber.com/login?redirect=/life-path-number/22',
        `${WEST}/login?redirect=/life-path-number/22`,
      ],
      ['https://arcanumber.com/blog/', `${WEST}/blog`],
    ] as const
    for (const [from, to] of cases) {
      const response = await gateSiteRequest(new Request(from), config, next)
      expect(response.status, from).toBe(301)
      expect(response.headers.get('location'), from).toBe(to)
      // 跳转目标本身已是规范地址：再次请求直接放行或只剩东方站无前缀跳转，不会循环
      const again = await gateSiteRequest(new Request(to), config, next)
      expect(again.status, to).toBe(200)
    }
  })

  it('非 GET/HEAD 的 HTTP 请求以 308 升级，保留方法；规范地址直接放行', async () => {
    const post = await gateSiteRequest(
      new Request('http://arcanumber.com/api/auth/sign-in/email', { method: 'POST', body: '{}' }),
      config,
      () => new Response('handled'),
    )
    expect(post.status).toBe(308)
    expect(post.headers.get('location')).toBe(`${WEST}/api/auth/sign-in/email`)
    for (const url of [`${EAST}/zh-hant`, `${EAST}/ko/pricing`, `${WEST}/tarot`, `${WEST}/`]) {
      const response = await gateSiteRequest(new Request(url), config, () => new Response('page'))
      expect(response.status, url).toBe(200)
    }
  })
})

describe('gateSiteRequest', () => {
  it('跳转直接返回，不进入后续处理', async () => {
    let called = false
    const response = await gateSiteRequest(new Request(`${WEST}/en/pricing`), config, () => {
      called = true
      return new Response('page')
    })
    expect(called).toBe(false)
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(`${WEST}/pricing`)
  })

  it('不属于本站的语言改写到 404 路径，由应用按本站语言渲染本站风格的 404', async () => {
    for (const url of [`${WEST}/zh-hant/pricing`, `${WEST}/ko/`, `${EAST}/en/pricing`]) {
      let seen = ''
      const response = await gateSiteRequest(new Request(url), config, (request) => {
        seen = new URL(request.url).href
        return new Response('not found', { status: 404 })
      })
      expect(response.status, url).toBe(404)
      const path = url.startsWith(EAST) ? `/zh-hant${NOT_FOUND_PATH}` : NOT_FOUND_PATH
      expect(seen, url).toBe(new URL(path, url).href)
    }
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
