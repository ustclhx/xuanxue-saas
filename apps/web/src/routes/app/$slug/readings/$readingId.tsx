import { createFileRoute, Link } from '@tanstack/react-router'
import { getReading } from '../../../../features/readings/readings.functions.ts'
import { ReadingReportPage } from '../../../../features/readings/report-page.tsx'
import { readingTitle } from '../../../../features/readings/unlock-card.tsx'
import { m } from '../../../../paraglide/messages.js'

export const Route = createFileRoute('/app/$slug/readings/$readingId')({
  loader: ({ params }) => getReading({ data: { slug: params.slug, id: params.readingId } }),
  staleTime: 0,
  // 报告含个人命盘解读：不进索引（specs/paid-readings「报告保存与查看」）
  head: ({ loaderData }) => ({
    meta: [
      ...(loaderData ? [{ title: readingTitle(loaderData.kind) }] : []),
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ReportPage,
  notFoundComponent: () => {
    const { slug } = Route.useParams()
    return (
      <section className="grid gap-2">
        <h2 className="text-2xl font-semibold">{m.app_workspace_not_found()}</h2>
        <Link to="/app/$slug/readings" params={{ slug }} className="underline">
          {m.readings_report_back()}
        </Link>
      </section>
    )
  },
})

function ReportPage() {
  const view = Route.useLoaderData()
  const { slug } = Route.useParams()
  return <ReadingReportPage key={view.id} slug={slug} initial={view} />
}
