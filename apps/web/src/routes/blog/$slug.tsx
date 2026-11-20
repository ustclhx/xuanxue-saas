import { createFileRoute } from '@tanstack/react-router'
import { PostCover } from '@xuanxue/ui/project'
import { formatDate } from '../../features/marketing/blog/post-list.tsx'
import { getBlogPost } from '../../features/marketing/content.functions.ts'
import { readingMinutes } from '../../features/marketing/content.ts'
import { ContentHead, ContentPage, MetaLine } from '../../features/marketing/content-page.tsx'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { RichContent } from '../../features/marketing/rich-content.tsx'
import { fallbackSourceLocale, originFromMatches, pageHead } from '../../features/seo/metadata.ts'
import { articleData, breadcrumbData } from '../../features/seo/structured-data.ts'
import { Breadcrumb } from '../../features/tools/breadcrumb.tsx'
import { AiDisclaimer } from '../../features/tools/disclaimer.tsx'
import { m } from '../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => getBlogPost({ data: { locale: getLocale(), slug: params.slug } }),
  head: ({ loaderData, params, matches }) => {
    if (!loaderData) return {}
    const locale = getLocale()
    const page = {
      path: `/blog/${encodeURIComponent(params.slug)}`,
      locale,
      title: loaderData.title,
      description: loaderData.summary,
      cover: loaderData.cover,
      date: loaderData.date,
      sourceLocale: loaderData.locale,
    }
    // 同站回退：canonical 指向原语言、hreflang 只列真实译文（模板 0.7.3）；跨站回退（东方站显示英文文章，
    // 模板 0.7.4 seo.linking.sites）canonical 指向本页，hreflang 按站点规则列出全部语言，保持 0.7.3 之前的输出
    const crossSite = loaderData.locale !== locale && fallbackSourceLocale(page) === undefined
    const appUrl = originFromMatches(matches)
    return pageHead(
      page,
      appUrl,
      [
        articleData(page, appUrl),
        // BreadcrumbList 与页面上的面包屑同一来源：公开页面清单的 parent 链（模板 0.7.3 getPageLinks）
        breadcrumbData(
          [...crumbs(loaderData.links.breadcrumb), { name: loaderData.title, path: page.path }],
          page.locale,
        ),
      ],
      crossSite ? undefined : loaderData.translations,
    )
  },
  component: BlogPostPage,
})

/** 清单上级链（不带语言前缀的 path 与主词）转为项目面包屑的条目 */
function crumbs(trail: readonly { href: string; label: string }[]) {
  return trail.map((item) => ({ name: item.label, path: item.href }))
}

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
                ...crumbs(post.links.breadcrumb).map((crumb) => ({
                  name: crumb.name,
                  href: localizeHref(crumb.path, { locale }),
                })),
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
