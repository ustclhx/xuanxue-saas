import { describe, expect, it, vi } from 'vitest'
import {
  cachedPageOf,
  DAILY_CACHE_HEADER,
  type DailyCacheStore,
  dailyCacheKey,
  dailyPageCache,
  dailyPageLocale,
  dailyTtl,
  hasSessionCookie,
} from './page-cache.ts'

const LOCALES = ['en', 'zh-Hant', 'zh-Hans', 'ko']

function memoryCache() {
  const entries = new Map<string, Response>()
  const store: DailyCacheStore & { entries: Map<string, Response> } = {
    entries,
    match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, new Response(await response.text(), response))
    }),
  }
  return store
}

const html = (body = '<h1>今日</h1>') =>
  new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': 'PARAGLIDE_LOCALE=zh-Hant',
    },
  })

const page = (path: string, init?: RequestInit) =>
  new Request(`https://ganjiday.com${encodeURI(path)}`, init)

describe('每日页识别', () => {
  it('按语言前缀识别四个每日页，其他路径返回 null', () => {
    expect(dailyPageLocale(encodeURI('/zh-hant/每日運勢'), LOCALES)).toBe('zh-Hant')
    expect(dailyPageLocale(encodeURI('/zh-hans/每日运势'), LOCALES)).toBe('zh-Hans')
    expect(dailyPageLocale(encodeURI('/ko/오늘의-운세'), LOCALES)).toBe('ko')
    expect(dailyPageLocale('/daily-numerology', LOCALES)).toBe('en')
    expect(dailyPageLocale(encodeURI('/zh-hans/每日運勢'), LOCALES)).toBeNull()
    expect(dailyPageLocale('/pricing', LOCALES)).toBeNull()
  })

  it('识别 better-auth 会话 Cookie', () => {
    expect(hasSessionCookie('a=1; __Secure-better-auth.session_token=x')).toBe(true)
    expect(hasSessionCookie('better-auth.session_data=x')).toBe(true)
    expect(hasSessionCookie('PARAGLIDE_LOCALE=ko')).toBe(false)
    expect(hasSessionCookie(null)).toBe(false)
  })
})

describe('缓存键与 TTL', () => {
  it('参考时区跨过 00:00 后键变化，查询串不进键', () => {
    const url = new URL(`https://ganjiday.com${encodeURI('/zh-hant/每日運勢')}?utm_source=x`)
    const before = dailyCacheKey(url, 'zh-Hant', new Date('2026-11-13T15:59:00Z')).url
    const after = dailyCacheKey(url, 'zh-Hant', new Date('2026-11-13T16:00:00Z')).url
    expect(before).toContain('daily=2026-11-13')
    expect(after).toContain('daily=2026-11-14')
    expect(before).not.toContain('utm_source')
  })

  it('部署版本进键：新版本不命中旧版本缓存的 HTML（旧哈希资源已 404）', () => {
    const url = new URL('https://arcanumber.com/daily-numerology')
    const now = new Date('2026-11-16T10:00:00Z')
    const v1 = dailyCacheKey(url, 'en', now, 'aaa111').url
    const v2 = dailyCacheKey(url, 'en', now, 'bbb222').url
    expect(v1).toContain('v=aaa111')
    expect(v1).not.toBe(v2)
  })

  it('TTL 为距参考日结束的秒数，不超过 3600', () => {
    expect(dailyTtl('zh-Hant', new Date('2026-11-13T15:50:00Z'))).toBe(600)
    expect(dailyTtl('zh-Hant', new Date('2026-11-13T02:00:00Z'))).toBe(3600)
  })
})

