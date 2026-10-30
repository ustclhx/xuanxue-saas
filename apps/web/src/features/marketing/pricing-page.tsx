import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { GrowthForm } from '../growth/forms.tsx'
import { FxAttribution } from '../readings/fx-attribution.tsx'
import { formatPrice, LOCAL_CURRENCY, type LocalRates } from '../readings/price.ts'
import { getLocalRates, type ReadingPricing } from '../readings/readings.functions.ts'
import { readingTitle } from '../readings/title.ts'
import { AiDisclaimer } from '../tools/disclaimer.tsx'
import { MarketingShell } from './marketing-shell.tsx'
import type { PricingCatalog } from './pricing-data.ts'

/** 未读到运行时设置时的每份详批积分（与 packages/db 设置默认值一致） */
const DEFAULT_READING_CREDITS = 100

const PACK_NAMES: Record<string, () => string> = {
  reading_single: m.pricing_pack_single,
  reading_five: m.pricing_pack_five,
}

interface Pack {
  readonly key: string
  readonly name: string
  readonly credits: number
  readonly creditExpiryDays: number | null
  /** 美分 */
  readonly amount: number | null
}

/** 只展示积分包（模板遗留的订阅套餐不在本产品出售）；价格取美元一次性价格，优先可购买的 */
export function creditPacks(catalog: PricingCatalog): Pack[] {
  return catalog.plans
    .filter((plan) => plan.type === 'credit_pack' && plan.credits > 0)
    .map((plan) => {
      const prices = catalog.prices.filter(
        (price) =>
          price.planId === plan.id &&
          price.interval === null &&
          price.currency.toUpperCase() === 'USD',
      )
      const price = prices.find((item) => item.available) ?? prices[0]
      return {
        key: plan.key,
        name: PACK_NAMES[plan.key]?.() ?? plan.name,
        credits: plan.credits,
        creditExpiryDays: plan.creditExpiryDays,
        amount: price?.amount ?? null,
      }
    })
    .sort((a, b) => a.credits - b.credits)
}

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

/**
 * 定价页（launch-v1-production 任务 1.3）：免费工具说明、积分包、本语言可解锁的详批与常见问题。
 * 支付未开通时显示「即将开放」，不提供结账入口。
 */
export function PricingPage({
  catalog,
  readings,
}: {
  catalog: PricingCatalog
  readings: ReadingPricing['readings']
}) {
  const locale = getLocale()
  // 汇率在浏览器中获取：预渲染时为空，不显示当地货币价格；读取失败时保持为空
  const [rates, setRates] = useState<LocalRates | null>(null)
  useEffect(() => {
    getLocalRates().then(setRates, () => undefined)
  }, [])
  const packs = creditPacks(catalog)
  const paymentsAvailable = catalog.providers.some((provider) => provider.available)
  const perReading = Math.min(...readings.map((r) => r.credits), DEFAULT_READING_CREDITS)
  const refundDays = String(templateConfig.billing.refundWindowDays)
  return (
    <MarketingShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 py-12 sm:px-6">
        <header className="flex max-w-3xl flex-col gap-3">
          <h1 className="m-0 font-bold font-heading text-4xl text-ink">{m.pricing_h1()}</h1>
          <p className="m-0 text-ink-muted text-lg leading-relaxed">{m.pricing_intro()}</p>
          {!paymentsAvailable && (
            <p
              role="status"
              className="m-0 rounded-lg border border-line bg-surface-2 px-4 py-3 text-ink text-sm"
            >
              {m.pricing_payments_soon()}
            </p>
          )}
        </header>

        <section aria-labelledby="pricing-packs" className="flex flex-col gap-4">
          <h2 id="pricing-packs" className="m-0 font-heading font-semibold text-2xl text-ink">
            {m.pricing_packs_title()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => {
              const count = Math.floor(pack.credits / perReading)
              const best = packs.length > 1 && pack === packs.at(-1)
              const local =
                pack.amount !== null && rates && LOCAL_CURRENCY[locale]
                  ? formatPrice(pack.amount, locale, rates).text
                  : null
              const each =
                count > 1 && pack.amount !== null ? usd(Math.round(pack.amount / count)) : null
              return (
                <article
                  key={pack.key}
                  data-testid="pricing-pack"
                  className={`flex flex-col gap-3 rounded-xl p-6 ${
                    best ? 'bg-inverse text-on-inverse' : 'border border-line bg-surface text-ink'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="m-0 font-heading font-semibold text-xl">{pack.name}</h3>
                    {best && (
                      <span className="rounded-full bg-brand px-3 py-1 font-semibold text-on-brand text-xs">
                        {m.pricing_pack_best_value()}
                      </span>
                    )}
                  </div>
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2">
                    {pack.amount !== null && (
                      <span className="font-bold text-3xl">{usd(pack.amount)}</span>
                    )}
                    {local && <span className="text-sm opacity-75">≈ {local}</span>}
                  </p>
                  <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px] leading-relaxed">
                    <li>{m.pricing_pack_credits({ credits: String(pack.credits) })}</li>
                    <li>
                      {count === 1
                        ? m.pricing_pack_readings_one()
                        : m.pricing_pack_readings_other({ count: String(count) })}
                      {each && ` · ${m.pricing_pack_per_reading({ price: each })}`}
                    </li>
                    {pack.creditExpiryDays && (
                      <li>{m.pricing_pack_expiry({ days: String(pack.creditExpiryDays) })}</li>
                    )}
                    <li>{m.pricing_pack_one_time()}</li>
                  </ul>
                  {paymentsAvailable && (
                    <Link
                      to="/app"
                      search={{ buy: pack.key }}
                      className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-on-brand"
                    >
                      {m.pricing_buy()}
                    </Link>
                  )}
                </article>
              )
            })}
          </div>
          {rates?.attribution && LOCAL_CURRENCY[locale] && (
            <FxAttribution attribution={rates.attribution} />
          )}
        </section>

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
          {[
            [m.pricing_faq_free_q(), m.pricing_faq_free_a()],
            [m.pricing_faq_fail_q(), m.pricing_faq_fail_a()],
            [m.pricing_faq_refund_q(), m.pricing_faq_refund_a({ days: refundDays })],
            [m.pricing_faq_accuracy_q(), m.pricing_faq_accuracy_a()],
            [m.pricing_faq_pay_q(), m.pricing_faq_pay_a()],
          ].map(([question, answer]) => (
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
