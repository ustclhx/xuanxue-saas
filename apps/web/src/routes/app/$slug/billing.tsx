import {
  createFileRoute,
  notFound as featureNotFound,
  Link,
  useRouter,
} from '@tanstack/react-router'
import { enabledCurrency, formatMoney } from '@xuanxue/billing/currency'
import { Button, Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { trackEvent } from '../../../features/analytics/track.ts'
import { SpacePage } from '../../../features/app-shell/space-frame.tsx'
import {
  checkoutCustomer,
  getCustomerBilling,
  manageCustomerSubscription,
} from '../../../features/billing/customer.functions.ts'
import { getCustomerRefunds } from '../../../features/billing/refund.functions.ts'
import { RefundSection } from '../../../features/billing/refund-section.tsx'
import { displayPrices } from '../../../features/marketing/pricing-data.ts'
import { paypalUsdNotice } from '../../../features/readings/price.ts'
import { getReadingPricing } from '../../../features/readings/readings.functions.ts'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'

export const Route = createFileRoute('/app/$slug/billing')({
  beforeLoad: () => {
    if (!templateConfig.billing.enabled) throw featureNotFound()
  },
  // 从公开页面发起购买时带上发起页面，支付后回到该页（决策 4；服务端再次校验）
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional(),
    checkout: z.enum(['success', 'canceled']).optional(),
    // 定价页「购买」带上积分包 key：进入本页后直接跳转支付页
    buy: z
      .string()
      .regex(/^[a-z0-9_-]{1,64}$/)
      .optional(),
  }),
  loader: async ({ params }) => {
    const [billing, refunds, readings] = await Promise.all([
      getCustomerBilling({ data: { slug: params.slug } }),
      getCustomerRefunds({ data: { slug: params.slug } }),
      // 积分只用于详批：本站本语言没有已开放的详批时不出售积分包（与定价页同一判定）
      getReadingPricing({ data: { locale: getLocale() } })
        .then((pricing) => pricing.readings.length > 0)
        .catch(() => false),
    ])
    return { ...billing, refundView: refunds, readingsOpen: readings }
  },
  staleTime: 0,
  component: BillingPage,
})
// 按各行的币种格式化（TWD、KRW 无小数），不认识的币种不猜测单位
const money = (amount: number, currency: string) =>
  enabledCurrency(currency)
    ? formatMoney(amount, currency, getLocale())
    : m.billing_amount_unavailable()
