import { useId } from 'react'
import { m } from '../../paraglide/messages.js'
import { useTool } from './context.tsx'

export interface ToolLink {
  readonly href: string
  readonly title: string
  /** 目标工具或文章的 slug，作为 tool_link_click 的 target 字段 */
  readonly target: string
}

/**
 * 内链矩阵（延伸阅读，设计稿 warm-refresh/ToolBazi.dc.html）：工具与概念页互链，位于结果、长文与 FAQ 之后；
 * 带下划线的文字链接（与正文同色），点击上报 tool_link_click。
 */
export function ToolLinks({
  links,
  title,
}: {
  links: readonly ToolLink[]
  title?: string | undefined
}) {
  const headingId = useId()
  const { track } = useTool()
  if (links.length === 0) return null
  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
        {title ?? m.tools_links_title()}
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-1 p-0">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              onClick={() => track('tool_link_click', { target: link.target })}
              className="inline-flex min-h-11 items-center text-body text-brand-ink hover:decoration-2"
            >
              {link.title}
              <span aria-hidden="true">&nbsp;→</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
