import type { PlanPrice } from '@xuanxue/db/schema'
import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import type { CheckoutInput, PlanSyncInput, RefundInput } from '../provider.ts'
import { createStripeClient, STRIPE_API_VERSION } from './client.ts'
import { parseStripeMetadata } from './metadata.ts'
import { createStripeOperations } from './operations.ts'

const workspaceId = '019a0000-0000-7000-8000-000000000001'
const userId = '019a0000-0000-7000-8000-000000000002'
const planId = '019a0000-0000-7000-8000-000000000003'
const planPriceId = '019a0000-0000-7000-8000-000000000004'
const nextPriceId = '019a0000-0000-7000-8000-000000000005'
const metadata = { workspaceId, userId, planPriceId }
const price: PlanPrice = {
  id: planPriceId,
  planId,
  provider: 'stripe',
  providerPriceId: 'price_current',
  interval: 'month',
  amount: 2000,
  currency: 'usd',
  active: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
}
const checkout: CheckoutInput = {
  workspaceId,
  userId,
  price,
  mode: 'subscription',
  customerEmail: 'buyer@example.com',
  successUrl: 'https://app.example/success',
  cancelUrl: 'https://app.example/cancel',
  idempotencyKey: 'checkout-request-1',
}
const targetPrice = { ...price, id: nextPriceId, providerPriceId: 'price_next' }
const subscription = {
  id: 'sub_test',
  object: 'subscription',
  schedule: null,
  metadata,
  cancel_at_period_end: false,
  pending_update: null,
  trial_end: null,
  discounts: ['di_test'],
  default_tax_rates: [{ id: 'txr_test' }],
  items: {
    has_more: false,
    data: [
      {
        id: 'si_test',
        price: { id: 'price_current', recurring: { interval: 'month' } },
        quantity: 2,
        current_period_start: 1800000000,
        current_period_end: 1802592000,
      },
    ],
  },
}
const schedule = {
  id: 'sub_sched_test',
  object: 'subscription_schedule',
  metadata: {},
  current_phase: { start_date: 1800000000, end_date: 1802592000 },
  phases: [
    {
      start_date: 1800000000,
      end_date: 1802592000,
      add_invoice_items: [],
      application_fee_percent: null,
      automatic_tax: { enabled: false, liability: null },
      billing_cycle_anchor: null,
      billing_thresholds: null,
      collection_method: 'charge_automatically',
      currency: 'usd',
      default_payment_method: { id: 'pm_test' },
      default_tax_rates: [{ id: 'txr_test' }],
      description: 'Billing terms',
      discounts: [{ discount: 'di_test', coupon: null, promotion_code: null }],
      invoice_settings: {
        account_tax_ids: null,
        custom_fields: null,
        days_until_due: null,
        description: null,
        footer: 'Invoice footer',
        issuer: { type: 'self' },
      },
      on_behalf_of: null,
      transfer_data: null,
      trial_end: null,
      items: [
        {
          price: 'price_current',
          quantity: 2,
          metadata: {},
          billing_thresholds: null,
          discounts: [{ discount: 'di_item', coupon: null, promotion_code: null }],
          tax_rates: [{ id: 'txr_item' }],
        },
      ],
    },
  ],
}

interface MockReply {
  method: string
  path: string
  body: unknown
  status?: number
}

/** The SDK serializes real HTTP requests; every unexpected request fails offline. */
function mockStripe(replies: MockReply[]) {
  const requests: { method: string; path: string; headers: Headers; body: URLSearchParams }[] = []
  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const reply = replies[requests.length]
    requests.push({
      method,
      path: url.pathname,
      headers: new Headers(init?.headers),
      body: new URLSearchParams(String(init?.body ?? '')),
    })
    if (!reply || reply.path !== url.pathname || reply.method !== method) {
      throw new Error(`Unexpected offline request: ${method} ${url.pathname}`)
    }
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return {
    operations: createStripeOperations(createStripeClient('sk_test_offline_only', fetchFn)),
    requests,
    complete: () => expect(requests).toHaveLength(replies.length),
  }
}

