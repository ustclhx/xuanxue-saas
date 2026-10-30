import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { aiConversation, aiMessage, type Database, reading, scoped } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withBilling } from '../../server/feature-gates.ts'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { contextFromParts, contextMessageParts, openChatContext } from './chat-context.ts'
import { conversationTitleSchema, messageDisplayParts } from './conversation.ts'

// 对话列表与对话页的数据（tasks.md 3.1，specs/ai-chat「会话管理」）。
// 对话只对创建者可见：所有读写都在 scoped(ws) 之上再按 user_id 过滤，
// 他人的对话与不存在的对话一样返回 404（空间 owner / admin 也不例外）。

const workspace = z.object({ slug: z.string().min(1).max(64) })
const conversationInput = workspace.extend({ conversationId: z.uuid() })

/** 列表每组最多返回的对话数 */
const LIST_LIMIT = 100

const ownConversation = (userId: string, conversationId?: string) =>
  and(
    eq(aiConversation.userId, userId),
    conversationId === undefined ? undefined : eq(aiConversation.id, conversationId),
  ) as SQL

type MutationResult<T> = { ok: true; result: T } | { ok: false; error: string }

async function mutation<T>(
  readOnly: boolean,
  action: () => Promise<T>,
): Promise<MutationResult<T>> {
  try {
    if (readOnly)
      throw new AppError('WORKSPACE_READ_ONLY', 'Team workspace writes are disabled', {
        status: 403,
      })
    return { ok: true, result: await action() }
  } catch (error) {
    if (!(error instanceof AppError)) log.error('ai.conversation.failed', { error })
    return { ok: false, error: error instanceof AppError ? error.code : 'CONVERSATION_FAILED' }
  }
}

async function updateOwn(
  db: Database,
  workspaceId: string,
  userId: string,
  conversationId: string,
  set: { title?: string; archived?: boolean },
) {
  const rows = await scoped(db, workspaceId)
    .update(aiConversation, set, ownConversation(userId, conversationId))
    .returning({ id: aiConversation.id })
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
  return { id: conversationId }
}

export const listConversations = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(workspace)
  .handler(async ({ context }) => {
    const s = scoped(context.db, context.workspace.id)
    const fields = {
      id: aiConversation.id,
      title: aiConversation.title,
      archived: aiConversation.archived,
      updatedAt: aiConversation.updatedAt,
    }
    const list = (archived: boolean) =>
      s
        .select(aiConversation, {
          fields,
          where: and(
            ownConversation(context.user.id),
            eq(aiConversation.archived, archived),
            // 付费详批借用对话消息结算，不出现在对话列表中
            sql`not exists (select 1 from ${reading} join ${aiMessage} on ${aiMessage.id} = ${reading.messageId} where ${aiMessage.conversationId} = ${aiConversation.id})`,
          ) as SQL,
        })
        .orderBy(desc(aiConversation.id))
        .limit(LIST_LIMIT)
    const [active, archived] = await Promise.all([list(false), list(true)])
    return { active, archived, readOnly: context.workspaceReadOnly }
  })

export const getConversation = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(conversationInput)
  .handler(async ({ context, data }) => {
    const s = scoped(context.db, context.workspace.id)
    const [conversation] = await s
      .select(aiConversation, {
        fields: {
          id: aiConversation.id,
          title: aiConversation.title,
          archived: aiConversation.archived,
        },
        where: ownConversation(context.user.id, data.conversationId),
      })
      .limit(1)
    if (!conversation) throw notFound()
    // 从结果页带入的命盘上下文保存为 system 消息（chat-context.ts），页面在首条消息前显示摘要
    const [system] = await s
      .select(aiMessage, {
        fields: { parts: aiMessage.parts },
        where: and(
          eq(aiMessage.conversationId, conversation.id),
          eq(aiMessage.role, 'system'),
        ) as SQL,
      })
      .orderBy(asc(aiMessage.id))
      .limit(1)
    const chatContext = system ? contextFromParts(system.parts) : null
    const messages = await s
      .select(aiMessage, {
        fields: {
          id: aiMessage.id,
          role: aiMessage.role,
          parts: aiMessage.parts,
          status: aiMessage.status,
        },
        where: and(
          eq(aiMessage.conversationId, conversation.id),
          inArray(aiMessage.role, ['user', 'assistant']),
        ) as SQL,
      })
      .orderBy(asc(aiMessage.id))
    return {
      conversation,
      messages: messages.map((message) => ({
        ...message,
        parts: messageDisplayParts(
          message.parts,
          message.role === 'assistant' && templateConfig.ai.text.reasoning.display,
        ),
      })),
      chatContext,
      readOnly: context.workspaceReadOnly,
    }
  })

/**
 * 新建空对话；标题在首轮回复完成后由对话页按首条消息填入，模型在发送时选择。
 * 带 `context` 令牌时（结果页「用这个结果问 AI」）验签、核对用户与有效期后，把复算结果写成
 * 对话的 system 消息，之后每轮请求都会带上它；令牌无效或过期时不建对话。
 */
export const createConversation = createServerFn({ method: 'POST' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(workspace.extend({ context: z.string().min(1).max(1024).optional() }))
  .handler(({ context, data }) =>
    mutation(context.workspaceReadOnly, async () => {
      let parts: unknown[] | null = null
      if (data.context !== undefined) {
        const runtime = getWebRuntime()
        const opened = await openChatContext(
          { secret: runtime.config.BETTER_AUTH_SECRET, cache: runtime.cache },
          { userId: context.user.id, token: data.context },
        )
        if (opened.status !== 'ok')
          throw new AppError('CHAT_CONTEXT_EXPIRED', 'Chat context is invalid or expired', {
            status: 410,
          })
        parts = contextMessageParts(opened.context)
      }
      return context.db.transaction(async (tx) => {
        const t = scoped(tx, context.workspace.id)
        const [row] = await t
          .insert(aiConversation, { userId: context.user.id, title: '', modelKey: '' })
          .returning({ id: aiConversation.id })
        if (!row) throw new AppError('CONVERSATION_FAILED', 'Conversation was not created')
        if (parts) await t.insert(aiMessage, { conversationId: row.id, role: 'system', parts })
        return row
      })
    }),
  )

export const renameConversation = createServerFn({ method: 'POST' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(conversationInput.extend({ title: conversationTitleSchema }))
  .handler(({ context, data }) =>
    mutation(context.workspaceReadOnly, () =>
      updateOwn(context.db, context.workspace.id, context.user.id, data.conversationId, {
        title: data.title,
      }),
    ),
  )

export const setConversationArchived = createServerFn({ method: 'POST' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(conversationInput.extend({ archived: z.boolean() }))
  .handler(({ context, data }) =>
    mutation(context.workspaceReadOnly, () =>
      updateOwn(context.db, context.workspace.id, context.user.id, data.conversationId, {
        archived: data.archived,
      }),
    ),
  )
