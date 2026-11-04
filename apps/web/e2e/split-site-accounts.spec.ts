import { randomUUID } from 'node:crypto'
import {
  type Browser,
  type BrowserContext,
  expect as baseExpect,
  type Page,
  test,
} from '@playwright/test'
import { createDb } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import { APP_URL, login, register, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// openspec split-site-accounts 4.1：两站账户按站点独立。同一邮箱在 east.localhost 与 west.localhost
// 各注册一次，依次验证余额独立、会话 Cookie 不跨站、西方站删号不影响东方站。
// 本地按 Host 识别站点（features/site/site.ts）；CI 随 smoke 配置运行，库为 xuanxue_ci_e2e。

/** 与 smoke-setup 相同的隔离库校验：只连本机 worktree 库或 CI 的 e2e 库，绝不写共享库。 */
function isolatedDb() {
  const connectionString = readLocalEnv('MIGRATION_DATABASE_URL')
  if (!connectionString) throw new Error('Split-site e2e requires an isolated local database')
  const url = new URL(connectionString)
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !(url.pathname.startsWith('/xuanxue_wt_') || url.pathname === '/xuanxue_ci_e2e')
  )
    throw new Error('Split-site e2e requires a worktree database or xuanxue_ci_e2e on localhost')
  return createDb({ connectionString })
}

// 后台积分页、账户页等在 vite dev 下首次访问时才编译，CI 冷启动可能超过默认 5 秒
const expect = baseExpect.configure({ timeout: 20_000 })

function siteOrigin(baseURL: string | undefined, site: 'east' | 'west') {
  const url = new URL(baseURL ?? '')
  url.hostname = `${site}.localhost`
  return url.origin
}

/** 每个站点、每个身份用独立 context：独立 Cookie 与模拟 IP，避免认证限流相互影响。 */
async function siteContext(browser: Browser, origin: string) {
  const context = await browser.newContext({ baseURL: origin })
  const page = await context.newPage()
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.hostname === 'challenges.cloudflare.com')
      return route.fallback()
    // 公开页的 Web Analytics 等外部请求在离线 e2e 中一律拦截
    await route.abort()
  })
  await stubTurnstile(page)
  await simulateClientIp(page)
  return { context, page }
}

async function expectAvailableCredits(page: Page, amount: number) {
  await page.goto('/app')
  await expect(page).toHaveURL(APP_URL)
  await page.goto(`${new URL(page.url()).pathname.replace(/\/$/, '')}/billing`)
  await expect(page.getByText(`Available credits: ${amount} ·`, { exact: false })).toBeVisible()
}

