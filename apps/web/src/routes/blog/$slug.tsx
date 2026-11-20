import { createFileRoute } from '@tanstack/react-router'
import { PostCover } from '@xuanxue/ui/project'
import { formatDate } from '../../features/marketing/blog/post-list.tsx'
import { getBlogPost } from '../../features/marketing/content.functions.ts'
import { readingMinutes } from '../../features/marketing/content.ts'
import { ContentHead, ContentPage, MetaLine } from '../../features/marketing/content-page.tsx'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { RichContent } from '../../features/marketing/rich-content.tsx'
import { originFromMatches, pageHead } from '../../features/seo/metadata.ts'
import { articleData } from '../../features/seo/structured-data.ts'
import { Breadcrumb } from '../../features/tools/breadcrumb.tsx'
import { AiDisclaimer } from '../../features/tools/disclaimer.tsx'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => getBlogPost({ data: { locale: getLocale(), slug: params.slug } }),
  head: ({ loaderData, params, matches }) => {
    if (!loaderData) return {}
    const page = {
      path: `/blog/${encodeURIComponent(params.slug)}`,
      locale: getLocale(),
      title: loaderData.title,
      description: loaderData.summary,
      cover: loaderData.cover,
      date: loaderData.date,
    }
    const appUrl = originFromMatches(matches)
    return pageHead(page, appUrl, [articleData(page, appUrl)])
  },
  component: BlogPostPage,
})

/**
 * 博客文章（设计稿 warm-refresh/BlogPost.dc.html）：面包屑、H1、一行元信息（日期、阅读时间、分类），
 * 正文限宽 720px。分类只作小字说明；回到列表经面包屑。正文内链写在文章的 MDX 里。
 */
function BlogPostPage() {
  const post = Route.useLoaderData()
  const locale = getLocale()
  const topic = post.tags[0]
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead
          eyebrow={
            <Breadcrumb
              items={[
                { name: m.marketing_nav_home(), href: localizeHref('/', { locale }) },
                { name: m.marketing_blog_title(), href: localizeHref('/blog', { locale }) },
                { name: post.title },
              ]}
            />
          }
          title={<span lang={post.locale}>{post.title}</span>}
        >
          <MetaLine
            items={[
              <time key="date" dateTime={post.date}>
                {formatDate(post.date, locale)}
              </time>,
              m.marketing_blog_reading_time({ minutes: String(readingMinutes(post.html)) }),
              topic,
              post.draft && m.marketing_blog_draft(),
            ]}
          />
        </ContentHead>
        <article lang={post.locale} className="flex max-w-180 flex-col gap-5">
          <p className="m-0 text-ink text-lead">{post.summary}</p>
          {post.cover && <PostCover src={post.cover} alt={post.coverAlt} loading="eager" />}
          <RichContent html={post.html} />
          <AiDisclaimer />
        </article>
      </ContentPage>
    </MarketingShell>
  )
}
