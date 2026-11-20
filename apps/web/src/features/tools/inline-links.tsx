import { Fragment, type ReactNode } from 'react'
import { useTool } from './context.tsx'

export interface InlineLink {
  readonly href: string
  /** tool_link_click 的 target 字段（目标工具或文章的短 slug） */
  readonly target: string
}

/** 正文内链接：与正文同色并始终带下划线（brand.css 给带 text-brand-ink 的 <a> 加下划线） */
export const inlineLinkClass = 'text-brand-ink hover:decoration-2'

/**
 * 句子里的链接（openspec refresh-visual-system-warm，设计稿 warm-refresh/Proposals79.dc.html D 表）：
 * 文案用 `[锚文本]` 标出链接位置，按出现顺序对应 `links`。这样锚文本留在各语言的句子里，
 * 译文可以按本语言的语序摆放，页面输出的是服务端渲染的真实 <a href>。
 * 方括号多于 `links` 时，多出的部分按普通文字输出。
 */
export function InlineLinks({
  text,
  links,
}: {
  text: string
  links: readonly InlineLink[]
}): ReactNode {
  const { track } = useTool()
  const parts = text.split(/\[([^\]]+)\]/)
  return parts.map((part, index) => {
    const link = index % 2 === 1 ? links[(index - 1) / 2] : undefined
    return link ? (
      <a
        // biome-ignore lint/suspicious/noArrayIndexKey: 句子片段顺序固定
        key={index}
        href={link.href}
        onClick={() => track('tool_link_click', { target: link.target })}
        className={inlineLinkClass}
      >
        {part}
      </a>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: 句子片段顺序固定
      <Fragment key={index}>{part}</Fragment>
    )
  })
}

/**
 * 页尾的一行转化条（设计稿 `.band`）：surface-2 圆角条，一句说明加一个链接；每页最多一条。
 */
export function LinkBand({
  children,
  link,
  label,
}: {
  children: ReactNode
  link: InlineLink
  /** 链接文字：目标页的主关键词 */
  label: string
}) {
  const { track } = useTool()
  return (
    <div
      data-testid="link-band"
      className="flex flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8"
    >
      <p className="m-0 max-w-180 text-body text-ink">{children}</p>
      <a
        href={link.href}
        onClick={() => track('tool_link_click', { target: link.target })}
        className="inline-flex min-h-11 shrink-0 items-center text-body text-brand-ink hover:decoration-2"
      >
        {label}
        <span aria-hidden="true">&nbsp;→</span>
      </a>
    </div>
  )
}