const date = (value: Date | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' }) : m.billing_pending()
function BillingPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const { returnTo, checkout: checkoutResult, buy } = Route.useSearch()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  // PayPal 取消后回到本页时提示一次；成功回跳由下方付款记录体现
  const [message, setMessage] = useState(
    checkoutResult === 'canceled' ? m.billing_checkout_canceled() : '',
  )
  const planType = (planId: string) => page.catalog.plans.find((plan) => plan.id === planId)?.type
  type CatalogPrice = (typeof page.catalog.prices)[number]
  const isPack = (price: CatalogPrice) =>
    page.readingsOpen &&
    price.available &&
    price.interval === null &&
    planType(price.planId) === 'credit_pack'
  const isPlan = (price: CatalogPrice) =>
    price.available && planType(price.planId) === 'subscription'
  // 支付方式「可选」要求已配置且有可购买的价格：只配置了密钥、价格全部停用（如临时关闭 Stripe 售卖）时
  // 不能默认选中它，否则页面只剩空白、定价页带来的购买也无法继续
  const sells = (providerId: string, planKey?: string) =>
    page.catalog.prices.some(
      (price) =>
        price.provider === providerId &&
        (isPack(price) || isPlan(price)) &&
        (!planKey || page.catalog.plans.find((plan) => plan.id === price.planId)?.key === planKey),
    )
  const selectable = page.catalog.providers.filter((p) => p.available && sells(p.id))
  const [provider, setProvider] = useState(
    // 定价页带 buy 进入时优先选能卖这个积分包的支付方式
    (buy ? selectable.find((p) => sells(p.id, buy)) : undefined)?.id ??
      selectable[0]?.id ??
      page.catalog.providers.find((p) => p.available)?.id ??
      page.catalog.providers[0]?.id ??
      '',
  )
  const providerId = useId()
  const planId = useId()
  const [priceId, setPriceId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const intent = useRef<{ key: string; uuid: string } | null>(null)
  const autoBuy = useRef(false)
  useEffect(() => setReady(true), [])
  useEffect(() => trackEvent('paywall_view'), [])
  const availableProviders = selectable.length
  const owner = page.role === 'owner'
  const disabled = !ready || busy || page.readOnly || !owner
  const renewing = page.subscriptions.find(
    (sub) =>
      !sub.cancelAtPeriodEnd && ['active', 'trialing', 'past_due', 'paused'].includes(sub.status),
  )
  // 积分包一次性购买、不涉及订阅替换：每个积分包一个按钮，点击即跳转支付页；订阅仍走选择 + 确认
  // 每个 (套餐, 周期) 只显示按界面语言选出的一行（与结账同一选价规则，localize-checkout-currency D5）
  const packPrices = displayPrices(page.catalog.prices.filter(isPack), getLocale(), provider)
  const planPrices = displayPrices(page.catalog.prices.filter(isPlan), getLocale(), provider)
  const selected = planPrices.find((price) => price.id === priceId)
  const currentProvider = page.catalog.providers.find((p) => p.id === provider)
  const providerLabel = (p: (typeof page.catalog.providers)[number]) =>
    selectable.includes(p) ? p.id : `${p.id} — ${m.billing_unavailable()}`
  const priceLabel = (price: (typeof planPrices)[number]) =>
    `${page.catalog.plans.find((plan) => plan.id === price.planId)?.name} · ${money(price.amount, price.currency)}${price.interval ? ` / ${price.interval}` : ''}`
  const isSubscription =
    page.catalog.plans.find((plan) => plan.id === selected?.planId)?.type === 'subscription'
  const change = isSubscription && renewing?.provider === 'stripe' && provider === 'stripe'
  const replacement = isSubscription && !change ? renewing : undefined
  const currentInterval = renewing?.interval
  // 月付与年付互换由服务端安排在当前周期结束时生效，确认前先说明生效时间
  const intervalChange =
    change &&
    Boolean(selected?.interval && currentInterval) &&
    selected?.interval !== currentInterval
  async function manage(subscriptionId: string, action: 'cancel' | 'resume' | 'portal' | 'change') {
    setBusy(true)
    setMessage('')
    try {
      const result = await manageCustomerSubscription({
        data: {
          slug,
          subscriptionId,
          action,
          ...(action === 'change' ? { planPriceId: priceId } : {}),
        },
      })
      if (!result.ok) {
        setMessage(errorMessage(result.error))
        return
      }
      if ('url' in result.result && result.result.url) {
        window.location.assign(result.result.url)
        return
      }
      setMessage(
        result.result.status === 'scheduled'
          ? m.billing_change_scheduled()
          : m.billing_subscription_updated(),
      )
      await router.invalidate()
    } catch {
      setMessage(m.billing_error_unknown())
    } finally {
      setBusy(false)
    }
  }
  async function checkout(target = selected) {
    if (target === selected && change && renewing && 'id' in renewing && renewing.id) {
      await manage(renewing.id, 'change')
      return
    }
    if (!target) return
    const switching = target === selected ? replacement : undefined
    const key = `${slug}:${provider}:${target.id}:${switching && 'id' in switching ? switching.id : ''}`
    if (intent.current?.key !== key) intent.current = { key, uuid: crypto.randomUUID() }
    setBusy(true)
    setMessage('')
    trackEvent('checkout_start', {
      plan: page.catalog.plans.find((plan) => plan.id === target.planId)?.key ?? '',
    })
    try {
      const result = await checkoutCustomer({
        data: {
          slug,
          provider: target.provider,
          planPriceId: target.id,
          idempotencyKey: intent.current.uuid,
          ...(switching && 'id' in switching && switching.id
            ? { confirmSwitch: confirmed, expectedOldSubscriptionId: switching.id }
            : {}),
          ...(returnTo ? { returnTo } : {}),
        },
      })
      if (result.ok) {
        setMessage(m.billing_checkout_redirecting())
        window.location.assign(result.result.url)
      } else setMessage(errorMessage(result.error))
    } catch {
      setMessage(m.billing_checkout_error())
    } finally {
      setBusy(false)
    }
  }
  // 从定价页带 `buy` 进入：去掉参数（返回本页时不再触发），可购买时直接结账
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在首次可交互时处理一次
  useEffect(() => {
    if (!ready || !buy || autoBuy.current) return
    autoBuy.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('buy')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    const plan = page.catalog.plans.find((item) => item.key === buy)
    const price = packPrices.find((item) => item.planId === plan?.id && item.available)
    if (price && !disabled) void checkout(price)
  }, [ready])
  return (
    <SpacePage title={m.app_billing()}>
      <p>{m.billing_current_plan({ plan: page.entitlements.key })}</p>
      {page.credits && (
        <p>
          {m.billing_credit_balance({
            available: page.credits.available,
            held: page.credits.held,
            debt: page.credits.debt,
          })}
        </p>
      )}
      <Link to="/app/$slug/usage" params={{ slug }} className="underline">
        {m.billing_credit_usage_link()}
      </Link>
      {page.subscriptions.filter(
        (sub) =>
          sub.currentPeriodEnd &&
          new Date(sub.currentPeriodEnd) > new Date() &&
          ['active', 'trialing', 'canceled', 'expired', 'past_due'].includes(sub.status),
      ).length > 1 && <p>{m.billing_overlap_notice()}</p>}
      {page.subscriptions.map((sub) => (
        <section key={sub.id} className="grid gap-3 rounded-xl border border-line bg-surface p-6">
          <h3 className="font-semibold">{sub.name}</h3>
          <p>
            {sub.provider} · {sub.status}
          </p>
          <p>
            {money(sub.amount, sub.currency)}
            {sub.interval ? ` / ${sub.interval}` : ''}
            {sub.priceActive ? '' : ` · ${m.billing_unavailable()}`}
          </p>
          <p>
            {sub.cancelAtPeriodEnd || ['canceled', 'expired', 'paused'].includes(sub.status)
              ? m.billing_paid_access_ends({ date: date(sub.currentPeriodEnd) })
              : m.billing_next_billing({ date: date(sub.currentPeriodEnd) })}
          </p>
          {owner && 'id' in sub && sub.id && (
            <div className="flex gap-3">
              <Button
                disabled={
                  disabled ||
                  !page.catalog.providers.some((p) => p.id === sub.provider && p.available)
                }
                onClick={() => void manage(sub.id, sub.cancelAtPeriodEnd ? 'resume' : 'cancel')}
              >
                {sub.cancelAtPeriodEnd
                  ? m.billing_resume_subscription()
                  : m.billing_cancel_at_period_end()}
              </Button>
              {sub.provider === 'stripe' && (
                <Button
                  disabled={
                    disabled ||
                    !page.catalog.providers.some((p) => p.id === 'stripe' && p.available)
                  }
                  onClick={() => void manage(sub.id, 'portal')}
                >
                  {m.billing_open_portal()}
                </Button>
              )}
            </div>
          )}
        </section>
      ))}
      {owner && (
        <section
          id="credit-packs"
          className="grid gap-3 rounded-xl border border-line bg-surface p-6"
        >
          <h3 id="subscriptions" className="font-semibold">
            {m.billing_choose_plan_or_pack()}
          </h3>
          {/* 只有一个可用支付方式时不显示选择器，直接用它结账（design D5） */}
          {availableProviders > 1 && (
            <div className="grid gap-2">
              <label htmlFor={providerId}>{m.billing_payment_method()}</label>
              <Select
                value={currentProvider ? provider : ''}
                disabled={disabled}
                onValueChange={(value) => {
                  setProvider(value)
                  setPriceId('')
                  setConfirmed(false)
                  intent.current = null
                }}
              >
                <SelectTrigger
                  id={providerId}
                  className="w-full"
                  placeholder={m.billing_payment_method()}
                  valueLabel={currentProvider ? providerLabel(currentProvider) : undefined}
                />
                <SelectContent>
                  {page.catalog.providers.map((p, index) => (
                    <SelectItem
                      key={p.id}
                      index={index}
                      value={p.id}
                      disabled={!selectable.includes(p)}
                    >
                      {providerLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!page.readingsOpen && (
            <p data-testid="billing-packs-not-open">{m.readings_packs_not_open()}</p>
          )}
          {paypalUsdNotice(getLocale(), provider) &&
            (packPrices.length > 0 || planPrices.length > 0) && (
              <p data-testid="billing-paypal-usd">{m.billing_paypal_usd_note()}</p>
            )}
          {packPrices.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {packPrices.map((price) => (
                <Button
                  key={price.id}
                  disabled={disabled || !price.available}
                  onClick={() => void checkout(price)}
                >
                  {m.billing_buy_pack({
                    name: page.catalog.plans.find((plan) => plan.id === price.planId)?.name ?? '',
                    amount: money(price.amount, price.currency),
                  })}
                </Button>
              ))}
            </div>
          )}
          {planPrices.length > 0 && (
            <div className="grid gap-2">
              <label htmlFor={planId}>{m.billing_plan()}</label>
              <Select
                value={selected ? priceId : ''}
                disabled={disabled}
                onValueChange={(value) => {
                  setPriceId(value)
                  setConfirmed(false)
                  intent.current = null
                }}
              >
                <SelectTrigger
                  id={planId}
                  className="w-full"
                  placeholder={m.billing_choose_plan()}
                  valueLabel={selected ? priceLabel(selected) : undefined}
                />
                <SelectContent>
                  {planPrices.map((price, index) => (
                    <SelectItem
                      key={price.id}
                      index={index}
                      value={price.id}
                      disabled={!price.available}
                    >
                      {priceLabel(price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* 没有任何可购买的支付方式时说明原因，而不是留下空白（详批未开放另有说明） */}
          {selectable.length === 0 &&
            (page.readingsOpen || !page.catalog.providers.some((p) => p.available)) && (
              <p data-testid="billing-payments-unavailable">{m.billing_payments_unavailable()}</p>
            )}
          {replacement && (
            <label>
              <input
                type="checkbox"
                disabled={disabled}
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              {m.billing_switch_confirmation({ date: date(replacement.currentPeriodEnd) })}
            </label>
          )}
          {intervalChange && renewing && (
            <p>{m.billing_change_interval_notice({ date: date(renewing.currentPeriodEnd) })}</p>
          )}
          {planPrices.length > 0 && (
            <Button
              disabled={disabled || !selected?.available || Boolean(replacement && !confirmed)}
              onClick={() => void checkout()}
            >
              {change ? m.billing_change_plan() : m.billing_continue_checkout()}
            </Button>
          )}
        </section>
      )}
      {message && <p role="status">{message}</p>}
      <RefundSection
        slug={slug}
        page={page.refundView}
        readOnly={page.readOnly}
        pendingPayments={page.refunds.filter((r) => r.status === 'pending').map((r) => r.paymentId)}
      />
      {owner && (
        <section className="grid gap-3">
          <h3 className="font-semibold">{m.billing_payment_history()}</h3>
          <p>{m.billing_cancel_refund_notice()}</p>
          <table>
            <thead>
              <tr>
                <th>{m.billing_date()}</th>
                <th>{m.billing_provider()}</th>
                <th>{m.billing_amount()}</th>
                <th>{m.billing_status()}</th>
                <th>{m.billing_refunded()}</th>
              </tr>
            </thead>
            <tbody>
              {page.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{date(payment.paidAt)}</td>
                  <td>{payment.provider}</td>
                  <td>{money(payment.amount, payment.currency)}</td>
                  <td>{payment.status}</td>
                  <td>{money(payment.refundedAmount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.payments.length === 0 && <p>{m.billing_no_payments()}</p>}
          <h3 className="font-semibold">{m.billing_refund_requests()}</h3>
          {page.refunds.map((refund) => (
            <p key={refund.id}>
              {date(refund.createdAt)} · {refund.status}
            </p>
          ))}
          {page.refunds.length === 0 && <p>{m.billing_no_refund_requests()}</p>}
        </section>
      )}
    </SpacePage>
  )
}
function errorMessage(code: string) {
  if (code === 'WORKSPACE_READ_ONLY') return m.billing_error_readonly()
  if (code === 'BILLING_OWNER_REQUIRED') return m.billing_error_owner()
  if (code === 'BILLING_PROVIDER_DISABLED' || code === 'BILLING_PRICE_UNAVAILABLE')
    return m.billing_error_unavailable()
  if (code === 'BILLING_SUBSCRIPTION_CHANGED' || code === 'BILLING_SWITCH_CONFIRMATION_REQUIRED')
    return m.billing_error_changed()
  return m.billing_error_unknown()
}
