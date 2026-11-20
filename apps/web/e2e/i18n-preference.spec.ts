import { type Browser, expect, type Page, test } from '@playwright/test'
import templateConfig from '../../../template.config.ts'
import { chooseOption } from './select.ts'
import { DUMMY_TURNSTILE_TOKEN } from './turnstile.ts'

const password = 'correct-horse-battery-staple'
const { enabled } = templateConfig.i18n

/**
 * 语言建议提示 LocalePrompt（使用者 2026-11-20 网址规则；设计稿 LocalePromptSpec）：
 * 只在客户端水合后空闲时出现，不在服务端 HTML 中；只建议当前页 hreflang 中确有的本站语言；
 * 「切换」是真实链接，点了才导航；关闭按站点记在 localStorage，不写 Cookie。
 */
const prompt = (page: Page) => page.locator('[data-locale-prompt]')
const promptSwitch = (page: Page, locale: string) => prompt(page).locator(`a[hreflang="${locale}"]`)
const localeCookies = async (page: Page) =>
  (await page.context().cookies()).filter((cookie) =>
    ['locale-preference', 'PARAGLIDE_LOCALE'].includes(cookie.name),
  )

test('东方站英文首页：繁中浏览器出现提示（不在服务端 HTML），点切换才导航，之后不再提示且不写 Cookie', async ({
  browser,
  baseURL,
  request,
}) => {
  test.skip(!enabled, '单语言构建没有语言提示')
  test.setTimeout(60_000)
  const origin = eastOrigin(baseURL)
  const html = await (
    await request.get(`${baseURL ?? 'http://localhost:3000'}/`, {
      headers: { host: new URL(origin).host, 'accept-language': 'zh-TW' },
    })
  ).text()
  expect(html).not.toContain('data-locale-prompt')
  const context = await browser.newContext({ baseURL: origin, locale: 'zh-TW' })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await expect(page).toHaveURL(`${origin}/`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(prompt(page)).toHaveAttribute('data-locale-prompt', 'zh-Hant', { timeout: 30_000 })
    await expect(prompt(page)).toHaveAttribute('lang', 'zh-Hant')
    await expect(promptSwitch(page, 'zh-Hant')).toHaveAttribute('href', '/zh-hant')
    await promptSwitch(page, 'zh-Hant').click()
    await expect(page).toHaveURL(`${origin}/zh-hant`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    expect(await localeCookies(page)).toEqual([])
    await page.goto('/')
    await page.waitForTimeout(1500)
    await expect(prompt(page)).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('关闭提示后按站点记住；不带地区的 zh 并列简繁两个候选', async ({ browser, baseURL }) => {
  test.skip(!enabled, '单语言构建没有语言提示')
  const origin = eastOrigin(baseURL)
  const context = await browser.newContext({ baseURL: origin, locale: 'zh' })
  const page = await context.newPage()
  try {
    await page.goto('/')
    await expect(prompt(page)).toHaveAttribute('data-locale-prompt', 'zh-Hans zh-Hant', {
      timeout: 30_000,
    })
    await expect(promptSwitch(page, 'zh-Hans')).toHaveAttribute('href', '/zh-hans')
    await expect(promptSwitch(page, 'zh-Hant')).toHaveAttribute('href', '/zh-hant')
    await prompt(page).getByRole('button').click()
    await expect(prompt(page)).toHaveCount(0)
    await page.reload()
    await page.waitForTimeout(1500)
    await expect(prompt(page)).toHaveCount(0)
    expect(await localeCookies(page)).toEqual([])
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
    // 通知铃铛与弹层也应跟随应用区语言，不能回退为英文（模板 0.3.1 起通知入口为铃铛）。
    const bell = page.getByTestId('notification-bell')
    await expect(bell).toHaveAccessibleName('通知，沒有未讀')
    await bell.click()
    await expect(page.getByRole('dialog').getByText('還沒有通知', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await saveAccountLocale(page, 'ko')
    await page.goto('/app')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.getByTestId('notification-bell')).toHaveAccessibleName(
      '알림, 읽지 않은 알림 없음',
    )

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
      .poll(
        async () => {
          if (!(await menu.getAttribute('open').then((open) => open !== null)))
            await menu.locator('summary').click()
          await menu
            .locator(`button[lang="${locale}"]`)
            .click({ timeout: 2_000 })
            .catch(() => {})
          return page.locator('html').getAttribute('lang')
          // dev server 下工具页水合与切换后的整页跳转常超过默认 5 秒，与其他水合等待一致放宽到 30 秒
        },
        { timeout: 30_000 },
      )
      .toBe(locale)
  }
  try {
    await page.goto('/zh-hant/塔羅/每日一張')
    await switchTo('ko')
    await expect(page).toHaveURL((url) => decodeURI(url.pathname) === '/ko/타로/오늘의-카드')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 切换语言会保存偏好并刷新路由，等它结束再整页导航，否则 goto 被进行中的导航中止
    await page.waitForLoadState('networkidle')
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

test('当前页没有浏览器语言的版本时不提示：西方站繁中浏览器、东方站工具页英文浏览器', async ({
  browser,
  baseURL,
}) => {
  const url = new URL(baseURL ?? '')
  url.hostname = 'west.localhost'
  const west = await browser.newContext({ baseURL: url.origin, locale: 'zh-TW' })
  const east = await browser.newContext({ baseURL: eastOrigin(baseURL), locale: 'en-US' })
  try {
    const page = await west.newPage()
    await page.goto('/pricing')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.waitForTimeout(1500)
    await expect(prompt(page)).toHaveCount(0)
    const tool = await east.newPage()
    await tool.goto(encodeURI('/zh-hant/八字排盤'))
    await expect(tool.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await tool.waitForTimeout(1500)
    await expect(prompt(tool)).toHaveCount(0)
  } finally {
    await west.close()
    await east.close()
  }
})
