import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gateSiteRequest } from '../../features/site/gate.ts'
import * as projectGate from '../project-gate.ts'
import { templateConfig } from '../template-config.ts'
import { responseBeforeRuntime } from './assets.ts'

// 项目闸门（模板 0.10.0「已有项目如何把自有闸门迁到钩子」）：站点跳转、按 Host 读取本站预渲染页与站点图标
// 在模板的静态资源查找之前完成，环境校验失败时同样生效；其余请求不按原始地址读取 ASSETS。

const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } })

/** 两站共用一个构建目录：西方站首页 index.html、东方站英文首页 en.html、语言页面按前缀分目录 */
const FILES: Record<string, string> = {
  '/index.html': 'west-home',
  '/en.html': 'east-home',
  '/zh-hant/faq.html': 'east-zh-hant-faq',
  '/faq.html': 'west-faq',
  '/images/favicon-east.ico': 'east-icon',
  '/images/favicon-west.ico': 'west-icon',
}

function setup() {
  const fetch = vi.fn(async (request: Request) => {
    const body = FILES[new URL(request.url).pathname]
    return body === undefined ? new Response('missing', { status: 404 }) : html(body)
  })
  const env = { ASSETS: { fetch } } as unknown as Cloudflare.Env
  const fetched = () => fetch.mock.calls.map(([request]) => new URL(request.url).pathname)
  return {
    fetched,
    run: (url: string, { envValid = true, method = 'GET' } = {}) =>
      responseBeforeRuntime(new Request(url, { method }), { env, envValid }, projectGate),
  }
}

beforeEach(() => {
  // 开发环境不读预渲染文件；这里按生产构建验证
  vi.stubEnv('DEV', false)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('项目闸门：静态资源之前的站点规则', () => {
  it('环境校验失败时也先返回预渲染页（staticFirst）', () => {
    expect(projectGate.staticFirst).toBe(true)
  })

  it('两个 Host 请求同一路径各自得到本站的预渲染页', async () => {
    const { run } = setup()
    expect(await (await run('https://arcanumber.com/'))?.text()).toBe('west-home')
    expect(await (await run('https://ganjiday.com/'))?.text()).toBe('east-home')
    // 环境校验失败时同样返回
    expect(await (await run('https://ganjiday.com/', { envValid: false }))?.text()).toBe(
      'east-home',
    )
    expect(await (await run('https://ganjiday.com/zh-hant/faq'))?.text()).toBe('east-zh-hant-faq')
    expect(await (await run('https://arcanumber.com/faq'))?.text()).toBe('west-faq')
  })

  it('非本站语言前缀不读静态文件，交给动态流程渲染本站 404；原始 .html 地址也不直出', async () => {
    const { run, fetched } = setup()
    expect(await run('https://arcanumber.com/zh-hant/faq')).toBeNull()
    expect(await run('https://arcanumber.com/zh-hant/faq.html')).toBeNull()
    expect(await run('https://arcanumber.com/en.html')).toBeNull()
    expect(fetched()).not.toContain('/zh-hant/faq.html')
    expect(fetched()).not.toContain('/en.html')
    // 动态流程中的站点闸门把它改写到本站 404 路径
    const next = vi.fn(async (request: Request) => new Response(new URL(request.url).pathname))
    const response = await gateSiteRequest(
      new Request('https://arcanumber.com/zh-hant/faq'),
      templateConfig,
      next,
    )
    expect(next).toHaveBeenCalledOnce()
    expect(await response.text()).not.toBe('/zh-hant/faq')
    expect(next.mock.calls[0]?.[0].url).toMatch(/^https:\/\/arcanumber\.com\/.+/)
  })

  it('默认语言前缀 301 到无前缀地址（含东方站旧英文入口 /en），结尾斜杠规范化', async () => {
    const { run, fetched } = setup()
    const west = await run('https://arcanumber.com/en/faq?x=1')
    expect(west?.status).toBe(301)
    expect(west?.headers.get('location')).toBe('https://arcanumber.com/faq?x=1')
    // 环境校验失败时也跳转
    const east = await run('https://ganjiday.com/en', { envValid: false })
    expect(east?.status).toBe(301)
    expect(east?.headers.get('location')).toBe('https://ganjiday.com/')
    // 结尾斜杠规范化
    const slash = await run('https://arcanumber.com/faq/')
    expect(slash?.status).toBe(301)
    expect(slash?.headers.get('location')).toBe('https://arcanumber.com/faq')
    expect(fetched()).toEqual([])
  })

  it('/favicon.ico 按 Host 返回本站图标', async () => {
    const { run } = setup()
    expect(await (await run('https://ganjiday.com/favicon.ico'))?.text()).toBe('east-icon')
    expect(await (await run('https://arcanumber.com/favicon.ico'))?.text()).toBe('west-icon')
  })

  it('未登记 Host、动态页面与非 GET 请求不读静态文件', async () => {
    const { run, fetched } = setup()
    expect(await run('https://preview.example.workers.dev/')).toBeNull()
    expect(await run('https://arcanumber.com/app')).toBeNull()
    expect(await run('https://arcanumber.com/api/auth/sign-in', { method: 'POST' })).toBeNull()
    expect(fetched()).not.toContain('/index.html')
  })

  it('分享链接的预渲染页带 noindex', async () => {
    const { run } = setup()
    const shared = await run('https://arcanumber.com/?r=abc')
    expect(await shared?.text()).toBe('west-home')
    expect(shared?.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('构建期预渲染请求不读静态文件', async () => {
    const fetch = vi.fn(async (asset: Request) =>
      new URL(asset.url).pathname === '/' ? html('stale') : new Response(null, { status: 404 }),
    )
    const env = {
      ASSETS: { fetch },
      SITE_PRERENDER_TOKEN: 'local-build',
    } as unknown as Cloudflare.Env
    const request = new Request('http://localhost/', {
      headers: { 'x-site-prerender': 'local-build' },
    })
    expect(await responseBeforeRuntime(request, { env, envValid: true }, projectGate)).toBeNull()
    expect(fetch.mock.calls.map(([asset]) => new URL(asset.url).pathname)).not.toContain('/')
  })
})
