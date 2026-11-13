import type { PlanPrice } from '@xuanxue/db/schema'
import { log } from '@xuanxue/shared/log'
import Stripe from 'stripe'
import { assertMinorAmount, enabledCurrency } from '../currency.ts'
import type { CheckoutInput, PaymentProvider, PlanSyncInput, RefundInput } from '../provider.ts'
import {
  canonicalProductId,
  isLocalizedPackLocale,
  LOCAL_CURRENCY_LOCALE,
  LOCALIZED_PACK_LOCALES,
  type LocalizedPackLocale,
  localizedLookupKey,
  localizedPackDescription,
  localizedPackName,
  localizedProductId,
} from './localized.ts'
import { parseStripeMetadata } from './metadata.ts'

export type StripeOperations = Required<
  Pick<
    PaymentProvider,
    | 'createCheckout'
    | 'getPortalUrl'
    | 'cancelSubscription'
    | 'resumeSubscription'
    | 'changePlan'
    | 'refund'
    | 'syncPlan'
  >
>

function priceId(price: PlanPrice): string {
  if (price.provider !== 'stripe' || !price.active || !price.providerPriceId.startsWith('price_')) {
    throw new Error('Expected an active Stripe price mapping')
  }
  return price.providerPriceId
}

function requestOptions(idempotencyKey: string): Stripe.RequestOptions {
  if (!idempotencyKey.trim() || idempotencyKey.length > 255) {
    throw new Error('A nonempty stable idempotency key of at most 255 characters is required')
  }
  return { idempotencyKey }
}

const STRIPE_LOCALES: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = {
  en: 'en',
  'zh-Hant': 'zh-TW',
  'zh-Hans': 'zh',
  ko: 'ko',
}

/**
 * 一次性付款的站点展示：两站共用一个 Stripe 账户与同一组价格，页头名称、语言、付款说明、
 * 卡账单后缀与站点元数据按请求站点区分；订阅不使用（商品名与发票由 Price 决定）。
 */
function stripePresentation(input: CheckoutInput) {
  const shown = input.mode === 'one_time' ? input.presentation : undefined
  if (!shown) return { session: {}, intent: {}, metadata: {} }
  const locale = STRIPE_LOCALES[shown.locale]
  return {
    session: {
      ...(shown.brandName ? { branding_settings: { display_name: shown.brandName } } : {}),
      ...(locale ? { locale } : {}),
    },
    intent: {
      ...(shown.description ? { description: shown.description } : {}),
      ...(shown.statementDescriptorSuffix
        ? { statement_descriptor_suffix: shown.statementDescriptorSuffix }
        : {}),
    },
    metadata: shown.site ? { site: shown.site } : {},
  }
}

/**
 * 一次性积分包按展示语言选用本地化价格（商品行显示本地化商品名）。查不到、元数据或金额不符、
 * 查询出错时都回退到规范价格：先部署代码、后跑同步也安全，且不因展示问题阻断付款。
 */
async function checkoutPrice(stripe: Stripe, input: CheckoutInput): Promise<string> {
  const canonical = priceId(input.price)
  // TWD / KRW 行本身就是挂在本地化商品上的独立 Price（localize-checkout-currency D1），直接使用、不查 lookup_key
  if (input.price.currency.toUpperCase() !== 'USD') return canonical
  const locale = input.mode === 'one_time' ? input.presentation?.locale : undefined
  if (!locale || !isLocalizedPackLocale(locale)) return canonical
  try {
    const found = await stripe.prices.list({
      lookup_keys: [localizedLookupKey(input.price.id, locale)],
      active: true,
      limit: 1,
    })
    const localized = found.data[0]
    if (
      localized &&
      localized.type === 'one_time' &&
      localized.metadata.planPriceId === input.price.id &&
      localized.metadata.canonicalPriceId === canonical &&
      localized.unit_amount === input.price.amount &&
      localized.currency === input.price.currency.toLowerCase()
    ) {
      return localized.id
    }
    if (localized) log.warn('billing.stripe_localized_price_mismatch', { locale })
  } catch {
    // Stripe 错误可能含请求细节，只记录固定字段
    log.warn('billing.stripe_localized_price_lookup_failed', { locale })
  }
  return canonical
}

