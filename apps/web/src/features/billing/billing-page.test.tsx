import type { ComponentType, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { baseLocale, locales, overwriteGetLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/app/$slug/billing.tsx'

const price = (
  id: string,
  planId: string,
  amount: number,
  available: boolean,
  provider = 'stripe',
) => ({
  id,
  planId,
  amount,
  currency: 'usd',
  provider,
  interval: planId === 'subscription' ? 'month' : null,
  available,
})
let readingsOpen = true
let search: { buy?: string } = {}
const page = {
  get readingsOpen() {
    return readingsOpen
  },
  role: 'owner',
  entitlements: { key: 'pro' },
  readOnly: false,
  credits: null,
  subscriptions: [
    {
      id: 'sub',
      name: 'Existing Pro',
      planPriceId: 'old',
      provider: 'stripe',
      amount: 399,
      currency: 'usd',
      interval: 'month',
      priceActive: false,
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  ],
  payments: [],
  refunds: [],
  catalog: {
    providers: [{ id: 'stripe', available: true }],
    plans: [
      { id: 'pack', key: 'reading_single', name: 'Credits', type: 'credit_pack' },
      { id: 'subscription', key: 'pro', name: 'Pro', type: 'subscription' },
    ],
    prices: [
      price('pack-ready', 'pack', 199, true),
      price('pack-unavailable', 'pack', 99, false),
      price('subscription-ready', 'subscription', 699, true),
      price('old', 'subscription', 399, false),
    ],
  },
}
const original = {
  providers: page.catalog.providers,
  plans: page.catalog.plans,
  prices: page.catalog.prices,
}
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => page,
    useParams: () => ({ slug: 'personal' }),
    useSearch: () => search,
  }),
  notFound: vi.fn(),
  useRouter: () => ({}),
  Link: ({ children }: { children: ReactNode }) => <a href="/usage">{children}</a>,
}))
vi.mock('../app-shell/space-frame.tsx', () => ({
  SpacePage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('./customer.functions.ts', () => ({}))
vi.mock('../readings/readings.functions.ts', () => ({}))
vi.mock('./refund.functions.ts', () => ({}))
vi.mock('./refund-section.tsx', () => ({ RefundSection: () => null }))
vi.mock('../../server/template-config.ts', () => ({
  templateConfig: { billing: { enabled: true } },
}))

afterEach(() => {
  overwriteGetLocale(() => baseLocale)
  readingsOpen = true
  search = {}
  Object.assign(page.catalog, original)
})
const purchasesHtml = () => {
  const Component = Route.options.component as ComponentType
  const html = renderToStaticMarkup(<Component />)
  return html.slice(html.indexOf(m.billing_choose_plan_or_pack()))
}

it.each(locales)(
  'shows only purchasable options and keeps the old price in subscription information in %s',
  (locale) => {
    overwriteGetLocale(() => locale)
    const Component = Route.options.component as ComponentType
    const html = renderToStaticMarkup(<Component />)
    const purchases = html.slice(html.indexOf(m.billing_choose_plan_or_pack()))
    expect(purchases).toContain('$1.99')
    // 订阅价格在 @xuanxue/ui Select 中，选项列表展开后才渲染；SSR 只输出带占位文案的触发器
    expect(purchases).toContain(m.billing_choose_plan())
    expect(purchases).not.toContain('$0.99')
    expect(purchases).not.toContain('$3.99')
    expect(html).toContain(`$3.99 / month · ${m.billing_unavailable()}`)
    expect(html).toContain(m.billing_next_billing({ date: m.billing_pending() }))
    expect(html).toContain(m.billing_credit_usage_link())
  },
)

it.each(locales)('详批未开放时不出售积分包并说明原因（%s）', (locale) => {
  overwriteGetLocale(() => locale)
  readingsOpen = false
  const Component = Route.options.component as ComponentType
  const html = renderToStaticMarkup(<Component />)
  const purchases = html.slice(html.indexOf(m.billing_choose_plan_or_pack()))
  expect(purchases).toContain('data-testid="billing-packs-not-open"')
  expect(purchases).not.toContain('$1.99')
  // 订阅不受影响（价格在 Select 选项中，SSR 只渲染触发器）
  expect(purchases).toContain(m.billing_choose_plan())
})

it('已配置但价格全部停用的支付方式不作默认，改用有积分包的支付方式', () => {
  // 临时关闭 Stripe 售卖：Stripe 仍已配置，但没有可购买的价格
  page.catalog.providers = [
    { id: 'stripe', available: true },
    { id: 'paypal', available: true },
  ]
  page.catalog.plans = [
    ...original.plans,
    { id: 'five', key: 'reading_five', name: 'Five', type: 'credit_pack' },
  ]
  page.catalog.prices = [
    price('stripe-off', 'pack', 199, false),
    price('paypal-pack', 'pack', 199, true, 'paypal'),
    price('paypal-five', 'five', 699, true, 'paypal'),
  ]
  search = { buy: 'reading_single' }
  const purchases = purchasesHtml()
  // 只剩一个可选支付方式：不显示选择器，直接列出 PayPal 积分包
  expect(purchases).not.toContain('<select')
  expect(purchases).toContain('$1.99')
  expect(purchases).toContain('$6.99')
  expect(purchases).not.toContain('data-testid="billing-payments-unavailable"')
})

it('两种支付方式都可购买时保持选择器，按 buy 选中能卖该积分包的支付方式', () => {
  page.catalog.providers = [
    { id: 'stripe', available: true },
    { id: 'paypal', available: true },
  ]
  page.catalog.plans = [
    ...original.plans,
    { id: 'five', key: 'reading_five', name: 'Five', type: 'credit_pack' },
  ]
  page.catalog.prices = [
    price('stripe-five', 'five', 699, true),
    price('paypal-pack', 'pack', 199, true, 'paypal'),
  ]
  search = { buy: 'reading_single' }
  const purchases = purchasesHtml()
  expect(purchases).toContain('<select')
  // $1.99 只有 PayPal 在卖、$6.99 只有 Stripe 在卖：据此判断默认选中了 PayPal
  expect(purchases).toContain('$1.99')
  expect(purchases).not.toContain('$6.99')
})

it('已配置的支付方式都没有可购买价格时给出说明而不是空白', () => {
  page.catalog.providers = [{ id: 'stripe', available: true }]
  page.catalog.prices = [price('stripe-off', 'pack', 199, false)]
  expect(purchasesHtml()).toContain('data-testid="billing-payments-unavailable"')
})

it('繁体按新台币显示 Stripe 积分包；韩语选择 PayPal 时提示以美元结算', () => {
  overwriteGetLocale(() => 'zh-Hant')
  page.catalog.prices = [
    price('pack-usd', 'pack', 199, true),
    { ...price('pack-twd', 'pack', 6500, true), currency: 'TWD' },
  ]
  let purchases = purchasesHtml()
  expect(purchases).toContain('NT$65')
  expect(purchases).not.toContain('$1.99')
  expect(purchases).not.toContain('billing-paypal-usd')
  overwriteGetLocale(() => 'ko')
  page.catalog.providers = [{ id: 'paypal', available: true }]
  page.catalog.prices = [price('paypal-pack', 'pack', 199, true, 'paypal')]
  purchases = purchasesHtml()
  expect(purchases).toContain('US$1.99')
  expect(purchases).toContain('data-testid="billing-paypal-usd"')
})
