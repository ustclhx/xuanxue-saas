import type { ComponentProps } from 'react'
import { cn } from '../lib/utils.ts'

/**
 * 工具标签（设计稿 content-growth-v2-tools/Proposals.dc.html 提议 1）：
 * - `free`：动作式免费标签（免费排盘、免费查询…），页面底色填充；
 * - `new`：「新」与年份小标，站点强调色填充；
 * - `paid`：详批价格，描边。只用于详批语境（解锁卡、定价），入口卡与枢纽页不用。
 * 字号为 caption，高 24px；没有「会员」「付费工具」标签。
 */
export type ToolLabelKind = 'free' | 'new' | 'paid'

const KIND: Readonly<Record<ToolLabelKind, string>> = {
  free: 'bg-background text-ink',
  new: 'bg-mark text-on-mark',
  paid: 'inset-ring inset-ring-line-strong text-ink-muted',
}

export type ToolLabelProps = ComponentProps<'span'> & { kind?: ToolLabelKind }

export function ToolLabel({ kind = 'free', className, ...props }: ToolLabelProps) {
  return (
    <span
      data-tool-label={kind}
      className={cn(
        'inline-flex min-h-6 shrink-0 items-center whitespace-nowrap rounded-field px-2 font-medium text-caption',
        KIND[kind],
        className,
      )}
      {...props}
    />
  )
}
