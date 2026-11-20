import { createFileRoute, notFound } from '@tanstack/react-router'
import { BlogIndex } from '../../../features/marketing/blog/index-page.tsx'
import { getBlogIndex } from '../../../features/marketing/content.functions.ts'
import { originFromMatches, pageHead, staticPage } from '../../../features/seo/metadata.ts'
import { getLocale } from '../../../paraglide/runtime.js'

// 博客列表第 2 页起（设计稿 warm-refresh/BlogList.dc.html 的分页）。第 1 页只在 /blog，
// 这里的 1 与非数字一律 404，避免同一内容出现在两个地址；页码超出范围由 getBlogIndex 回 404。
// 预渲染的静态 HTML 按路径匹配并丢弃查询串（features/site/static-pages.ts），所以分页用路径而不是 ?page=。
export const Route = createFileRoute('/blog/page/$page')({
  loader: ({ params }) => {
    if (!/^[1-9]\d{0,3}$/.test(params.page) || params.page === '1') throw notFound()
    return getBlogIndex({ data: { locale: getLocale(), page: Number(params.page) } })
  },
  head: ({ params, matches }) => {
    const head = pageHead(
      { ...staticPage('/blog', getLocale()), path: `/blog/page/${params.page}` },
      originFromMatches(matches),
    )
    // 分页与第 1 页同标题同描述：不进索引，文章本身经站点地图与列表链接被发现
    return { ...head, meta: [...head.meta, { name: 'robots', content: 'noindex, follow' }] }
  },
  component: BlogPagedPage,
})

function BlogPagedPage() {
  return <BlogIndex {...Route.useLoaderData()} />
}
