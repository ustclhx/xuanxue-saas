import { Link } from '@tanstack/react-router'
import { Input } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { type DocsNavSection, type DocsSearchEntry, searchDocs } from './content.ts'
import { MarketingShell } from './marketing-shell.tsx'
import { RichContent } from './rich-content.tsx'

interface DocsPageData {
  readonly page: {
    readonly slug: string
    readonly locale: string
    readonly title: string
    readonly description: string
    readonly html: string
  }
  readonly nav: readonly DocsNavSection[]
  readonly searchIndex: readonly DocsSearchEntry[]
}

/**
 * 文档站（tasks.md 3.4；设计稿 warm-refresh/Docs.dc.html）：左侧 240px 的文档导航（文档自身的页面导航）
 * 与构建期索引的客户端搜索，右侧正文限宽 720px。手机上导航在正文之上，单栏。
 */
export function DocsLayout({ page, nav, searchIndex }: DocsPageData) {
  const titleId = useId()
  return (
    <MarketingShell>
      <PageWidth className="grid gap-6 pt-5 pb-16 sm:pt-10 sm:pb-28 md:grid-cols-12 md:gap-16">
        <aside className="flex flex-col gap-4 md:col-span-3">
          <DocsSearch index={searchIndex} />
          <nav aria-label={m.marketing_docs_nav_label()} className="flex flex-col gap-4">
            {nav.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <p className="m-0 px-3 text-caption text-ink-subtle">{section.title}</p>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {section.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        to="/docs/$slug"
                        params={{ slug: item.slug }}
                        aria-current={item.slug === page.slug ? 'page' : undefined}
                        className="flex min-h-11 items-center rounded-field px-3 text-body text-ink-muted hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <article
          lang={page.locale}
          aria-labelledby={titleId}
          className="flex min-w-0 max-w-180 flex-col gap-5 md:col-span-9"
        >
          <p className="m-0 text-caption text-ink-subtle">{m.marketing_docs_title()}</p>
          <h1 id={titleId} className="m-0 text-balance font-heading text-ink text-title">
            {page.title}
          </h1>
          <p className="m-0 text-ink text-lead">{page.description}</p>
          <RichContent html={page.html} />
        </article>
      </PageWidth>
    </MarketingShell>
  )
}

function DocsSearch({ index }: { index: readonly DocsSearchEntry[] }) {
  const [query, setQuery] = useState('')
  const id = useId()
  const results = searchDocs(index, query)
  return (
    <search className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-muted">
        {m.marketing_docs_search_label()}
      </label>
      <Input
        id={id}
        type="search"
        value={query}
        placeholder={m.marketing_docs_search_placeholder()}
        className="min-h-12"
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== '' && (
        <ul
          aria-live="polite"
          className="m-0 flex list-none flex-col gap-1 rounded-object bg-surface p-2"
        >
          {results.length === 0 ? (
            <li className="px-2 py-1 text-caption text-ink-muted">
              {m.marketing_docs_search_empty()}
            </li>
          ) : (
            results.map((entry) => (
              <li key={entry.slug}>
                <Link
                  to="/docs/$slug"
                  params={{ slug: entry.slug }}
                  onClick={() => setQuery('')}
                  className="flex flex-col rounded-field px-2 py-1 text-body hover:bg-surface-2"
                >
                  <span className="font-medium text-ink">{entry.title}</span>
                  <span className="text-caption text-ink-muted">{entry.description}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </search>
  )
}