export async function createStripeCheckout(stripe: Stripe, input: CheckoutInput) {
  const options = requestOptions(input.idempotencyKey)
  const metadata = parseStripeMetadata({
    workspaceId: input.workspaceId,
    planPriceId: input.price.id,
    userId: input.userId,
  })
  if (!metadata) throw new Error('Checkout source metadata must contain UUIDs')
  if ((input.mode === 'subscription') !== (input.price.interval !== null)) {
    throw new Error('Checkout mode must match the price interval')
  }
  const shown = stripePresentation(input)
  const linePrice = await checkoutPrice(stripe, input)
  const session = await stripe.checkout.sessions.create(
    {
      mode: input.mode === 'one_time' ? 'payment' : 'subscription',
      ...shown.session,
      // 模板不由 Stripe 代销，避免账户默认的 Managed Payments 改变结算模式。
      managed_payments: { enabled: false },
      // 结算币种由服务端按界面语言选定价格行：关闭 Adaptive Pricing，避免 Stripe 按买家所在地再换算币种扣款。
      adaptive_pricing: { enabled: false },
      line_items: [{ price: linePrice, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.providerCustomerId
        ? { customer: input.providerCustomerId }
        : {
            customer_email: input.customerEmail,
            ...(input.mode === 'one_time' ? { customer_creation: 'always' as const } : {}),
          }),
      metadata: { ...metadata, ...shown.metadata },
      ...(input.mode === 'subscription'
        ? { subscription_data: { metadata: { ...metadata } } }
        : {
            payment_intent_data: { ...shown.intent, metadata: { ...metadata, ...shown.metadata } },
          }),
    },
    options,
  )
  if (!session.url) throw new Error('Stripe hosted Checkout session has no URL')
  return { url: session.url, providerRef: session.id }
}

function objectId(object: string | { id: string }): string {
  return typeof object === 'string' ? object : object.id
}

async function releaseSchedule(stripe: Stripe, subscription: Stripe.Subscription) {
  if (subscription.schedule) {
    // Cancellation and an immediate change supersede a pending downgrade.
    await stripe.subscriptionSchedules.release(objectId(subscription.schedule))
  }
}

type Phase = Stripe.SubscriptionScheduleUpdateParams.Phase

function phaseDiscount(discount: Stripe.SubscriptionSchedule.Phase.Discount) {
  if (discount.discount) return { discount: objectId(discount.discount) }
  if (discount.promotion_code) return { promotion_code: objectId(discount.promotion_code) }
  if (discount.coupon) return { coupon: objectId(discount.coupon) }
  throw new Error('Stripe schedule discount has no reference')
}

/** Stripe unsets omitted phase settings on update; explicitly preserve existing billing terms. */
function phaseSettings(phase: Stripe.SubscriptionSchedule.Phase): Omit<Phase, 'items'> {
  const invoice = phase.invoice_settings
  return {
    ...(phase.application_fee_percent === null
      ? {}
      : { application_fee_percent: phase.application_fee_percent }),
    ...(phase.automatic_tax
      ? {
          automatic_tax: {
            enabled: phase.automatic_tax.enabled,
            ...(phase.automatic_tax.liability
              ? {
                  liability: {
                    type: phase.automatic_tax.liability.type,
                    ...(phase.automatic_tax.liability.account
                      ? { account: objectId(phase.automatic_tax.liability.account) }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(phase.billing_cycle_anchor ? { billing_cycle_anchor: phase.billing_cycle_anchor } : {}),
    ...(phase.billing_thresholds
      ? {
          billing_thresholds: {
            ...(phase.billing_thresholds.amount_gte === null
              ? {}
              : { amount_gte: phase.billing_thresholds.amount_gte }),
            ...(phase.billing_thresholds.reset_billing_cycle_anchor === null
              ? {}
              : {
                  reset_billing_cycle_anchor: phase.billing_thresholds.reset_billing_cycle_anchor,
                }),
          },
        }
      : {}),
    ...(phase.collection_method ? { collection_method: phase.collection_method } : {}),
    currency: phase.currency,
    ...(phase.default_payment_method
      ? { default_payment_method: objectId(phase.default_payment_method) }
      : {}),
    default_tax_rates: phase.default_tax_rates?.map((rate) => rate.id) ?? [],
    ...(phase.description ? { description: phase.description } : {}),
    discounts: phase.discounts.map(phaseDiscount),
    ...(invoice
      ? {
          invoice_settings: {
            ...(invoice.account_tax_ids
              ? { account_tax_ids: invoice.account_tax_ids.map(objectId) }
              : {}),
            ...(invoice.custom_fields ? { custom_fields: invoice.custom_fields } : {}),
            ...(invoice.days_until_due === null ? {} : { days_until_due: invoice.days_until_due }),
            ...(invoice.description ? { description: invoice.description } : {}),
            ...(invoice.footer ? { footer: invoice.footer } : {}),
            ...(invoice.issuer
              ? {
                  issuer: {
                    type: invoice.issuer.type,
                    ...(invoice.issuer.account
                      ? { account: objectId(invoice.issuer.account) }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(phase.on_behalf_of ? { on_behalf_of: objectId(phase.on_behalf_of) } : {}),
    ...(phase.transfer_data
      ? {
          transfer_data: {
            destination: objectId(phase.transfer_data.destination),
            ...(phase.transfer_data.amount_percent === null
              ? {}
              : { amount_percent: phase.transfer_data.amount_percent }),
          },
        }
      : {}),
  }
}

export async function cancelStripeSubscription(
  stripe: Stripe,
  subId: string,
  opts: { atPeriodEnd: boolean },
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subId)
  await releaseSchedule(stripe, subscription)
  if (opts.atPeriodEnd) await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
  else await stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false })
}

/** Restore a period-end cancellation; an already canceled subscription cannot be restored. */
export async function resumeStripeSubscription(stripe: Stripe, subId: string): Promise<void> {
  await stripe.subscriptions.update(subId, { cancel_at_period_end: false })
}

export async function changeStripePlan(
  stripe: Stripe,
  subId: string,
  newPrice: PlanPrice,
  opts: { atPeriodEnd: boolean },
): Promise<void> {
  const target = priceId(newPrice)
  if (!newPrice.interval) throw new Error('Subscription changes require a recurring price')
  const subscription = await stripe.subscriptions.retrieve(subId)
  const item = subscription.items.data[0]
  if (!item || subscription.items.has_more || subscription.items.data.length !== 1) {
    throw new Error('Plan changes require a single subscription item')
  }
  if (subscription.pending_update) throw new Error('Subscription has a pending payment update')
  if (subscription.cancel_at_period_end)
    throw new Error('Resume the subscription before changing plan')
  const metadata = { ...subscription.metadata, planPriceId: newPrice.id }
  const intervalChange = item.price.recurring?.interval !== newPrice.interval
  if (!opts.atPeriodEnd) {
    await releaseSchedule(stripe, subscription)
    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, price: target, quantity: item.quantity ?? 1 }],
      metadata,
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
    })
    // Credit grants are exclusively the verified payment-event consumer's responsibility.
    return
  }
  const schedule = subscription.schedule
    ? await stripe.subscriptionSchedules.retrieve(objectId(subscription.schedule))
    : // SDK request keys cover network retries. A later cancel/resume/downgrade must
      // create a fresh schedule rather than replaying a previously released one.
      await stripe.subscriptionSchedules.create({ from_subscription: subId })
  if (schedule.phases.length > 1 && schedule.metadata?.saasManaged !== 'plan_change') {
    throw new Error('Cannot replace an externally managed subscription schedule')
  }
  const current = schedule.phases.find(
    (phase) => phase.start_date === schedule.current_phase?.start_date,
  )
  if (!current) throw new Error('Stripe schedule has no current phase')
  const common = phaseSettings(current)
  const phaseItem = current.items[0]
  if (!phaseItem || current.items.length !== 1) throw new Error('Schedule must have a single item')
  const itemSettings = {
    quantity: item.quantity ?? 1,
    metadata: { ...phaseItem.metadata },
    discounts: phaseItem.discounts.map(phaseDiscount),
    tax_rates: phaseItem.tax_rates?.map((rate) => rate.id) ?? [],
    ...(phaseItem.billing_thresholds?.usage_gte == null
      ? {}
      : {
          billing_thresholds: { usage_gte: phaseItem.billing_thresholds.usage_gte },
        }),
  }
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    metadata: { saasManaged: 'plan_change' },
    proration_behavior: 'none',
    phases: [
      {
        ...common,
        start_date: current.start_date,
        end_date: item.current_period_end,
        items: [{ ...itemSettings, price: item.price.id }],
        add_invoice_items: current.add_invoice_items.map((invoiceItem) => ({
          price: objectId(invoiceItem.price),
          ...(invoiceItem.quantity === null ? {} : { quantity: invoiceItem.quantity }),
          ...(invoiceItem.discountable === null ? {} : { discountable: invoiceItem.discountable }),
          discounts: invoiceItem.discounts.map(phaseDiscount),
          metadata: { ...invoiceItem.metadata },
          period: invoiceItem.period,
          tax_rates: invoiceItem.tax_rates?.map((rate) => rate.id) ?? [],
        })),
        metadata: { ...subscription.metadata },
        proration_behavior: 'none',
        ...(current.trial_end ? { trial_end: current.trial_end } : {}),
        ...(current.trial ? { trial: true } : {}),
      },
      {
        ...common,
        start_date: item.current_period_end,
        duration: { interval: newPrice.interval, interval_count: 1 },
        items: [{ ...itemSettings, price: target }],
        metadata,
        proration_behavior: 'none',
        // 月付↔年付：默认锚点在不按比例结算时沿用原锚点、把当前周期直接延长为新周期且不开票；
        // 从新阶段起点重置锚点，周期末才会按新价格开出整周期发票（同周期降级保持原锚点）。
        ...(intervalChange ? { billing_cycle_anchor: 'phase_start' as const } : {}),
      },
    ],
  })
}

export async function refundStripePayment(stripe: Stripe, input: RefundInput) {
  const options = requestOptions(input.idempotencyKey)
  if (input.amount !== undefined && (!Number.isSafeInteger(input.amount) || input.amount <= 0)) {
    throw new Error('Refund amount must be a positive integer in the smallest currency unit')
  }
  const refund = await stripe.refunds.create(
    {
      payment_intent: input.providerPaymentId,
      ...(input.amount === undefined ? {} : { amount: input.amount }),
    },
    options,
  )
  return { providerRefundId: refund.id }
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing'
  )
}

async function ensureCanonicalProduct(stripe: Stripe, input: PlanSyncInput): Promise<string> {
  const productId = canonicalProductId(input.plan.id)
  try {
    await stripe.products.retrieve(productId)
  } catch (error) {
    if (!isMissing(error)) throw error
    await stripe.products.create(
      {
        id: productId,
        name: input.plan.name,
        metadata: { planId: input.plan.id },
      },
      { idempotencyKey: `saas:product:${input.plan.id}` },
    )
  }
  return productId
}

/** 按确定的商品 ID 幂等补齐本地化商品；已存在时核对归属，不一致即报错 */
async function ensureLocalizedProduct(
  stripe: Stripe,
  input: PlanSyncInput,
  locale: LocalizedPackLocale,
  name: string,
): Promise<string> {
  const productId = localizedProductId(input.plan.id, locale)
  const description =
    input.plan.credits === undefined
      ? undefined
      : localizedPackDescription(input.plan.credits, locale, input.plan.type)
  try {
    const product = await stripe.products.retrieve(productId)
    if (product.metadata.planId !== input.plan.id || product.metadata.locale !== locale)
      throw new Error('Localized Stripe product does not match the local plan')
  } catch (error) {
    if (!isMissing(error)) throw error
    await stripe.products.create(
      {
        id: productId,
        name,
        ...(description ? { description } : {}),
        metadata: { planId: input.plan.id, locale },
      },
      { idempotencyKey: `saas:product:${input.plan.id}:${locale}` },
    )
  }
  return productId
}

async function syncCanonicalPrice(stripe: Stripe, input: PlanSyncInput): Promise<string> {
  const options = requestOptions(input.idempotencyKey)
  if (input.providerPriceId) {
    const existing = await stripe.prices.retrieve(input.providerPriceId)
    if (
      existing.unit_amount !== input.price.amount ||
      existing.currency !== input.price.currency.toLowerCase() ||
      (existing.recurring?.interval ?? null) !== input.price.interval ||
      (existing.recurring?.interval_count ?? 1) !== 1 ||
      existing.metadata.planId !== input.plan.id ||
      existing.metadata.planPriceId !== input.price.id
    ) {
      throw new Error('Immutable Stripe price mapping does not match the local price')
    }
    return existing.id
  }
  const productId = await ensureCanonicalProduct(stripe, input)
  const price = await stripe.prices.create(
    {
      product: productId,
      currency: input.price.currency.toLowerCase(),
      unit_amount: input.price.amount,
      active: input.plan.active && input.price.active,
      ...(input.price.interval ? { recurring: { interval: input.price.interval } } : {}),
      metadata: { planId: input.plan.id, planPriceId: input.price.id },
    },
    options,
  )
  return price.id
}

/**
 * 为积分包补齐各非英文语言的本地化 Product + Price（金额与规范价格相同）。
 * 按确定的商品 ID 与 lookup_key 幂等：已存在的价格只核对，不一致即报错，绝不改指向；
 * 本地仍只记录规范价格，订阅价格不受影响。
 */
async function syncLocalizedPackPrices(
  stripe: Stripe,
  input: PlanSyncInput,
  canonicalPriceId: string,
): Promise<void> {
  if (input.plan.type !== 'credit_pack' || input.price.interval !== null) return
  const currency = input.price.currency.toLowerCase()
  for (const locale of LOCALIZED_PACK_LOCALES) {
    const name = localizedPackName(input.plan.key, locale)
    if (!name) continue
    const productId = await ensureLocalizedProduct(stripe, input, locale, name)
    const lookupKey = localizedLookupKey(input.price.id, locale)
    // 不按 active 过滤：停用的同 key 价格也必须被发现，避免重复创建或静默改指向
    const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
    const existing = found.data[0]
    if (existing) {
      if (
        existing.product !== productId ||
        existing.type !== 'one_time' ||
        existing.unit_amount !== input.price.amount ||
        existing.currency !== currency ||
        existing.metadata.planId !== input.plan.id ||
        existing.metadata.planPriceId !== input.price.id ||
        existing.metadata.canonicalPriceId !== canonicalPriceId ||
        existing.metadata.locale !== locale
      ) {
        throw new Error('Localized Stripe price does not match the canonical price')
      }
      continue
    }
    await stripe.prices.create(
      {
        product: productId,
        currency,
        unit_amount: input.price.amount,
        active: input.plan.active && input.price.active,
        lookup_key: lookupKey,
        metadata: {
          planId: input.plan.id,
          planPriceId: input.price.id,
          canonicalPriceId,
          locale,
        },
      },
      requestOptions(`${input.idempotencyKey}:${locale}`),
    )
  }
}

/**
 * TWD / KRW 价格行（localize-checkout-currency D1）：每行对应 Stripe 上一个独立 Price，挂在该币种所服务语言的
 * 本地化商品上（套餐有译名时，含订阅 plus / premium；没有译名的套餐挂规范商品）。本地 plan_price 直接记录该 Price，
 * 结账不经 lookup_key 还原。已映射的 Price 只核对，不一致即报错，绝不改价或改指向。
 */
async function syncLocalCurrencyPrice(stripe: Stripe, input: PlanSyncInput): Promise<string> {
  const currency = enabledCurrency(input.price.currency)
  if (!currency || currency === 'USD') throw new Error('Expected a local-currency price')
  assertMinorAmount(input.price.amount, currency)
  const locale = LOCAL_CURRENCY_LOCALE[currency]
  // 积分包与有译名的订阅（plus / premium）都挂本地化商品；没有译名的套餐挂规范商品
  const name = localizedPackName(input.plan.key, locale)
  const expectedProduct = name
    ? localizedProductId(input.plan.id, locale)
    : canonicalProductId(input.plan.id)
  if (input.providerPriceId) {
    const existing = await stripe.prices.retrieve(input.providerPriceId)
    if (
      existing.unit_amount !== input.price.amount ||
      existing.currency !== currency.toLowerCase() ||
      (existing.recurring?.interval ?? null) !== input.price.interval ||
      (existing.recurring?.interval_count ?? 1) !== 1 ||
      objectId(existing.product) !== expectedProduct ||
      existing.metadata.planId !== input.plan.id ||
      existing.metadata.planPriceId !== input.price.id ||
      existing.metadata.currency !== currency
    ) {
      throw new Error('Immutable Stripe price mapping does not match the local price')
    }
    return existing.id
  }
  const productId = name
    ? await ensureLocalizedProduct(stripe, input, locale, name)
    : await ensureCanonicalProduct(stripe, input)
  const price = await stripe.prices.create(
    {
      product: productId,
      currency: currency.toLowerCase(),
      unit_amount: input.price.amount,
      active: input.plan.active && input.price.active,
      ...(input.price.interval ? { recurring: { interval: input.price.interval } } : {}),
      metadata: { planId: input.plan.id, planPriceId: input.price.id, currency, locale },
    },
    requestOptions(input.idempotencyKey),
  )
  return price.id
}

export async function syncStripePlan(stripe: Stripe, input: PlanSyncInput) {
  requestOptions(input.idempotencyKey)
  if ((input.plan.type === 'subscription') !== (input.price.interval !== null)) {
    throw new Error('Plan type must match the price interval')
  }
  if (input.price.currency.toUpperCase() !== 'USD')
    return { providerPriceId: await syncLocalCurrencyPrice(stripe, input) }
  const providerPriceId = await syncCanonicalPrice(stripe, input)
  await syncLocalizedPackPrices(stripe, input, providerPriceId)
  return { providerPriceId }
}

/** Compose these operations with retrieval and verification in the next adapter slice. */
export function createStripeOperations(stripe: Stripe): StripeOperations {
  return {
    createCheckout: (input) => createStripeCheckout(stripe, input),
    getPortalUrl: async (customerId, returnUrl) =>
      (await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl }))
        .url,
    cancelSubscription: (subId, opts) => cancelStripeSubscription(stripe, subId, opts),
    resumeSubscription: (subId) => resumeStripeSubscription(stripe, subId),
    changePlan: (subId, newPrice, opts) => changeStripePlan(stripe, subId, newPrice, opts),
    refund: (input) => refundStripePayment(stripe, input),
    syncPlan: (input) => syncStripePlan(stripe, input),
  }
}
