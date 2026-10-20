import { brandName } from '@xuanxue/config'
import { newsletterSubscriber } from '@xuanxue/db'
import { EMAIL_QUEUE_MESSAGE_VERSION } from '@xuanxue/email/queue'
import { requireCapability } from '@xuanxue/platform'
import { and, eq, sql } from 'drizzle-orm'
import { optinEmailProps } from '../readings/optin-email.ts'
import { type ReadingOptin, readingOptinSchema } from '../readings/optin-schema.ts'
import type { GrowthContext } from './service.ts'
import { signGrowthToken } from './tokens.ts'

type Subscriber = typeof newsletterSubscriber.$inferSelect

/** 短租约避免并发确认重复入队；进程中断后同一投递键可重试，队列失败保留结果。 */
export async function deliverReading(ctx: GrowthContext, row: Subscriber): Promise<void> {
  if (row.status !== 'confirmed' || !row.lastResult) return
  const pending = row.lastResult
  const id = pending.deliveryId
  if (typeof id !== 'string') throw new Error('Missing reading delivery identity')
  const started = pending.deliveryStartedAt
  if (typeof started === 'number' && started > Date.now() - 60_000) return
  const input: ReadingOptin = readingOptinSchema.parse({
    ...pending,
    sourceTool: row.sourceTool,
    topic: row.topic,
    site: row.site,
    locale: row.locale,
  })
  const queue = requireCapability(ctx.queue, 'Email queue')
  const token = await signGrowthToken(ctx.secret, {
    purpose: 'unsubscribe',
    id: row.id,
    nonce: row.confirmToken,
    expires: null,
  })
  const unsubscribe = new URL('/api/newsletter/unsubscribe', ctx.appUrl)
  unsubscribe.searchParams.set('token', token)
  const props = optinEmailProps(input, ctx.config, unsubscribe.href)
  const claimed = { ...pending, deliveryStartedAt: Date.now() }
  const matches = (value: Record<string, unknown>) =>
    and(
      eq(newsletterSubscriber.id, row.id),
      eq(newsletterSubscriber.status, 'confirmed'),
      sql`${newsletterSubscriber.lastResult} = ${JSON.stringify(value)}::jsonb`,
    )
  const [acquired] = await ctx.db
    .update(newsletterSubscriber)
    .set({ lastResult: claimed })
    .where(matches(pending))
    .returning({ id: newsletterSubscriber.id })
  if (!acquired) return
  try {
    await queue.send({
      v: EMAIL_QUEUE_MESSAGE_VERSION,
      template: 'reading-summary',
      to: row.email,
      locale: input.locale,
      appName: brandName(ctx.config, input.locale),
      idempotencyKey: `reading-summary:${row.id}:${id}`,
      props,
    })
  } catch (error) {
    await ctx.db
      .update(newsletterSubscriber)
      .set({ lastResult: { ...pending, deliveryStartedAt: null } })
      .where(matches(claimed))
    throw error
  }
  // 入队成功即移除临时结果；比较完整快照，不能清掉并发提交的新结果。
  await ctx.db.update(newsletterSubscriber).set({ lastResult: null }).where(matches(claimed))
}
