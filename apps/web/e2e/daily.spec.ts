import { expect, test } from '@playwright/test'
import { newId } from '@xuanxue/shared'
import { fixtureDb, PASSWORD } from './fixtures.ts'
import { DUMMY_TURNSTILE_TOKEN } from './turnstile.ts'

// openspec add-birth-profiles-daily-horoscope tasks 7.5：公开每日运势页
const localSite = (baseURL: string | undefined, site: string) => {
  const url = new URL(baseURL ?? 'http://localhost:3000')
  url.hostname = `${site}.localhost`
  return url.origin
}

const PAGES = [
  { site: 'east', path: '/zh-hant/每日運勢', h1: /今日運勢 · .{2}日/, hreflang: ['zh-Hans', 'ko'] },
  { site: 'east', path: '/zh-hans/每日运势', h1: /今日运势 · .{2}日/, hreflang: ['zh-Hant', 'ko'] },
  {
    site: 'east',
    path: '/ko/오늘의-운세',
    h1: /오늘의 운세 · .+일/,
    hreflang: ['zh-Hant', 'zh-Hans'],
  },
  { site: 'west', path: '/daily-numerology', h1: /Your Number Today/, hreflang: [] },
] as const

for (const item of PAGES) {
  test(`禁用 JS 时 ${item.path} 的 HTML 含 H1、日期、规则内容与合规声明`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    const response = await page.goto(`${localSite(baseURL, item.site)}${encodeURI(item.path)}`)
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText(item.h1)
    await expect(page.getByTestId('daily-date')).toContainText(/\d/)
    if (item.site === 'east') {
      // 十个日主的提示都在 HTML 中
      await expect(page.locator('[role="tabpanel"]')).toHaveCount(10)
    } else {
      await expect(page.getByTestId('daily-steps')).toContainText('=')
      await expect(page.locator('#personal-day-22')).toBeAttached()
    }
    await expect(page.getByRole('note').first()).toBeVisible()
    // 只声明本站语言的 hreflang
    const langs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('hreflang')))
    for (const lang of item.hreflang) expect(langs).toContain(lang)
    if (item.site === 'west') expect(langs.filter((lang) => lang !== 'x-default')).toEqual(['en'])
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${encodeURI(item.path)}$`),
    )
    await context.close()
  })
}

// APIRequestContext 不解析 *.localhost：请求本机地址并以 Host 头指定站点（同 dual-site-seo.spec.ts）
const eastHost = (baseURL: string | undefined) => new URL(localSite(baseURL, 'east')).host

test('其他语言前缀下的每日页返回 404', async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}${encodeURI('/zh-hans/每日運勢')}`, {
    maxRedirects: 0,
    headers: { host: eastHost(baseURL) },
  })
  expect(response.status()).toBe(404)
})

test('带会话 Cookie 的请求不进共享缓存', async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}${encodeURI('/zh-hant/每日運勢')}`, {
    headers: { host: eastHost(baseURL), cookie: 'better-auth.session_token=invalid' },
  })
  expect(response.status()).toBe(200)
  // 本地 dev 不启用边缘缓存；带会话的请求在任何环境都不得被标记为 public
  expect(response.headers()['cache-control'] ?? '').not.toContain('public')
})

test('西方站个人日计算只在浏览器中进行', async ({ page, baseURL }) => {
  const requests: string[] = []
  await page.goto(`${localSite(baseURL, 'west')}/daily-numerology`)
  // 等水合完成，受控输入才会响应
  await page.waitForLoadState('networkidle')
  page.on('request', (request) => requests.push(request.url()))
  // 水合前的输入会被受控组件重置：重复填写直到结果出现
  await expect(async () => {
    await page.getByLabel('Birth date (stays in your browser)').fill('1990-05-15')
    await expect(page.getByTestId('daily-personal')).toContainText('Personal Day', {
      timeout: 1000,
    })
  }).toPass({ timeout: 15_000 })
  expect(requests.filter((url) => url.includes('1990'))).toEqual([])
})

// tasks 8.1：登录后首页显示默认档案的今日内容；没有档案时显示建立入口
test('东方站今日面板：无档案引导建立，写入默认档案后显示今日十神', async ({ page, baseURL }) => {
  const east = localSite(baseURL, 'east')
  const email = `daily-${newId()}@example.com`
  // 在页面内调用注册接口（APIRequestContext 不解析 *.localhost），会话 Cookie 直接写进浏览器
  await page.goto(`${east}/zh-hant`)
  const status = await page.evaluate(
    async ({ email, password, token }) =>
      (
        await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-turnstile-token': token },
          body: JSON.stringify({ name: 'Daily', email, password }),
        })
      ).status,
    { email, password: PASSWORD, token: DUMMY_TURNSTILE_TOKEN },
  )
  expect(status).toBe(200)
  await page.goto(`${east}/app`)
  await expect(page.getByText('還沒有出生檔案')).toBeVisible()
  const sql = fixtureDb()
  try {
    await sql`
      insert into birth_profile (id, workspace_id, user_id, label, relation, is_default, birth)
      select gen_random_uuid(), o.id, u.id, '本人', 'self', true, ${sql.json({
        calendar: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        time: { hour: 10, minute: 30 },
        gender: 'male',
        location: { city: 'taipei' },
      })}
      from "user" u join organization o on o.id = u.id where u.email = ${email}`
  } finally {
    await sql.end()
  }
  await page.reload()
  const panel = page.getByTestId('today-panel')
  await expect(panel).toContainText('今日天干對你')
  await expect(panel).toContainText('庚金日主')
})
