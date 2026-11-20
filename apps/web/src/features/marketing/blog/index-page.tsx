import { m } from '../../../paraglide/messages.js'
import { ContentHead, ContentPage } from '../content-page.tsx'
import { MarketingShell } from '../marketing-shell.tsx'
import { PostList, type PostSummary } from './post-list.tsx'

/** 博客列表页（设计稿 warm-refresh/BlogList.dc.html）：/blog 与第 2 页起的 /blog/page/$page 共用 */
export function BlogIndex({
  posts,
  tags,
  page,
  pages,
}: {
  posts: readonly PostSummary[]
  tags: readonly string[]
  page: number
  pages: number
}) {
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead title={m.marketing_blog_title()}>
          <p className="m-0 text-body text-ink-muted">{m.marketing_blog_intro()}</p>
        </ContentHead>
        <PostList posts={posts} tags={tags} page={page} pages={pages} />
      </ContentPage>
    </MarketingShell>
  )
}
