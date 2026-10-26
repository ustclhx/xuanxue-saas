import { createRequire } from 'node:module'
import { expect, type Page, type Route } from '@playwright/test'
import { createDb } from '@xuanxue/db'
import { readLocalEnv } from '@xuanxue/db/worktree-env'
import { fixtureDb } from './fixtures.ts'

// Resolve the serializer used by the installed Start transport, without adding dependencies.
const require = createRequire(new URL('../package.json', import.meta.url))
const start = createRequire(require.resolve('@tanstack/react-start/package.json'))
const client = createRequire(start.resolve('@tanstack/start-client-core/package.json'))
export const serializer = client('seroval') as {
  fromJSON(value: unknown): { data: Record<string, unknown> }
  fromCrossJSON(
    value: unknown,
    options: { refs: Map<unknown, unknown> },
  ): { result?: Record<string, unknown> }
  toCrossJSONAsync(value: unknown, options: { refs: Map<unknown, unknown> }): Promise<unknown>
}

export function actionDb() {
  const url = readLocalEnv('DATABASE_URL')
  if (!url || !/^\/xuanxue_wt_[a-z0-9_]+$/.test(new URL(url).pathname))
    throw new Error('Billing actions require an isolated worktree database')
  for (const key of ['STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'])
    expect(readLocalEnv(key) || process.env[key], `${key} must remain absent`).toBeFalsy()
  return createDb({ connectionString: url })
}

export async function actor(email: string) {
  const sql = fixtureDb()
  try {
    const [row] = await sql`select u.id as user_id,o.id as workspace_id,o.slug from "user" u
      join member m on m.user_id=u.id join organization o on o.id=m.organization_id
      where u.email=${email} and m.role='owner' limit 1`
    if (!row) throw new Error('Missing registered billing owner')
    return {
      userId: String(row.user_id),
      workspaceId: String(row.workspace_id),
      slug: String(row.slug),
    }
  } finally {
    await sql.end()
  }
}

export function requestData(route: Route) {
  return serializer.fromJSON(route.request().postDataJSON()).data
}

export async function reply(route: Route, result: unknown) {
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' },
    body: JSON.stringify(
      await serializer.toCrossJSONAsync({ result, context: {} }, { refs: new Map() }),
    ),
  })
}

/** Real authenticated GETs remain real; only the provider readiness flags change.
 * POST response transport calls the real domain service with a deterministic provider.
 * Enter via a client-side link so server-side rendering is never replaced.
 */
export async function offlineProviderTransport(
  page: Page,
  action: (data: Record<string, unknown>) => Promise<unknown>,
) {
  await page.route('**/_serverFn/**', async (route) => {
    if (route.request().method() === 'POST') {
      await reply(route, await action(requestData(route)))
      return
    }
    const response = await route.fetch()
    expect(response.headers()['x-tss-serialized']).toBe('true')
    const envelope = serializer.fromCrossJSON(await response.json(), { refs: new Map() })
    const result = envelope.result
    if (result && 'catalog' in result) {
      const catalog = result.catalog as { providers: { id: string; available: boolean }[] }
      for (const provider of catalog.providers)
        if (provider.id === 'paypal') provider.available = true
    }
    if (result && 'rows' in result)
      for (const row of result.rows as { provider: string; providerAvailable: boolean }[])
        if (row.provider === 'paypal') row.providerAvailable = true
    await route.fulfill({
      status: response.status(),
      headers: { 'content-type': 'application/json', 'x-tss-serialized': 'true' },
      body: JSON.stringify(await serializer.toCrossJSONAsync(envelope, { refs: new Map() })),
    })
  })
}

/** 兼容合并前的手动 capture 和合并后的自动 capture，共用同一离线流程。 */
export async function completeOfflineCheckout(page: Page, checkout: () => Promise<void>) {
  let captured = false
  const capture = page.waitForResponse((response) => {
    const request = response.request()
    if (request.method() !== 'POST' || !request.url().includes('/_serverFn/')) return false
    const data = serializer.fromJSON(request.postDataJSON()).data
    return data.provider === 'paypal' && typeof data.providerRef === 'string'
  })
  void capture.then(
    () => {
      captured = true
    },
    () => {},
  )
  await checkout()
  const confirm = page.getByRole('button', { name: 'Confirm payment', exact: true })
  await expect
    .poll(
      async () => {
        if ((await confirm.isVisible()) && (await confirm.isEnabled())) await confirm.click()
        return captured
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  await capture
  if (await confirm.count()) {
    await expect(confirm).toBeDisabled()
    await page.getByRole('link', { name: /^Return to (billing|previous page)$/ }).click()
  }
}
