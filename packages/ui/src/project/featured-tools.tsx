import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/utils.ts'
import { stretchedLinkClass } from './tool-card.tsx'

/**
 * 首页精选区（设计稿 content-growth-v2-tools/Main.dc.html、HomeWest.dc.html，Proposals 提议 3）：
 * 第一行主卡（7 份宽，surface）+ 季节位（5 份宽，surface-2 色带），第二行副卡；手机上依次堆叠。
 * 没有季节位时主卡占满整行。副卡列数随张数：4 张为 2 / 4 列，3 张为 3 列，其余两列。
 */
export function FeaturedTools({
  main,
  season,
  count,
  children,
  className,
}: {
  main: ReactNode
  season?: ReactNode
  /** 副卡张数 */
  count: number
  /** 副卡（`ToolCard`） */
  children?: ReactNode
  className?: string
}) {
  return (
    <div data-featured-tools className={cn('grid gap-4 lg:grid-cols-12 lg:gap-6', className)}>
      <div className={season ? 'lg:col-span-7' : 'lg:col-span-12'}>{main}</div>
      {season && <div className="lg:col-span-5">{season}</div>}
      {count > 0 && (
        <ul
          className={cn(
            'm-0 grid list-none gap-3 p-0 sm:gap-4 lg:col-span-12 lg:gap-6',
            count === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : count === 3 ? 'sm:grid-cols-3' : '',
            count === 2 && 'sm:grid-cols-2',
          )}
        >
          {children}
        </ul>
      )}
    </div>
  )
}

/**
 * 主卡：标签、名称、一句说明、主按钮样式的动作文字与一个样例图形。整张卡是一个链接（链接只包住名称），
 * 动作文字只作视觉、对读屏隐藏，首屏之外不再多出一个主按钮链接。
 */
export function FeaturedMain({
  href,
  title,
  label,
  summary,
  action,
  visual,
  linkProps,
}: {
  href: string
  title: ReactNode
  label?: ReactNode
  summary?: ReactNode
  action?: ReactNode
  visual?: ReactNode
  linkProps?: Omit<ComponentProps<'a'>, 'href' | 'className' | 'children'>
}) {
  return (
    <article
      data-featured="main"
      className={cn(
        'group relative grid h-full items-center gap-5 rounded-object bg-surface p-6 text-ink sm:gap-8 sm:p-8',
        visual && 'sm:grid-cols-2',
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-3">
        {label}
        <h3 className="m-0 font-heading text-ink text-title">
          <a href={href} className={stretchedLinkClass} {...linkProps}>
            {title}
          </a>
        </h3>
        {summary && <p className="m-0 text-body text-ink-muted">{summary}</p>}
        {action && (
          <span
            aria-hidden="true"
            className="mt-1 inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-brand px-7 font-medium text-body text-on-brand transition-opacity group-hover:opacity-90 max-sm:w-full"
          >
            {action}
          </span>
        )}
      </div>
      {visual && <div className="min-w-0">{visual}</div>}
    </article>
  )
}

/** 季节位：小标、装饰大字（如「丁未」，对读屏隐藏）、可选的当日一行、标题、说明与一到两个链接 */
export function FeaturedSeason({
  badge,
  mark,
  lead,
  title,
  summary,
  children,
  ...props
}: Omit<ComponentProps<'article'>, 'title'> & {
  badge?: ReactNode
  mark?: ReactNode
  lead?: ReactNode
  title: ReactNode
  summary?: ReactNode
}) {
  return (
    <article
      data-featured="season"
      className="flex h-full min-w-0 flex-col items-start gap-3 rounded-object bg-surface-2 p-6 sm:p-8"
      {...props}
    >
      {badge}
      {mark && (
        <p aria-hidden="true" className="m-0 font-heading text-display text-mark">
          {mark}
        </p>
      )}
      {lead}
      <h3 className="m-0 font-heading text-ink text-subtitle">{title}</h3>
      {summary && <p className="m-0 text-body text-ink-muted">{summary}</p>}
      <div className="mt-auto flex w-full flex-wrap items-center gap-x-6 gap-y-1 pt-1">
        {children}
      </div>
    </article>
  )
}

/** 季节位里的链接：`button` 为描边药丸按钮，`text` 为带下划线的文字链接；都 ≥ 44px */
export function FeaturedSeasonLink({
  variant = 'text',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: 'button' | 'text' }) {
  return (
    <a
      className={cn(
        variant === 'button'
          ? 'inset-ring inset-ring-field-border inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full px-7 font-medium text-body text-ink no-underline transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 max-sm:w-full'
          : 'inline-flex min-h-11 items-center text-body text-brand-ink underline underline-offset-4 hover:decoration-2 max-sm:w-full max-sm:justify-center',
        className,
      )}
      {...props}
    />
  )
}
