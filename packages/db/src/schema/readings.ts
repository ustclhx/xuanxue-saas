import { newId } from '@xuanxue/shared'
import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { aiMessage } from './ai.ts'
import { user } from './auth.ts'
import { organization } from './tenancy.ts'

/**
 * 付费详批类型（add-reading-monetization design 决策 1）。运行时设置 `readings.<kind>.*`
 * 与 `reading.kind` 共用此列表；新增类型时在 apps/web 的详批注册表中补上复算与提示词。
 */
export const READING_KINDS = [
  'bazi-full',
  'saju-full',
  'ziwei-full',
  'saju-compat',
  'numerology-full',
  'tarot-spread',
] as const
export type ReadingKind = (typeof READING_KINDS)[number]

/**
 * 付费详批报告，保存在用户的个人空间。计费复用文本对话的预扣与结算：`message_id` 指向承载
 * 预扣、检查点与兜底结算的 assistant 消息，报告状态在该消息结算后同步。
 * `input_hash` 为规范化输入的 SHA-256，同一用户、类型与输入在 10 分钟内视为同一请求。
 */
export const reading = pgTable(
  'reading',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: READING_KINDS }).notNull(),
    inputHash: text('input_hash').notNull(),
    /** 校验后的原始输入（不含客户端计算结果） */
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    /** 报告语言，邮件与阅读页据此选择站点 */
    locale: text('locale').notNull(),
    engineVersion: text('engine_version').notNull(),
    promptVersion: text('prompt_version').notNull(),
    modelKey: text('model_key').notNull(),
    /** 发起时的积分价格快照 */
    credits: integer('credits').notNull(),
    status: text('status', { enum: ['generating', 'ready', 'failed'] })
      .notNull()
      .default('generating'),
    /** Markdown 正文，渲染时做白名单清洗 */
    content: text('content').notNull().default(''),
    messageId: uuid('message_id').references(() => aiMessage.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('reading_workspace_id_id_idx').on(t.workspaceId, t.id.desc()),
    index('reading_workspace_user_kind_hash_idx').on(
      t.workspaceId,
      t.userId,
      t.kind,
      t.inputHash,
      t.createdAt.desc(),
    ),
    check('reading_credits_nonnegative', sql`${t.credits} >= 0`),
    check('reading_status_valid', sql`${t.status} in ('generating', 'ready', 'failed')`),
  ],
)

export type Reading = typeof reading.$inferSelect
export type NewReading = typeof reading.$inferInsert
