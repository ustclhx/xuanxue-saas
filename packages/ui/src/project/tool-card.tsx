import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/utils.ts'

/** 铺满卡片的链接：链接只包住名称，伪元素让整张卡可点，焦点环画在卡片外沿 */
export const stretchedLinkClass =
  'text-ink no-underline after:absolute after:inset-0 after:rounded-object focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:outline-offset-3'

export interface ToolCardProps {
  href: string
  /** 工具名：也是链接的锚文本（目标页主词） */
  title: ReactNode
  /** 大号字形，站点强调色，对读屏隐藏 */
  glyph?: ReactNode
  summary?: ReactNode
  /** 名称右侧的小标（「新」「2027」） */
  badge?: ReactNode
  /** 卡片底部的标签行（动作式免费标签） */
  labels?: ReactNode
  /** `stack`：桌面纵排、手机横排（首页副卡）；`row`：始终横排、说明用 caption（枢纽页） */
  layout?: 'stack' | 'row'
  as?: 'li' | 'div'
  /** 传给链接的属性（`data-tool` 等） */
  linkProps?: Omit<ComponentProps<'a'>, 'href' | 'className' | 'children'>
  className?: string
}

/**
 * 工具卡（设计稿 content-growth-v2-tools/Proposals.dc.html 提议 2）：字形、名称 + 小标、一句说明、标签行。
 * 整张卡是一个真实链接；原来的「开始排盘 →」文字由动作式免费标签取代。
 */
export function ToolCard({
  href,
  title,
  glyph,
  summary,
  badge,
  labels,
  layout = 'stack',
  as: Tag = 'li',
  linkProps,
  className,
}: ToolCardProps) {
  const stack = layout === 'stack'
  return (
    <Tag
      data-tool-card={layout}
      className={cn(
        'relative flex min-w-0 gap-3 rounded-object bg-surface p-5 text-ink transition-colors hover:bg-surface-2',
        stack && 'sm:flex-col sm:gap-2 sm:p-6',
        className,
      )}
    >
      {glyph !== undefined && (
        <span
          aria-hidden="true"
          className={cn('w-11 shrink-0 font-heading text-mark text-title', stack && 'sm:w-auto')}
        >
          {glyph}
        </span>
      )}
      <div className={cn('flex min-w-0 flex-1 flex-col gap-1', stack && 'sm:gap-2')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 font-heading text-ink text-subtitle">
            <a href={href} className={stretchedLinkClass} {...linkProps}>
              {title}
            </a>
          </h3>
          {badge}
        </div>
        {summary && (
          <p className={cn('m-0 text-ink-muted', stack ? 'text-body' : 'text-caption')}>
            {summary}
          </p>
        )}
        {labels && <div className="mt-auto flex flex-wrap gap-1.5 pt-1">{labels}</div>}
      </div>
    </Tag>
  )
}
