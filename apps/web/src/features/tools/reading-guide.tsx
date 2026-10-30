import { useId } from 'react'
import { m } from '../../paraglide/messages.js'
import { useReadingAvailable } from '../readings/use-reading-available.ts'
import { useTool } from './context.tsx'

export interface FunnelTarget {
  readonly href: string
  readonly label: string
  /** tool_link_click 的 target 字段（短 slug） */
  readonly target: string
}

/**
 * 没有对应详批的工具结果末尾的引导（product-improve-ai-content tasks.md 3.3）：指向本站可以解锁
 * 相关详批的工具页。文案只说明目标工具能解锁「它自己的」结果，不承诺解锁当前结果；
 * 目标详批不可用或报价读取失败时不渲染。
 */
export function ReadingGuide({
  kind,
  body,
  to,
}: {
  /** 目标工具可解锁的详批种类 */
  kind: string
  body: string
  to: FunnelTarget
}) {
  const headingId = useId()
  const available = useReadingAvailable(kind)
  const { track } = useTool()
  if (!available) return null
  return (
    <section
      aria-labelledby={headingId}
      data-testid="reading-guide"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id={headingId} className="m-0 font-heading font-semibold text-ink text-xl">
        {m.funnel_guide_title()}
      </h2>
      <p className="m-0 max-w-[720px] text-ink-muted leading-relaxed">{body}</p>
      <a
        href={to.href}
        onClick={() => track('tool_link_click', { target: to.target })}
        className="inline-flex min-h-11 items-center self-start rounded-lg border border-line-strong px-5 text-ink no-underline transition-colors hover:bg-surface-2"
      >
        {to.label}
      </a>
    </section>
  )
}

/**
 * 内容词典页（牌义、生命灵数含义、八字概念）末尾的工具与详批入口（tasks.md 3.6）：
 * 工具入口始终随服务端 / 预渲染 HTML 输出，不依赖数据库；详批入口在客户端读取报价，
 * 可用时才追加，读取失败时隐藏。
 */
export function ContentFunnel({
  tool,
  reading,
}: {
  tool: FunnelTarget
  reading: FunnelTarget & { readonly kind: string }
}) {
  const headingId = useId()
  const available = useReadingAvailable(reading.kind)
  const { track } = useTool()
  const linkClass =
    'flex min-h-11 items-center rounded-[10px] border border-line bg-surface p-3.5 text-[15px] text-ink no-underline transition-colors hover:border-line-strong'
  return (
    <nav
      aria-labelledby={headingId}
      data-testid="content-funnel"
      className="flex max-w-[720px] flex-col gap-3"
    >
      <h2 id={headingId} className="m-0 font-heading text-ink text-xl">
        {m.funnel_content_title()}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        <li>
          <a
            href={tool.href}
            data-testid="content-funnel-tool"
            onClick={() => track('tool_link_click', { target: tool.target })}
            className={linkClass}
          >
            {tool.label}
          </a>
        </li>
        {available && (
          <li>
            <a
              href={reading.href}
              data-testid="content-funnel-reading"
              onClick={() => track('tool_link_click', { target: reading.target })}
              className={`${linkClass} flex-col items-start justify-center gap-0.5`}
            >
              <span className="font-semibold">{reading.label}</span>
              <span className="text-ink-muted text-sm">{m.funnel_content_reading_note()}</span>
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}
