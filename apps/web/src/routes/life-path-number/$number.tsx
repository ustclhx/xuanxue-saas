import { createFileRoute, notFound } from '@tanstack/react-router'
import { exampleDateFor } from '../../features/tools/numerology/calc.ts'
import { getNumerologyPage } from '../../features/tools/numerology/content.functions.ts'
import { NumerologyContentPage } from '../../features/tools/numerology/content-page.tsx'
import { LifePathCalculator } from '../../features/tools/numerology/life-path-calculator.tsx'
import { LIFE_PATH_NUMBERS, lifePathPath } from '../../features/tools/numerology/routes.ts'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocale,
} from '../../features/tools/numerology/seo.ts'

// 12 个生命灵数页（openspec add-numerology-tools tasks.md 2.3）：正文见 content/numerology/en/life-path-<n>.mdx
export const Route = createFileRoute('/life-path-number/$number')({
  beforeLoad: ({ params }) => {
    requireNumerologyLocale()
    if (!LIFE_PATH_NUMBERS.map(String).includes(params.number)) throw notFound()
  },
  loader: ({ params }) => getNumerologyPage({ data: { slug: `life-path-${params.number}` } }),
  head: ({ loaderData, params, matches }) =>
    loaderData
      ? numerologyHead(
          { path: lifePathPath(Number(params.number)), ...loaderData },
          matches,
          faqItems(loaderData.faq),
        )
      : {},
  component: LifePathNumberPage,
})

function LifePathNumberPage() {
  const content = Route.useLoaderData()
  return (
    <NumerologyContentPage
      tool={content.slug}
      content={content}
      calculator={<LifePathCalculator example={exampleDateFor(Number(content.number))} />}
    />
  )
}
