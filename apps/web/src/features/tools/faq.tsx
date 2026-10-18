import type { ReactNode } from 'react'
import { useId } from 'react'
import { m } from '../../paraglide/messages.js'

export interface FaqItem {
  readonly question: string
  readonly answer: ReactNode
}

/** 工具页常见问题：原生 details / summary，无需脚本即可展开，键盘可用 */
export function ToolFaq({ items, title }: { items: readonly FaqItem[]; title?: string }) {
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <section aria-labelledby={headingId} className="flex max-w-[720px] flex-col gap-3">
      <h2 id={headingId} className="m-0 font-heading text-2xl text-ink">
        {title ?? m.tools_faq_title()}
      </h2>
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((item) => (
          <details key={item.question} className="group px-5">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium text-ink marker:hidden">
              {item.question}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
              >
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </summary>
            <div className="pb-4 text-ink-muted leading-relaxed">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