describe('Stripe checkout and transport', () => {
  it.each(['subscription', 'one_time'] as const)(
    'sets trusted metadata on %s objects and stable request keys',
    async (mode) => {
      const mock = mockStripe([
        {
          method: 'POST',
          path: '/v1/checkout/sessions',
          body: { id: 'cs_test', url: 'https://checkout.stripe.com/offline' },
        },
      ])
      const input = {
        ...checkout,
        mode,
        price: { ...price, interval: mode === 'one_time' ? null : price.interval },
      }
      expect(await mock.operations.createCheckout(input)).toEqual({
        providerRef: 'cs_test',
        url: 'https://checkout.stripe.com/offline',
      })
      const request = mock.requests[0]
      expect(request?.headers.get('stripe-version')).toBe(STRIPE_API_VERSION)
      expect(request?.headers.get('idempotency-key')).toBe(input.idempotencyKey)
      expect(request?.body.get('mode')).toBe(mode === 'one_time' ? 'payment' : mode)
      expect(request?.body.get('managed_payments[enabled]')).toBe('false')
      expect(request?.body.get('adaptive_pricing[enabled]')).toBe('false')
      const dataKey = mode === 'subscription' ? 'subscription_data' : 'payment_intent_data'
      for (const [key, value] of Object.entries(metadata)) {
        expect(request?.body.get(`metadata[${key}]`)).toBe(value)
        expect(request?.body.get(`${dataKey}[metadata][${key}]`)).toBe(value)
      }
      expect(request?.body.get('line_items[0][price]')).toBe(price.providerPriceId)
      expect(request?.body.get('success_url')).toBe(input.successUrl)
      expect(request?.body.get('cancel_url')).toBe(input.cancelUrl)
      expect(request?.body.get('customer_email')).toBe(input.customerEmail)
      expect(request?.body.get('customer_creation')).toBe(mode === 'one_time' ? 'always' : null)
      mock.complete()
    },
  )

  it('uses an existing customer without conflicting email or customer creation fields', async () => {
    const mock = mockStripe([
      {
        method: 'POST',
        path: '/v1/checkout/sessions',
        body: { id: 'cs_test', url: 'https://arcanumber.com' },
      },
    ])
    await mock.operations.createCheckout({ ...checkout, providerCustomerId: 'cus_test' })
    expect(mock.requests[0]?.body.get('customer')).toBe('cus_test')
    expect(mock.requests[0]?.body.has('customer_email')).toBe(false)
    expect(mock.requests[0]?.body.has('customer_creation')).toBe(false)
  })

  it('shows the purchasing site on one-time Checkout and keeps subscriptions unchanged', async () => {
    const reply = {
      method: 'POST',
      path: '/v1/checkout/sessions',
      body: { id: 'cs_test', url: 'https://checkout.stripe.com/offline' },
    }
    const noLocalized = {
      method: 'GET',
      path: '/v1/prices',
      body: { object: 'list', data: [], has_more: false, url: '/v1/prices' },
    }
    const mock = mockStripe([noLocalized, reply, reply, reply, reply])
    const presentation = (site: string, brandName: string, locale: string, suffix: string) => ({
      brandName,
      locale,
      description: `100 credits · ${brandName}`,
      site,
      statementDescriptorSuffix: suffix,
    })
    const oneTime = { ...checkout, mode: 'one_time' as const, price: { ...price, interval: null } }
    await mock.operations.createCheckout({
      ...oneTime,
      presentation: presentation('east', '干支日', 'zh-Hant', 'GANJIDAY'),
    })
    await mock.operations.createCheckout({
      ...oneTime,
      presentation: presentation('west', 'Arcanumber', 'en', 'ARCANUMBER'),
    })
    await mock.operations.createCheckout({
      ...checkout,
      presentation: presentation('east', '干支日', 'ko', 'GANJIDAY'),
    })
    await mock.operations.createCheckout(checkout)
    const [east, west, subscription, plain] = mock.requests
      .filter((request) => request.method === 'POST')
      .map((request) => request.body)
    for (const [body, site, brand, locale, suffix] of [
      [east, 'east', '干支日', 'zh-TW', 'GANJIDAY'],
      [west, 'west', 'Arcanumber', 'en', 'ARCANUMBER'],
    ] as const) {
      expect(body?.get('branding_settings[display_name]')).toBe(brand)
      expect(body?.get('locale')).toBe(locale)
      expect(body?.get('payment_intent_data[description]')).toBe(`100 credits · ${brand}`)
      expect(body?.get('payment_intent_data[statement_descriptor_suffix]')).toBe(suffix)
      expect(body?.get('metadata[site]')).toBe(site)
      expect(body?.get('payment_intent_data[metadata][site]')).toBe(site)
      // 站点元数据不替换可信的空间关联
      expect(body?.get('metadata[workspaceId]')).toBe(metadata.workspaceId)
    }
    expect(subscription?.toString()).toBe(plain?.toString())
    mock.complete()
  })

  describe('localized credit pack prices', () => {
    const packPrice = { ...price, interval: null, amount: 199 }
    const pack = {
      ...checkout,
      mode: 'one_time' as const,
      price: packPrice,
      presentation: { brandName: '干支日', locale: 'zh-Hant', description: '100 積分 · 干支日' },
    }
    const localized = {
      id: 'price_zh_hant',
      object: 'price',
      type: 'one_time',
      active: true,
      unit_amount: 199,
      currency: 'usd',
      lookup_key: `xuanxue_${planPriceId}_zh_hant`,
      metadata: {
        planId,
        planPriceId,
        canonicalPriceId: 'price_current',
        locale: 'zh-Hant',
      },
    }
    const lookup = (data: unknown[]) => ({
      method: 'GET',
      path: '/v1/prices',
      body: { object: 'list', data, has_more: false, url: '/v1/prices' },
    })
    const session = {
      method: 'POST',
      path: '/v1/checkout/sessions',
      body: { id: 'cs_test', url: 'https://checkout.stripe.com/offline' },
    }

    it('uses the verified localized price on east-site Checkout', async () => {
      const mock = mockStripe([lookup([localized]), session])
      await mock.operations.createCheckout(pack)
      expect(mock.requests[0]?.method).toBe('GET')
      expect(mock.requests[1]?.body.get('line_items[0][price]')).toBe('price_zh_hant')
      // 归属元数据仍指向本地价格
      expect(mock.requests[1]?.body.get('metadata[planPriceId]')).toBe(planPriceId)
      mock.complete()
    })

    it('queries the deterministic active lookup key', async () => {
      const requested: URL[] = []
      const fetchFn: typeof fetch = async (input, init) => {
        const url = new URL(String(input))
        requested.push(url)
        const body =
          (init?.method ?? 'GET') === 'GET'
            ? { object: 'list', data: [], has_more: false, url: '/v1/prices' }
            : session.body
        return new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        })
      }
      const operations = createStripeOperations(createStripeClient('sk_test_offline_only', fetchFn))
      await operations.createCheckout({
        ...pack,
        presentation: { ...pack.presentation, locale: 'ko' },
      })
      expect(requested[0]?.searchParams.get('lookup_keys[0]')).toBe(`xuanxue_${planPriceId}_ko`)
      expect(requested[0]?.searchParams.get('active')).toBe('true')
      expect(requested[0]?.searchParams.get('limit')).toBe('1')
    })

    it.each([
      ['missing', []],
      [
        'another local price',
        [{ ...localized, metadata: { ...localized.metadata, planPriceId: nextPriceId } }],
      ],
      [
        'another canonical price',
        [{ ...localized, metadata: { ...localized.metadata, canonicalPriceId: 'price_other' } }],
      ],
      ['a different amount', [{ ...localized, unit_amount: 99 }]],
      ['a different currency', [{ ...localized, currency: 'eur' }]],
    ])('falls back to the canonical price when the localized price is %s', async (_, data) => {
      const mock = mockStripe([lookup(data), session])
      await mock.operations.createCheckout(pack)
      expect(mock.requests[1]?.body.get('line_items[0][price]')).toBe('price_current')
      mock.complete()
    })

    it('falls back to the canonical price when the lookup fails', async () => {
      const mock = mockStripe([
        {
          method: 'GET',
          path: '/v1/prices',
          status: 400,
          body: { error: { type: 'invalid_request_error', message: 'Offline failure' } },
        },
        session,
      ])
      await mock.operations.createCheckout(pack)
      expect(mock.requests[1]?.body.get('line_items[0][price]')).toBe('price_current')
      mock.complete()
    })

    it('uses a TWD price directly without listing prices and keeps Adaptive Pricing off', async () => {
      const mock = mockStripe([session])
      await mock.operations.createCheckout({
        ...pack,
        price: { ...packPrice, amount: 6500, currency: 'TWD', providerPriceId: 'price_twd' },
      })
      expect(mock.requests[0]?.path).toBe('/v1/checkout/sessions')
      expect(mock.requests[0]?.body.get('line_items[0][price]')).toBe('price_twd')
      expect(mock.requests[0]?.body.get('adaptive_pricing[enabled]')).toBe('false')
      expect(mock.requests[0]?.body.get('metadata[planPriceId]')).toBe(planPriceId)
      mock.complete()
    })

    it('uses the canonical price without a lookup for English Checkout', async () => {
      const mock = mockStripe([session])
      await mock.operations.createCheckout({
        ...pack,
        presentation: { brandName: 'Arcanumber', locale: 'en', description: '100 credits' },
      })
      expect(mock.requests[0]?.body.get('line_items[0][price]')).toBe('price_current')
      mock.complete()
    })
  })

  it('rejects invalid source UUIDs and mode mismatches before making requests', async () => {
    const mock = mockStripe([])
    await expect(
      mock.operations.createCheckout({ ...checkout, userId: 'client-value' }),
    ).rejects.toThrow('UUIDs')
    await expect(mock.operations.createCheckout({ ...checkout, mode: 'one_time' })).rejects.toThrow(
      'interval',
    )
    expect(parseStripeMetadata({ ...metadata, workspaceId: 'not-uuid' })).toBeNull()
    expect(parseStripeMetadata(metadata)).toEqual(metadata)
    mock.complete()
  })
})

