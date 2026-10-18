import { createFileRoute, notFound } from '@tanstack/react-router'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { originFromMatches } from '../../features/seo/metadata.ts'
import { ConceptPage } from '../../features/tools/bazi/concept-page.tsx'
import { getConceptPage } from '../../features/tools/bazi/concepts.functions.ts'
import { conceptHead } from '../../features/tools/bazi/concepts.ts'
import { getLocale } from '../../paraglide/runtime.js'

export const Route = createFileRoute('/사주/$slug')({
  beforeLoad: () => {
    if (getLocale() !== 'ko') throw notFound()
  },
  loader: ({ params }) => getConceptPage({ data: { locale: 'ko', slug: params.slug } }),
  head: ({ loaderData, matches }) =>
    loaderData ? conceptHead(loaderData, originFromMatches(matches)) : {},
  component: ConceptRoute,
})

function ConceptRoute() {
  const page = Route.useLoaderData()
  return (
    <MarketingShell>
      <ConceptPage key={page.conceptKey} page={page} />
    </MarketingShell>
  )
}
