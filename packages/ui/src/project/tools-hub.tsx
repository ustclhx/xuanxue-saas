import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/utils.ts'

// 「全部工具」枢纽页的版式部件（设计稿 content-growth-v2-tools/HubEast.dc.html、HubWest.dc.html，Proposals 提议 4）：
// 分组跳转标签、分组（标题 + 导语 + 工具卡或链接列表）。空分组由调用方不渲染。

/** 分组跳转：一行可横向滚动的标签，页内锚点 */
export function HubToc({
  label,
  items,
}: {
  label: string
  items: readonly { readonly href: string; readonly label: ReactNode }[]
}) {
  return (
    <nav aria-label={label} data-link-zone="nav" className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex min-h-11 flex-none items-center rounded-field bg-surface-2 px-3.5 text-caption text-ink-muted no-underline transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

/** 分组之间的纵向节奏：手机 40px、桌面 56px */
export function HubGroups({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-10 sm:gap-14', className)} {...props} />
}

export function HubGroup({
  id,
  title,
  intro,
  children,
}: {
  id: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      data-hub-group={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <div className="flex max-w-180 flex-col gap-1">
        <h2 id={`${id}-title`} className="m-0 text-balance font-heading text-ink text-title">
          {title}
        </h2>
        {intro && <p className="m-0 text-body text-ink-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

/** 工具卡网格：手机单列、平板两列、桌面三列 */
export function HubToolGrid({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      className={cn(
        'm-0 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3',
        className,
      )}
      {...props}
    />
  )
}

/** 链接列表（知识库一组）：手机两列、桌面四列，每项 ≥ 44px */
export function HubLinkList({
  items,
  className,
  ...props
}: Omit<ComponentProps<'ul'>, 'children'> & {
  items: readonly { readonly href: string; readonly label: ReactNode; readonly id?: string }[]
}) {
  return (
    <ul
      className={cn(
        'm-0 grid list-none grid-cols-2 gap-x-4 p-0 sm:gap-x-8 lg:grid-cols-4',
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <li key={item.href} className="flex min-h-11 items-baseline py-2">
          <a
            href={item.href}
            data-tool={item.id}
            className="text-body text-brand-ink underline underline-offset-4 hover:decoration-2"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  )
}
