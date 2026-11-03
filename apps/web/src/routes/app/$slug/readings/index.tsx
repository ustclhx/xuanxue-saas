import { createFileRoute } from '@tanstack/react-router'
import {
  getReadingPricing,
  listReadings,
} from '../../../../features/readings/readings.functions.ts'
import { ReadingsListPage } from '../../../../features/readings/report-page.tsx'
import { m } from '../../../../paraglide/messages.js'
import { getLocale } from '../../../../paraglide/runtime.js'

export const Route = createFileRoute('/app/$slug/readings/')({
  loader: async ({ params }) => {
    const page = await listReadings({ data: { slug: params.slug } })
    // 只有空列表需要判断能否解锁；读取失败时不承诺可解锁
    const unlockable =
      page.items.length === 0
        ? await getReadingPricing({ data: { locale: getLocale() } })
            .then((pricing) => pricing.readings.length > 0)
            .catch(() => false)
        : true
    return { page, unlockable }
  },
  staleTime: 0,
  head: () => ({
    meta: [{ title: m.readings_list_title() }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: ReadingsPage,
})

function ReadingsPage() {
  const { page, unlockable } = Route.useLoaderData()
  const { slug } = Route.useParams()
  return <ReadingsListPage key={slug} slug={slug} initial={page} unlockable={unlockable} />
}
