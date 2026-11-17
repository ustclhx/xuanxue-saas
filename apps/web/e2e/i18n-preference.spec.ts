import { type Browser, expect, type Locator, type Page, test } from '@playwright/test'
import { chooseOption } from './select.ts'
import { DUMMY_TURNSTILE_TOKEN } from './turnstile.ts'

const password = 'correct-horse-battery-staple'

/** React 已接管该元素（水合完成）：本项目营销页没有浮动语言下拉，按元素上的 React 内部属性判断 */
const isHydrated = (locator: Locator) =>
  locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith('__react')))
const hydrated = (locator: Locator) =>
  expect.poll(() => isHydrated(locator), { timeout: 30_000 }).toBe(true)

/** 挂起页面脚本请求，模拟营销页首帧后、水合前的时间窗；返回放行函数 */
async function holdScripts(page: Page) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await gate
    await route.fallback().catch(() => {})
  })
  return async () => {
    release()
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  }
}

const preferenceCookie = async (page: Page) =>
  (await page.context().cookies()).find((cookie) => cookie.name === 'locale-preference')?.value

test('浏览器语言偏好只建议不跳转，手动选择和关闭建议会记住偏好', async ({ browser, baseURL }) => {
  // 建议由首帧前脚本按 navigator.languages 决定（suggestion.ts），locale 同时设置它与 Accept-Language；
  // localhost 是未登记 Host，建议全部语言；zh-TW 按地区归入繁体（SUGGESTION_ALIASES）
  const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), locale: 'zh-TW' })
  const page = await context.newPage()
  try {
    await page.goto('/pricing')
    await expect(page).toHaveURL(/\/pricing$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const banner = page.getByRole('complementary', { name: 'Language suggestion' })
    await expect(banner).toBeVisible()
    // CI 中这是冷启动 vite dev 的首个用例，首次按需编译客户端模块可能较慢
    await hydrated(banner)
    await banner.getByRole('link', { name: 'Switch language' }).click()
    await expect(page).toHaveURL(/\/zh-hant\/pricing$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    expect(await preferenceCookie(page)).toBe('zh-Hant')
    // Cookie 记住选择，但直接访问默认语言 URL 仍显示默认语言。
    await page.goto('/pricing')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(banner).toHaveCount(0)
    await context.clearCookies()
    await page.reload()
    await expect(banner).toBeVisible()
    await hydrated(banner)
    await banner.getByRole('button', { name: 'Keep current language' }).click()
    await expect(banner).toBeHidden()
    await page.reload()
    await expect(banner).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('横幅首帧即可操作：水合前点击切换与保留当前语言同样生效', async ({ browser, baseURL }) => {
  // zh-CN 按地区归入简体
  const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), locale: 'zh-CN' })
  const page = await context.newPage()
  const banner = page.getByRole('complementary', { name: 'Language suggestion' })
  try {
    // 保留当前语言：首帧脚本的委托监听写入 Cookie 并隐藏横幅
    let release = await holdScripts(page)
    await page.goto('/pricing', { waitUntil: 'commit' })
    await expect(banner).toBeVisible()
    expect(await isHydrated(banner)).toBe(false)
    await banner.getByRole('button', { name: 'Keep current language' }).click()
    await expect(banner).toBeHidden()
    expect(await preferenceCookie(page)).toBe('en')
    await release()
    await page.reload()
    await expect(banner).toHaveCount(0)

    // 切换：真实链接直接导航，委托监听同时记住选择
    await context.clearCookies()
    release = await holdScripts(page)
    await page.goto('/pricing', { waitUntil: 'commit' })
    await expect(banner).toBeVisible()
    expect(await isHydrated(banner)).toBe(false)
    await banner.getByRole('link', { name: 'Switch language' }).click()
    await expect(page).toHaveURL(/\/zh-hans\/pricing$/)
    await release()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans')
    expect(await preferenceCookie(page)).toBe('zh-Hans')
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

test('已登记的西方站只建议本站语言：浏览器为繁体中文时不输出建议横幅', async ({
  browser,
  baseURL,
}) => {
  const url = new URL(baseURL ?? '')
  url.hostname = 'west.localhost'
  const context = await browser.newContext({ baseURL: url.origin, locale: 'zh-TW' })
  const page = await context.newPage()
  try {
    await page.goto('/pricing')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('[data-locale-suggestion-for]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})
