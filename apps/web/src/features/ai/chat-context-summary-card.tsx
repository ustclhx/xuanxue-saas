import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { readingTitle } from '../readings/title.ts'
import { contextSummary } from './chat-context-summary.ts'
import type { ChatContext } from './legacy-chat-context.ts'

/**
 * 旧带盘对话的命盘摘要（adopt-subject-chat-readings design 决策 7）：发布前用旧机制建立的对话，
 * 由对话页路由在 ChatPage 之上显示。新对话改由模板对象对话显示「类型 · 关键结论」标题。
 */
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
