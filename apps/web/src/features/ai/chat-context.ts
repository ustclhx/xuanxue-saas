import type { KeyValueStore } from '@xuanxue/platform'
import { z } from 'zod'

/**
 * 从结果页带入 Chat 的命盘上下文（product-improve-ai-content design 决策 3，specs/ai-chat
 * 「从结果页携带命盘上下文」）。
 *
 * - 结果页提交原始输入，服务端复算出结构化结果（不含出生日期、城市、姓名），存入运行时 KV，
 *   30 分钟后自动过期；
 * - 地址里只放签名令牌 `{id, uid, kind, returnTo, exp}`：id 是随机的 KV 键，uid 绑定发起用户，
 *   returnTo 用于过期后引导回结果页（结果输入在 `#r=` 片段里，不在路径中）；
 * - 新建对话时验签、核对用户与有效期，再从 KV 取出结构化结果，写成对话的 system 消息。
 *
 * 选择 KV 而不是把结果放进令牌：紫微等结果有数 KB，放进地址过长；令牌只签名不加密，
 * 也不应携带结果正文。
 */

export const CHAT_CONTEXT_PARAM = 'context'
export const CHAT_CONTEXT_TTL_MS = 30 * 60_000
const SCOPE = 'chat-context'
const KV_PREFIX = 'chat-context:'

const payloadSchema = z.object({
  v: z.literal(1),
  id: z.uuid(),
  uid: z.string().min(1).max(64),
  kind: z.string().min(1).max(64),
  returnTo: z.string().max(512),
  exp: z.number().int().positive(),
})
type ChatContextPayload = z.infer<typeof payloadSchema>

const storedSchema = z.object({
  kind: z.string().min(1).max(64),
  result: z.record(z.string(), z.json()),
})

/** 对话 system 消息中保存的上下文；`result` 是服务端复算的结构化结果 */
export type ChatContext = z.infer<typeof storedSchema>

export type OpenedChatContext =
  | { readonly status: 'ok'; readonly context: ChatContext; readonly returnTo: string }
  | { readonly status: 'expired'; readonly returnTo: string }
  | { readonly status: 'invalid' }

export interface ChatContextDeps {
  readonly secret: string
  readonly cache: KeyValueStore
  readonly now?: number
}

/** 存入复算结果并签发令牌 */
export async function issueChatContext(
  deps: ChatContextDeps,
  input: { userId: string; context: ChatContext; returnTo: string },
): Promise<string> {
  const now = deps.now ?? Date.now()
  const id = crypto.randomUUID()
  await deps.cache.put(`${KV_PREFIX}${id}`, JSON.stringify(input.context), {
    expirationTtl: CHAT_CONTEXT_TTL_MS / 1000,
  })
  const { signHmacToken } = await import('../growth/tokens.ts')
  const payload: ChatContextPayload = {
    v: 1,
    id,
    uid: input.userId,
    kind: input.context.kind,
    returnTo: input.returnTo,
    exp: now + CHAT_CONTEXT_TTL_MS,
  }
  return signHmacToken(deps.secret, SCOPE, payload)
}

/**
 * 验签并取出上下文：签名无效或不属于当前用户返回 invalid；过期（或 KV 中已不存在）返回 expired，
 * 附带结果页路径供重新进入。
 */
export async function openChatContext(
  deps: ChatContextDeps,
  input: { userId: string; token: string },
): Promise<OpenedChatContext> {
  const { verifyHmacToken } = await import('../growth/tokens.ts')
  const payload = await verifyHmacToken(deps.secret, SCOPE, input.token, payloadSchema)
  if (!payload || payload.uid !== input.userId) return { status: 'invalid' }
  if (payload.exp <= (deps.now ?? Date.now()))
    return { status: 'expired', returnTo: payload.returnTo }
  const raw = await deps.cache.get(`${KV_PREFIX}${payload.id}`)
  const stored = raw ? storedSchema.safeParse(safeJson(raw)) : null
  if (!stored?.success || stored.data.kind !== payload.kind)
    return { status: 'expired', returnTo: payload.returnTo }
  return { status: 'ok', context: stored.data, returnTo: payload.returnTo }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** system 消息中携带结构化上下文的数据片段类型 */
export const CHAT_CONTEXT_PART = 'data-chat-context'

/**
 * 注入模型的 system 提示：说明来源与合规边界，结构化结果以 JSON 附在后面。
 * 不含任何出生信息原文；回答语言跟随用户提问。
 */
export function contextSystemText(context: ChatContext): string {
  return [
    `The user opened this conversation from a free "${context.kind}" result on our site.`,
    'Below is the structured result our rules engine computed on the server (it contains no birth date, place or name).',
    'Refer to it — e.g. pillars, elements, palaces, numbers or cards — when it helps answer the question.',
    'Interpret it within the tradition for reflection and entertainment only: do not predict specific events, and do not give medical, legal or financial advice.',
    'Reply in the language the user writes in.',
    '',
    '```json',
    JSON.stringify(context),
    '```',
  ].join('\n')
}

/** 保存为对话 system 消息的 parts：文本片段进提示词，数据片段供页面显示摘要 */
export function contextMessageParts(context: ChatContext): unknown[] {
  return [
    { type: 'text', text: contextSystemText(context) },
    { type: CHAT_CONTEXT_PART, data: context },
  ]
}

/** 从 system 消息的 parts 中取回上下文；不是上下文消息时返回 null */
export function contextFromParts(parts: readonly unknown[]): ChatContext | null {
  for (const part of parts) {
    if (
      typeof part === 'object' &&
      part !== null &&
      (part as { type?: unknown }).type === CHAT_CONTEXT_PART
    ) {
      const parsed = storedSchema.safeParse((part as { data?: unknown }).data)
      if (parsed.success) return parsed.data
    }
  }
  return null
}
