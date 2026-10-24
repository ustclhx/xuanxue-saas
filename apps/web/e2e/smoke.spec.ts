import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { APP_URL, login, register, simulateClientIp } from './fixtures.ts'
import { SMOKE_PRICE_ID } from './smoke-setup.ts'
import { stubTurnstile } from './turnstile.ts'

test('register, sign out/in, and buy a credit pack through the local provider', async ({
  page,
  context,
  baseURL,
}) => {
  const externalRequests: string[] = []
  // 后注册的 route 先执行：stubTurnstile 处理测试脚本，其余外部请求立即阻止。
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(baseURL ?? '').origin) return route.continue()
    externalRequests.push(url.origin)
    await route.abort()
  })
  await stubTurnstile(page)
  await simulateClientIp(page)
  const email = `ci-smoke-${randomUUID()}@example.com`
  await register(page, email)
  await expect(page.getByTestId('current-user')).toContainText(email)
  await expect(page.getByText('Personal workspace', { exact: true })).toBeVisible()
  const workspaceURL = page.url()

  const signedOut = await context.request.post('/api/auth/sign-out', {
    headers: { origin: baseURL ?? '' },
    data: {},
  })
  expect(signedOut.ok()).toBe(true)
  await page.goto(workspaceURL)
  await expect(page).toHaveURL(/\/login/)
  await login(page, email)
  await expect(page).toHaveURL(APP_URL)
  await expect(page.getByTestId('current-user')).toContainText(email)

  await page.locator('aside').getByRole('link', { name: 'Billing', exact: true }).click()
  await expect(page.getByText('Available credits: 0', { exact: false })).toBeVisible()
  await page.getByLabel('Payment method').selectOption('stripe')
  await page.getByRole('combobox', { name: 'Plan', exact: true }).selectOption(SMOKE_PRICE_ID)
  await page.getByRole('button', { name: 'Continue to checkout' }).click()
  await expect(page).toHaveURL(/\/billing-return\?/)
  const providerRef = new URL(page.url()).searchParams.get('providerRef')
  expect(providerRef?.startsWith('smoke:')).toBe(true)
  await page.getByRole('link', { name: 'Return to billing' }).click()
  // 回跳不能发积分，必须经过真实 Webhook 管线确认付款。
  await expect(page.getByText('Available credits: 0', { exact: false })).toBeVisible()
  for (let delivery = 0; delivery < 2; delivery++) {
    const response = await context.request.post('/api/billing/webhooks/stripe', {
      headers: { 'x-smoke-payment': 'local-fixture' },
      data: { providerRef },
    })
    expect(response.ok()).toBe(true)
  }
  await page.reload()
  await expect(page.getByText('Available credits: 100', { exact: false })).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
  expect(externalRequests).toEqual([])
})

// openspec add-dual-site-foundation 3.2：东方站登录与支付都回到发起页面，界面仍为韩语。
// 本地用 east.localhost 访问东方站（features/site/site.ts），支付使用 smoke 的本地服务商。
test('east site sign-in and checkout return to the originating /ko page', async ({
  browser,
  baseURL,
}) => {
  const east = new URL(baseURL ?? '')
  east.hostname = 'east.localhost'
  const context = await browser.newContext({ baseURL: east.origin })
  const page = await context.newPage()
  const externalRequests: string[] = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === east.origin) return route.continue()
    // 东方站公开页按站点 token 加载 Cloudflare Web Analytics；离线冒烟只拦截，不算外部依赖
    if (url.origin === 'https://static.cloudflareinsights.com') return route.abort()
    externalRequests.push(url.origin)
    await route.abort()
  })
  await stubTurnstile(page)
  await simulateClientIp(page)
  const korean = async (path: RegExp) => {
    await expect(page).toHaveURL(path)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  }

  const email = `ci-smoke-east-${randomUUID()}@example.com`
  await register(page, email)
  // Node 的请求上下文不解析 *.localhost，改在页面内退出登录
  const signedOut = await page.evaluate(async () => {
    const response = await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    return response.ok
  })
  expect(signedOut).toBe(true)
  await login(page, email, `/login?redirect=${encodeURIComponent('/ko')}`)
  await korean(new RegExp(`^${east.origin}/ko/?$`))

  // 公开页面的购买入口：/app?returnTo= 进入计费页，支付回跳经 billing-return 回到发起页面
  await page.goto(`/app?returnTo=${encodeURIComponent('/ko')}`)
  await expect(page).toHaveURL(/\/billing\?returnTo=/)
  await page.getByLabel('Payment method').selectOption('stripe')
  await page.getByRole('combobox', { name: 'Plan', exact: true }).selectOption(SMOKE_PRICE_ID)
  await page.getByRole('button', { name: 'Continue to checkout' }).click()
  await korean(new RegExp(`^${east.origin}/ko/?\\?checkout=success$`))
  expect(externalRequests).toEqual([])
  await context.close()
})
