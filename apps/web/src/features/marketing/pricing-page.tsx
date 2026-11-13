import { Link } from '@tanstack/react-router'
import { cn } from '@xuanxue/ui'
import { useEffect } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { trackEvent } from '../analytics/track.ts'
import { siteAccountNames } from '../auth/site-account-names.ts'
import { GrowthForm } from '../growth/forms.tsx'
import { displayPrice, type PriceDisplay } from '../readings/price.ts'
import type { ReadingPricing } from '../readings/readings.functions.ts'
import { readingTitle } from '../readings/title.ts'
import { siteOfLocale } from '../site/site.ts'
import { AiDisclaimer } from '../tools/disclaimer.tsx'
import { MarketingShell } from './marketing-shell.tsx'
import { displayProvider, type PricingCatalog, selectDisplayPrice } from './pricing-data.ts'

/** 未读到运行时设置时的每份详批积分（与 packages/db 设置默认值一致） */
const DEFAULT_READING_CREDITS = 100

const PACK_NAMES: Record<string, () => string> = {
  reading_single: m.pricing_pack_single,
  reading_five: m.pricing_pack_five,
}

const CURRENCY_NAMES: Record<string, () => string> = {
  USD: m.pricing_currency_usd,
  TWD: m.pricing_currency_twd,
  KRW: m.pricing_currency_krw,
}

type CatalogPlan = PricingCatalog['plans'][number]

interface Offer {
  readonly key: string
  readonly name: string
  readonly credits: number
  readonly creditExpiryDays: number | null
  /** 结算币种的最小单位 */
  readonly amount: number | null
  readonly currency: string
  /** 有价格已同步到支付商且付款方式可用 */
  readonly available: boolean
}

/**
 * 订阅只在有订阅价格的平台上展示（enable-subscriptions-daily-credits D3，PayPal 不卖订阅）：
 * 按 template.config 顺序取第一个可用且有该套餐价格的平台，都不可用时取第一个有价格的平台。
 */
function subscriptionProvider(catalog: PricingCatalog, prices: readonly { provider: string }[]) {
  const priced = (id: string) => prices.some((price) => price.provider === id)
  return (
    catalog.providers.find((p) => p.available && priced(p.id))?.id ??
    catalog.providers.find((p) => priced(p.id))?.id ??
    prices[0]?.provider
  )
}

function offer(catalog: PricingCatalog, plan: CatalogPlan, locale: string): Offer {
  const subscription = plan.type === 'subscription'
  // 只有月付（D1）：订阅取 month 价格，积分包取一次性价格
  const prices = catalog.prices.filter(
    (price) => price.planId === plan.id && price.interval === (subscription ? 'month' : null),
  )
  const provider = subscription ? subscriptionProvider(catalog, prices) : displayProvider(catalog)
  const price = provider ? selectDisplayPrice(prices, locale, provider) : undefined
  return {
    key: plan.key,
    name: PACK_NAMES[plan.key]?.() ?? plan.name,
    credits: plan.credits,
    creditExpiryDays: plan.creditExpiryDays,
    amount: price?.amount ?? null,
    currency: price?.currency ?? 'USD',
    available: prices.some((item) => item.available),
  }
}

/**
 * 积分包价格按界面语言在主展示平台上选价（与结账同一规则，localize-checkout-currency D5）：
 * zh-Hant 为 TWD、ko 为 KRW，本地价格不可购买时回退 USD。
 */
export function creditPacks(catalog: PricingCatalog, locale: string): Offer[] {
  return catalog.plans
    .filter((plan) => plan.type === 'credit_pack' && plan.credits > 0)
    .map((plan) => offer(catalog, plan, locale))
    .sort((a, b) => a.credits - b.credits)
}

/** 在售订阅档位（不含免费档与没有月付价格的模板示例），按积分从少到多 */
export function subscriptionPlans(catalog: PricingCatalog, locale: string): Offer[] {
  return catalog.plans
    .filter(
      (plan) =>
        plan.type === 'subscription' &&
        plan.credits > 0 &&
        catalog.prices.some((price) => price.planId === plan.id && price.interval === 'month'),
    )
    .map((plan) => offer(catalog, plan, locale))
    .sort((a, b) => a.credits - b.credits)
}

