import type { ComponentType, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { baseLocale, locales, overwriteGetLocale } from '../../paraglide/runtime.js'
import { Route } from '../../routes/app/$slug/billing.tsx'

const price = (id: string, planId: string, amount: number, available: boolean) => ({
  id,
  planId,
  amount,
  currency: 'usd',
  provider: 'stripe',
  interval: planId === 'subscription' ? 'month' : null,
  available,
})
const page = {
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
      { id: 'pack', name: 'Credits', type: 'credit_pack' },
      { id: 'subscription', name: 'Pro', type: 'subscription' },
    ],
    prices: [
      price('pack-ready', 'pack', 199, true),
      price('pack-unavailable', 'pack', 99, false),
      price('subscription-ready', 'subscription', 699, true),
      price('old', 'subscription', 399, false),
    ],
  },
}
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => page,
    useParams: () => ({ slug: 'personal' }),
    useSearch: () => ({}),
  }),
  notFound: vi.fn(),
  useRouter: () => ({}),
  Link: ({ children }: { children: ReactNode }) => <a href="/usage">{children}</a>,
}))
vi.mock('../app-shell/space-frame.tsx', () => ({
  SpacePage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('./customer.functions.ts', () => ({}))
vi.mock('./refund.functions.ts', () => ({}))
vi.mock('./refund-section.tsx', () => ({ RefundSection: () => null }))
vi.mock('../../server/template-config.ts', () => ({
  templateConfig: { billing: { enabled: true } },
}))

afterEach(() => overwriteGetLocale(() => baseLocale))

it.each(locales)(
  'shows only purchasable options and keeps the old price in subscription information in %s',
  (locale) => {
    overwriteGetLocale(() => locale)
    const Component = Route.options.component as ComponentType
    const html = renderToStaticMarkup(<Component />)
    const purchases = html.slice(html.indexOf('Choose a plan or credit pack'))
    expect(purchases).toContain('$1.99')
    expect(purchases).toContain('$6.99')
    expect(purchases).not.toContain('$0.99')
    expect(purchases).not.toContain('$3.99')
    expect(html).toContain(`$3.99 / month · ${m.billing_unavailable()}`)
  },
)
