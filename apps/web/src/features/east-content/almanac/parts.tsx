import { cn } from '@xuanxue/ui'
import type { ReactNode } from 'react'
import { RichContent } from '../../marketing/rich-content.tsx'
import { Breadcrumb, type Crumb } from '../../tools/breadcrumb.tsx'

/**
 * 黄历两类页面共用的小块（设计稿 content-growth-phase2/AlmanacTool、AlmanacMonth 的
 * `.tool-head`、`.tile`、`.badge`、`.tag`、`.article`）。只用 @xuanxue/ui 的设计 token 工具类。
 */

/** 正文内链接：与正文同色并始终带下划线（同每日页） */
export const bodyLink = 'text-brand-ink hover:decoration-2'

/** 次要按钮（设计稿 `.btn-secondary`）：药丸形细线框 */
export const secondaryButton =
  'inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full border border-field-border bg-transparent px-5 font-medium text-body text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-60'

/** 小节内容卡（设计稿 `.tile`） */
export function Tile({
  label,
  value,
  children,
}: {
  label: string
  value: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-object bg-surface p-5">
      <p className="m-0 text-caption text-ink-subtle">{label}</p>
      <p className="m-0 flex flex-wrap items-center gap-2 font-bold font-heading text-ink text-subtitle">
        {value}
      </p>
      {children && <p className="m-0 text-body text-ink-muted">{children}</p>}
    </div>
  )
}

/** 灰底标签（设计稿 `.badge`）：黄道黑道分类、交节时刻、节日 */
export function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 font-normal font-sans text-caption text-ink-muted">
      {children}
    </span>
  )
}

/** 「今天」标签（设计稿 `.tag`） */
export function TodayTag({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-5.5 items-center whitespace-nowrap rounded-field bg-brand px-2 font-normal font-sans text-caption text-on-brand">
      {label}
    </span>
  )
}

/** 页首：面包屑、H1 与导语（设计稿 `.tool-head`） */
export function AlmanacHeader({
  crumbs,
  title,
  children,
}: {
  crumbs: readonly Crumb[]
  title: string
  children: ReactNode
}) {
  return (
    <header className="flex max-w-180 flex-col gap-3 pt-5 sm:pt-10">
      <Breadcrumb items={crumbs} />
      <h1 className="m-0 text-balance font-heading text-ink text-title">{title}</h1>
      <div className="text-body text-ink-muted">{children}</div>
    </header>
  )
}

/** 说明长文的排版：小节标题用 heading 角色，正文为弱化文字色（同概念页） */
const prose =
  'text-body text-ink-muted [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title [&_h3]:font-bold [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle [&_strong]:text-ink [&_a]:text-brand-ink'

export function AlmanacProse({ html, className }: { html: string; className?: string }) {
  return <RichContent html={html} className={cn(prose, className)} />
}

/** 合规声明（设计稿 `.disc`） */
export function AlmanacDisclaimer({ text }: { text: string }) {
  return (
    <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
      {text}
    </p>
  )
}
