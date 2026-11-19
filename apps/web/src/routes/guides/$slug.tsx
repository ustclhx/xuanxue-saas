import { createFileRoute } from '@tanstack/react-router'
import { getGuide } from '../../features/marketing/content.functions.ts'
import { ContentHead, ContentPage } from '../../features/marketing/content-page.tsx'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { RichContent } from '../../features/marketing/rich-content.tsx'
import { originFromMatches, pageHead } from '../../features/seo/metadata.ts'
import { faqData } from '../../features/seo/structured-data.ts'
import { Breadcrumb } from '../../features/tools/breadcrumb.tsx'
import { ToolFaq } from '../../features/tools/faq.tsx'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/guides/$slug')({
  loader: ({ params }) => getGuide({ data: { locale: getLocale(), slug: params.slug } }),
  head: ({ loaderData, params, matches }) => {
    if (!loaderData) return {}
    return pageHead(
      {
        path: `/guides/${encodeURIComponent(params.slug)}`,
        locale: getLocale(),
        title: loaderData.title,
        description: loaderData.answer_summary,
      },
      originFromMatches(matches),
      [faqData(loaderData.faq)],
    )
  },
  component: GuidePage,
})

/** 指南页：与博客文章同一版式（warm-refresh/BlogPost.dc.html）：面包屑、H1、置顶结论、正文、FAQ */
function GuidePage() {
  const guide = Route.useLoaderData()
  const locale = getLocale()
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead
          eyebrow={
            <Breadcrumb
              items={[
                { name: m.marketing_nav_home(), href: localizeHref('/', { locale }) },
                { name: m.marketing_guides_title(), href: localizeHref('/guides', { locale }) },
                { name: guide.title },
              ]}
            />
          }
          title={<span lang={guide.locale}>{guide.title}</span>}
        />
        <article lang={guide.locale} className="flex max-w-180 flex-col gap-5">
          {/* 结论置顶：读者与 AI 助手都先看到答案，正文只做展开。 */}
          <p data-testid="answer-summary" className="m-0 text-ink text-lead">
            {guide.answer_summary}
          </p>
          <RichContent html={guide.html} />
        </article>
        <ToolFaq
          title={m.marketing_guides_faq()}
          items={guide.faq.map((item) => ({ question: item.q, answer: item.a }))}
        />
      </ContentPage>
    </MarketingShell>
  )
}
