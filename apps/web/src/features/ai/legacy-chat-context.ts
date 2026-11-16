import { z } from 'zod'

/** 发布前建立的带盘对话仍以 data-chat-context 片段显示摘要，长期保留解析。 */

const storedSchema = z.object({
  kind: z.string().min(1).max(64),
  result: z.record(z.string(), z.json()),
})

/** 旧上下文：`result` 是服务端复算的结构化结果（不含出生信息） */
export type ChatContext = z.infer<typeof storedSchema>

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
