import { createFileRoute } from '@tanstack/react-router'
import { PostList } from '../../../features/marketing/blog/post-list.tsx'
import { getBlogIndex } from '../../../features/marketing/content.functions.ts'
import { ContentHead, ContentPage } from '../../../features/marketing/content-page.tsx'
import { MarketingShell } from '../../../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageHead } from '../../../features/seo/metadata.ts'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'

export const Route = createFileRoute('/blog/tags/$tag')({
  loader: ({ params }) => getBlogIndex({ data: { locale: getLocale(), tag: params.tag } }),
  head: ({ params, matches }) =>
    pageHead(
      {
        path: `/blog/tags/${encodeURIComponent(params.tag)}`,
        locale: getLocale(),
        title: m.marketing_blog_tag_title({ tag: params.tag }),
        description: `${m.marketing_blog_subtitle()} · ${params.tag}`,
      },
      originFromMatches(matches),
    ),
  component: BlogTagPage,
})

/** 标签页：与列表页同一版式，分类筛选中当前标签为选中态（「全部」回到列表页） */
function BlogTagPage() {
  const { tag } = Route.useParams()
  const { posts, tags } = Route.useLoaderData()
  return (
    <MarketingShell>
      <ContentPage>
        <ContentHead title={m.marketing_blog_tag_title({ tag })} />
        <PostList posts={posts} tags={tags} activeTag={tag} />
      </ContentPage>
    </MarketingShell>
  )
}
