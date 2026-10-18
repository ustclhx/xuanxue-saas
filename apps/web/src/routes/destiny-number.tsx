import { createFileRoute } from '@tanstack/react-router'
import { getNumerologyPage } from '../features/tools/numerology/content.functions.ts'
import { NumerologyContentPage } from '../features/tools/numerology/content-page.tsx'
import { NameCalculator } from '../features/tools/numerology/name-calculator.tsx'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocale,
} from '../features/tools/numerology/seo.ts'

// 枢纽页（openspec add-numerology-tools tasks.md 2.3）：正文见 content/numerology/en/destiny-number.mdx
export const Route = createFileRoute('/destiny-number')({
  beforeLoad: requireNumerologyLocale,
  loader: () => getNumerologyPage({ data: { slug: 'destiny-number' } }),
  head: ({ loaderData, matches }) =>
    loaderData
      ? numerologyHead(
          { path: '/destiny-number', ...loaderData },
          matches,
          faqItems(loaderData.faq),
        )
      : {},
  component: () => (
    <NumerologyContentPage
      tool="destiny-number"
      content={Route.useLoaderData()}
      calculator={<NameCalculator focus="expression" />}
    />
  ),
})
