import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { FormAlert } from '../auth/auth-layout.tsx'
import { readingTitle } from '../readings/title.ts'
import type { ChatContext, OpenedChatContext } from './chat-context.ts'
import { contextSummary } from './chat-context-summary.ts'
import { createConversation } from './conversations.functions.ts'

/** 首条消息前的上下文摘要（specs/ai-chat「带盘提问」） */
export function ChatContextSummary({ context }: { context: ChatContext }) {
  const items = contextSummary(context, getLocale())
  return (
    <section
      aria-label={m.ai_chat_context_title({ title: readingTitle(context.kind) })}
      data-testid="chat-context-summary"
      className="grid gap-2 rounded-xl border border-line bg-surface p-4"
    >
      <h3 className="m-0 font-semibold text-base text-ink">
        {m.ai_chat_context_title({ title: readingTitle(context.kind) })}
      </h3>
      {items.length > 0 ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-ink-subtle">{item.label}</dt>
              <dd className="m-0 text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="m-0 text-ink-muted text-xs">{m.ai_chat_context_hint()}</p>
    </section>
  )
}

/**
 * `chat?context=<token>`：令牌有效时自动新建带上下文的对话并进入；过期或不属于当前用户时
 * 显示原因，过期的引导回结果页重新进入。
 */
export function ChatContextStart({
  slug,
  token,
  opened,
}: {
  slug: string
  token: string
  opened: OpenedChatContext
}) {
  const navigate = useNavigate()
  const [failed, setFailed] = useState<'expired' | 'error' | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (opened.status !== 'ok' || started.current) return
    started.current = true
    void (async () => {
      const result = await createConversation({ data: { slug, context: token } }).catch(() => null)
      if (!result?.ok) {
        setFailed(result?.error === 'CHAT_CONTEXT_EXPIRED' ? 'expired' : 'error')
        return
      }
      await navigate({
        to: '/app/$slug/chat/$conversationId',
        params: { slug, conversationId: result.result.id },
        replace: true,
      })
    })()
  }, [opened, slug, token, navigate])

  if (opened.status === 'invalid') return <FormAlert message={m.ai_chat_context_invalid()} />
  if (opened.status === 'expired' || failed === 'expired')
    return (
      <div className="grid gap-3" data-testid="chat-context-expired">
        <FormAlert message={m.ai_chat_context_expired()} />
        {'returnTo' in opened ? (
          <a href={opened.returnTo} className="underline">
            {m.ai_chat_context_back()}
          </a>
        ) : null}
      </div>
    )
  return (
    <div className="grid gap-4">
      <ChatContextSummary context={opened.context} />
      {failed === 'error' ? (
        <FormAlert message={m.ai_chat_context_failed()} />
      ) : (
        <p role="status" className="m-0 text-ink-muted text-sm">
          {m.ai_chat_context_starting()}
        </p>
      )}
    </div>
  )
}
