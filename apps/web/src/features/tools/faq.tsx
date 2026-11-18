import type { ReactNode } from 'react'
import { useId } from 'react'
import { m } from '../../paraglide/messages.js'

export interface FaqItem {
  readonly question: string
  readonly answer: ReactNode
}

/**
 * 工具页常见问题（设计稿 warm-refresh/ToolBazi.dc.html）：细线分隔的列表，不套卡片；
 * 原生 details / summary，无需脚本即可展开，键盘可用。第一条默认展开。
 */
export function ToolFaq({ items, title }: { items: readonly FaqItem[]; title?: string }) {
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <section aria-labelledby={headingId} className="flex max-w-180 flex-col gap-6">
      <h2 id={headingId} className="m-0 text-balance font-heading text-ink text-title">
        {title ?? m.tools_faq_title()}
      </h2>
      <div className="border-line border-t">
        {items.map((item, index) => (
          <details key={item.question} open={index === 0} className="group border-line border-b">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-body text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
              {item.question}
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
              >
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <div className="pb-5 text-body text-ink-muted">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
