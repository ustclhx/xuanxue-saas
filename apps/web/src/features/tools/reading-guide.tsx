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
 * 样式：承载单个对象的 surface 面板（14px 圆角、不画边框），入口是次要按钮（药丸形、细线框）。
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
      className="flex flex-col gap-3 rounded-object bg-surface p-6 sm:p-8"
    >
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
        {m.funnel_guide_title()}
      </h2>
      <p className="m-0 max-w-180 text-body text-ink-muted">{body}</p>
      <a
        href={to.href}
        onClick={() => track('tool_link_click', { target: to.target })}
        className="inline-flex min-h-12 items-center self-start rounded-full px-7 font-medium text-body text-ink no-underline ring-1 ring-field-border ring-inset transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
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
 * 样式：限宽 720px 的入口列表，每项是 surface 底的整行链接（6px 圆角、不画边框）。
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
    'flex min-h-12 items-center rounded-field bg-surface px-4 py-3 text-body text-ink no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2'
  return (
    <nav
      aria-labelledby={headingId}
      data-testid="content-funnel"
      // 转化入口（docs/seo-internal-linking.md §3）：不计入正文内链数与锚文本统计（openspec seo-fix-tdk-links 决策 5）
      data-link-zone="action"
      className="flex max-w-180 flex-col gap-3"
    >
      <h2 id={headingId} className="m-0 font-heading text-ink text-subtitle">
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
              <span className="font-medium">{reading.label}</span>
              <span className="text-caption text-ink-muted">{m.funnel_content_reading_note()}</span>
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}
