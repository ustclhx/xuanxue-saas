import { createFileRoute } from '@tanstack/react-router'
import { listReadings } from '../../../../features/readings/readings.functions.ts'
import { ReadingsListPage } from '../../../../features/readings/report-page.tsx'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/readings/')({
  loader: ({ params }) => listReadings({ data: { slug: params.slug } }),
  staleTime: 0,
  head: () => ({
    meta: [{ title: m.readings_list_title() }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ReadingsPage,
})

function ReadingsPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  return <ReadingsListPage key={slug} slug={slug} initial={page} />
}
