import { createFileRoute } from '@tanstack/react-router'
import { BlogIndex } from '../../features/marketing/blog/index-page.tsx'
import { getBlogIndex } from '../../features/marketing/content.functions.ts'
import { originFromMatches, pageHead, staticPage } from '../../features/seo/metadata.ts'
import { getLocale } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/blog/')({
  loader: () => getBlogIndex({ data: { locale: getLocale() } }),
  head: ({ matches }) => pageHead(staticPage('/blog', getLocale()), originFromMatches(matches)),
  component: BlogIndexPage,
})

function BlogIndexPage() {
  return <BlogIndex {...Route.useLoaderData()} />
}
