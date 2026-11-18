import { m } from '../../paraglide/messages.js'

export interface Crumb {
  readonly name: string
  /** 省略时为当前页，不输出链接 */
  readonly href?: string
}

/**
 * 面包屑（openspec separate-landing-homepage specs/numerology-pages「数字页」，原型 ToolLifePath.dc.html）：
 * 位于 H1 之上，指向首页与父工具页；与页面 head 中的 BreadcrumbList 同一组层级。
 */
export function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label={m.tools_breadcrumb_label()} className="text-caption text-ink-muted">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">›</span>}
            {item.href ? (
              <a href={item.href} className="underline-offset-4 hover:text-ink hover:underline">
                {item.name}
              </a>
            ) : (
              <span aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
