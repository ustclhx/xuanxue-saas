import { cn } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { Fragment, type ReactNode } from 'react'

// 内容页（法律页、博客、FAQ、newsletter、/en、404）共用的版式
// （设计稿 docs/design/prototypes/warm-refresh/Legal.dc.html 等的 .page-main 与 .tool-head）：
// 页宽 1120px，页头到正文手机 32px / 桌面 40px，末尾留一个区块间距；页头与正文限宽 720px。

export function ContentPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <PageWidth className={cn('flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28', className)}>
      {children}
    </PageWidth>
  )
}

/** 页头：可选的面包屑或小字、H1，以及一句导语或一行元信息 */
export function ContentHead({
  eyebrow,
  title,
  children,
}: {
  /** H1 之上的面包屑或小字说明 */
  eyebrow?: ReactNode
  title: ReactNode
  /** H1 之下的导语（text-ink-muted 的 <p>）或元信息 */
  children?: ReactNode
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      {eyebrow}
      <h1 className="m-0 text-balance font-heading text-ink text-title">{title}</h1>
      {children}
    </header>
  )
}

/** 元信息行（日期、阅读时间、分类）：caption 小字，手机上自动换行 */
export function MetaLine({ items }: { items: readonly ReactNode[] }) {
  return (
    <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-subtle">
      {items.filter(Boolean).map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 静态的元信息片段，顺序不变
        <span key={index}>{item}</span>
      ))}
    </p>
  )
}

export interface InlineLink {
  readonly href: string
  readonly hrefLang?: string
  readonly lang?: string
}

/**
 * 把文案中的 `[锚文本](key)` 换成服务端输出的真实 <a>（正文内链：与正文同色并加下划线）。
 * 文案仍是一整句，译文可以按各自语序摆放链接；`links` 里没有的 key 只输出文字，不留方括号。
 */
export function inlineLinks(text: string, links: Readonly<Record<string, InlineLink | undefined>>) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(/\[([^\]]+)\]\((\w+)\)/g)) {
    const [whole, label = '', key = ''] = match
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    const link = links[key]
    parts.push(
      link ? (
        <a
          key={`${key}-${start}`}
          href={link.href}
          hrefLang={link.hrefLang}
          lang={link.lang}
          className="text-brand-ink"
        >
          {label}
        </a>
      ) : (
        label
      ),
    )
    last = start + whole.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}

/** 去掉 `[锚文本](key)` 标记后的纯文本（结构化数据、meta 描述等不含链接的输出） */
export function plainInline(text: string): string {
  return text.replace(/\[([^\]]+)\]\(\w+\)/g, '$1')
}

/**
 * 在一段纯文本里把各 `phrase` 第一次出现的位置换成链接；没有出现的不处理（不为放链接改写句子）。
 * 用于问答：同一份文字既输出为可见答案，也原样进入 FAQPage 结构化数据。
 */
export function linkPhrases(
  text: string,
  phrases: readonly { readonly phrase: string; readonly href: string }[],
): ReactNode {
  const hits = phrases
    .map((item) => ({ ...item, index: item.phrase ? text.indexOf(item.phrase) : -1 }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
  const parts: ReactNode[] = []
  let last = 0
  for (const hit of hits) {
    // 与前一个链接重叠的短语跳过
    if (hit.index < last) continue
    if (hit.index > last) parts.push(text.slice(last, hit.index))
    parts.push(
      <a key={hit.href} href={hit.href} className="text-brand-ink">
        {hit.phrase}
      </a>,
    )
    last = hit.index + hit.phrase.length
  }
  if (parts.length === 0) return text
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
