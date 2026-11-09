import { randomUUID } from 'node:crypto'
import { type Browser, expect as baseExpect, type Page, test } from '@playwright/test'
import { APP_URL, PASSWORD, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// 两站语言不串（ux-fix-20261109 A1/A2）：西方站购买入口在任何语言状态下都落到西方站英文登录页，
// 登录后回到西方站的 /app?buy= 购买流程；外站语言前缀的认证页跳回本站无前缀认证页；
// 404 页保持 404 状态，按本站品牌与语言给出返回首页的入口。本地按 Host 区分站点（east/west.localhost）。

// vite dev 首次访问页面时才编译，冷启动可能超过默认 5 秒
const expect = baseExpect.configure({ timeout: 20_000 })
// 中文与韩文字符：西方站页面上不应出现
const CJK = /[㐀-鿿가-힯]/
const BUY = `/app?buy=${'reading_single'}`
const LOGIN_FOR_BUY = /\/login\?redirect=%2Fapp%3Fbuy%3Dreading_single$/

function siteOrigin(baseURL: string | undefined, site: 'east' | 'west') {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}

async function siteContext(browser: Browser, origin: string) {
  const context = await browser.newContext({ baseURL: origin })
  const page = await context.newPage()
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname.endsWith('.localhost') || url.hostname === 'challenges.cloudflare.com')
      return route.fallback()
    await route.abort()
  })
  await stubTurnstile(page)
  await simulateClientIp(page)
  return { context, page }
}

async function expectWestLogin(page: Page, west: string) {
  await expect(page).toHaveURL(new RegExp(`^${west}${LOGIN_FOR_BUY.source}`))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('form', { name: 'Sign in with password' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(CJK)
}

test('西方站新会话：购买入口进入英文登录页', async ({ browser, baseURL }) => {
  const west = siteOrigin(baseURL, 'west')
  const { context, page } = await siteContext(browser, west)
  const response = await page.goto(BUY)
  expect(response?.status()).toBe(200)
  await expectWestLogin(page, west)
  await context.close()
})

test('西方站残留外站语言 Cookie：购买入口仍进入英文登录页并更正 Cookie', async ({
  browser,
  baseURL,
}) => {
  const west = siteOrigin(baseURL, 'west')
  for (const locale of ['zh-Hans', 'zh-Hant', 'ko']) {
    const { context, page } = await siteContext(browser, west)
    // 旧版同一域名提供全部语言时写下的语言 Cookie
    await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: locale, url: west }])
    await page.goto(BUY)
    await expectWestLogin(page, west)
    const cookie = (await context.cookies(west)).find((item) => item.name === 'PARAGLIDE_LOCALE')
    expect(cookie?.value, locale).toBe('en')
    await context.close()
  }
})

test('先在东方站切换语言，再到西方站购买：不出现外站语言', async ({ browser, baseURL }) => {
  const east = siteOrigin(baseURL, 'east')
  const west = siteOrigin(baseURL, 'west')
  for (const [segment, locale] of [
    ['zh-hans', 'zh-Hans'],
    ['zh-hant', 'zh-Hant'],
    ['ko', 'ko'],
  ] as const) {
    const { context, page } = await siteContext(browser, east)
    await page.goto(`/${segment}`)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    // 语言菜单的选择记在东方站的两个 Cookie 上（features/i18n/preference.ts 的 rememberLocale）
    await context.addCookies([
      { name: 'PARAGLIDE_LOCALE', value: locale, url: east },
      { name: 'locale-preference', value: locale, url: east },
    ])
    await page.goto(`${west}${BUY}`)
    await expectWestLogin(page, west)
    await context.close()
  }
})

test('外站语言前缀的认证页跳回本站无前缀认证页，保留回跳参数', async ({ request, baseURL }) => {
  const west = siteOrigin(baseURL, 'west')
  const east = siteOrigin(baseURL, 'east')
  const local = baseURL ?? 'http://localhost:3000'
  const redirect = '?redirect=%2Fapp%3Fbuy%3Dreading_single'
  for (const [site, path] of [
    [west, `/zh-hans/login${redirect}`],
    [west, `/ko/register${redirect}`],
    [east, `/en/login${redirect}`],
  ] as const) {
    const response = await request.get(`${local}${path}`, {
      maxRedirects: 0,
      headers: { host: new URL(site).host },
    })
    expect(response.status(), path).toBe(302)
    const location = new URL(response.headers().location ?? '', site)
    expect(location.pathname + location.search, path).toBe(
      `/${path.split('/')[2]?.split('?')[0]}${redirect}`,
    )
  }
  // 无前缀登录页两站都可访问
  for (const site of [west, east]) {
    const response = await request.get(`${local}/login`, { headers: { host: new URL(site).host } })
    expect(response.status(), site).toBe(200)
  }
})

test('西方站购买入口登录后回到本站购买流程', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const west = siteOrigin(baseURL, 'west')
  const { context, page } = await siteContext(browser, west)
  const email = `west-buy-${randomUUID()}@example.com`
  await register(page, email)
  await context.clearCookies()
  // 残留外站语言 Cookie 的已注册用户
  await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'zh-Hans', url: west }])
  await page.goto(BUY)
  await expectWestLogin(page, west)
  const form = page.getByRole('form', { name: 'Sign in with password' })
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await form.getByRole('button', { name: 'Sign in', exact: true }).click()
  // /app?buy= 进入本站计费页（本地未配置支付渠道，不会继续跳转到支付页）
  await expect(page).toHaveURL(new RegExp(`^${west}/app/u-[a-z0-9]+/billing(?:\\?|$)`))
  expect(await page.locator('body').innerText()).not.toMatch(CJK)
  await page.goto('/app')
  await expect(page).toHaveURL(APP_URL)
  await context.close()
})

test('404 页保持 404 状态，按本站品牌与语言提供返回首页入口', async ({ browser, baseURL }) => {
  const west = siteOrigin(baseURL, 'west')
  const east = siteOrigin(baseURL, 'east')
  const cases = [
    { url: `${west}/not-found-check`, lang: 'en', home: 'Back to Arcanumber home', href: '/' },
    { url: `${west}/zh-hans/pricing`, lang: 'en', home: 'Back to Arcanumber home', href: '/' },
    {
      url: `${east}/zh-hant/not-found-check`,
      lang: 'zh-Hant',
      home: '返回干支日首頁',
      href: '/zh-hant',
    },
    {
      url: `${east}/ko/not-found-check`,
      lang: 'ko',
      home: '간지데이 홈으로 돌아가기',
      href: '/ko',
    },
    { url: `${east}/en/pricing`, lang: 'zh-Hant', home: '返回干支日首頁', href: '/zh-hant' },
  ]
  for (const item of cases) {
    const { context, page } = await siteContext(browser, new URL(item.url).origin)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(item.url)
    expect(response?.status(), item.url).toBe(404)
    await expect(page).toHaveURL(item.url)
    await expect(page.locator('html')).toHaveAttribute('lang', item.lang)
    const home = page.getByRole('link', { name: item.home })
    await expect(home).toHaveAttribute('href', item.href)
    if (item.lang === 'en') expect(await page.locator('body').innerText()).not.toMatch(CJK)
    expect(errors, item.url).toEqual([])
    await context.close()
  }
})
