import { AppError } from '@xuanxue/shared'
import { describe, expect, it, vi } from 'vitest'
import { baseLocale, getLocale, isLocale } from '../../paraglide/runtime.js'
import type { WebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { languageUrl, preferredLocale } from './preference.ts'
import { localizeRequest } from './request.server.ts'
import { readRequestSession, withSessionCache } from './session.server.ts'

vi.mock('@xuanxue/auth', async (original) => ({
  ...(await original<typeof import('@xuanxue/auth')>()),
  requireFreshSession: vi.fn(async ({ headers }) => ({
    user: { id: headers.get('x-user'), locale: headers.get('x-locale') },
    session: {},
  })),
}))

const runtime = { db: {}, auth: {} } as Pick<WebRuntime, 'db' | 'auth'>

const pause = () => new Promise((resolve) => setTimeout(resolve, 5))
const origin = 'https://arcanumber.com'
const east = 'https://ganjiday.com'

describe('请求级语言与只读会话隔离', () => {
  it('并发账号请求各自保留会话与语言，同一请求只读取一次会话', async () => {
    const { requireFreshSession } = await import('@xuanxue/auth')
    vi.mocked(requireFreshSession).mockClear()
    const run = (locale: string, site = origin) => {
      const request = new Request(`${site}/account`, {
        headers: { 'x-user': locale, 'x-locale': locale },
      })
      const handle = async () => {
        await pause()
        const [a, b] = await Promise.all([
          readRequestSession({ headers: request.headers } as Parameters<
            typeof readRequestSession
          >[0]),
          readRequestSession({ headers: request.headers } as Parameters<
            typeof readRequestSession
          >[0]),
        ])
        return Response.json({ locale: getLocale(), a: a.user.id, b: b.user.id })
      }
      return localizeRequest(request, runtime, () =>
        templateConfig.i18n.enabled ? handle() : withSessionCache(handle),
      )
    }
    const responses = await Promise.all([run('ko', east), run('en')])
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      {
        locale: templateConfig.i18n.enabled && isLocale('ko') ? 'ko' : baseLocale,
        a: 'ko',
        b: 'ko',
      },
      {
        locale: templateConfig.i18n.enabled && isLocale('en') ? 'en' : baseLocale,
        a: 'en',
        b: 'en',
      },
    ])
    expect(requireFreshSession).toHaveBeenCalledTimes(2)
  })

  it('公开 server function 用同源来源页的 URL 语言，Cookie 不覆盖营销页', async () => {
    const request = new Request(`${origin}/_serverFn/test`, {
      headers: { referer: `${origin}/zh-hant/pricing`, cookie: 'PARAGLIDE_LOCALE=en' },
    })
    const response = await localizeRequest(request, runtime, async () => new Response(getLocale()))
    expect(await response.text()).toBe(
      templateConfig.i18n.enabled && isLocale('zh-Hant') ? 'zh-Hant' : baseLocale,
    )
    expect(
      languageUrl(
        new Request(request, { headers: { referer: 'https://other.test/zh-hant/pricing' } }),
      ).pathname,
    ).toBe('/_serverFn/test')
  })

  it('语言识别不消耗 server function 的 POST 请求体', async () => {
    const request = new Request(`${origin}/_serverFn/test`, {
      method: 'POST',
      body: 'zh',
      headers: { referer: `${origin}/pricing` },
    })
    const response = await localizeRequest(
      request,
      runtime,
      async () => new Response(await request.text()),
    )
    expect(await response.text()).toBe('zh')
  })

  it('独立请求缓存上下文结束后不再复用会话', async () => {
    const { requireFreshSession } = await import('@xuanxue/auth')
    vi.mocked(requireFreshSession).mockClear()
    const options = { headers: new Headers({ 'x-user': 'one' }) } as Parameters<
      typeof readRequestSession
    >[0]
    await withSessionCache(() =>
      Promise.all([readRequestSession(options), readRequestSession(options)]),
    )
    await readRequestSession(options)
    expect(requireFreshSession).toHaveBeenCalledTimes(2)
  })
})

it('账号语言只在多语言模式读取，单语言忽略 Cookie 和账号偏好', async () => {
  const { requireFreshSession } = await import('@xuanxue/auth')
  vi.mocked(requireFreshSession).mockClear()
  const request = new Request(`${east}/account`, {
    headers: { 'x-user': 'one', 'x-locale': 'zh-Hant', cookie: 'PARAGLIDE_LOCALE=en' },
  })
  const response = await localizeRequest(request, runtime, async () => new Response(getLocale()))
  expect(await response.text()).toBe(
    templateConfig.i18n.enabled && isLocale('zh-Hant') ? 'zh-Hant' : baseLocale,
  )
  expect(requireFreshSession).toHaveBeenCalledTimes(templateConfig.i18n.enabled ? 1 : 0)
  if (!templateConfig.i18n.enabled) {
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('location')).toBeNull()
  }
})

