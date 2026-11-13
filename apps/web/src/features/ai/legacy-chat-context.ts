import type { KeyValueStore } from '@xuanxue/platform'
import { z } from 'zod'

/**
 * 旧版「结果页带盘进入对话」的兼容（adopt-subject-chat-readings design 决策 7）。
 * 新签发一律走模板临时上下文令牌（`chart-result`，见 readings/chart-result-context.ts），本文件只读：
 *
 * 1. 旧链接 `chat?context=<token>`：验旧令牌、读旧 KV，由 `upgradeLegacyChatContext` 换发新令牌。
 *    旧令牌最多存活 30 分钟——**本 change 发布后的下一次发布删除这一部分**（tasks.md 组 8）。
 * 2. 旧对话摘要：发布前建立的带盘对话，首条 system 消息带 `data-chat-context` 片段，
 *    对话页仍据此显示命盘摘要。旧对话不会消失，这一部分长期保留。
 */

// ---- 1. 旧链接换发（下一次发布删除） ----

export const CHAT_CONTEXT_PARAM = 'context'
export const CHAT_CONTEXT_TTL_MS = 30 * 60_000
/** 旧令牌的 HMAC 用途前缀与 KV 键前缀；只用于读取，不再签发 */
export const LEGACY_SCOPE = 'chat-context'
export const LEGACY_KV_PREFIX = 'chat-context:'

const payloadSchema = z.object({
  v: z.literal(1),
  id: z.uuid(),
  uid: z.string().min(1).max(64),
  kind: z.string().min(1).max(64),
  returnTo: z.string().max(512),
  exp: z.number().int().positive(),
})

const storedSchema = z.object({
  kind: z.string().min(1).max(64),
  result: z.record(z.string(), z.json()),
})

/** 旧上下文：`result` 是服务端复算的结构化结果（不含出生信息） */
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

/**
 * 验签并取出旧上下文：签名无效或不属于当前用户返回 invalid；过期（或 KV 中已不存在）返回 expired，
 * 附带结果页路径供重新进入。
 */
export async function openChatContext(
  deps: ChatContextDeps,
  input: { userId: string; token: string },
): Promise<OpenedChatContext> {
  const { verifyHmacToken } = await import('../growth/tokens.ts')
  const payload = await verifyHmacToken(deps.secret, LEGACY_SCOPE, input.token, payloadSchema)
  if (!payload || payload.uid !== input.userId) return { status: 'invalid' }
  if (payload.exp <= (deps.now ?? Date.now()))
    return { status: 'expired', returnTo: payload.returnTo }
  const raw = await deps.cache.get(`${LEGACY_KV_PREFIX}${payload.id}`)
  const stored = raw ? storedSchema.safeParse(safeJson(raw)) : null
  if (!stored?.success || stored.data.kind !== payload.kind)
    return { status: 'expired', returnTo: payload.returnTo }
  return { status: 'ok', context: stored.data, returnTo: payload.returnTo }
}

export type UpgradedChatContext =
  | { readonly status: 'ok'; readonly token: string }
  | { readonly status: 'expired'; readonly returnTo: string }
  | { readonly status: 'invalid' }

/**
 * 旧链接换发：旧令牌有效时，以旧 `{ kind, result }` 构造 `chart-result` 上下文并签发新令牌。
 * 旧令牌未绑定空间，换发时使用当前路由空间（调用方已校验成员身份）。
 */
export async function upgradeLegacyChatContext(
  deps: ChatContextDeps,
  input: { userId: string; workspaceId: string; token: string; locale: string },
): Promise<UpgradedChatContext> {
  const opened = await openChatContext(deps, input)
  if (opened.status !== 'ok') return opened
  const { issueChartResultContext } = await import('../readings/chart-result-context.ts')
  try {
    const issued = await issueChartResultContext(
      { secret: deps.secret, cache: deps.cache, ...(deps.now ? { now: deps.now } : {}) },
      {
        userId: input.userId,
        workspaceId: input.workspaceId,
        kind: opened.context.kind,
        result: opened.context.result,
        locale: input.locale,
        returnTo: opened.returnTo,
      },
    )
    return { status: 'ok', token: issued.token }
  } catch (error) {
    // 返回地址或上下文不再满足新格式（如超长）：按无效处理，不回显内容
    if (error instanceof RangeError || error instanceof z.ZodError) return { status: 'invalid' }
    throw error
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---- 2. 旧对话摘要（长期保留） ----

/** 旧对话 system 消息中携带结构化上下文的数据片段类型 */
export const CHAT_CONTEXT_PART = 'data-chat-context'

/** 从 system 消息的 parts 中取回旧上下文；不是旧上下文消息（含新对象对话）时返回 null */
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