describe('Stripe subscription management', () => {
  it('upgrades the existing item with immediate proration and preserves quantity', async () => {
    const mock = mockStripe([
      {
        method: 'GET',
        path: '/v1/subscriptions/sub_test',
        body: { ...subscription, schedule: 'sub_sched_test' },
      },
      { method: 'POST', path: '/v1/subscription_schedules/sub_sched_test/release', body: schedule },
      { method: 'POST', path: '/v1/subscriptions/sub_test', body: subscription },
    ])
    await mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: false })
    const body = mock.requests[2]?.body
    expect(body?.get('items[0][id]')).toBe('si_test')
    expect(body?.get('items[0][price]')).toBe('price_next')
    expect(body?.get('items[0][quantity]')).toBe('2')
    expect(body?.get('proration_behavior')).toBe('always_invoice')
    expect(body?.get('payment_behavior')).toBe('error_if_incomplete')
    expect(body?.get('metadata[planPriceId]')).toBe(nextPriceId)
    mock.complete()
  })

  it('defers an interval change to the item period end and restarts the anchor there', async () => {
    const mock = mockStripe([
      { method: 'GET', path: '/v1/subscriptions/sub_test', body: subscription },
      { method: 'POST', path: '/v1/subscription_schedules', body: schedule },
      { method: 'POST', path: '/v1/subscription_schedules/sub_sched_test', body: schedule },
    ])
    await mock.operations.changePlan(
      'sub_test',
      { ...targetPrice, interval: 'year' },
      { atPeriodEnd: true },
    )
    expect(mock.requests[1]?.body.toString()).toBe('from_subscription=sub_test')
    expect(mock.requests[1]?.headers.get('idempotency-key')).toBeTruthy()
    const body = mock.requests[2]?.body
    expect(body?.get('phases[0][start_date]')).toBe('1800000000')
    expect(body?.get('phases[0][end_date]')).toBe('1802592000')
    expect(body?.get('phases[0][items][0][price]')).toBe('price_current')
    expect(body?.get('phases[1][start_date]')).toBe('1802592000')
    expect(body?.get('phases[1][items][0][price]')).toBe('price_next')
    expect(body?.get('phases[1][duration][interval]')).toBe('year')
    expect(body?.get('phases[1][metadata][planPriceId]')).toBe(nextPriceId)
    expect(body?.get('phases[0][discounts][0][discount]')).toBe('di_test')
    expect(body?.get('phases[1][default_tax_rates][0]')).toBe('txr_test')
    expect(body?.get('phases[0][default_payment_method]')).toBe('pm_test')
    expect(body?.get('phases[0][invoice_settings][footer]')).toBe('Invoice footer')
    expect(body?.get('phases[1][items][0][discounts][0][discount]')).toBe('di_item')
    expect(body?.get('phases[1][items][0][tax_rates][0]')).toBe('txr_item')
    expect(body?.get('proration_behavior')).toBe('none')
    expect(body?.get('phases[1][proration_behavior]')).toBe('none')
    expect(body?.get('end_behavior')).toBe('release')
    // 周期变更必须从新阶段起点重置锚点，否则 Stripe 把当前周期延长为新周期且不开票
    expect(body?.get('phases[1][billing_cycle_anchor]')).toBe('phase_start')
    expect(body?.get('phases[0][billing_cycle_anchor]')).toBeNull()
    mock.complete()
  })

  it('keeps the original anchor for a same-interval downgrade', async () => {
    const mock = mockStripe([
      { method: 'GET', path: '/v1/subscriptions/sub_test', body: subscription },
      { method: 'POST', path: '/v1/subscription_schedules', body: schedule },
      { method: 'POST', path: '/v1/subscription_schedules/sub_sched_test', body: schedule },
    ])
    await mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: true })
    const body = mock.requests[2]?.body
    expect(body?.get('phases[1][duration][interval]')).toBe('month')
    expect(body?.get('phases[1][items][0][price]')).toBe('price_next')
    expect(body?.get('phases[0][billing_cycle_anchor]')).toBeNull()
    expect(body?.get('phases[1][billing_cycle_anchor]')).toBeNull()
    mock.complete()
  })

  it('reuses an adapter managed schedule for a subsequent downgrade', async () => {
    const mock = mockStripe([
      {
        method: 'GET',
        path: '/v1/subscriptions/sub_test',
        body: { ...subscription, schedule: 'sub_sched_test' },
      },
      {
        method: 'GET',
        path: '/v1/subscription_schedules/sub_sched_test',
        body: {
          ...schedule,
          metadata: { saasManaged: 'plan_change' },
          phases: [...schedule.phases, { start_date: 1802592000 }],
        },
      },
      { method: 'POST', path: '/v1/subscription_schedules/sub_sched_test', body: schedule },
    ])
    await mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: true })
    mock.complete()
  })

  it('uses a fresh schedule request key after an earlier schedule was released', async () => {
    const replies = [
      { method: 'GET', path: '/v1/subscriptions/sub_test', body: subscription },
      { method: 'POST', path: '/v1/subscription_schedules', body: schedule },
      { method: 'POST', path: '/v1/subscription_schedules/sub_sched_test', body: schedule },
    ]
    const mock = mockStripe([...replies, ...replies])
    await mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: true })
    // Both retrieves represent an unscheduled subscription after cancel/resume.
    await mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: true })
    expect(mock.requests[1]?.headers.get('idempotency-key')).not.toBe(
      mock.requests[4]?.headers.get('idempotency-key'),
    )
    mock.complete()
  })

  it.each([true, false])(
    'cancels atPeriodEnd=%s after releasing a pending schedule',
    async (atPeriodEnd) => {
      const mock = mockStripe([
        {
          method: 'GET',
          path: '/v1/subscriptions/sub_test',
          body: { ...subscription, schedule: 'sub_sched_test' },
        },
        {
          method: 'POST',
          path: '/v1/subscription_schedules/sub_sched_test/release',
          body: schedule,
        },
        {
          method: atPeriodEnd ? 'POST' : 'DELETE',
          path: '/v1/subscriptions/sub_test',
          body: subscription,
        },
      ])
      await mock.operations.cancelSubscription('sub_test', { atPeriodEnd })
      if (atPeriodEnd) expect(mock.requests[2]?.body.get('cancel_at_period_end')).toBe('true')
      mock.complete()
    },
  )

  it('resumes renewal and opens the portal with the supplied return URL', async () => {
    const mock = mockStripe([
      { method: 'GET', path: '/v1/subscriptions/sub_test', body: subscription },
      { method: 'POST', path: '/v1/subscriptions/sub_test', body: subscription },
      {
        method: 'POST',
        path: '/v1/billing_portal/sessions',
        body: { url: 'https://billing.stripe.com/offline' },
      },
    ])
    await mock.operations.resumeSubscription('sub_test')
    expect(mock.requests[1]?.body.get('cancel_at_period_end')).toBe('false')
    expect(await mock.operations.getPortalUrl('cus_test', 'https://app.example/billing')).toBe(
      'https://billing.stripe.com/offline',
    )
    expect(mock.requests[2]?.body.get('customer')).toBe('cus_test')
    expect(mock.requests[2]?.body.get('return_url')).toBe('https://app.example/billing')
  })

  it('restores a portal cancellation by clearing cancel_at (portal sets cancel_at, not cancel_at_period_end)', async () => {
    const portalCanceled = { ...subscription, cancel_at: 1802592000 }
    const mock = mockStripe([
      { method: 'GET', path: '/v1/subscriptions/sub_test', body: portalCanceled },
      { method: 'POST', path: '/v1/subscriptions/sub_test', body: subscription },
    ])
    await mock.operations.resumeSubscription('sub_test')
    expect(mock.requests[1]?.body.get('cancel_at')).toBe('')
    expect(mock.requests[1]?.body.has('cancel_at_period_end')).toBe(false)
  })

  it('rejects multi-item subscriptions before a destructive plan update', async () => {
    const mock = mockStripe([
      {
        method: 'GET',
        path: '/v1/subscriptions/sub_test',
        body: {
          ...subscription,
          items: { ...subscription.items, has_more: true },
        },
      },
    ])
    await expect(
      mock.operations.changePlan('sub_test', targetPrice, { atPeriodEnd: false }),
    ).rejects.toThrow('single subscription item')
    mock.complete()
  })
})

