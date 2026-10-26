import { AppError } from '@xuanxue/shared'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  process: vi.fn(),
  checkout: vi.fn(),
  confirm: vi.fn(),
  eventsAvailable: true,
  emailAvailable: true,
  refund: vi.fn(),
  db: { transaction: vi.fn(), insert: vi.fn() },
  catalog: {
    plans: [{ id: 'pro', name: 'Pro' }],
    prices: [{ provider: 'stripe', available: true }],
  },
  deletion: vi.fn(),
  status: vi.fn(),
  requestUrl: 'https://app.test',
}))
vi.mock('../../server/runtime.ts', () => ({
  getWebRuntime: () => ({
    config: mocks.env,
    db: mocks.db,
    cache: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    requestMeta: { clientIp: '198.51.100.42', requestId: 'test-request' },
    emailQueue: mocks.emailAvailable
      ? { available: true, value: { send: vi.fn() } }
      : { available: false },
    eventsQueue: mocks.eventsAvailable
      ? { available: true, value: { send: vi.fn() } }
      : { available: false },
  }),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  isNotFound: () => false,
}))
vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({ server: () => ({}) }),
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      validator: () => builder,
      handler: (handler: (...args: unknown[]) => unknown) => handler,
    }
    return builder
  },
}))
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: mocks.status,
  getRequest: () => new Request(mocks.requestUrl),
}))
vi.mock('../../server/middleware.ts', () => ({ withRealSession: {}, withWorkspace: {} }))
vi.mock('../admin/admin.functions.ts', () => ({ adminMiddleware: {} }))
vi.mock('../admin/action.server.ts', () => ({
  withAdminAction: vi.fn(),
  withDelegatedAdminAction: vi.fn(),
}))
vi.mock('./admin-data.ts', () => ({
  listAdminPayments: async () => ({ rows: [] }),
  listAdminPurchases: vi.fn(),
  listAdminRefunds: vi.fn(),
  listAdminSubscriptions: vi.fn(),
  listAdminWebhooks: vi.fn(),
}))
vi.mock('@xuanxue/db', async (original) => ({
  ...(await original<typeof import('@xuanxue/db')>()),
  createDb: () => mocks.db,
}))
vi.mock('@xuanxue/billing', async (original) => ({
  ...(await original<typeof import('@xuanxue/billing')>()),
  processWebhook: mocks.process,
  createCheckout: mocks.checkout,
  confirmCheckout: mocks.confirm,
  submitRefundRequest: mocks.refund,
  createBillingDeletionStep: mocks.deletion,
}))
vi.mock('../../server/template-config.ts', () => ({
  templateConfig: {
    credits: { enabled: true },
    billing: { enabled: true, providers: ['stripe', 'paypal'], refundWindowDays: 30 },
    i18n: { enabled: true, locales: ['en', 'zh-Hant', 'ko'], defaultLocale: 'en' },
    sites: {
      east: {
        hosts: ['ganjiday.com'],
        locales: ['zh-Hant', 'ko'],
        defaultLocale: null,
        brand: { name: 'Ganjiday', names: { 'zh-Hant': '干支日', ko: '간지데이' } },
      },
      west: {
        hosts: ['arcanumber.com'],
        locales: ['en'],
        defaultLocale: 'en',
        brand: { name: 'Arcanumber', names: {} },
      },
    },
  },
}))
vi.mock('../marketing/pricing-data.ts', () => ({
  createPricingCache: () => async () => mocks.catalog,
}))
vi.mock('../marketing/pricing-snapshot.ts', () => ({ pricingSnapshot: {} }))

import { handlePaymentWebhook } from '../../routes/api/billing/webhooks/$provider.ts'
import { getMarketingPricing } from '../marketing/pricing.functions.ts'
import { getAdminBilling, replayAdminWebhook } from './admin.functions.ts'
import { checkoutCustomer, confirmCustomerCheckout } from './customer.functions.ts'
import { createBillingDeletionSteps as billingDeletionSteps } from './deletion.server.ts'
import { requestCustomerRefund } from './refund.functions.ts'

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of Object.keys(mocks.env)) delete mocks.env[key]
  mocks.env.HYPERDRIVE = { connectionString: 'offline' }
  mocks.eventsAvailable = true
  mocks.emailAvailable = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it.each([
  { SENTRY_ENVIRONMENT: 'production' },
  { PAYMENT_MODE: 'live', STRIPE_SECRET_KEY: 'sk_test_fixture' },
  { PAYMENT_MODE: 'test', STRIPE_SECRET_KEY: 'sk_live_fixture' },
])('invalid payment configuration returns 503 before webhook accounting: %j', async (env) => {
  Object.assign(mocks.env, env)
  const response = await handlePaymentWebhook(
    new Request('https://app.test/api/billing/webhooks/stripe', { method: 'POST', body: '{}' }),
    'stripe',
  )
  expect(response.status).toBe(503)
  expect(mocks.process).not.toHaveBeenCalled()
  expect(mocks.db.transaction).not.toHaveBeenCalled()
  expect(mocks.db.insert).not.toHaveBeenCalled()
})

