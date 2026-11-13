import { DEFAULT_TOKENS_PER_CHAR, estimateInputTokens } from '@xuanxue/ai/client'
import { CreditEstimate } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getChatCostContext } from './chat-cost.functions.ts'
import type { ChatCostContext } from './chat-cost.server.ts'
import { formatNumber } from './chat-extras.tsx'
import { formatEstimate, type PickerModel, typicalMessageEstimate } from './model-picker.ts'

/**
 * 对话输入区的「预计 · 余额」（adopt-subject-chat-readings design 决策 6，specs/ai-chat
 * 「预计消耗与余额提示」）：按模型单价 × 典型回复长度估算，输入计入对话的固定前缀（对象上下文）。
 * 只用于展示，不改变预扣与结算；余额不足的拦截与弹窗仍由 POST /api/ai/chat 的 402 触发。
 */

/** 读取状态：null 读取中；'error' 读取失败（只显示不含前缀的预计，不显示余额） */
export type ChatCostState = ChatCostContext | 'error' | null

/** 前缀的 token 估算：与 estimateInputTokens 同一口径（一条消息的格式开销 + 按字符估算） */
const prefixTokens = (chars: number) =>
  chars > 0 ? estimateInputTokens([{ text: '' }]) + Math.ceil(chars * DEFAULT_TOKENS_PER_CHAR) : 0

export function ChatCostView({
  model,
  inputTokens,
  cost,
}: {
  model: PickerModel | undefined
  /** 历史与当前输入的估算（不含前缀） */
  inputTokens: number
  cost: ChatCostState
}) {
  if (!model) return null
  if (cost === null)
    return (
      <CreditEstimate
        data-testid="chat-cost"
        estimate={null}
        pendingLabel={m.chat_cost_pending()}
      />
    )
  const loaded = cost === 'error' ? null : cost
  const estimate = typicalMessageEstimate(model.pricing, {
    inputTokens: inputTokens + prefixTokens(loaded?.prefixChars ?? 0),
  })
  const upper = estimate.kind === 'range' ? estimate.max : estimate.credits
  const insufficient = loaded !== null && upper > loaded.availableCredits
  const credits = loaded ? formatNumber(loaded.availableCredits) : ''
  return (
    <CreditEstimate
      data-testid="chat-cost"
      estimate={m.ai_chat_per_message({ estimate: formatEstimate(estimate) })}
      {...(loaded
        ? {
            balance: insufficient
              ? m.chat_cost_balance_low({ credits })
              : m.chat_cost_balance({ credits }),
          }
        : {})}
      insufficient={insufficient}
    />
  )
}

/** 挂载时读取一次；`refreshKey` 变化（每轮回复结束）时再读一次，不轮询 */
export function ChatCost({
  slug,
  conversationId,
  refreshKey,
  ...props
}: {
  slug: string
  conversationId: string | undefined
  refreshKey: number
  model: PickerModel | undefined
  inputTokens: number
}) {
  const [cost, setCost] = useState<ChatCostState>(null)
  useEffect(() => {
    // refreshKey 只用于触发重新读取
    void refreshKey
    let active = true
    getChatCostContext({ data: { slug, ...(conversationId ? { conversationId } : {}) } })
      .then((next) => {
        if (active) setCost(next)
      })
      .catch(() => {
        if (active) setCost((old) => (old && old !== 'error' ? old : 'error'))
      })
    return () => {
      active = false
    }
  }, [slug, conversationId, refreshKey])
  return <ChatCostView cost={cost} {...props} />
}