describe('Stripe refunds and immutable plan prices', () => {
  it('rejects an empty refund request key before any money operation', async () => {
    const mock = mockStripe([])
    await expect(
      mock.operations.refund({
        providerPaymentId: 'pi_test',
        kind: 'one_time',
        currency: 'usd',
        idempotencyKey: '',
        amount: 1200,
      }),
    ).rejects.toThrow('idempotency key')
    mock.complete()
  })
  it.each([undefined, 1200])('reuses the refund request key with amount=%s', async (amount) => {
    const mock = mockStripe(
      Array.from({ length: 2 }, () => ({
        method: 'POST',
        path: '/v1/refunds',
        body: { id: 're_test' },
      })),
    )
    const input: RefundInput = {
      providerPaymentId: 'pi_test',
      kind: 'one_time',
      currency: 'usd',
      idempotencyKey: 'refund-request-1',
      ...(amount === undefined ? {} : { amount }),
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await mock.operations.refund(input)).toEqual({ providerRefundId: 're_test' })
      expect(mock.requests[attempt]?.headers.get('idempotency-key')).toBe(input.idempotencyKey)
      expect(mock.requests[attempt]?.body.get('payment_intent')).toBe('pi_test')
      expect(mock.requests[attempt]?.body.get('amount')).toBe(
        amount === undefined ? null : String(amount),
      )
    }
    mock.complete()
  })

  const sync: PlanSyncInput = {
    plan: { id: planId, key: 'pro', name: 'Pro', type: 'subscription', active: true },
    price,
    idempotencyKey: 'price-sync-1',
  }
  const remotePrice = {
    id: 'price_current',
    unit_amount: 2000,
    currency: 'usd',
    recurring: { interval: 'month', interval_count: 1 },
    metadata: { planId, planPriceId },
  }

  it('reuses a matching immutable mapping with no remote mutations', async () => {
    const mock = mockStripe([
      { method: 'GET', path: '/v1/prices/price_current', body: remotePrice },
    ])
    expect(await mock.operations.syncPlan({ ...sync, providerPriceId: 'price_current' })).toEqual({
      providerPriceId: 'price_current',
    })
    mock.complete()
  })

  it('rejects mapping drift instead of changing the existing price', async () => {
    const mock = mockStripe([
      {
        method: 'GET',
        path: '/v1/prices/price_current',
        body: { ...remotePrice, unit_amount: 999 },
      },
    ])
    await expect(
      mock.operations.syncPlan({ ...sync, providerPriceId: 'price_current' }),
    ).rejects.toThrow('Immutable')
    mock.complete()
  })

  it('creates a product only when absent and creates a price under a stable sync key', async () => {
    const productId = `xuanxue_plan_${planId.replaceAll('-', '')}`
    const mock = mockStripe([
      {
        method: 'GET',
        path: `/v1/products/${productId}`,
        status: 404,
        body: {
          error: {
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: 'Missing product',
          },
        },
      },
      { method: 'POST', path: '/v1/products', body: { id: productId } },
      { method: 'POST', path: '/v1/prices', body: { id: 'price_new' } },
    ])
    expect(await mock.operations.syncPlan(sync)).toEqual({ providerPriceId: 'price_new' })
    expect(mock.requests[1]?.headers.get('idempotency-key')).toBe(`saas:product:${planId}`)
    expect(mock.requests[2]?.headers.get('idempotency-key')).toBe(sync.idempotencyKey)
    expect(mock.requests[2]?.body.get('product')).toBe(productId)
    expect(mock.requests[2]?.body.get('unit_amount')).toBe('2000')
    expect(mock.requests[2]?.body.get('recurring[interval]')).toBe('month')
    expect(mock.requests[2]?.body.get('metadata[planPriceId]')).toBe(planPriceId)
    mock.complete()
  })

  it('reuses the product when adding a one-time credit pack price', async () => {
    const productId = `xuanxue_plan_${planId.replaceAll('-', '')}`
    const mock = mockStripe([
      { method: 'GET', path: `/v1/products/${productId}`, body: { id: productId } },
      { method: 'POST', path: '/v1/prices', body: { id: 'price_pack' } },
    ])
    await mock.operations.syncPlan({
      ...sync,
      plan: { ...sync.plan, type: 'credit_pack' },
      price: { ...sync.price, interval: null },
    })
    expect(mock.requests[1]?.body.get('product')).toBe(productId)
    expect(mock.requests[1]?.body.has('recurring[interval]')).toBe(false)
    mock.complete()
  })

  describe('localized credit pack variants', () => {
    const hex = planId.replaceAll('-', '')
    const locales = [
      ['zh-Hant', 'zh_hant', '單次詳批', '100 積分'],
      ['zh-Hans', 'zh_hans', '单次详批', '100 积分'],
      ['ko', 'ko', '상세 풀이 1회', '100 크레딧'],
    ] as const
    const packSync: PlanSyncInput = {
      plan: {
        id: planId,
        key: 'reading_single',
        name: 'Single Reading',
        type: 'credit_pack',
        active: true,
        credits: 100,
      },
      price: { ...price, interval: null, amount: 199 },
      idempotencyKey: 'catalog:stripe:pack',
    }
    const canonical = {
      id: 'price_current',
      type: 'one_time',
      unit_amount: 199,
      currency: 'usd',
      recurring: null,
      metadata: { planId, planPriceId },
    }
    const missing = {
      status: 404,
      body: {
        error: { type: 'invalid_request_error', code: 'resource_missing', message: 'Missing' },
      },
    }
    const list = (data: unknown[]) => ({ object: 'list', data, has_more: false, url: '/v1/prices' })
    const remoteLocalized = (locale: string, slug: string) => ({
      id: `price_${slug}`,
      object: 'price',
      type: 'one_time',
      product: `xuanxue_plan_${hex}_${slug}`,
      unit_amount: 199,
      currency: 'usd',
      metadata: { planId, planPriceId, canonicalPriceId: 'price_current', locale },
    })

    it('creates one localized product and price per east locale beside a new canonical price', async () => {
      const mock = mockStripe([
        { method: 'GET', path: `/v1/products/xuanxue_plan_${hex}`, body: { id: 'p' } },
        { method: 'POST', path: '/v1/prices', body: { id: 'price_current' } },
        ...locales.flatMap(([, slug]) => [
          { method: 'GET', path: `/v1/products/xuanxue_plan_${hex}_${slug}`, ...missing },
          { method: 'POST', path: '/v1/products', body: { id: `xuanxue_plan_${hex}_${slug}` } },
          { method: 'GET', path: '/v1/prices', body: list([]) },
          { method: 'POST', path: '/v1/prices', body: { id: `price_${slug}` } },
        ]),
      ])
      expect(await mock.operations.syncPlan(packSync)).toEqual({ providerPriceId: 'price_current' })
      locales.forEach(([locale, slug, name, description], index) => {
        const [, product, , created] = mock.requests.slice(2 + index * 4, 6 + index * 4)
        expect(product?.body.get('id')).toBe(`xuanxue_plan_${hex}_${slug}`)
        expect(product?.body.get('name')).toBe(name)
        expect(product?.body.get('description')).toBe(description)
        expect(product?.body.get('metadata[locale]')).toBe(locale)
        expect(product?.headers.get('idempotency-key')).toBe(`saas:product:${planId}:${locale}`)
        expect(created?.body.get('product')).toBe(`xuanxue_plan_${hex}_${slug}`)
        expect(created?.body.get('unit_amount')).toBe('199')
        expect(created?.body.get('currency')).toBe('usd')
        expect(created?.body.get('lookup_key')).toBe(`xuanxue_${planPriceId}_${slug}`)
        expect(created?.body.get('metadata[planPriceId]')).toBe(planPriceId)
        expect(created?.body.get('metadata[canonicalPriceId]')).toBe('price_current')
        expect(created?.body.get('metadata[locale]')).toBe(locale)
        expect(created?.body.has('recurring[interval]')).toBe(false)
        expect(created?.headers.get('idempotency-key')).toBe(`${packSync.idempotencyKey}:${locale}`)
      })
      mock.complete()
    })

    it('verifies existing localized prices on rerun without creating anything', async () => {
      const mock = mockStripe([
        { method: 'GET', path: '/v1/prices/price_current', body: canonical },
        ...locales.flatMap(([locale, slug]) => [
          {
            method: 'GET',
            path: `/v1/products/xuanxue_plan_${hex}_${slug}`,
            body: { id: `xuanxue_plan_${hex}_${slug}`, metadata: { planId, locale } },
          },
          { method: 'GET', path: '/v1/prices', body: list([remoteLocalized(locale, slug)]) },
        ]),
      ])
      expect(
        await mock.operations.syncPlan({ ...packSync, providerPriceId: 'price_current' }),
      ).toEqual({ providerPriceId: 'price_current' })
      expect(mock.requests.every((request) => request.method === 'GET')).toBe(true)
      mock.complete()
    })

    it('adds missing localized variants to an already mapped canonical price', async () => {
      const mock = mockStripe([
        { method: 'GET', path: '/v1/prices/price_current', body: canonical },
        { method: 'GET', path: `/v1/products/xuanxue_plan_${hex}_zh_hant`, ...missing },
        { method: 'POST', path: '/v1/products', body: { id: `xuanxue_plan_${hex}_zh_hant` } },
        { method: 'GET', path: '/v1/prices', body: list([]) },
        { method: 'POST', path: '/v1/prices', body: { id: 'price_zh_hant' } },
        ...locales.slice(1).flatMap(([locale, slug]) => [
          {
            method: 'GET',
            path: `/v1/products/xuanxue_plan_${hex}_${slug}`,
            body: { id: `xuanxue_plan_${hex}_${slug}`, metadata: { planId, locale } },
          },
          { method: 'GET', path: '/v1/prices', body: list([remoteLocalized(locale, slug)]) },
        ]),
      ])
      await mock.operations.syncPlan({ ...packSync, providerPriceId: 'price_current' })
      expect(mock.requests[4]?.body.get('metadata[canonicalPriceId]')).toBe('price_current')
      mock.complete()
    })

    it('rejects a localized price that points elsewhere instead of re-pointing it', async () => {
      const mock = mockStripe([
        { method: 'GET', path: '/v1/prices/price_current', body: canonical },
        {
          method: 'GET',
          path: `/v1/products/xuanxue_plan_${hex}_zh_hant`,
          body: { id: `xuanxue_plan_${hex}_zh_hant`, metadata: { planId, locale: 'zh-Hant' } },
        },
        {
          method: 'GET',
          path: '/v1/prices',
          body: list([{ ...remoteLocalized('zh-Hant', 'zh_hant'), unit_amount: 99 }]),
        },
      ])
      await expect(
        mock.operations.syncPlan({ ...packSync, providerPriceId: 'price_current' }),
      ).rejects.toThrow('Localized Stripe price')
      mock.complete()
    })
  })

  describe('local-currency prices', () => {
    const hex = planId.replaceAll('-', '')
    const twdSync: PlanSyncInput = {
      plan: {
        id: planId,
        key: 'reading_single',
        name: 'Single Reading',
        type: 'credit_pack',
        active: true,
        credits: 100,
      },
      price: { ...price, interval: null, amount: 6500, currency: 'TWD' },
      idempotencyKey: 'catalog:stripe:twd',
    }
    const remoteTwd = {
      id: 'price_twd',
      object: 'price',
      type: 'one_time',
      product: `xuanxue_plan_${hex}_zh_hant`,
      unit_amount: 6500,
      currency: 'twd',
      recurring: null,
      metadata: { planId, planPriceId, currency: 'TWD', locale: 'zh-Hant' },
    }

    it('creates the TWD price on the zh-Hant localized product without lookup keys', async () => {
      const mock = mockStripe([
        {
          method: 'GET',
          path: `/v1/products/xuanxue_plan_${hex}_zh_hant`,
          status: 404,
          body: {
            error: { type: 'invalid_request_error', code: 'resource_missing', message: 'Missing' },
          },
        },
        { method: 'POST', path: '/v1/products', body: { id: `xuanxue_plan_${hex}_zh_hant` } },
        { method: 'POST', path: '/v1/prices', body: { id: 'price_twd' } },
      ])
      expect(await mock.operations.syncPlan(twdSync)).toEqual({ providerPriceId: 'price_twd' })
      const created = mock.requests[2]
      expect(created?.body.get('product')).toBe(`xuanxue_plan_${hex}_zh_hant`)
      expect(created?.body.get('currency')).toBe('twd')
      expect(created?.body.get('unit_amount')).toBe('6500')
      expect(created?.body.get('metadata[planPriceId]')).toBe(planPriceId)
      expect(created?.body.get('metadata[currency]')).toBe('TWD')
      expect(created?.body.has('lookup_key')).toBe(false)
      expect(created?.headers.get('idempotency-key')).toBe(twdSync.idempotencyKey)
      mock.complete()
    })

    it('only verifies an existing TWD mapping on rerun', async () => {
      const mock = mockStripe([{ method: 'GET', path: '/v1/prices/price_twd', body: remoteTwd }])
      expect(await mock.operations.syncPlan({ ...twdSync, providerPriceId: 'price_twd' })).toEqual({
        providerPriceId: 'price_twd',
      })
      mock.complete()
    })

    it('rejects an existing local-currency price whose amount drifted', async () => {
      const mock = mockStripe([
        {
          method: 'GET',
          path: '/v1/prices/price_twd',
          body: { ...remoteTwd, unit_amount: 6900 },
        },
      ])
      await expect(
        mock.operations.syncPlan({ ...twdSync, providerPriceId: 'price_twd' }),
      ).rejects.toThrow('Immutable')
      mock.complete()
    })

    it('rejects a TWD amount that is not whole dollars before calling Stripe', async () => {
      const mock = mockStripe([])
      await expect(
        mock.operations.syncPlan({ ...twdSync, price: { ...twdSync.price, amount: 6550 } }),
      ).rejects.toThrow('Invalid TWD minor amount')
      mock.complete()
    })

    it('puts a KRW subscription price without a localized name on the canonical product', async () => {
      const mock = mockStripe([
        { method: 'GET', path: `/v1/products/xuanxue_plan_${hex}`, body: { id: 'p' } },
        { method: 'POST', path: '/v1/prices', body: { id: 'price_krw' } },
      ])
      await mock.operations.syncPlan({
        ...sync,
        price: { ...price, amount: 7000, currency: 'KRW' },
      })
      expect(mock.requests[1]?.body.get('product')).toBe(`xuanxue_plan_${hex}`)
      expect(mock.requests[1]?.body.get('currency')).toBe('krw')
      expect(mock.requests[1]?.body.get('recurring[interval]')).toBe('month')
      expect(mock.requests[1]?.body.get('metadata[locale]')).toBe('ko')
      mock.complete()
    })

    it.each([
      ['plus', 'KRW', 7000, 'ko', 'Plus 월간 플랜', '매월 400 크레딧'],
      ['premium', 'TWD', 32500, 'zh_hant', 'Premium 每月方案', '每月 400 積分'],
    ] as const)(
      'puts the %s %s subscription price on its localized monthly product',
      async (key, currency, amount, slug, name, description) => {
        const mock = mockStripe([
          {
            method: 'GET',
            path: `/v1/products/xuanxue_plan_${hex}_${slug}`,
            status: 404,
            body: {
              error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: 'Missing',
              },
            },
          },
          { method: 'POST', path: '/v1/products', body: { id: `xuanxue_plan_${hex}_${slug}` } },
          { method: 'POST', path: '/v1/prices', body: { id: 'price_local' } },
        ])
        expect(
          await mock.operations.syncPlan({
            ...sync,
            plan: { ...sync.plan, key, credits: 400 },
            price: { ...price, amount, currency },
          }),
        ).toEqual({ providerPriceId: 'price_local' })
        expect(mock.requests[1]?.body.get('name')).toBe(name)
        expect(mock.requests[1]?.body.get('description')).toBe(description)
        expect(mock.requests[2]?.body.get('product')).toBe(`xuanxue_plan_${hex}_${slug}`)
        expect(mock.requests[2]?.body.get('recurring[interval]')).toBe('month')
        expect(mock.requests[2]?.body.has('lookup_key')).toBe(false)
        mock.complete()
      },
    )

    it('creates a USD subscription price on the canonical product only, without localized variants', async () => {
      const mock = mockStripe([
        { method: 'GET', path: `/v1/products/xuanxue_plan_${hex}`, body: { id: 'p' } },
        { method: 'POST', path: '/v1/prices', body: { id: 'price_plus_usd' } },
      ])
      expect(
        await mock.operations.syncPlan({
          ...sync,
          plan: { ...sync.plan, key: 'plus', credits: 400 },
          price: { ...price, amount: 499 },
        }),
      ).toEqual({ providerPriceId: 'price_plus_usd' })
      expect(mock.requests).toHaveLength(2)
      expect(mock.requests[1]?.body.get('recurring[interval]')).toBe('month')
      mock.complete()
    })
  })

  it('propagates Stripe errors without masking them as product absence', async () => {
    const mock = mockStripe([
      {
        method: 'GET',
        path: `/v1/products/xuanxue_plan_${planId.replaceAll('-', '')}`,
        status: 401,
        body: { error: { type: 'authentication_error', message: 'Invalid offline test key' } },
      },
    ])
    await expect(mock.operations.syncPlan(sync)).rejects.toBeInstanceOf(
      Stripe.errors.StripeAuthenticationError,
    )
    mock.complete()
  })
})
