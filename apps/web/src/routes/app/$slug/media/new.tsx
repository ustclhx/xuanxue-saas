import { createFileRoute } from '@tanstack/react-router'
import { getMediaSubmitPage } from '../../../../features/ai-media/page.functions.ts'
import { MediaSubmitPage } from '../../../../features/ai-media/page.tsx'
import { siteTitle } from '../../../../features/seo/site-title.ts'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/media/new')({
  loader: ({ params }) => getMediaSubmitPage({ data: { slug: params.slug } }),
  staleTime: 0,
  head: ({ matches }) => ({ meta: [{ title: siteTitle(m.media_title(), matches) }] }),
  component: MediaPage,
})

function MediaPage() {
  const page = Route.useLoaderData()
  return <MediaSubmitPage key={page.workspaceId} page={page} />
}
