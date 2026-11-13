import { describe, expect, it, vi } from 'vitest'
import {
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
