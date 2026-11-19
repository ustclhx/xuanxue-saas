import { Link } from '@tanstack/react-router'
import { cn } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { useEffect } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { trackEvent } from '../analytics/track.ts'
import { siteAccountNames } from '../auth/site-account-names.ts'
import { GrowthForm } from '../growth/forms.tsx'
import { primaryButton, secondaryButton, textLink } from '../readings/buttons.ts'
import { displayPrice, type PriceDisplay } from '../readings/price.ts'
import type { ReadingPricing } from '../readings/readings.functions.ts'
import { readingTitle } from '../readings/title.ts'
import { siteOfLocale } from '../site/site.ts'
import { AiDisclaimer } from '../tools/disclaimer.tsx'
import { MarketingShell } from './marketing-shell.tsx'
import { DEFAULT_READING_CREDITS } from './pricing-credits.ts'
import { displayProvider, type PricingCatalog, selectDisplayPrice } from './pricing-data.ts'

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

// 设计稿 warm-refresh/Pricing{East,West}Mobile.dc.html：区块标题用 heading 角色，方案卡是 surface 上的对象，不画边框
const sectionTitle = 'm-0 font-heading text-ink text-subtitle'
const planCard = 'flex flex-col gap-3 rounded-object bg-surface p-6 sm:p-8'
const planName = 'm-0 font-heading text-ink text-subtitle'
const planList = 'm-0 flex list-none flex-col gap-1 p-0 text-body text-ink-muted'
const badge =
  'inline-flex min-h-6 shrink-0 items-center rounded-full bg-surface-2 px-2.5 text-caption text-ink-muted'

