import { cn } from '@xuanxue/ui'
import { type ReactNode, useId, useState } from 'react'
import { useSiteId } from '../site/context.tsx'
import { useTool } from './context.tsx'

/** 东方站区块编号 ①–⑳ */
export function circledNumber(index: number): string {
  return index >= 1 && index <= 20 ? String.fromCodePoint(0x2460 + index - 1) : String(index)
}

/**
 * 结果区块（视觉规范「布局与组件」）：`<section>` + `<h2>`，带锚点 id，可折叠。
 * 说明文字与内容在服务端输出（默认展开），禁用脚本时仍可阅读；折叠按钮用 aria-expanded 表达状态。
 * 编号（①–⑦）只在东方站显示；展开时上报 block_open。
 */
export function ResultBlock({
  id,
  title,
  index,
  description,
  aside,
  defaultOpen = true,
  className,
  children,
}: {
  /** 锚点 id，同时作为埋点 block 字段，使用小写 slug */
  id: string
  title: string
  index?: number
  /** 区块解释文字，预渲染可抓取 */
  description?: ReactNode
  /** 标题行右侧的补充信息（如排盘时间） */
  aside?: ReactNode
  defaultOpen?: boolean
  className?: string
  children?: ReactNode
}) {
  const site = useSiteId()
  const { track } = useTool()
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const toggle = () => {
    if (!open) track('block_open', { block: id })
    setOpen(!open)
  }
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'flex scroll-mt-6 flex-col gap-3.5 rounded-xl border border-line bg-surface p-5',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-title`} className="m-0 font-heading text-ink text-xl">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
            className="group inline-flex min-h-11 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            {site === 'east' && index !== undefined && (
              <span aria-hidden="true">{circledNumber(index)}</span>
            )}
            <span>{title}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="text-ink-subtle transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none"
            >
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </h2>
        {aside && <span className="text-ink-subtle text-sm">{aside}</span>}
      </div>
      <div id={bodyId} hidden={!open} className="flex flex-col gap-3">
        {children}
        {description && (
          <p className="m-0 text-ink-subtle text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </section>
  )
}
