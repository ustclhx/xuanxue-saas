import { createFileRoute } from '@tanstack/react-router'
import { getNumerologyPage } from '../features/tools/numerology/content.functions.ts'
import { NumerologyContentPage } from '../features/tools/numerology/content-page.tsx'
import { NameCalculator } from '../features/tools/numerology/name-calculator.tsx'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocale,
} from '../features/tools/numerology/seo.ts'

// 枢纽页（openspec add-numerology-tools tasks.md 2.3）：正文见 content/numerology/en/soul-urge-number.mdx
export const Route = createFileRoute('/soul-urge-number')({
  beforeLoad: requireNumerologyLocale,
  loader: () => getNumerologyPage({ data: { slug: 'soul-urge-number' } }),
  head: ({ loaderData, matches }) =>
    loaderData
      ? numerologyHead(
          { path: '/soul-urge-number', ...loaderData },
          matches,
          faqItems(loaderData.faq),
        )
      : {},
  component: () => (
    <NumerologyContentPage
      tool="soul-urge-number"
      content={Route.useLoaderData()}
      calculator={<NameCalculator focus="soulUrge" />}
    />
  ),
})
