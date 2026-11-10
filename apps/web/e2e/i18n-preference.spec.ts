import { type Browser, expect, type Page, test } from '@playwright/test'
import { chooseOption } from './select.ts'
import { DUMMY_TURNSTILE_TOKEN } from './turnstile.ts'

const password = 'correct-horse-battery-staple'

test('Accept-Language 只建议不跳转，手动选择和关闭建议会记住偏好', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    extraHTTPHeaders: { 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.5' },
  })
  const page = await context.newPage()
  try {
    await page.goto('/pricing')
    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const banner = page.getByRole('complementary', { name: 'Language suggestion' })
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Switch language' }).click()
    await expect(page).toHaveURL(/\/zh-hant\/pricing$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    expect(
      (await context.cookies()).find((cookie) => cookie.name === 'locale-preference')?.value,
    ).toBe('zh-Hant')
    // Cookie 记住选择，但直接访问默认语言 URL 仍显示默认语言。
    await page.goto('/pricing')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(banner).toHaveCount(0)
    await context.clearCookies()
    await page.reload()
    await expect(banner).toBeVisible()
    await banner.getByRole('button', { name: 'Keep current language' }).click()
    await page.reload()
    await expect(banner).toHaveCount(0)
  } finally {
    await context.close()
  }
})

/** 本地用 east.localhost 访问东方站（features/site/site.ts）；localhost 按西方站处理，只有英文 */
function eastOrigin(baseURL: string | undefined) {
  const url = new URL(baseURL ?? '')
  url.hostname = 'east.localhost'
  return url.origin
}

async function eastContext(browser: Browser, baseURL: string | undefined) {
  const origin = eastOrigin(baseURL)
  const context = await browser.newContext({ baseURL: origin, locale: 'en-US' })
  const page = await context.newPage()
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  )
  return { context, page }
}

/** Node 的请求上下文不解析 *.localhost，认证请求改在页面内发出（同源，带 Turnstile 测试令牌） */
async function authPost(page: Page, path: string, body: Record<string, string>) {
  return page.evaluate(
    async ({ path, body, token }) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-turnstile-token': token },
        body: JSON.stringify(body),
      })
      return response.status
    },
    { path, body, token: DUMMY_TURNSTILE_TOKEN },
  )
}

/** 账号设置的语言偏好：按表单字段定位，不依赖当前界面语言的文案 */
async function saveAccountLocale(page: Page, locale: string) {
  // 水合前提交会走原生表单 GET 而不保存，等网络空闲（水合完成）后再操作
  await page.goto('/account', { waitUntil: 'networkidle' })
  const select = page.locator('#locale')
  const form = page.locator('form').filter({ has: select })
  await chooseOption(select, { value: locale })
  const saved = page.waitForResponse((response) => response.url().includes('/api/auth/update-user'))
  await form.locator('button[type="submit"]').click()
  expect((await saved).status()).toBe(200)
  // 保存后整页重新加载；dev 下首次编译可能较慢
  await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 20_000 })
}

test('东方站换设备登录后应用区跟随账号语言，营销页继续按 URL，账号设置可再次切换', async ({
  browser,
  baseURL,
}) => {
  // 两个设备、多次整页加载，vite dev 冷启动编译应用区与账号页较慢
  test.setTimeout(120_000)
  const email = `i18n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const first = await eastContext(browser, baseURL)
  const second = await eastContext(browser, baseURL)
  try {
    const { page } = first
    await page.goto('/zh-hant')
    expect(
      await authPost(page, '/api/auth/sign-up/email', { email, password, name: 'Locale User' }),
    ).toBe(200)
    // 未保存语言且浏览器为 en-US（不属于东方站）：应用区按东方站第一个语言繁体中文显示，不落到英文
    await page.goto('/app')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    // 通知中心与共用表格控件也应跟随应用区语言，不能回退为英文。
    await page.getByLabel('通知（0 則未讀）', { exact: true }).click()
    const notifications = page.getByRole('region', { name: '通知中心', exact: true })
    await expect(notifications.getByRole('table', { name: '通知', exact: true })).toBeVisible()
    await expect(notifications.getByText('找不到記錄。', { exact: true })).toBeVisible()
    await expect(notifications.getByRole('navigation', { name: '分頁' })).toBeVisible()
    await expect(notifications.getByRole('status')).toHaveText('第 1 頁')
    await expect(notifications.getByRole('button', { name: '上一頁' })).toBeDisabled()
    await expect(notifications.getByRole('button', { name: '下一頁' })).toBeDisabled()
    await saveAccountLocale(page, 'ko')
    await page.goto('/app')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.getByLabel('알림 (읽지 않음 0개)', { exact: true })).toBeVisible()

    // 新设备已有相反的匿名 Cookie，账号设置仍优先。
    await second.context.addCookies([
      { name: 'PARAGLIDE_LOCALE', value: 'zh-Hant', url: eastOrigin(baseURL) },
    ])
    await second.page.goto('/zh-hant')
    expect(await authPost(second.page, '/api/auth/sign-in/email', { email, password })).toBe(200)
    await second.page.goto('/app')
    await expect(second.page.locator('html')).toHaveAttribute('lang', 'ko')
    // 营销页继续按 URL 语言
    await second.page.goto('/zh-hant')
    await expect(second.page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await saveAccountLocale(second.page, 'zh-Hans')
    await second.page.goto('/app')
    await expect(second.page.locator('html')).toHaveAttribute('lang', 'zh-Hans')
  } finally {
    await first.context.close()
    await second.context.close()
  }
})

test('东方站页头切换语言时工具页换成目标语言的对应路径，没有对应页面时回到首页', async ({
  browser,
  baseURL,
}) => {
  const { context, page } = await eastContext(browser, baseURL)
  // 页头语言菜单（<details>）：展开后点目标语言；水合前点击无效，所以重试直到页面语言改变
  const switchTo = async (locale: string) => {
    const menu = page.locator('details').filter({ has: page.locator('button[lang]') })
    await expect
      .poll(async () => {
        if (!(await menu.getAttribute('open').then((open) => open !== null)))
          await menu.locator('summary').click()
        await menu
          .locator(`button[lang="${locale}"]`)
          .click({ timeout: 2_000 })
          .catch(() => {})
        return page.locator('html').getAttribute('lang')
      })
      .toBe(locale)
  }
  try {
    await page.goto('/zh-hant/塔羅/每日一張')
    await switchTo('ko')
    await expect(page).toHaveURL((url) => decodeURI(url.pathname) === '/ko/타로/오늘의-카드')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 紫微斗数没有韩语页面：回到韩语首页
    await page.goto('/zh-hant/紫微斗數排盤')
    await switchTo('ko')
    await expect(page).toHaveURL((url) => url.pathname === '/ko')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  } finally {
    await context.close()
  }
})

test('西方站只有英文，页头不显示语言菜单', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('header button[lang]')).toHaveCount(0)
})
