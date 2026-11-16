import { useChat } from '@ai-sdk/react'
import { DEFAULT_TOKENS_PER_CHAR, estimateCredits, estimateInputTokens } from '@xuanxue/ai/client'
import { CreditEstimate } from '@xuanxue/ui'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getChatCostContext } from './chat-cost.functions.ts'
import type { ChatCostContext } from './chat-cost.server.ts'
import { formatNumber } from './chat-extras.tsx'
import { type ChatSession, useChatSessionState } from './chat-session.ts'
import type { ChatUIMessage } from './conversation.ts'
import { formatEstimate, type PickerModel, typicalMessageEstimate } from './model-picker.ts'
import type { SubjectRef } from './subject-chat.server.ts'

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
  className,
}: {
  model: PickerModel | undefined
  /** 历史与当前输入的估算（不含前缀） */
  inputTokens: number
  cost: ChatCostState
  className?: string
}) {
  if (!model) return null
  if (cost === null)
    return (
      <CreditEstimate
        data-testid="chat-cost"
        estimate={null}
        pendingLabel={m.chat_cost_pending()}
        {...(className ? { className } : {})}
      />
    )
  const loaded = cost === 'error' ? null : cost
  const totalInputTokens = inputTokens + prefixTokens(loaded?.prefixChars ?? 0)
  const typical = typicalMessageEstimate(model.pricing, {
    inputTokens: totalInputTokens,
  })
  // 典型回复的下限为 150 token，服务端预扣至少要容纳 256；从服务端读取该门槛，避免取整边界低估。
  const minimum =
    loaded && model.pricing.mode === 'token'
      ? estimateCredits(model.pricing, {
          inputTokens: totalInputTokens,
          maxOutputTokens: loaded.minOutputTokens,
        })
      : 0
  const estimate =
    typical.kind === 'range'
      ? { ...typical, min: Math.max(typical.min, minimum), max: Math.max(typical.max, minimum) }
      : typical
  const upper = estimate.kind === 'range' ? estimate.max : estimate.credits
  const insufficient = loaded !== null && upper > loaded.availableCredits
  const credits = loaded ? formatNumber(loaded.availableCredits) : ''
  const text = m.ai_chat_per_message({ estimate: formatEstimate(estimate) })
  const balance = loaded
    ? insufficient
      ? m.chat_cost_balance_low({ credits })
      : m.chat_cost_balance({ credits })
    : undefined
  return (
    <CreditEstimate
      data-testid="chat-cost"
      estimate={text}
      {...(balance ? { balance } : {})}
      insufficient={insufficient}
      // 窄输入区（手机抽屉）里文字会被截断，悬停可看全文
      title={balance ? `${text} · ${balance}` : text}
      {...(className ? { className } : {})}
    />
  )
}

/** 挂载时读取一次；`refreshKey` 变化（每轮回复结束）时再读一次，不轮询 */
export function ChatCost({
  slug,
  conversationId,
  subject,
  token,
  refreshKey,
  ...props
}: {
  slug: string
  conversationId: string | undefined
  subject?: SubjectRef | undefined
  token?: string | undefined
  refreshKey: number
  model: PickerModel | undefined
  inputTokens: number
  className?: string
}) {
  const [cost, setCost] = useState<ChatCostState>(null)
  const subjectType = subject?.type
  const subjectId = subject?.id
  useEffect(() => {
    // refreshKey 只用于触发重新读取
    void refreshKey
    let active = true
    getChatCostContext({
      data: {
        slug,
        ...(conversationId
          ? { conversationId }
          : subjectType && subjectId
            ? { subject: { type: subjectType, id: subjectId } }
            : token
              ? { token }
              : {}),
      },
    })
      .then((next) => {
        if (active) setCost(next)
      })
      .catch(() => {
        if (active) setCost((old) => (old && old !== 'error' ? old : 'error'))
      })
    return () => {
      active = false
    }
  }, [slug, conversationId, subjectType, subjectId, token, refreshKey])
  return <ChatCostView cost={cost} {...props} />
}

/**
 * 项目页面只传对象引用；首次发送前由服务端构建完整 system 上下文并计数。
 * 已有对话始终读取持久化前缀，不叠加对象上下文。
 */
export const ChatCostSubject = createContext<SubjectRef | undefined>(undefined)

/**
 * ChatComposer 内的「预计 · 余额」：按会话读取对话 ID（对象对话第一次发送后才有）与回复状态，
 * 每轮回复结束（不再生成）时刷新一次余额。
 */
export function SessionChatCost({
  session,
  model,
  inputTokens,
  token,
}: {
  session: ChatSession
  model: PickerModel | undefined
  inputTokens: number
  token?: string | undefined
}) {
  useChatSessionState(session)
  const { status, messages } = useChat<ChatUIMessage>({ chat: session.chat })
  const busy = status === 'submitted' || status === 'streaming'
  // 只在不生成时更新：生成开始不触发读取，结束时消息数变化触发一次
  const settled = useRef(messages.length)
  if (!busy) settled.current = messages.length
  const subject = useContext(ChatCostSubject)
  const conversationId = session.conversationId
  // credit-estimate：沿用模板 CreditEstimateText 的测试钩子（模板 e2e 读取输入区预计消耗）；contents 不参与布局
  return (
    <span data-testid="credit-estimate" className="contents">
      <ChatCost
        key={`${session.slug}:${conversationId ?? (subject ? `${subject.type}:${subject.id}` : (token ?? ''))}`}
        slug={session.slug}
        conversationId={conversationId}
        subject={conversationId ? undefined : subject}
        token={conversationId || subject ? undefined : token}
        refreshKey={settled.current}
        model={model}
        inputTokens={inputTokens}
        // 输入区右下角空间有限：限制在所在列宽内，超出时截断而不是压到发送按钮下
        className="max-w-full"
      />
    </span>
  )
}
