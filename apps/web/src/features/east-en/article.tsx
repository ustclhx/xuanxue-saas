import { useId } from 'react'
import type { FaqItem } from '../tools/faq.tsx'
import type { Faq, TextSection } from './copy/types.ts'
import { EastEnText, plainText } from './links.tsx'

/** 东方站英文页面面包屑的首页一级：锚文本「Home」与页头、清单主词短变体一致（pages.project.ts STATIC_MAIN） */
export const HOME_CRUMB = { name: 'Home', href: '/' } as const

/**
 * 东方站根路径英文的说明长文：与工具页长文同一版式（tool-article.tsx），段落可含站内链接。
 * 位于结果之后、FAQ 之前，服务端输出。
 */
export function EastEnArticle({
  title,
  sections,
}: {
  title?: string
  sections: readonly TextSection[]
}) {
  const headingId = useId()
  return (
    <article
      aria-labelledby={title ? headingId : undefined}
      className="flex max-w-180 flex-col gap-5"
    >
      {title && (
        <h2 id={headingId} className="m-0 text-balance font-heading text-ink text-title">
          {title}
        </h2>
      )}
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          {title ? (
            <h3 className="m-0 font-heading text-ink text-subtitle">{section.heading}</h3>
          ) : (
            <h2 className="m-0 mt-5 text-balance font-heading text-ink text-title first:mt-0">
              {section.heading}
            </h2>
          )}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="m-0 text-body text-ink-muted">
              <EastEnText text={paragraph} />
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}

/** FAQ 条目：可见答案保留链接 */
export function eastEnFaq(items: readonly Faq[]): FaqItem[] {
  return items.map((item) => ({ question: item.q, answer: <EastEnText text={item.a} /> }))
}

/** FAQPage 结构化数据：纯文本答案（与可见文字相同，去掉链接标记） */
export function eastEnFaqData(items: readonly Faq[]): { question: string; answer: string }[] {
  return items.map((item) => ({ question: item.q, answer: plainText(item.a) }))
}
