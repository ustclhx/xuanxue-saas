import { aiMessageOrder, MIN_OUTPUT_TOKENS, messageText } from '@xuanxue/ai'
import { getCreditBalance } from '@xuanxue/credits'
import { aiConversation, aiMessage, type Database, scoped } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { and, eq, type SQL } from 'drizzle-orm'
import {
  openSubjectContext,
  type SubjectContextDeps,
  subjectSystemContextSchema,
  subjectSystemText,
} from './subject-context.ts'
import { resolveConversationSubject } from './subjects.ts'

/**
 * 对话输入区预计消耗所需的服务端数据（adopt-subject-chat-readings design 决策 6）：
 * 当前空间可用余额，以及首发对象上下文或持久对话首条 system 消息的长度。
 * 只返回长度不返回正文；与 `chat.ts` 取固定前缀的口径一致（首条 system 消息的文本）。
 */
export interface ChatCostContext {
  /** 可用积分（与 POST /api/ai/chat 预扣时读取的余额一致） */
  readonly availableCredits: number
  /** 固定前缀的字符数（按码点计数，与 token 估算器一致）；无对象上下文或前缀为 0 */
  readonly prefixChars: number
  /** 服务端预算允许的最低输出 token 数 */
  readonly minOutputTokens: number
}

interface ChatCostInput {
  workspaceId: string
  userId: string
  conversationId?: string | undefined
  locale?: string | undefined
  subject?: { type: string; id: string } | undefined
  token?: string | undefined
}

export async function chatCostContext(
  db: Database,
  input: ChatCostInput,
  deps?: SubjectContextDeps,
): Promise<ChatCostContext> {
  // 对话建立后固定前缀以持久消息为准，原对象变化或临时令牌过期不影响估算。
  const prefixChars = input.conversationId
    ? await prefixLength(db, input)
    : await initialPrefixLength(db, input, deps)
  const balance = await getCreditBalance(db, input.workspaceId)
  return {
    availableCredits: Math.max(0, balance.available),
    prefixChars,
    minOutputTokens: MIN_OUTPUT_TOKENS,
  }
}

async function initialPrefixLength(db: Database, input: ChatCostInput, deps?: SubjectContextDeps) {
  if (input.subject && input.token)
    throw new AppError('INVALID_INPUT', 'Subject and token are mutually exclusive', { status: 400 })
  if (input.subject) {
    const resolved = await resolveConversationSubject(
      {
        db,
        workspaceId: input.workspaceId,
        userId: input.userId,
        locale: input.locale ?? 'en',
      },
      input.subject.type,
      input.subject.id,
    )
    if (!resolved) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
    // 与新建对象对话使用相同校验，避免估算一个实际无法写入的上下文。
    const parsed = subjectSystemContextSchema.safeParse(await resolved.context())
    if (!parsed.success)
      throw new AppError('INVALID_SUBJECT_CONTEXT', 'Subject context is invalid or too large', {
        status: 422,
      })
    return [...subjectSystemText(input.subject.type, parsed.data)].length
  }
  if (input.token) {
    if (!deps) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
    const opened = await openSubjectContext(deps, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      token: input.token,
    })
    if (opened.status !== 'ok') throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
    return [...subjectSystemText(opened.subjectType, opened.stored.context)].length
  }
  return 0
}

async function prefixLength(
  db: Database,
  input: { workspaceId: string; userId: string; conversationId?: string | undefined },
) {
  const s = scoped(db, input.workspaceId)
  const conversationId = input.conversationId ?? ''
  // 只看自己的对话：他人的对话与不存在的对话一样 404
  const [conversation] = await s
    .select(aiConversation, {
      fields: { id: aiConversation.id },
      where: and(
        eq(aiConversation.id, conversationId),
        eq(aiConversation.userId, input.userId),
      ) as SQL,
    })
    .limit(1)
  if (!conversation) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
  const [system] = await s
    .select(aiMessage, {
      fields: { parts: aiMessage.parts },
      where: and(eq(aiMessage.conversationId, conversationId), eq(aiMessage.role, 'system')) as SQL,
    })
    .orderBy(...aiMessageOrder())
    .limit(1)
  if (!system) return 0
  let chars = 0
  for (const _ of messageText(system.parts)) chars++
  return chars
}