/**
 * 定价页（launch-v1-production 1.3，enable-subscriptions-daily-credits 4.1；版式见设计稿
 * warm-refresh/Pricing{East,West}Mobile.dc.html，refresh-visual-system-warm 8.1）：
 * 单次购买积分包、免费档、每月方案、积分扣用顺序、本语言可解锁的详批与常见问题。
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
  // 「版本 B」新用户首次登录共 20 积分 = 注册赠送 + 当天每日领取（文案写死合计数，与每日数一样）
  const firstLogin = daily && templateConfig.billing.signupBonusCredits > 0
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
  // 设计稿把「最划算」标在积分最多的积分包上，它也是页面上唯一的主按钮
  const bestPack = packs.length > 1 ? packs.at(-1) : undefined
  return (
    <MarketingShell>
      <PageWidth className="flex flex-col gap-12 pb-16 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          <h1 className="m-0 text-balance font-heading text-ink text-title">{m.pricing_h1()}</h1>
          {/* 补充句自带前导空格（en / ko），中文直接衔接 */}
          <p className="m-0 text-body text-ink-muted">
            {m.pricing_lead()}
            {firstLogin ? m.pricing_lead_first_login() : daily && m.pricing_lead_daily()}
          </p>
          {!anyPurchasable && (
            <p
              role="status"
              data-testid="pricing-not-purchasable"
              className="m-0 mt-2 rounded-field bg-surface-2 px-4 py-3 text-body text-ink"
            >
              {readingsOpen ? m.pricing_payments_soon() : m.readings_packs_not_open()}
            </p>
          )}
        </header>

        <section aria-labelledby="pricing-packs" className="flex flex-col gap-4">
          <h2 id="pricing-packs" className={sectionTitle}>
            {subs.length > 0 ? m.pricing_packs_once_title() : m.pricing_packs_title()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 积分多的在前（设计稿：超值包、入门包） */}
            {[...packs].reverse().map((pack) => {
              const price = money(pack, locale)
              const best = pack === bestPack
              return (
                <article key={pack.key} data-testid="pricing-pack" className={planCard}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={planName}>{pack.name}</h3>
                    {best && <span className={badge}>{m.pricing_pack_best_value()}</span>}
                  </div>
                  {price && (
                    <p
                      className="m-0 font-heading text-ink text-title"
                      data-testid="pricing-pack-price"
                    >
                      {price.text}
                    </p>
                  )}
                  <ul className={planList}>
                    <li>{m.pricing_pack_credits({ credits: String(pack.credits) })}</li>
                  </ul>
                  {price?.reference && (
                    <p className="m-0 text-caption text-ink-subtle">
                      {m.billing_cny_reference({ price: price.reference })}
                    </p>
                  )}
                  {packPurchasable(pack, readingsOpen) && (
                    <Link
                      to="/app"
                      search={{ buy: pack.key }}
                      className={cn(best ? primaryButton : secondaryButton, 'mt-auto w-full')}
                    >
                      {m.pricing_pack_buy()}
                    </Link>
                  )}
                </article>
              )
            })}
          </div>
          <PayNote catalog={catalog} packs={packs} locale={locale} />
        </section>

        {subs.length > 0 && (
          <section aria-labelledby="pricing-free" className="flex flex-col gap-4">
            <h2 id="pricing-free" className={sectionTitle}>
              {m.pricing_free_name()}
            </h2>
            <article data-testid="pricing-free" className={planCard}>
              <p className="m-0 font-heading text-ink text-title">
                {zeroPrice(subCurrency, locale)}
              </p>
              <ul className={planList}>
                <li>{m.pricing_free_tools()}</li>
                {firstLogin && <li>{m.pricing_free_first_login()}</li>}
                {daily && <li>{m.pricing_free_daily()}</li>}
                {daily && <li>{m.pricing_free_daily_expiry()}</li>}
              </ul>
              <Link to="/register" className={cn(textLink, 'gap-1 self-start')}>
                {m.pricing_free_cta()}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          </section>
        )}

        {subs.length > 0 && (
          <section aria-labelledby="pricing-subs" className="flex flex-col gap-4">
            <h2 id="pricing-subs" className={sectionTitle}>
              {m.pricing_subs_title()}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {subs.map((sub) => {
                const price = money(sub, locale)
                return (
                  <article key={sub.key} data-testid="pricing-sub" className={planCard}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className={planName}>{sub.name}</h3>
                      <p className={cn(planName, 'flex items-baseline gap-x-1')}>
                        {price && <span data-testid="pricing-sub-price">{price.text}</span>}
                        <span>{m.pricing_per_month()}</span>
                      </p>
                    </div>
                    {price?.reference && (
                      <p className="m-0 text-caption text-ink-subtle">
                        {m.billing_cny_reference({ price: price.reference })}
                      </p>
                    )}
                    <ul className={planList}>
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
                        className={cn(secondaryButton, 'mt-auto w-full')}
                      >
                        {m.pricing_sub_cta()}
                      </Link>
                    ) : (
                      <span
                        data-testid="pricing-sub-soon"
                        className="mt-auto inline-flex min-h-12 items-center justify-center rounded-full bg-surface-2 px-7 text-body text-ink-muted"
                      >
                        {m.pricing_sub_soon()}
                      </span>
                    )}
                  </article>
                )
              })}
            </div>
            <p
              role="note"
              className="m-0 max-w-180 text-caption text-ink-subtle"
              data-testid="pricing-sub-note"
            >
              {m.pricing_sub_note({ currency: CURRENCY_NAMES[subCurrency]?.() ?? subCurrency })}
              {subReference && m.pricing_sub_reference_note()}
            </p>
          </section>
        )}

        {subs.length > 0 && (
          <section
            aria-labelledby="pricing-order"
            className="flex flex-col gap-1 rounded-object bg-surface-2 p-6 sm:px-8"
          >
            <h2 id="pricing-order" className={sectionTitle}>
              {m.pricing_order_title()}
            </h2>
            <p className="m-0 max-w-180 text-body text-ink-muted">
              {daily ? m.pricing_order_desc() : m.pricing_order_desc_no_daily()}
            </p>
          </section>
        )}

        {readings.length > 0 && (
          <section aria-labelledby="pricing-readings" className="flex flex-col gap-4">
            <h2 id="pricing-readings" className={sectionTitle}>
              {m.pricing_unlock_title()}
            </h2>
            <ul className="m-0 grid list-none gap-x-6 p-0 text-body text-ink sm:grid-cols-2 [&>li]:border-line [&>li]:border-b [&>li]:py-2">
              {readings.map((reading) => (
                <li key={reading.kind}>{readingTitle(reading.kind)}</li>
              ))}
            </ul>
            <p role="note" className="m-0 text-caption text-ink-subtle">
              {m.pricing_unlock_note({ credits: String(perReading) })}
            </p>
          </section>
        )}

        <section aria-labelledby="pricing-faq" className="flex max-w-180 flex-col gap-4">
          <h2 id="pricing-faq" className={sectionTitle}>
            {m.pricing_faq_title()}
          </h2>
          {/* 原生 details：无需脚本即可展开，答案始终在服务端输出的 HTML 中 */}
          <div className="border-line border-t">
            {faq.map(([question, answer], index) => (
              <details key={question} open={index === 0} className="group border-line border-b">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
                  {question}
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  >
                    <path
                      d="M5 8l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <p className="m-0 pb-5 text-body text-ink-muted">{answer}</p>
              </details>
            ))}
          </div>
          <p className="m-0 flex flex-wrap gap-x-6">
            <Link to="/refund" className={textLink}>
              {m.marketing_footer_refund()}
            </Link>
            <Link to="/terms" className={textLink}>
              {m.marketing_footer_terms()}
            </Link>
            <Link to="/disclaimer" className={textLink}>
              {m.marketing_footer_disclaimer()}
            </Link>
          </p>
          <AiDisclaimer />
        </section>
      </PageWidth>
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
    <p
      role="note"
      className="m-0 max-w-180 text-caption text-ink-subtle"
      data-testid="pricing-pay-note"
    >
      {text}
    </p>
  )
}
