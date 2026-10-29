import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { capture, grant, hold } from '@xuanxue/credits'
import { createDb } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import { reply, requestData, serializer } from './billing-actions-helper.ts'
import { fixtureDb, register, seedBillingCatalog, simulateClientIp } from './fixtures.ts'
import { stubTurnstile } from './turnstile.ts'

test('public pricing describes unavailable payments without a checkout success', async ({
  page,
}) => {
  await seedBillingCatalog()
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible()
  await expect(page.getByText('Online payment is coming soon', { exact: false })).toBeVisible()
  const packs = page.getByTestId('pricing-pack')
  await expect(packs).toHaveCount(2)
  await expect(packs.first()).toContainText('Single Reading')
  await expect(packs.first()).toContainText('$1.99')
  await expect(packs.last()).toContainText('Unlocks 5 full readings')
  await expect(page.getByRole('link', { name: 'Buy credits' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /checkout|pay now/i })).toHaveCount(0)

  // 东方站语言版本
  await page.goto('/ko/pricing')
  await expect(page.getByRole('heading', { name: '요금 안내', exact: true })).toBeVisible()
  await expect(page.getByTestId('pricing-pack').first()).toContainText('≈ ₩')
})

test('billing and usage require a fresh authenticated workspace session', async ({ page }) => {
  await page.goto('/app/no-session/billing')
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/app/no-session/usage')
  await expect(page).toHaveURL(/\/login/)
})

/** Server Function 路径段是 base64url 编码的 `{file, export}` */
function serverFnId(url: string): string {
  const segment = new URL(url).pathname.split('/').at(-1) ?? ''
  return Buffer.from(segment, 'base64url').toString('utf8')
}

const RETRY_URL = 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-TOKEN'

test('PayPal return captures once automatically and routes each result', async ({ page }) => {
  await simulateClientIp(page)
  await stubTurnstile(page)
  await register(page, `billing-return-${randomUUID()}@example.com`)
  const workspacePath = new URL(page.url()).pathname.replace(/\/$/, '')
  // 本地没有 PayPal 凭据：按与 A 组约定的契约模拟 confirmCustomerCheckout 的返回（design D2）
  const captures: Record<string, unknown>[] = []
  const results: unknown[] = []
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request()
    if (
      request.method() !== 'POST' ||
      !serverFnId(request.url()).includes('confirmCustomerCheckout')
    )
      return route.continue()
    captures.push(requestData(route))
    await reply(route, results.shift() ?? { ok: false, error: 'BILLING_UNAVAILABLE' })
  })
  await page.route('https://www.sandbox.paypal.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>PayPal sandbox</title>' }),
  )
  const confirmButton = page.getByRole('button', { name: 'Confirm payment' })

  await test.step('subscription and canceled returns never capture', async () => {
    for (const [query, text] of [
      [
        'provider=paypal&subscription_id=I-SUBSCRIPTION&ba_token=BA-TOKEN&token=8F-TOKEN',
        'Your credits update after the payment is verified.',
      ],
    ] as const) {
      await page.goto(`${workspacePath}/billing-return?${query}`)
      await expect(page.getByRole('status')).toContainText(text)
      await page.waitForLoadState('networkidle')
    }
    // 从账单页发起（无 returnTo）的取消直接回到账单页并提示
    await page.goto(
      `${workspacePath}/billing-return?provider=paypal&token=ORDER-TOKEN&canceled=true`,
    )
    await expect(page).toHaveURL(/\/billing\?checkout=canceled$/)
    await expect(page.getByRole('status')).toContainText('Checkout was canceled.')
    await page.goto(
      `${workspacePath}/billing-return?provider=paypal&token=ORDER-TOKEN&canceled=true&returnTo=${encodeURIComponent('/ko/pricing')}`,
    )
    await expect(page).toHaveURL(/\/ko\/pricing\?checkout=canceled$/)
    expect(captures).toHaveLength(0)
  })

  await test.step('errors are localized from returnTo and can be retried', async () => {
    results.push(
      { ok: false, error: 'BILLING_UNAVAILABLE' },
      { ok: true, result: { status: 'awaiting_payment' } },
    )
    await page.goto(
      `${workspacePath}/billing-return?provider=paypal&token=ORDER-TOKEN&returnTo=${encodeURIComponent('/ko/pricing')}`,
    )
    await expect(page.getByRole('heading', { name: '결제', exact: true })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('결제를 확인하지 못했습니다')
    await expect(confirmButton).toHaveCount(0)
    expect(captures).toEqual([
      { slug: expect.any(String), provider: 'paypal', providerRef: 'ORDER-TOKEN' },
    ])
    await page.getByRole('button', { name: '다시 시도', exact: true }).click()
    await expect(page).toHaveURL(/\/ko\/pricing\?checkout=success$/)
    expect(captures).toHaveLength(2)
  })

  await test.step('success without returnTo goes to billing', async () => {
    captures.length = 0
    results.push({ ok: true, result: { status: 'awaiting_payment' } })
    await page.goto(`${workspacePath}/billing-return?provider=paypal&token=ORDER-TOKEN`)
    await expect(page).toHaveURL(new RegExp(`${workspacePath}/billing$`))
    expect(captures).toHaveLength(1)
  })

  await test.step('declined payment returns to PayPal', async () => {
    captures.length = 0
    results.push({ ok: false, error: 'BILLING_PAYMENT_DECLINED', retryUrl: RETRY_URL })
    await page.goto(`${workspacePath}/billing-return?provider=paypal&token=ORDER-TOKEN`)
    await expect(page).toHaveURL(RETRY_URL)
    expect(captures).toHaveLength(1)
  })
})