describe('dailyPageCache', () => {
  const now = new Date('2026-11-13T02:00:00Z')

  it('不是每日页时返回 null，不渲染', async () => {
    const render = vi.fn(async () => html())
    expect(
      await dailyPageCache(page('/zh-hant/命盤查詢'), LOCALES, { cache: memoryCache() }, render),
    ).toBeNull()
    expect(render).not.toHaveBeenCalled()
  })

  it('带会话 Cookie 的请求不读也不写缓存', async () => {
    const cache = memoryCache()
    const response = await dailyPageCache(
      page('/zh-hant/每日運勢', { headers: { cookie: 'better-auth.session_token=abc' } }),
      LOCALES,
      { cache, now },
      async () => html(),
    )
    expect(cache.match).not.toHaveBeenCalled()
    expect(cache.put).not.toHaveBeenCalled()
    expect(response?.headers.get('cache-control')).toBe('private, no-store')
  })

  it('匿名请求：未命中时渲染并写入（去掉 Set-Cookie），第二次命中', async () => {
    const cache = memoryCache()
    const render = vi.fn(async () => html())
    const first = await dailyPageCache(page('/zh-hant/每日運勢'), LOCALES, { cache, now }, render)
    expect(first?.headers.get(DAILY_CACHE_HEADER)).toBe('miss')
    expect(first?.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=3600')
    expect(first?.headers.get('vary')).toBe('Cookie')
    expect(await first?.text()).toContain('今日')
    const [stored] = [...cache.entries.values()]
    expect(stored?.headers.get('set-cookie')).toBeNull()

    const second = await dailyPageCache(page('/zh-hant/每日運勢'), LOCALES, { cache, now }, render)
    expect(second?.headers.get(DAILY_CACHE_HEADER)).toBe('hit')
    expect(await second?.text()).toContain('今日')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('非 200 响应不写缓存', async () => {
    const cache = memoryCache()
    await dailyPageCache(
      page('/zh-hant/每日運勢'),
      LOCALES,
      { cache, now },
      async () => new Response('err', { status: 500, headers: { 'content-type': 'text/html' } }),
    )
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('命中时交给 secure 补安全头', async () => {
    const cache = memoryCache()
    const secure = vi.fn(async (response: Response) => response)
    await dailyPageCache(page('/ko/오늘의-운세'), LOCALES, { cache, now }, async () => html())
    await dailyPageCache(page('/ko/오늘의-운세'), LOCALES, { cache, now, secure }, async () =>
      html(),
    )
    expect(secure).toHaveBeenCalledTimes(1)
  })
})

describe('黄历页（content-growth-phase2 决策 5）', () => {
  const now = new Date('2026-11-22T02:00:00Z')
  const url = (path: string) => new URL(`https://ganjiday.com${encodeURI(path)}`)

  it('识别黄历工具页与 12 个月份页，日期参数进键，非法日期不缓存', () => {
    expect(cachedPageOf(url('/zh-hans/黄历'), LOCALES)).toEqual({ locale: 'zh-Hans' })
    expect(cachedPageOf(url('/zh-hans/黄历/1月'), LOCALES)).toEqual({ locale: 'zh-Hans' })
    expect(cachedPageOf(url('/zh-hans/黄历/12月/'), LOCALES)).toEqual({ locale: 'zh-Hans' })
    expect(cachedPageOf(url('/zh-hans/黄历?date=2026-12-01'), LOCALES)).toEqual({
      locale: 'zh-Hans',
      variant: 'date=2026-12-01',
    })
    expect(cachedPageOf(url('/zh-hans/黄历?date=2026-02-30'), LOCALES)).toEqual({
      locale: 'zh-Hans',
      variant: null,
    })
    // 月份页的查询串不进键；逐日地址、其他语言与无前缀地址不是黄历页
    expect(cachedPageOf(url('/zh-hans/黄历/1月?date=2026-12-01'), LOCALES)).toEqual({
      locale: 'zh-Hans',
    })
    expect(cachedPageOf(url('/zh-hans/黄历/13月'), LOCALES)).toBeNull()
    expect(cachedPageOf(url('/zh-hans/黄历/2026-12-01'), LOCALES)).toBeNull()
    expect(cachedPageOf(url('/zh-hant/黄历'), LOCALES)).toBeNull()
    expect(cachedPageOf(url('/黄历'), LOCALES)).toBeNull()
  })

  it('工具页：不同日期参数各自成键，第二次请求命中', async () => {
    const cache = memoryCache()
    const render = vi.fn(async () => html('<h1>黄历查询</h1>'))
    const first = await dailyPageCache(page('/zh-hans/黄历'), LOCALES, { cache, now }, render)
    expect(first?.headers.get(DAILY_CACHE_HEADER)).toBe('miss')
    const second = await dailyPageCache(page('/zh-hans/黄历'), LOCALES, { cache, now }, render)
    expect(second?.headers.get(DAILY_CACHE_HEADER)).toBe('hit')
    const dated = await dailyPageCache(
      new Request(`https://ganjiday.com${encodeURI('/zh-hans/黄历')}?date=2027-02-04`),
      LOCALES,
      { cache, now },
      render,
    )
    expect(dated?.headers.get(DAILY_CACHE_HEADER)).toBe('miss')
    expect(render).toHaveBeenCalledTimes(2)
    expect([...cache.entries.keys()].some((key) => key.includes('q=date%3D2027-02-04'))).toBe(true)
  })

  it('非法日期参数：直接渲染，不读也不写缓存', async () => {
    const cache = memoryCache()
    const response = await dailyPageCache(
      new Request(`https://ganjiday.com${encodeURI('/zh-hans/黄历')}?date=abc`),
      LOCALES,
      { cache, now },
      async () => html(),
    )
    expect(response?.status).toBe(200)
    expect(response?.headers.get(DAILY_CACHE_HEADER)).toBeNull()
    expect(cache.match).not.toHaveBeenCalled()
    expect(cache.put).not.toHaveBeenCalled()
  })

  it('月份页：北京时间跨日后键变化（跨月即换内容），TTL 不超过 3600', async () => {
    const before = dailyCacheKey(
      url('/zh-hans/黄历/11月'),
      'zh-Hans',
      new Date('2026-11-30T15:59:00Z'),
    )
    const after = dailyCacheKey(
      url('/zh-hans/黄历/11月'),
      'zh-Hans',
      new Date('2026-11-30T16:00:00Z'),
    )
    expect(before.url).toContain('daily=2026-11-30')
    expect(after.url).toContain('daily=2026-12-01')
    const cache = memoryCache()
    const response = await dailyPageCache(
      page('/zh-hans/黄历/11月'),
      LOCALES,
      { cache, now },
      async () => html(),
    )
    expect(response?.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=3600')
  })
})
