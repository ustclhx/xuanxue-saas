import { expect, type Page, test } from '@playwright/test'
import { grant } from '@xuanxue/credits'
import { newId } from '@xuanxue/shared'
import { actionDb, actor, reply, requestData, serializer } from './billing-actions-helper.ts'
import { fixtureDb, login, PASSWORD, register } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

// add-reading-monetization tasks.md 3.1：新访客在结果页点击解锁 → 登录 → 积分不足时购买积分包
// （Stripe 离线模拟：拦截 Checkout 的 Server Function，直接按已付款入账积分并走真实的 billing-return
// 回跳）→ 回到原结果页，输入从 `unlock` 令牌恢复，自动开始生成。
// 本地没有真实模型：POST /api/readings 被拦截并返回模拟的 UI message 流（生成管线由
// test/readings.test.ts 以 fake provider 覆盖），这里断言请求体是恢复后的原始输入。

const MODEL_KEY = `e2e-reading-${newId()}`
const PACK_PLAN = newId()
const PACK_PRICE = newId()

test.beforeAll(async () => {
  const sql = fixtureDb()
  try {
    await sql`insert into ai_model (id, key, kind, provider, provider_model_id, pricing)
      values (${newId()}, ${MODEL_KEY}, 'text', 'mock', 'mock-model', ${sql.json({ mode: 'token', inputPer1k: 1, outputPer1k: 1 })})`
    await sql`insert into plan (id, key, name, type, credits, features, sort, active)
      values (${PACK_PLAN}, ${`e2e-reading-pack-${PACK_PLAN}`}, 'E2E Reading', 'credit_pack', 100,
        '{}'::jsonb, 1000, false)`
    await sql`insert into plan_price (id, plan_id, provider, provider_price_id, interval, amount, currency, active)
      values (${PACK_PRICE}, ${PACK_PLAN}, 'stripe', ${`e2e:${PACK_PRICE}`}, null, 99, 'usd', false)`
  } finally {
    await sql.end()
  }
})

test.afterAll(async () => {
  const sql = fixtureDb()
  try {
    await sql`delete from setting where key = 'readings.numerology-full.modelKey'`
    await sql`delete from plan_price where id = ${PACK_PRICE}`
    await sql`delete from plan where id = ${PACK_PLAN}`
    await sql`delete from ai_model where key = ${MODEL_KEY}`
  } finally {
    await sql.end()
  }
})

/**
 * 由管理员在后台选定详批模型：保存时清除设置缓存（KV 缓存 60 秒，直接写库可能读到旧值）。
 * 结束后清空 Cookie，后续步骤是未登录的新访客。
 */
async function enableReading(page: Page) {
  const email = `reading-admin-${newId()}@example.com`
  await register(page, email, 'Readings Admin')
  const sql = fixtureDb()
  try {
    await sql`update "user" set role = 'admin' where email = ${email}`
  } finally {
    await sql.end()
  }
  await page.goto('/admin/settings')
  const form = page.getByRole('form', { name: 'Paid readings' })
  await form.locator('#reading-model-numerology-full').selectOption(MODEL_KEY)
  await form.getByRole('button', { name: 'Save paid readings' }).click()
  await expect(form.getByRole('status')).toHaveText(/^Saved\./)
  await page.context().clearCookies()
}

const REPORT_STREAM = [
  { type: 'start', messageId: 'm1' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: '## Overview\n\nYour life path **11** ' },
  { type: 'text-delta', id: 't1', delta: 'is a master number.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish' },
]
  .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
  .join('')

/** Server Function 路径段是 base64url 编码的 `{file, export}` */
function serverFnId(url: string): string {
  const segment = new URL(url).pathname.split('/').at(-1) ?? ''
  return Buffer.from(segment, 'base64url').toString('utf8')
}

/**
 * 离线 Stripe：报价中注入本测试的积分包（本地没有 Stripe 凭据，readiness 为不可用）；
 * Checkout 调用改为直接入账后返回 billing-return 地址。其余 Server Function 照常访问真实服务。
 */
async function offlineStripe(page: Page, email: string, purchases: string[]) {
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const data = requestData(route)
      if (data.planPriceId !== PACK_PRICE) return route.continue()
      purchases.push(String(data.returnTo))
      const owner = await actor(email)
      const db = actionDb()
      await grant(db, {
        workspaceId: owner.workspaceId,
        source: 'purchase',
        sourceRef: `e2e:${newId()}`,
        amount: 100,
      })
      await db.$client.end()
      const url = `/app/${owner.slug}/billing-return?provider=stripe&returnTo=${encodeURIComponent(String(data.returnTo))}`
      return reply(route, { ok: true, result: { url } })
    }
    // 只改写解锁卡的报价；其余 GET 照常
    if (!serverFnId(request.url()).includes('getReadingOffer')) return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    const envelope = serializer.fromCrossJSON(body, { refs: new Map() })
    const result = envelope.result as { packs?: unknown[]; available?: boolean } | undefined
    if (!result || !('packs' in result) || !result.available)
      return route.fulfill({ response, json: body })
    result.packs = [{ planPriceId: PACK_PRICE, provider: 'stripe', credits: 100, amount: 99 }]
    await route.fulfill({
      status: response.status(),
      headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' },
      body: JSON.stringify(await serializer.toCrossJSONAsync(envelope, { refs: new Map() })),
    })
  })
}