it('invalid payment configuration leaves marketing prices visible and all providers unavailable', async () => {
  mocks.env.PAYMENT_MODE = 'invalid'
  const result = await (
    getMarketingPricing as unknown as () => Promise<
      typeof mocks.catalog & {
        providers: { available: boolean }[]
      }
    >
  )()
  expect(result.plans).toEqual(mocks.catalog.plans)
  expect(result.providers).toEqual([
    { id: 'stripe', available: false },
    { id: 'paypal', available: false },
  ])
  expect(result.prices[0]?.available).toBe(false)
})

it('ordinary auth creates deletion steps without payment configuration, then invalid mode rejects before writes', async () => {
  mocks.env.PAYMENT_MODE = 'invalid'
  const db = mocks.db as unknown as Parameters<typeof billingDeletionSteps>[1]
  const [step] = billingDeletionSteps(mocks.env, db, {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  })
  expect(mocks.deletion).not.toHaveBeenCalled()
  await expect(
    step?.before?.({ actorUserId: 'actor', workspaceIds: ['workspace'], db }),
  ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE', status: 503 })
  expect(mocks.deletion).not.toHaveBeenCalled()
  expect(mocks.db.transaction).not.toHaveBeenCalled()
})

it('payments off (no PAYMENT_MODE) still deletes, leaving subscription checks to the step', async () => {
  mocks.env.SENTRY_ENVIRONMENT = 'production'
  const before = vi.fn()
  mocks.deletion.mockReturnValue({ before, execute: vi.fn() })
  const db = mocks.db as unknown as Parameters<typeof billingDeletionSteps>[1]
  const [step] = billingDeletionSteps(mocks.env, db, {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  })
  const context = { actorUserId: 'actor', workspaceIds: ['workspace'], db }
  await step?.before?.(context)
  expect(mocks.deletion).toHaveBeenCalledWith(expect.objectContaining({ providers: {} }))
  expect(before).toHaveBeenCalledWith(context)
})

it.each([checkoutCustomer, replayAdminWebhook])(
  'payment actions preserve their result format and set HTTP 503',
  async (action) => {
    const result = await (action as unknown as (input: unknown) => Promise<unknown>)({
      context: { db: mocks.db, workspaceReadOnly: false },
      data: {},
    })
    expect(result).toEqual({ ok: false, error: 'BILLING_UNAVAILABLE' })
    expect(mocks.status).toHaveBeenCalledWith(503)
    expect(mocks.db.transaction).not.toHaveBeenCalled()
  },
)

it('admin billing returns the actual live mode', async () => {
  mocks.env.PAYMENT_MODE = 'live'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const result = await (
    getAdminBilling as unknown as (input: unknown) => Promise<{ mode: string }>
  )({ context: { db: mocks.db }, data: {} })
  expect(result.mode).toBe('live')
})

it('payment reads retain HTTP 503 when the runtime rejects configuration', async () => {
  await expect(
    (getAdminBilling as unknown as (input: unknown) => Promise<unknown>)({
      context: { db: mocks.db },
      data: {},
    }),
  ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE', status: 503 })
  expect(mocks.status).toHaveBeenCalledWith(503)
})

it('missing event capability rejects a webhook before accounting writes', async () => {
  mocks.env.PAYMENT_MODE = 'test'
  mocks.env.STRIPE_SECRET_KEY = 'sk_test_fixture'
  mocks.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture'
  mocks.eventsAvailable = false
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const response = await handlePaymentWebhook(
    new Request('https://app.test/api/billing/webhooks/stripe', { method: 'POST', body: '{}' }),
    'stripe',
  )
  expect(response.status).toBe(503)
  expect(mocks.process).not.toHaveBeenCalled()
  expect(mocks.db.transaction).not.toHaveBeenCalled()
})

it('checkout audit uses the trusted runtime IP and configured return URL', async () => {
  mocks.env.PAYMENT_MODE = 'test'
  mocks.env.APP_URL = 'https://configured.test'
  mocks.checkout.mockResolvedValue({ url: 'https://checkout.test' })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const result = await (checkoutCustomer as unknown as (input: unknown) => Promise<unknown>)({
    context: {
      db: mocks.db,
      workspaceReadOnly: false,
      workspace: { id: 'workspace', slug: 'team' },
      user: { id: 'user' },
    },
    data: { provider: 'stripe', planPriceId: 'price', idempotencyKey: 'key' },
  })
  expect(result).toEqual({ ok: true, result: { url: 'https://checkout.test' } })
  expect(mocks.checkout).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      ip: '198.51.100.42',
      successUrl: 'https://configured.test/app/team/billing-return?provider=stripe',
    }),
  )
})

