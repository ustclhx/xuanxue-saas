import { useId } from 'react'

export interface ArticleSection {
  readonly heading: string
  readonly body: string
}

/**
 * 正文按空行分段（openspec add-locales-eu-ja 决策 10「结构自定」：新语言的段数可与其他语言不同）；
 * 不含空行的正文仍是一段，现有语言的输出不变。
 */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
}

/**
 * 工具页说明长文（specs/tool-pages「工具页紧凑布局」；设计稿 warm-refresh/ToolBazi.dc.html 的 `.article`）：
 * 位于结果之后、FAQ 之前，服务端输出，未提交时也可阅读与抓取；限宽 720px。
 */
export function ToolArticle({
  title,
  sections,
}: {
  title: string
  sections: readonly ArticleSection[]
}) {
  const headingId = useId()
  return (
    <article aria-labelledby={headingId} className="flex max-w-180 flex-col gap-5">
      <h2 id={headingId} className="m-0 text-balance font-heading text-ink text-title">
        {title}
      </h2>
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h3 className="m-0 font-heading text-ink text-subtitle">{section.heading}</h3>
          {paragraphs(section.body).map((text) => (
            <p key={text} className="m-0 text-body text-ink-muted">
              {text}
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}