test('新访客登录并购买积分包后回到原结果页，自动开始生成', async ({ page }) => {
  await stubTurnstile(page)
  await enableReading(page)
  const email = `unlock-${newId()}@example.com`
  await register(page, email, 'Unlock Visitor')
  await page.context().clearCookies()
  const purchases: string[] = []
  await offlineStripe(page, email, purchases)
  const generated: unknown[] = []
  await page.route('**/api/readings', async (route) => {
    generated.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-reading-id': '01900000-0000-7000-8000-000000000001',
      },
      body: REPORT_STREAM,
    })
  })

  await page.goto('/')
  await page.getByLabel('Date of birth').fill('1987-11-29')
  await page.getByRole('button', { name: 'Calculate' }).first().click()
  const card = page.getByTestId('reading-unlock')
  await expect(card.getByText('100 credits')).toBeVisible()
  await expect(card.getByTestId('reading-price')).toContainText('$0.99')
  await expect(card.getByRole('listitem').first()).toHaveText('Overview')
  await card.getByRole('button', { name: 'Unlock the full reading' }).click()

  // 未登录：本语言登录页，redirect 带签名的 unlock 参数
  await expect(page).toHaveURL(/\/login\?redirect=%2F%3Funlock%3D/)
  const form = page.getByRole('form', { name: 'Sign in with password' })
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await form.getByRole('button', { name: 'Sign in', exact: true }).click()

  // 回到结果页：输入恢复，积分不足 → 积分包
  await expect(page).toHaveURL(/\/#r=/)
  const pack = page.getByTestId('reading-pack')
  await expect(pack).toContainText('100 credits')
  expect(generated).toEqual([])
  await pack.click()

  // 付款回跳：billing-return → 原页 ?unlock=…&checkout=success → 自动生成
  const stream = page.getByTestId('reading-stream')
  await expect(stream.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(stream.getByText('is a master number.')).toBeVisible()
  expect(purchases).toHaveLength(1)
  expect(purchases[0]).toMatch(/^\/\?unlock=[\w\-.]+$/)
  expect(generated).toEqual([
    {
      kind: 'numerology-full',
      input: { year: 1987, month: 11, day: 29 },
      locale: 'en',
      site: 'west',
    },
  ])
  // 回跳参数已清理，刷新不会再次自动生成
  expect(new URL(page.url()).search).toBe('')
  await page.reload()
  await expect(page.getByTestId('reading-unlock')).toBeVisible()
  expect(generated).toHaveLength(1)
})

test('外部构造的 unlock 链接只恢复输入，不自动扣费', async ({ page }) => {
  await stubTurnstile(page)
  await enableReading(page)
  const email = `forged-${newId()}@example.com`
  await register(page, email, 'Forged Link')
  // 本地没有支付凭据：注入积分包，否则解锁卡按「支付未开通」隐藏
  await offlineStripe(page, email, [])
  let posted = 0
  await page.route('**/api/readings', async (route) => {
    posted++
    await route.abort()
  })
  const body = Buffer.from(
    JSON.stringify({
      v: 1,
      kind: 'numerology-full',
      share: { date: '1990-02-03' },
      returnTo: '/',
      exp: Date.now() + 60_000,
    }),
  ).toString('base64url')
  await page.goto(`/?unlock=${body}.forged`)
  // 结果按令牌中的日期复现（1990-02-03 → 生命灵数 6），解锁卡出现但不自动生成
  await expect(page.locator('#life-path-result')).toContainText('6')
  await expect(page.getByTestId('reading-unlock')).toBeVisible()
  expect(posted).toBe(0)
  await login(page, email)
})

test('支付未开通（没有可购买的积分包）时不显示解锁卡，免费结果照常', async ({ page }) => {
  await stubTurnstile(page)
  await enableReading(page)
  await page.goto('/')
  await page.getByLabel('Date of birth').fill('1987-11-29')
  await page.getByRole('button', { name: 'Calculate' }).first().click()
  await expect(page.locator('#life-path-result')).toContainText('11')
  await expect(page.getByTestId('reading-unlock')).toHaveCount(0)
})
