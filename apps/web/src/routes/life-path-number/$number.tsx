import { createFileRoute, notFound } from '@tanstack/react-router'
import { breadcrumbData } from '../../features/seo/structured-data.ts'
import { Breadcrumb } from '../../features/tools/breadcrumb.tsx'
import { exampleDateFor } from '../../features/tools/numerology/calc.ts'
import { getNumerologyPage } from '../../features/tools/numerology/content.functions.ts'
import { NumerologyContentPage } from '../../features/tools/numerology/content-page.tsx'
import { LifePathCalculator } from '../../features/tools/numerology/life-path-calculator.tsx'
import {
  LIFE_PATH_NUMBERS,
  LIFE_PATH_TOOL_PATH,
  lifePathPath,
  NUMEROLOGY_LOCALE,
} from '../../features/tools/numerology/routes.ts'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocale,
} from '../../features/tools/numerology/seo.ts'
import { toolHref } from '../../features/tools/tool-href.ts'
import { m } from '../../paraglide/messages.js'

// 12 个生命灵数页（openspec add-numerology-tools tasks.md 2.3）：正文见 content/numerology/en/life-path-<n>.mdx。
// 父页为 Life Path 工具页 `/life-path-number`（openspec separate-landing-homepage design.md D1、D3）：
// 可见面包屑「Home › Life Path Number › n」与 head 中的 BreadcrumbList 同一组层级。
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
          [
            breadcrumbData(
              [
                { name: m.marketing_nav_home(), path: '/' },
                { name: m.numerology_number_life_path(), path: LIFE_PATH_TOOL_PATH },
                { name: params.number, path: lifePathPath(Number(params.number)) },
              ],
              NUMEROLOGY_LOCALE,
            ),
          ],
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
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: toolHref('/', NUMEROLOGY_LOCALE) },
            {
              name: m.numerology_number_life_path(),
              href: toolHref(LIFE_PATH_TOOL_PATH, NUMEROLOGY_LOCALE),
            },
            { name: String(content.number) },
          ]}
        />
      }
      calculator={<LifePathCalculator example={exampleDateFor(Number(content.number))} />}
    />
  )
}
