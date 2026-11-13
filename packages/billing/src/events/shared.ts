import {
  billingCustomer,
  type Database,
  member,
  organization,
  type PaymentProviderId,
  type Plan,
  type PlanPrice,
  payment,
  plan,
  planPrice,
  purchase,
  type Subscription,
  type SubscriptionCompensationPayload,
  subscription,
  user,
} from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { ENABLED_CURRENCIES, enabledCurrency } from '../currency.ts'
import type { WebhookTransaction } from '../pipeline.ts'
import type {
  CheckoutMetadata,
  NormalizedEvent,
  OrderSnapshot,
  PaymentProvider,
  SubscriptionSnapshot,
} from '../provider.ts'

export type BillingProviders = Partial<Record<PaymentProviderId, PaymentProvider>>
export interface Association {
  workspaceId: string
  price: PlanPrice
  plan: Plan
  metadata: CheckoutMetadata | null
  snapshot?: SubscriptionSnapshot | OrderSnapshot | undefined
}
export interface PreparedBillingEvents {
  associations: Map<NormalizedEvent, Association>
}
export interface BillingEventOptions {
  db: Database
  providers: BillingProviders
  subscriptionCreditGraceHours?: number
  now?: () => Date
}
/** The caller must persist a compensation job after rollback; this error contains no credentials. */
export class RenewingSubscriptionConflict extends Error {
  readonly code = 'RENEWING_SUBSCRIPTION_CONFLICT'
  readonly compensation: Exclude<
    SubscriptionCompensationPayload,
    { reason: 'workspace_deleted' }
  > & { workspaceId: string }

  constructor(compensation: RenewingSubscriptionConflict['compensation']) {
    super('RENEWING_SUBSCRIPTION_CONFLICT')
    this.compensation = compensation
    this.name = 'RenewingSubscriptionConflict'
  }
}
const _key = (provider: PaymentProviderId, kind: string, id: string) => `${provider}:${kind}:${id}`
export const scope = (provider: PaymentProviderId, id: string) =>
  and(eq(subscription.provider, provider), eq(subscription.providerSubscriptionId, id))
export const orderScope = (provider: PaymentProviderId, id: string) =>
  and(eq(purchase.provider, provider), eq(purchase.providerOrderId, id))
export const paymentScope = (provider: PaymentProviderId, id: string) =>
  and(eq(payment.provider, provider), eq(payment.providerPaymentId, id))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * 校验付款金额与币种：币种必须属于启用集合（USD / TWD / KRW）；传入 `expected`（价格行或原付款的币种）时
 * 还必须与之一致。币种不符说明结账配置异常或买家所在地导致换币，重投无法修复，按不可重试错误由人工处理。
 */
export function money(amount: number, currency: string, expected?: string) {
  const code = enabledCurrency(currency)
  if (!code || (expected !== undefined && code !== expected.toUpperCase()))
    throw new AppError(
      'BILLING_CURRENCY_MISMATCH',
      `BILLING_CURRENCY_MISMATCH: expected ${
        expected === undefined ? ENABLED_CURRENCIES.join('|') : clean(expected)
      }, received ${clean(currency)}`,
      { status: 422 },
    )
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647)
    throw new Error('Invalid billing amount or currency')
}
// 错误文本会进入日志与审计，只保留字母且限长
const clean = (value: unknown) =>
  String(value)
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 8)
    .toUpperCase()
