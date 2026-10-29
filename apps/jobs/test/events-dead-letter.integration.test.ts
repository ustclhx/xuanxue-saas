import { env } from 'cloudflare:workers'
import { createDb, jobDeadLetter, jobMessage } from '@xuanxue/db'
import type { QueueBatch, QueueMessage } from '@xuanxue/platform'
import { eq } from 'drizzle-orm'
import { expect, it, vi } from 'vitest'
import {
  createEventsDeadLetterSink,
  handleEventsDeadLetterBatch,
} from '../src/queues/events-dead-letter.ts'

it('records CF terminal failure with app permissions and deduplicates redelivery in Postgres', async () => {
  // 模板的 Node 运行时套件改为 workerd 集成项目：app 权限经 HYPERDRIVE 写入，清理走 migrator
  const db = createDb(env.HYPERDRIVE)
  const cleanup = createDb(env.HYPERDRIVE_MIGRATOR)
  const sourceId = `cf-${crypto.randomUUID()}`
  const timestamp = new Date('2026-10-24T00:00:00Z')
  const source: QueueMessage<unknown> = {
    id: sourceId,
    body: { v: 1, operations: [] },
    attempts: 6,
    timestamp,
    ack: vi.fn(),
    retry: vi.fn(),
  }
  const send = vi.fn()
  await createEventsDeadLetterSink('xuanxue-events-production', {
    send,
    sendBatch: vi.fn(),
  }).failed(source, { code: 'OPERATIONS_TELEGRAM_DELIVERY_FAILED', retryable: true })
  const message: QueueMessage<unknown> = {
    ...source,
    body: send.mock.calls[0]?.[0],
    ack: vi.fn(),
    retry: vi.fn(),
  }
  const batch = {
    queue: 'xuanxue-events-dlq-production',
    messages: [message],
  } as unknown as QueueBatch<unknown>
  const alert = vi.fn().mockResolvedValue(undefined)
  try {
    await handleEventsDeadLetterBatch(batch, db, alert)
    await handleEventsDeadLetterBatch(batch, db, alert)
    expect(message.ack).toHaveBeenCalledTimes(2)
    expect(message.retry).not.toHaveBeenCalled()
    const rows = await db
      .select()
      .from(jobDeadLetter)
      .innerJoin(jobMessage, eq(jobMessage.id, jobDeadLetter.messageId))
      .where(eq(jobMessage.idempotencyKey, sourceId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.dead_letter).toMatchObject({
      queue: 'xuanxue-events-production',
      attempts: 6,
      code: 'OPERATIONS_TELEGRAM_DELIVERY_FAILED',
      retryable: 1,
    })
    expect(rows[0]?.message.body).toMatchObject({
      messageId: sourceId,
      timestamp: timestamp.toISOString(),
      body: source.body,
    })
    expect(Number.parseInt(rows[0]?.message.id.replaceAll('-', '').slice(0, 12) ?? '', 16)).toBe(
      timestamp.getTime(),
    )
  } finally {
    const rows = await db
      .select({ id: jobMessage.id })
      .from(jobMessage)
      .where(eq(jobMessage.idempotencyKey, sourceId))
    for (const row of rows) {
      await cleanup.delete(jobDeadLetter).where(eq(jobDeadLetter.messageId, row.id))
      await cleanup.delete(jobMessage).where(eq(jobMessage.id, row.id))
    }
    await Promise.all([db.close(), cleanup.close()])
  }
})
