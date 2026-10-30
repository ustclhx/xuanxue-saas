import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'
import { createReadingUnlock } from '../readings/readings.functions.ts'
import { UNLOCK_PARAM, unlockReturnPath } from '../readings/unlock.ts'
import type { UnlockRequest } from '../readings/unlock-card.tsx'
import type { ShareInput } from '../tools/share.ts'
import { createChatContextLink } from './chat-context.functions.ts'

/**
 * 结果页「用这个结果问 AI」（specs/ai-chat「从结果页携带命盘上下文」）：
 * 原始输入只发给服务端复算，地址里只有服务端签发的上下文令牌。
 *
 * 未登录时沿用解锁卡的回跳令牌（只含分享片段，不含姓名）去登录，并在本标签页 sessionStorage
 * 记下待办；登录回到结果页、令牌一致时自动继续进入对话。组件须随解锁卡在首次渲染时挂载
 * （`request` 可以先为 null），才能在解锁卡清理地址前读到 `?unlock=`。
 */
const PENDING_KEY = 'xuanxue.chat.pending-context'

interface Pending {
  readonly token: string
  readonly kind: string
  readonly input: unknown
}

function savePending(pending: Pending) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // 存储不可用时登录后不自动继续，用户再点一次即可
  }
}

function takePending(): Pending | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY)
    window.sessionStorage.removeItem(PENDING_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Pending).token === 'string' &&
      typeof (value as Pending).kind === 'string'
    )
      return value as Pending
  } catch {
    // 损坏或不可用视为没有
  }
  return null
}

export function AskAiEntry({ kind, request }: { kind: string; request: UnlockRequest | null }) {
  const locale = getLocale()
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const resumeToken = useRef<string | null>(null)

  // 解锁卡在 useEffect 中清掉 `?unlock=`，这里在布局阶段先读出来
  useLayoutEffect(() => {
    resumeToken.current = new URLSearchParams(window.location.search).get(UNLOCK_PARAM)
  }, [])

  const open = async (input: unknown, share: ShareInput | null) => {
    setState('busy')
    try {
      const returnTo = window.location.pathname
      const link = await createChatContextLink({ data: { kind, locale, input, returnTo } })
      if (link.status === 'ok') return window.location.assign(link.href)
      // 回跳后自动继续时仍未登录（会话已失效）：不再循环跳转，由用户重新点击
      if (link.status === 'login' && share) {
        const { token } = await createReadingUnlock({
          data: { kind, share: { ...share }, returnTo },
        })
        savePending({ token, kind, input })
        const redirect = unlockReturnPath(returnTo, token)
        return window.location.assign(
          localizeHref(`/login?redirect=${encodeURIComponent(redirect)}`, { locale }),
        )
      }
      setState('error')
    } catch {
      setState('error')
    }
  }

  // 登录回跳：本标签页发起的待办与地址中的令牌一致时继续
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载时处理一次回跳
  useEffect(() => {
    const token = resumeToken.current
    if (!token) return
    const pending = takePending()
    if (pending && pending.token === token && pending.kind === kind) void open(pending.input, null)
  }, [])

  // 结果出现前不显示；登录回跳自动继续时结果可能尚未恢复，仍显示进行中的状态
  if (!request && state === 'idle') return null
  return (
    <div className="flex flex-col gap-1.5" data-testid="ask-ai-entry">
      <button
        type="button"
        onClick={() => request && void open(request.input, request.share)}
        disabled={state === 'busy' || !request}
        data-testid="ask-ai-button"
        className="inline-flex min-h-11 items-center self-start rounded-lg border border-line-strong bg-transparent px-5 font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state === 'busy' ? m.ai_chat_ask_busy() : m.ai_chat_ask()}
      </button>
      <p className="m-0 text-ink-muted text-xs">
        {state === 'error' ? (
          <span role="alert">{m.ai_chat_ask_error()}</span>
        ) : (
          m.ai_chat_ask_note()
        )}
      </p>
    </div>
  )
}