export async function priceFor(
  db: Database | WebhookTransaction,
  id: string,
  provider: PaymentProviderId,
  providerPriceId?: string | null,
  expectedPlan?: string,
  requireActive = true,
) {
  const [row] = await db
    .select({ price: planPrice, plan })
    .from(planPrice)
    .innerJoin(plan, eq(plan.id, planPrice.planId))
    .where(eq(planPrice.id, id))
  if (
    !row ||
    (requireActive && (!row.price.active || !row.plan.active)) ||
    row.price.provider !== provider ||
    (expectedPlan && row.plan.id !== expectedPlan) ||
    (providerPriceId && row.price.providerPriceId !== providerPriceId)
  )
    throw new Error('Invalid active billing price association')
  money(row.price.amount, row.price.currency)
  if ((row.plan.type === 'subscription') !== Boolean(row.price.interval))
    throw new Error('Invalid billing plan interval')
  return row
}
export async function validateMetadata(
  db: Database | WebhookTransaction,
  metadata: CheckoutMetadata | null,
  allowDeletedReceipt = false,
) {
  if (
    !metadata ||
    ![metadata.workspaceId, metadata.userId, metadata.planPriceId].every((id) => uuid.test(id))
  )
    throw new Error('Missing or invalid billing metadata')
  if (allowDeletedReceipt) {
    const [workspace] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, metadata.workspaceId))
    if (workspace?.deletedAt) return
  }
  const [owned] = await db
    .select({ email: user.email, banned: user.banned })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(
      and(
        eq(member.organizationId, metadata.workspaceId),
        eq(member.userId, metadata.userId),
        isNull(organization.deletedAt),
      ),
    )
  if (!owned || owned.email === `deleted+${metadata.userId}@invalid` || owned.banned)
    throw new Error('Billing checkout user or workspace is ineligible')
}
export async function lockWorkspaceBilling(tx: WebhookTransaction, workspaceId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`ws:${workspaceId}`}, 0))`)
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`billing:${workspaceId}`}, 0))`,
  )
}
export async function customer(
  tx: WebhookTransaction,
  workspaceId: string,
  provider: PaymentProviderId,
  customerId: string | null,
) {
  // PayPal payer IDs identify wallets, not workspace-specific customers.
  if (provider === 'paypal') customerId = null
  if (customerId)
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`billing-customer:${provider}:${customerId}`}, 0))`,
    )
  const [existing] = await tx
    .select()
    .from(billingCustomer)
    .where(
      and(eq(billingCustomer.workspaceId, workspaceId), eq(billingCustomer.provider, provider)),
    )
  if (existing?.providerCustomerId && customerId && existing.providerCustomerId !== customerId)
    throw new Error('Billing customer association mismatch')
  if (customerId) {
    const [other] = await tx
      .select()
      .from(billingCustomer)
      .where(
        and(
          eq(billingCustomer.provider, provider),
          eq(billingCustomer.providerCustomerId, customerId),
          ne(billingCustomer.workspaceId, workspaceId),
        ),
      )
    if (other) throw new Error('Billing customer already associated')
  }
  if (!existing)
    await tx
      .insert(billingCustomer)
      .values({ workspaceId, provider, providerCustomerId: customerId })
  else if (!existing.providerCustomerId && customerId)
    await tx
      .update(billingCustomer)
      .set({ providerCustomerId: customerId })
      .where(eq(billingCustomer.id, existing.id))
}
const renewing = (status: Subscription['status'], cancel: boolean) =>
  ['active', 'trialing', 'past_due', 'paused'].includes(status) && !cancel
export async function checkWinner(
  tx: WebhookTransaction,
  a: Association,
  event: NormalizedEvent,
  id: string,
  status: Subscription['status'],
  cancel: boolean,
) {
  if (!renewing(status, cancel)) return
  const [winner] = await tx
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.workspaceId, a.workspaceId),
        inArray(subscription.status, ['active', 'trialing', 'past_due', 'paused']),
        eq(subscription.cancelAtPeriodEnd, false),
        sql`not (${subscription.provider} = ${event.provider} and ${subscription.providerSubscriptionId} = ${id})`,
      ),
    )
  if (winner)
    throw new RenewingSubscriptionConflict({
      workspaceId: a.workspaceId,
      provider: event.provider,
      providerSubscriptionId: id,
      winnerSubscriptionId: winner.id,
      planId: a.plan.id,
      planPriceId: a.price.id,
      ...conflictPayment(event, a),
    })
}
export function conflictPayment(event: NormalizedEvent, a: Association) {
  if (event.type !== 'payment.succeeded' || event.payment.kind === 'one_time') return {}
  const p = event.payment
  money(p.amount, p.currency, a.price.currency)
  if (p.kind !== 'adjustment' && p.amount !== a.price.amount)
    throw new Error('Payment price mismatch')
  if (!p.period || !(p.period.start < p.period.end) || !Number.isFinite(p.paidAt.getTime()))
    throw new Error('Invalid payment period')
  if (p.refundedAmount !== null) money(p.refundedAmount, p.currency)
  if ((p.refundedAmount ?? 0) > p.amount) throw new Error('Payment refund exceeds gross')
  return {
    payment: {
      providerPaymentId: p.providerPaymentId,
      kind: p.kind,
      amount: p.amount,
      currency: p.currency.toUpperCase(),
      paidAt: p.paidAt.toISOString(),
      periodStart: p.period.start.toISOString(),
      periodEnd: p.period.end.toISOString(),
      refundedAmount: p.refundedAmount,
      raw: p.raw,
    },
  }
}