/**
 * 积分包或订阅能否在本站购买：积分主要用于详批，本站本语言没有已开放的详批时（`readings` 为空，
 * 判定见 readings/availability.ts）暂停出售；否则需有可购买的价格。
 */
export function packPurchasable(pack: Pick<Offer, 'available'>, readingsOpen: boolean): boolean {
  return readingsOpen && pack.available
}

const money = (item: Offer, locale: string): PriceDisplay | null =>
  item.amount === null
    ? null
    : displayPrice({ amount: item.amount, currency: item.currency }, locale)

/** 免费档价格：与订阅同币种的 0 元，不显示小数 */
function zeroPrice(currency: string, locale: string): string {
  const code = currency.toUpperCase()
  return new Intl.NumberFormat(code === 'TWD' ? 'en' : locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(0)
}

type Faq = readonly [string, string]

/**
 * 定价页（launch-v1-production 1.3，enable-subscriptions-daily-credits 4.1，原型 Pricing.dc.html）：
 * 每月方案（免费档 + 订阅两档）、单次购买积分包、积分扣用顺序、本语言可解锁的详批与常见问题。
 * 详批尚未开放时说明暂不出售；订阅价格不可购买时显示「即将开放」、积分包不显示购买入口。
 * 页面只依赖传入的目录与详批清单，预渲染不读数据库。
 */
export function PricingPage({
  catalog,
  readings,
}: {
  catalog: PricingCatalog
  readings: ReadingPricing['readings']
}) {
  const locale = getLocale()
  useEffect(() => trackEvent('paywall_view'), [])
  const packs = creditPacks(catalog, locale)
  const subs = subscriptionPlans(catalog, locale)
  const readingsOpen = readings.length > 0
  const anyPurchasable = [...packs, ...subs].some((item) => packPurchasable(item, readingsOpen))
  const perReading = Math.min(...readings.map((r) => r.credits), DEFAULT_READING_CREDITS)
  const refundDays = String(templateConfig.billing.refundWindowDays)
  const daily = templateConfig.credits.enabled && templateConfig.credits.dailyEnabled
  const subCurrency = subs.find((sub) => sub.amount !== null)?.currency.toUpperCase() ?? 'USD'
  const subReference = subs.some((sub) => money(sub, locale)?.reference)
  const subFaq: Faq[] = subs.length
    ? [
        [m.pricing_faq_sub_rollover_q(), m.pricing_faq_sub_rollover_a()],
        [m.pricing_faq_sub_cancel_q(), m.pricing_faq_sub_cancel_a({ days: refundDays })],
      ]
    : []
  // 每日领取规则与同一邮箱两站共享额度（daily-credits spec）
  const dailyFaq: Faq[] = daily
    ? [
        [
          m.daily_credits_faq_q(),
          m.daily_credits_faq_a(
            siteAccountNames(siteOfLocale(locale, templateConfig) ?? 'west', locale),
          ),
        ],
      ]
    : []
  const faq: Faq[] = [
    [m.pricing_faq_free_q(), m.pricing_faq_free_a()],
    ...subFaq,
    ...dailyFaq,
    [m.pricing_faq_fail_q(), m.pricing_faq_fail_a()],
    [m.pricing_faq_refund_q(), m.pricing_faq_refund_a({ days: refundDays })],
    [m.pricing_faq_accuracy_q(), m.pricing_faq_accuracy_a()],
    [m.pricing_faq_pay_q(), m.pricing_faq_pay_a()],
    [m.pricing_faq_currency_q(), m.pricing_faq_currency_a()],
  ]
  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 px-4 py-12 sm:px-6">
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h1 className="m-0 font-bold font-heading text-4xl text-ink">{m.pricing_h1()}</h1>
          <p className="m-0 text-ink-muted text-lg leading-relaxed">
            {m.pricing_lead()}
            {daily && ` ${m.pricing_lead_daily()}`}
          </p>
          {!anyPurchasable && (
            <p
              role="status"
              data-testid="pricing-not-purchasable"
              className="m-0 rounded-lg border border-line bg-surface-2 px-4 py-3 text-ink text-sm"
            >
              {readingsOpen ? m.pricing_payments_soon() : m.readings_packs_not_open()}
            </p>
          )}
        </header>

        {subs.length > 0 && (
          <section aria-labelledby="pricing-subs" className="flex flex-col gap-4">
            <h2 id="pricing-subs" className="m-0 font-heading font-semibold text-2xl text-ink">
              {m.pricing_subs_title()}
            </h2>
            <div className="grid items-stretch gap-4 md:grid-cols-3">
              <article
                data-testid="pricing-free"
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 text-ink"
              >
                <h3 className="m-0 font-semibold text-lg">{m.pricing_free_name()}</h3>
                <p className="m-0 font-bold text-3xl">{zeroPrice(subCurrency, locale)}</p>
                <ul className="m-0 flex flex-1 flex-col gap-1 pl-5 text-ink-muted leading-relaxed">
                  <li>{m.pricing_free_tools()}</li>
                  {daily && <li>{m.pricing_free_daily()}</li>}
                  {daily && <li>{m.pricing_free_daily_expiry()}</li>}
                </ul>
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-ink hover:bg-surface-2"
                >
                  {m.pricing_free_cta()}
                </Link>
              </article>
              {subs.map((sub) => {
                const best = subs.length > 1 && sub === subs.at(-1)
                const price = money(sub, locale)
                return (
                  <article
                    key={sub.key}
                    data-testid="pricing-sub"
                    className={cn(
                      'flex flex-col gap-3 rounded-xl bg-surface p-6 text-ink',
                      best ? 'border-2 border-brand' : 'border border-line-strong',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="m-0 font-semibold text-lg">{sub.name}</h3>
                      {best && (
                        <span className="rounded-full bg-brand px-2.5 py-0.5 text-on-brand text-xs">
                          {m.pricing_pack_best_value()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="m-0 flex flex-wrap items-baseline gap-x-1">
                        {price && (
                          <span className="font-bold text-3xl" data-testid="pricing-sub-price">
                            {price.text}
                          </span>
                        )}
                        <span className="text-ink-muted">{m.pricing_per_month()}</span>
                      </p>
                      <p className="m-0 min-h-5 text-ink-subtle text-sm">
                        {price?.reference && m.billing_cny_reference({ price: price.reference })}
                      </p>
                    </div>
                    <ul className="m-0 flex flex-1 flex-col gap-1 pl-5 text-ink-muted leading-relaxed">
                      <li>
                        {m.pricing_sub_credits({
                          credits: String(sub.credits),
                          count: String(Math.floor(sub.credits / perReading)),
                        })}
                      </li>
                      <li>{m.pricing_sub_usage()}</li>
                      <li>{m.pricing_sub_cancel()}</li>
                    </ul>
                    {packPurchasable(sub, readingsOpen) ? (
                      <Link
                        to="/app"
                        search={{ buy: sub.key }}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-on-brand hover:opacity-90"
                      >
                        {m.pricing_sub_cta()}
                      </Link>
                    ) : (
                      <span
                        data-testid="pricing-sub-soon"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-5 text-ink-muted"
                      >
                        {m.pricing_sub_soon()}
                      </span>
                    )}
                  </article>
                )
              })}
            </div>
            <p className="m-0 text-ink-subtle text-sm" data-testid="pricing-sub-note">
              {m.pricing_sub_note({ currency: CURRENCY_NAMES[subCurrency]?.() ?? subCurrency })}
              {subReference && ` ${m.pricing_sub_reference_note()}`}
            </p>
          </section>
        )}

        <section aria-labelledby="pricing-packs" className="flex flex-col gap-4">
          <h2 id="pricing-packs" className="m-0 font-heading font-semibold text-2xl text-ink">
            {subs.length > 0 ? m.pricing_packs_once_title() : m.pricing_packs_title()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => {
              const price = money(pack, locale)
              return (
                <article
                  key={pack.key}
                  data-testid="pricing-pack"
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-6 py-5 text-ink"
                >
                  <div className="flex min-w-0 flex-col">
                    <h3 className="m-0 font-semibold text-lg">{pack.name}</h3>
                    <p className="m-0 text-ink-muted text-sm">
                      {m.pricing_pack_credits({ credits: String(pack.credits) })}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                      {price && (
                        <p className="m-0 font-bold text-2xl" data-testid="pricing-pack-price">
                          {price.text}
                        </p>
                      )}
                      {price?.reference && (
                        <p className="m-0 text-ink-subtle text-xs">
                          {m.billing_cny_reference({ price: price.reference })}
                        </p>
                      )}
                    </div>
                    {packPurchasable(pack, readingsOpen) && (
                      <Link
                        to="/app"
                        search={{ buy: pack.key }}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong px-4 font-semibold text-ink hover:bg-surface-2"
                      >
                        {m.pricing_pack_buy()}
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          <PayNote catalog={catalog} packs={packs} locale={locale} />
        </section>

        {subs.length > 0 && (
          <section
            aria-labelledby="pricing-order"
            className="flex flex-col gap-2 rounded-xl bg-surface-2 px-6 py-5"
          >
            <h2 id="pricing-order" className="m-0 font-semibold text-ink text-lg">
              {m.pricing_order_title()}
            </h2>
            <p className="m-0 text-ink-muted leading-relaxed">
              {daily ? m.pricing_order_desc() : m.pricing_order_desc_no_daily()}
            </p>
          </section>
        )}

        {readings.length > 0 && (
          <section aria-labelledby="pricing-readings" className="flex flex-col gap-3">
            <h2 id="pricing-readings" className="m-0 font-heading font-semibold text-2xl text-ink">
              {m.pricing_unlock_title()}
            </h2>
            <ul className="m-0 grid gap-2 pl-5 text-ink sm:grid-cols-2">
              {readings.map((reading) => (
                <li key={reading.kind}>{readingTitle(reading.kind)}</li>
              ))}
            </ul>
            <p className="m-0 text-ink-muted text-sm">
              {m.pricing_unlock_note({ credits: String(perReading) })}
            </p>
          </section>
        )}

        <section aria-labelledby="pricing-faq" className="flex max-w-3xl flex-col gap-4">
          <h2 id="pricing-faq" className="m-0 font-heading font-semibold text-2xl text-ink">
            {m.pricing_faq_title()}
          </h2>
          {faq.map(([question, answer]) => (
            <div key={question} className="flex flex-col gap-1">
              <h3 className="m-0 font-semibold text-ink">{question}</h3>
              <p className="m-0 text-ink-muted leading-relaxed">{answer}</p>
            </div>
          ))}
          <p className="m-0 flex flex-wrap gap-x-4 text-sm">
            <Link to="/refund" className="text-brand-ink underline">
              {m.marketing_footer_refund()}
            </Link>
            <Link to="/terms" className="text-brand-ink underline">
              {m.marketing_footer_terms()}
            </Link>
            <Link to="/disclaimer" className="text-brand-ink underline">
              {m.marketing_footer_disclaimer()}
            </Link>
          </p>
          <AiDisclaimer />
        </section>
      </div>
      {templateConfig.features.newsletter ? <GrowthForm feature="newsletter" /> : null}
    </MarketingShell>
  )
}

/**
 * 积分包的结算说明：卡片按界面语言的结算币种（与展示价格一致），PayPal 一律美元并列出美元价格；
 * 结算币种本就是美元时只说明两者均为美元（localize-checkout-currency 决策 2）。
 */
function PayNote({
  catalog,
  packs,
  locale,
}: {
  catalog: PricingCatalog
  packs: readonly Offer[]
  locale: string
}) {
  const days = Math.min(...packs.map((pack) => pack.creditExpiryDays ?? Number.POSITIVE_INFINITY))
  if (!Number.isFinite(days)) return null
  const currency = packs.find((pack) => pack.amount !== null)?.currency.toUpperCase() ?? 'USD'
  const paypal = packs.flatMap((pack) => {
    const plan = catalog.plans.find((item) => item.key === pack.key)
    const price = catalog.prices.find(
      (item) =>
        item.planId === plan?.id &&
        item.provider === 'paypal' &&
        item.interval === null &&
        item.currency.toUpperCase() === 'USD',
    )
    return price ? [displayPrice(price, locale).text] : []
  })
  const text =
    currency === 'USD'
      ? m.pricing_pay_note_usd({ days: String(days) })
      : paypal.length
        ? m.pricing_pay_note_local({
            currency: CURRENCY_NAMES[currency]?.() ?? currency,
            prices: paypal.join(' / '),
            days: String(days),
          })
        : m.pricing_pack_expiry({ days: String(days) })
  return (
    <p className="m-0 text-ink-subtle text-sm" data-testid="pricing-pay-note">
      {text}
    </p>
  )
}
