import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../paraglide/runtime.js', () => ({ getLocale: () => 'en' }))

import { trackEvent, trackProductEvent } from '../analytics/track.ts'
import { PVUV_EXCLUDE, pvuvHeadScripts, pvuvSiteId } from './pvuv.ts'

const west = { id: 'west', known: true } as const
const east = { id: 'east', known: true } as const

type Element = Record<string, unknown> & { attrs: Record<string, string> }

/** 在给定访问域名下执行 head 中的内联加载器，返回它插入的脚本 */
function runLoader(pathname: string, site: typeof west | typeof east, hostname: string) {
  const scripts = pvuvHeadScripts(pathname, site)
  const inserted: Element[] = []
  const document = {
    getElementById: (id: string) => inserted.find((script) => script.id === id) ?? null,
    createElement: () => ({
      attrs: {},
      setAttribute(this: Element, name: string, value: string) {
        this.attrs[name] = value
      },
    }),
    head: { appendChild: (script: Element) => inserted.push(script) },
  }
  // 执行两次，模拟水合或导航时内联脚本被重新插入
  for (const script of [...scripts, ...scripts])
    new Function('location', 'document', script.children)({ hostname }, document)
  return { scripts, inserted }
}

function expectLoaded(inserted: Element[], id: string) {
  expect(inserted).toHaveLength(1)
  expect(inserted[0]).toMatchObject({
    id: 'xuanxue-pvuv',
    src: 'https://www.pvuv.ai/f.js',
    defer: true,
    attrs: { 'data-site': id, 'data-api': 'https://in.pvuv.ai', 'data-exclude': PVUV_EXCLUDE },
  })
}

// 按 f.js 的 data-exclude 规则（`*` → `.*`，整段匹配）还原排除判断
function excluded(pathname: string) {
  return PVUV_EXCLUDE.split(',').some((pattern) =>
    new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(
      pathname,
    ),
  )
}

describe('pvuvHeadScripts', () => {
  it('已登记站点的公开页面在正式域名下各自加载本站 site id', () => {
    for (const pathname of ['/', '/pricing', '/zh/blog/post'])
      expectLoaded(runLoader(pathname, west, 'arcanumber.com').inserted, '9WXDSwET')
    for (const pathname of ['/zh-hant', '/ko/pricing', '/en'])
      expectLoaded(runLoader(pathname, east, 'ganjiday.com').inserted, 'jphDLWjj')
  })

  it('本地 `<站点>.localhost`、其他域名与重复执行不加载', () => {
    expect(runLoader('/', west, 'west.localhost').inserted).toEqual([])
    expect(runLoader('/', east, 'arcanumber.com').inserted).toEqual([])
    const { scripts } = runLoader('/', west, 'arcanumber.com')
    expect(scripts[0]?.children).not.toContain('</')
  })

  it('应用区、后台、接口与未登记 Host 不输出', () => {
    for (const pathname of [
      '/app',
      '/app/personal/chat',
      '/account',
      '/admin/users',
      '/api/health',
    ])
      for (const site of [west, east]) expect(pvuvHeadScripts(pathname, site)).toEqual([])
    expect(pvuvHeadScripts('/', { id: 'west', known: false })).toEqual([])
  })

  it('某站 site id 为空时不输出', () => {
    const ids = { west: '9WXDSwET', east: ' ' }
    expect(pvuvHeadScripts('/', east, undefined, ids)).toEqual([])
    expect(pvuvHeadScripts('/', west, undefined, ids)).toHaveLength(1)
    expect(pvuvSiteId('ganjiday.com', undefined, ids)).toBe('')
  })

  it('客户端导航进入应用区时由 data-exclude 停止上报，公开路径不受影响', () => {
    for (const pathname of ['/app', '/app/x', '/account/billing', '/admin', '/api/health'])
      expect(excluded(pathname)).toBe(true)
    for (const pathname of ['/', '/apple', '/pricing', '/zh-hant/app', '/accounts'])
      expect(excluded(pathname)).toBe(false)
  })
})

describe('产品事件转发 pvuv', () => {
  type Queued = ((...args: unknown[]) => void) & { q?: unknown[][] }
  let browser: { location: URL; pvuv?: Queued; plausible?: Queued }
  let nav: { userAgent: string; doNotTrack: string | null; globalPrivacyControl?: boolean }

  const go = (url: string) => {
    browser.location = new URL(url)
  }
  const sent = () => browser.pvuv?.q ?? []

  beforeEach(() => {
    browser = { location: new URL('https://arcanumber.com/pricing') }
    nav = { userAgent: 'Mozilla/5.0 (Macintosh)', doNotTrack: null }
    vi.stubGlobal('window', browser)
    vi.stubGlobal('navigator', nav)
    vi.stubGlobal('document', {
      cookie: '',
      getElementById: () => null,
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild() {} },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 与 Plausible 相同的归因属性：无首触 Cookie 时为 (none)
  const none = { source: '(none)', landing_path: '(none)' }

  it('公开页面转发字典事件与项目事件，带同一组归因属性；page_view 不转发', () => {
    trackEvent('page_view')
    trackEvent('checkout_start', { plan: 'pro' })
    trackProductEvent('tool_submit', { tool: 'bazi' })
    expect(sent()).toEqual([
      ['event', 'checkout_start', { ...none, locale: 'en', plan: 'pro', device: 'desktop' }],
      [
        'event',
        'tool_submit',
        { ...none, plan: '(none)', locale: 'en', device: 'desktop', tool: 'bazi' },
      ],
    ])
    // Plausible 照常收到页面浏览，pvuv 转发不影响模板通道
    expect(browser.plausible?.q?.map((args) => args[0])).toEqual([
      'pageview',
      'checkout_start',
      'tool_submit',
    ])
  })

  it('DNT / GPC、未登记或本地域名、应用区路径与未配置 site id 时不发送', () => {
    nav.doNotTrack = '1'
    trackEvent('checkout_start')
    nav.doNotTrack = null
    nav.globalPrivacyControl = true
    trackProductEvent('tool_submit', { tool: 'bazi' })
    nav.globalPrivacyControl = false
    for (const url of [
      'https://xuanxue.example.workers.dev/pricing',
      'http://west.localhost:3000/pricing',
      'https://arcanumber.com/app/personal/chat',
      'https://arcanumber.com/account',
    ]) {
      go(url)
      trackEvent('checkout_start')
    }
    expect(sent()).toEqual([])
    expect(pvuvSiteId('arcanumber.com', undefined, { west: '', east: 'x' })).toBe('')
  })
})