describe.runIf(templateConfig.i18n.enabled)('应用区按本站语言回退', () => {
  const localeOf = async (url: string, headers: Record<string, string>) => {
    const response = await localizeRequest(
      new Request(url, { headers: { 'x-user': 'one', ...headers } }),
      runtime,
      async () => new Response(getLocale()),
    )
    return response.text()
  }

  it('东方站未保存语言时按浏览器语言选东方站语言，都不匹配时用繁体中文', async () => {
    expect(await localeOf(`${east}/app`, { 'accept-language': 'ko-KR,ko;q=0.9' })).toBe('ko')
    expect(await localeOf(`${east}/app`, { 'accept-language': 'zh-CN' })).toBe('zh-Hans')
    expect(await localeOf(`${east}/app`, { 'accept-language': 'en-US' })).toBe('zh-Hant')
    expect(await localeOf(`${east}/app`, {})).toBe('zh-Hant')
  })

  it('东方站保存了另一站语言时不显示英文，东方站内的手动选择优先', async () => {
    expect(await localeOf(`${east}/app`, { 'x-locale': 'en' })).toBe('zh-Hant')
    expect(
      await localeOf(`${east}/app`, { 'x-locale': 'en', cookie: 'locale-preference=ko' }),
    ).toBe('ko')
    expect(await localeOf(`${east}/app`, { 'x-locale': 'zh-Hans' })).toBe('zh-Hans')
  })

  it('西方站只用英文；未登记的预览 Host 沿用账号语言', async () => {
    expect(await localeOf(`${origin}/app`, { 'x-locale': 'ko' })).toBe('en')
    expect(await localeOf(`${origin}/app`, {})).toBe('en')
    expect(
      await localeOf('https://xuanxue-web-staging.saas-jobs.workers.dev/app', { 'x-locale': 'ko' }),
    ).toBe('ko')
  })
})

describe.runIf(templateConfig.i18n.enabled)('未登录的应用区不沿用外站语言 Cookie', () => {
  const signedOut = async (url: string, cookie: string, accept = '') => {
    const { requireFreshSession } = await import('@xuanxue/auth')
    vi.mocked(requireFreshSession).mockRejectedValueOnce(
      new AppError('SESSION_REQUIRED', 'Sign in required', { status: 401 }),
    )
    const response = await localizeRequest(
      new Request(url, { headers: { cookie, 'accept-language': accept } }),
      runtime,
      async () => new Response(getLocale()),
    )
    return { locale: await response.text(), setCookie: response.headers.get('set-cookie') }
  }

  it('西方站残留 zh-Hans Cookie：按英文处理并更正 Cookie（登录跳转不生成 /zh-hans/login）', async () => {
    const result = await signedOut(`${origin}/app?buy=reading_single`, 'PARAGLIDE_LOCALE=zh-Hans')
    expect(result.locale).toBe('en')
    expect(result.setCookie).toMatch(/^PARAGLIDE_LOCALE=en;/)
  })

  it('东方站残留 en Cookie 按东方站语言回退；本站语言 Cookie 与无 Cookie 不改动', async () => {
    const east1 = await signedOut(`${east}/app`, 'PARAGLIDE_LOCALE=en', 'ko-KR')
    expect(east1).toEqual({
      locale: 'ko',
      setCookie: expect.stringMatching(/^PARAGLIDE_LOCALE=ko;/),
    })
    expect(await signedOut(`${east}/app`, 'PARAGLIDE_LOCALE=zh-Hans')).toEqual({
      locale: 'zh-Hans',
      setCookie: null,
    })
    expect(await signedOut(`${origin}/app`, '')).toEqual({ locale: 'en', setCookie: null })
  })
})

describe('首次访问建议', () => {
  it('按 Accept-Language 的 q 权重、地区语言和禁用项匹配，默认语言也尊重优先级', () => {
    const zh = isLocale('zh-Hant') ? 'zh-Hant' : baseLocale
    expect(preferredLocale('fr,zh-TW;q=0.8,en;q=0.2')).toBe(zh)
    expect(preferredLocale('zh-hant-tw')).toBe(zh)
    expect(preferredLocale('zh-CN,zh;q=0.9')).toBe(isLocale('zh-Hans') ? 'zh-Hans' : baseLocale)
    expect(preferredLocale('zh-SG')).toBe(isLocale('zh-Hans') ? 'zh-Hans' : baseLocale)
    expect(preferredLocale('zh-TW,zh-CN;q=0.5')).toBe(zh)
    expect(preferredLocale('ko-KR,ko;q=0.9,en;q=0.8')).toBe(isLocale('ko') ? 'ko' : baseLocale)
    expect(preferredLocale('zh;q=0,en;q=0.9')).toBe(isLocale('en') ? 'en' : baseLocale)
    expect(preferredLocale('en-US;q=0.9,zh;q=0.8')).toBe(isLocale('en') ? 'en' : baseLocale)
    expect(preferredLocale('zh;q=oops,fr')).toBe(baseLocale)
  })
})