test('billing hides the payment method selector unless several providers are available', async ({
  page,
}) => {
  await simulateClientIp(page)
  await stubTurnstile(page)
  await register(page, `billing-providers-${randomUUID()}@example.com`)
  let providers: { id: string; available: boolean }[] = []
  // 只改写客户端导航时账单 loader 的可用支付方式，其余请求照常
  await page.route('**/_serverFn/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET' || !serverFnId(request.url()).includes('getCustomerBilling'))
      return route.continue()
    const response = await route.fetch()
    const envelope = serializer.fromCrossJSON(await response.json(), { refs: new Map() })
    const result = envelope.result as { catalog: { providers: unknown[] } }
    result.catalog.providers = providers
    await route.fulfill({
      status: response.status(),
      headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' },
      body: JSON.stringify(await serializer.toCrossJSONAsync(envelope, { refs: new Map() })),
    })
  })
  const workspacePath = new URL(page.url()).pathname.replace(/\/$/, '')
  const billingLink = page.locator('aside').getByRole('link', { name: 'Billing', exact: true })
  const heading = page.getByRole('heading', { name: 'Choose a plan or credit pack' })
  const selector = page.getByLabel(/Payment method/)
  for (const { name, list, visible } of [
    {
      name: 'single available provider',
      list: [
        { id: 'stripe', available: false },
        { id: 'paypal', available: true },
      ],
      visible: false,
    },
    {
      name: 'several available providers',
      list: [
        { id: 'stripe', available: true },
        { id: 'paypal', available: true },
      ],
      visible: true,
    },
  ]) {
    await test.step(name, async () => {
      providers = list
      await page.goto(`${workspacePath}/usage`)
      await page.waitForLoadState('networkidle')
      // 等待客户端导航真正经过被改写的 loader 请求（而不是整页 SSR）
      const loaded = page.waitForResponse((response) =>
        serverFnId(response.url()).includes('getCustomerBilling'),
      )
      await billingLink.click()
      await loaded
      await expect(heading).toBeVisible()
      await expect(selector).toHaveCount(visible ? 1 : 0)
    })
  }
})

test('ordinary members see their own ledger without workspace credits or billing history', async ({
  page,
}) => {
  const sql = fixtureDb()
  const email = `billing-member-${randomUUID()}@example.com`
  const workspaceId = randomUUID()
  const usageRef = randomUUID()
  const slug = `billing-${workspaceId}`
  try {
    await simulateClientIp(page)
    await stubTurnstile(page)
    await register(page, email)
    const [account] = await sql`select id from "user" where email=${email}`
    if (!account) throw new Error('Missing registered fixture')
    await sql`insert into organization (id,name,slug) values (${workspaceId},'Billing privacy fixture',${slug})`
    await sql`insert into member (id,organization_id,user_id,role) values (${randomUUID()},${workspaceId},${account.id},'member')`
    const url = readLocalEnv('DATABASE_URL')
    if (!url) throw new Error('Missing isolated worktree database')
    const db = createDb({ connectionString: url })
    try {
      await grant(db, {
        workspaceId,
        source: 'admin',
        sourceRef: `workspace-private-reference:${workspaceId}`,
        amount: 100,
      })
      const reservation = await hold(db, {
        workspaceId,
        userId: String(account.id),
        amount: 2,
        refType: 'ai_message',
        refId: usageRef,
      })
      await capture(db, { workspaceId, holdId: reservation.id, actualAmount: 2 })
    } finally {
      await db.$client.end()
    }
    await page.goto(`/app/${slug}/usage`)
    await expect(page.getByText('Your own credit activity is shown below.')).toBeVisible()
    await expect(page.getByText(`ai_message · ${usageRef}`)).toBeVisible()
    expect(await page.content()).not.toContain('workspace-private-reference')
    await expect(page.getByRole('heading', { name: 'Credit batches' })).toHaveCount(0)
    await page.goto(`/app/${slug}/billing`)
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Payment history' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue to checkout' })).toHaveCount(0)
  } finally {
    await sql.end()
  }
})
