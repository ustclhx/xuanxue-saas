import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/utils.ts'

// 营销页与工具页的区块容器（openspec refresh-visual-system-warm design.md D6、D14）：
// 一个居中栏（页宽 1120px，页面边距手机 20px / 桌面 32px），区块之间靠留白而不是边框分隔。
// 字号取营销作用域的角色类（text-title、text-body…），在 MarketingShell 的 data-surface="marketing" 内生效。

/** 页宽容器：页头、页脚与区块共用同一左右边距 */
export function PageWidth({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-280 px-5 sm:px-8', className)} {...props} />
}

/** 区块纵向节奏：区块间距手机 64px / 桌面 112px，末尾留同样的空白 */
export function SectionStack({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-16 pb-16 sm:gap-28 sm:pb-28', className)} {...props} />
  )
}

export type SectionProps = Omit<ComponentProps<'section'>, 'title'> & {
  /** plain：内容直接落在页面底；band：内容放进一条 surface-2 圆角色带（今日条、一行价格） */
  tone?: 'plain' | 'band'
  /** 区块标题（h2）；提供时区块以它命名 */
  title?: ReactNode
  /** 标题下的一句说明 */
  intro?: ReactNode
  /** 标题元素的 id，默认由 `id` 派生 */
  titleId?: string
}

/**
 * 区块：标题到内容手机 32px / 桌面 40px，标题与说明限宽 720px。
 * 不给整个区块画边框；需要与页面底区分的对象（表单、卡片、样例）自己用 surface。
 */
export function Section({
  tone = 'plain',
  title,
  intro,
  titleId,
  id,
  className,
  children,
  ...props
}: SectionProps) {
  const headingId = title ? (titleId ?? (id ? `${id}-title` : undefined)) : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={className} {...props}>
      <PageWidth>
        {title && (
          <div className="mb-8 flex max-w-180 flex-col gap-2 sm:mb-10">
            <h2 id={headingId} className="m-0 text-balance font-heading text-ink text-title">
              {title}
            </h2>
            {intro && <p className="m-0 text-body text-ink-muted">{intro}</p>}
          </div>
        )}
        {tone === 'band' ? (
          <div className="flex flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
            {children}
          </div>
        ) : (
          children
        )}
      </PageWidth>
    </section>
  )
}

/**
 * 正文内各元素的排版（设计稿 warm-refresh/BlogPost.dc.html、Proposals79 B「Prose 补样式」）：
 * 小标题、链接、列表、提示块（blockquote，surface 圆角块）、行内代码与代码块（模板已有的等宽字体，caption 字号）。
 * 只定样式不定间距：`Prose` 用 flex 间距，构建期 HTML 正文（应用层的 RichContent）用外边距。
 */
export const PROSE_ELEMENTS = [
  '[&_h2]:text-balance [&_h2]:font-bold [&_h2]:font-heading [&_h2]:text-ink [&_h2]:text-title',
  '[&_h3]:font-bold [&_h3]:font-heading [&_h3]:text-ink [&_h3]:text-subtitle',
  '[&_a]:text-brand-ink [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:decoration-2',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2',
  '[&_blockquote]:rounded-object [&_blockquote]:bg-surface [&_blockquote]:px-6 [&_blockquote]:py-5',
  '[&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-caption [&_code]:text-ink',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-field [&_pre]:bg-surface [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-mono [&_pre]:text-caption [&_pre]:text-ink',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
].join(' ')

/** 正文：限宽 720px，段落之间 16px；CJK 与拉丁正文都用营销作用域的 body 行高 */
export function Prose({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex max-w-180 flex-col gap-4 text-body text-ink-muted',
        PROSE_ELEMENTS,
        className,
      )}
      {...props}
    />
  )
}