test('same email on east and west: independent balances, sessions and deletion', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000)
  const east = siteOrigin(baseURL, 'east')
  const west = siteOrigin(baseURL, 'west')
  const suffix = randomUUID().slice(0, 8)
  const email = `split-site-${randomUUID()}@example.com`
  const adminEmail = `split-site-admin-${randomUUID()}@example.com`
  const contexts: BrowserContext[] = []
  const open = async (origin: string) => {
    const opened = await siteContext(browser, origin)
    contexts.push(opened.context)
    return opened
  }
  const db = isolatedDb()
  const sql = db.$client
  try {
    // 1. 同一邮箱两站各注册一次（不同姓名，便于在后台区分），得到两个用户与两个个人空间
    const eastUser = await open(east)
    await register(eastUser.page, email, `Split East ${suffix}`)
    const westUser = await open(west)
    await register(westUser.page, email, `Split West ${suffix}`)
    const accounts =
      await sql`select u.site, u.id as user_id, o.id as workspace_id, o.site as workspace_site
      from "user" u join member m on m.user_id = u.id and m.role = 'owner'
      join organization o on o.id = m.organization_id
      where u.email = ${email} order by u.site`
    expect(accounts.map((row) => [row.site, row.workspace_site])).toEqual([
      ['east', 'east'],
      ['west', 'west'],
    ])
    const [eastAccount, westAccount] = accounts
    if (!eastAccount || !westAccount) throw new Error('Missing per-site accounts')
    expect(eastAccount.user_id).not.toBe(westAccount.user_id)
    expect(eastAccount.workspace_id).not.toBe(westAccount.workspace_id)

    // 2. 东方站管理员在后台给东方站账户发放积分；西方站同邮箱账户余额仍为 0。
    //    目标空间按东方站账户的 workspaceId 定位，不依赖后台用户搜索是否按站点过滤。
    const admin = await open(east)
    await register(admin.page, adminEmail, `Split Admin ${suffix}`)
    const promoted =
      await sql`update "user" set role = 'admin' where email = ${adminEmail} and site = 'east' returning id`
    expect(promoted).toHaveLength(1)
    await admin.page.goto(`/admin/credits?workspaceId=${eastAccount.workspace_id}`)
    await expect(admin.page.getByRole('heading', { name: 'Credit adjustments' })).toBeVisible()
    const amount = admin.page.getByLabel('Amount', { exact: true })
    const addCredits = admin.page.getByRole('button', { name: 'Add credits', exact: true })
    // 等 hydration 后表单可用再填写（不使用 networkidle）
    await expect
      .poll(async () => {
        await amount.fill('')
        await amount.fill('100')
        await admin.page.getByLabel('Reason', { exact: true }).fill('')
        await admin.page.getByLabel('Reason', { exact: true }).fill('split-site-accounts e2e')
        return addCredits.isEnabled()
      })
      .toBe(true)
    await addCredits.click()
    await expect(admin.page.getByText('Adjustment applied.', { exact: true })).toBeVisible()
    await expectAvailableCredits(eastUser.page, 100)
    await expectAvailableCredits(westUser.page, 0)
    const grants = await sql`select workspace_id, amount from credit_grant
      where workspace_id in (${eastAccount.workspace_id}, ${westAccount.workspace_id})`
    expect(grants.map((row) => [row.workspace_id, row.amount])).toEqual([
      [eastAccount.workspace_id, 100],
    ])

    // 3. 东方站的会话 Cookie 换到西方站无效：进入 /app 跳转登录页
    const copyCookies = async (from: BrowserContext, fromOrigin: string, toOrigin: string) => {
      const cookies = await from.cookies(fromOrigin)
      expect(cookies.some((cookie) => cookie.name.endsWith('session_token'))).toBe(true)
      const target = await open(toOrigin)
      await target.context.addCookies(
        cookies.map(({ name, value, path, expires, httpOnly, secure, sameSite }) => ({
          name,
          value,
          path,
          expires,
          httpOnly,
          secure,
          sameSite,
          domain: new URL(toOrigin).hostname,
        })),
      )
      await target.page.goto('/app')
      return target.page
    }
    // 对照：同一组 Cookie 复制到同站的新 context 仍有效，排除复制方式本身导致的失效
    await expect(await copyCookies(eastUser.context, east, east)).toHaveURL(APP_URL)
    await expect(await copyCookies(eastUser.context, east, west)).toHaveURL(/\/login(?:\?|$)/)
    // 反向同样无效：西方站 Cookie 不能进入东方站
    await expect(await copyCookies(westUser.context, west, east)).toHaveURL(/\/login(?:\?|$)/)

    // 4. 西方站删号后，东方站同邮箱账户仍能用密码登录，余额不变
    await westUser.page.goto('/account')
    const confirm = westUser.page.getByLabel('Type DELETE to confirm')
    const deleteButton = westUser.page.getByRole('button', { name: 'Delete account', exact: true })
    await expect
      .poll(async () => {
        await confirm.fill('')
        await confirm.fill('DELETE')
        return deleteButton.isEnabled()
      })
      .toBe(true)
    await deleteButton.click()
    await expect(westUser.page).toHaveURL(/\/login(?:\?|$)/)
    const [westAfter] =
      await sql`select deleted_at from organization where id = ${westAccount.workspace_id}`
    expect(westAfter?.deleted_at).not.toBeNull()

    const eastAgain = await open(east)
    await login(eastAgain.page, email)
    await expect(eastAgain.page.getByTestId('current-user')).toContainText(email)
    await expectAvailableCredits(eastAgain.page, 100)
    const [eastAfter] = await sql`select u.id, o.deleted_at from "user" u
      join organization o on o.id = ${eastAccount.workspace_id}
      where u.id = ${eastAccount.user_id}`
    expect(eastAfter?.deleted_at).toBeNull()
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await sql.end()
  }
})