it('checkout started on the east site returns there and then to the originating page', async () => {
  mocks.env.PAYMENT_MODE = 'test'
  mocks.env.APP_URL = 'https://arcanumber.com'
  mocks.requestUrl = 'https://ganjiday.com/_serverFn/checkout'
  mocks.checkout.mockResolvedValue({ url: 'https://checkout.test' })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const checkout = checkoutCustomer as unknown as (input: unknown) => Promise<unknown>
  const input = (returnTo: string) => ({
    context: {
      db: mocks.db,
      workspaceReadOnly: false,
      workspace: { id: 'workspace', slug: 'team' },
      user: { id: 'user' },
    },
    data: { provider: 'stripe', planPriceId: 'price', idempotencyKey: 'key', returnTo },
  })
  await checkout(input('/ko/manseryeok'))
  expect(mocks.checkout).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      successUrl:
        'https://ganjiday.com/app/team/billing-return?provider=stripe&returnTo=%2Fko%2Fmanseryeok',
      cancelUrl:
        'https://ganjiday.com/app/team/billing-return?provider=stripe&canceled=true&returnTo=%2Fko%2Fmanseryeok',
    }),
  )
  // PayPal 页面展示按请求站点与 returnTo 语言在服务端生成，商品说明只含积分数与品牌
  const presentation = mocks.checkout.mock.lastCall?.[1].presentation
  expect(presentation).toMatchObject({ brandName: '간지데이', locale: 'ko' })
  expect(presentation.describe({ credits: 100 })).toBe('100 크레딧 · 간지데이')
  // 不安全的 returnTo 被丢弃，回到计费页
  await checkout(input('//evil.example'))
  expect(mocks.checkout).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      successUrl: 'https://ganjiday.com/app/team/billing-return?provider=stripe',
    }),
  )
  mocks.requestUrl = 'https://app.test'
})

it('capture failures return retryUrl only for a declined payment method', async () => {
  mocks.env.PAYMENT_MODE = 'test'
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const confirm = confirmCustomerCheckout as unknown as (input: unknown) => Promise<unknown>
  const input = {
    context: {
      db: mocks.db,
      workspaceReadOnly: false,
      workspace: { id: 'workspace', slug: 'team' },
      user: { id: 'user' },
    },
    data: { provider: 'paypal', providerRef: 'ORDER' },
  }
  const retryUrl = 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER'
  mocks.confirm.mockRejectedValueOnce(
    new AppError('BILLING_PAYMENT_DECLINED', 'Payment method declined', {
      status: 402,
      details: { retryUrl },
    }),
  )
  expect(await confirm(input)).toEqual({ ok: false, error: 'BILLING_PAYMENT_DECLINED', retryUrl })
  mocks.confirm.mockRejectedValueOnce(
    new AppError('BILLING_PURCHASE_NOT_PENDING', 'Purchase cannot be captured', {
      details: { retryUrl },
    }),
  )
  expect(await confirm(input)).toEqual({ ok: false, error: 'BILLING_PURCHASE_NOT_PENDING' })
  // 平台错误不向用户透出原文，只记日志
  mocks.confirm.mockRejectedValueOnce(new Error('PayPal HTTP request failed (500)'))
  expect(await confirm(input)).toEqual({ ok: false, error: 'BILLING_UNAVAILABLE' })
  mocks.confirm.mockResolvedValueOnce(undefined)
  expect(await confirm(input)).toEqual({ ok: true, result: { status: 'awaiting_payment' } })
})

it.each(['events', 'email'] as const)(
  'missing %s queue rejects a refund before submission',
  async (queue) => {
    if (queue === 'events') mocks.eventsAvailable = false
    else mocks.emailAvailable = false
    const result = await (requestCustomerRefund as unknown as (input: unknown) => Promise<unknown>)(
      {
        context: { db: mocks.db, workspaceReadOnly: false },
        data: {},
      },
    )
    expect(result).toEqual({ ok: false, error: 'CAPABILITY_UNAVAILABLE' })
    expect(mocks.status).toHaveBeenCalledWith(503)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.db.transaction).not.toHaveBeenCalled()
  },
)
