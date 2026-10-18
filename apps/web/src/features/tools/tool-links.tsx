import { useId } from 'react'
import { m } from '../../paraglide/messages.js'
import { useTool } from './context.tsx'

export interface ToolLink {
  readonly href: string
  readonly title: string
  /** 目标工具或文章的 slug，作为 tool_link_click 的 target 字段 */
  readonly target: string
}

/** 内链矩阵（延伸阅读）：工具与概念页互链，点击上报 tool_link_click */
export function ToolLinks({ links, title }: { links: readonly ToolLink[]; title?: string }) {
  const headingId = useId()
  const { track } = useTool()
  if (links.length === 0) return null
  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="m-0 font-heading text-ink text-xl">
        {title ?? m.tools_links_title()}
      </h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 p-0">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              onClick={() => track('tool_link_click', { target: link.target })}
              className="flex min-h-11 items-center rounded-[10px] border border-line bg-surface p-3.5 text-[15px] text-ink transition-colors hover:border-line-strong"
            >
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
