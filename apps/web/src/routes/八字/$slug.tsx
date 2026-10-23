import { createFileRoute, notFound } from '@tanstack/react-router'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { originFromMatches } from '../../features/seo/metadata.ts'
import { eastChineseLocale } from '../../features/tools/bazi/chinese-locale.ts'
import { ConceptPage } from '../../features/tools/bazi/concept-page.tsx'
import { getConceptPage } from '../../features/tools/bazi/concepts.functions.ts'
import { conceptHead } from '../../features/tools/bazi/concepts.ts'
import { getLocale } from '../../paraglide/runtime.js'

const isEastChinese = (locale: string) => locale === 'zh-Hant' || locale === 'zh-Hans'

export const Route = createFileRoute('/八字/$slug')({
  beforeLoad: () => {
    if (!isEastChinese(getLocale())) throw notFound()
  },
  loader: ({ params }) =>
    getConceptPage({ data: { locale: eastChineseLocale(), slug: params.slug } }),
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
