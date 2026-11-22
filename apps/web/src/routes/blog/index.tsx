import { createFileRoute } from '@tanstack/react-router'
import { BlogIndex } from '../../features/marketing/blog/index-page.tsx'
import { getBlogIndex } from '../../features/marketing/content.functions.ts'
import { originFromMatches, pageHead, staticPage } from '../../features/seo/metadata.ts'
import { getLocale } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/blog/')({
  loader: () => getBlogIndex({ data: { locale: getLocale() } }),
  head: ({ loaderData, matches }) => {
    const head = pageHead(staticPage('/blog', getLocale()), originFromMatches(matches))
    // 该语言没有已发布文章时（草稿与未到发布日期的不计）列表页是空壳：不进索引，链接照常跟随；
    // 站点地图与页脚同样按语言隐藏（features/seo/pages.ts、site-footer.tsx），发布第一篇后自动恢复
    if (loaderData && loaderData.posts.length > 0) return head
    return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, follow' }] }
  },
  component: BlogIndexPage,
})

function BlogIndexPage() {
  return <BlogIndex {...Route.useLoaderData()} />
}
