import { createFileRoute, notFound } from '@tanstack/react-router'
import { breadcrumbData } from '../../features/seo/structured-data.ts'
import { Breadcrumb } from '../../features/tools/breadcrumb.tsx'
import { exampleDateFor } from '../../features/tools/numerology/calc.ts'
import { getNumerologyPage } from '../../features/tools/numerology/content.functions.ts'
import { NumerologyContentPage } from '../../features/tools/numerology/content-page.tsx'
import { LifePathCalculator } from '../../features/tools/numerology/life-path-calculator.tsx'
import {
  LIFE_PATH_NUMBERS,
  localizedLifePathPath,
  numerologyPath,
} from '../../features/tools/numerology/routes.ts'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocaleOf,
} from '../../features/tools/numerology/seo.ts'
import { toolHref } from '../../features/tools/tool-href.ts'
import { m } from '../../paraglide/messages.js'

// 12 个西班牙语数字页 `/es/numero-de-vida/<n>`（add-locales-eu-ja 任务 5.2、5.4）：正文见
// content/numerology/es/life-path-<n>.mdx；父页为 `/es/numero-de-vida`，面包屑与 BreadcrumbList 同一组层级。
const LOCALE = 'es'
const PARENT = numerologyPath('life-path', LOCALE)
const requireLocale = requireNumerologyLocaleOf(LOCALE)

export const Route = createFileRoute('/numero-de-vida/$number')({
  beforeLoad: ({ params }) => {
    requireLocale()
    if (!LIFE_PATH_NUMBERS.map(String).includes(params.number)) throw notFound()
  },
  loader: ({ params }) =>
    getNumerologyPage({ data: { slug: `life-path-${params.number}`, locale: LOCALE } }),
  head: ({ loaderData, params, matches }) =>
    loaderData
      ? numerologyHead(
          { path: localizedLifePathPath(Number(params.number), LOCALE), ...loaderData },
          matches,
          faqItems(loaderData.faq),
          [
            breadcrumbData(
              [
                { name: m.marketing_nav_home(), path: '/' },
                { name: m.numerology_number_life_path(), path: PARENT },
                {
                  name: params.number,
                  path: localizedLifePathPath(Number(params.number), LOCALE),
                },
              ],
              LOCALE,
            ),
          ],
        )
      : {},
  component: NumeroDeVidaPage,
})

function NumeroDeVidaPage() {
  const content = Route.useLoaderData()
  return (
    <NumerologyContentPage
      tool={content.slug}
      content={content}
      breadcrumb={
        <Breadcrumb
          items={[
            { name: m.marketing_nav_home(), href: toolHref('/', LOCALE) },
            { name: m.numerology_number_life_path(), href: toolHref(PARENT, LOCALE) },
            { name: String(content.number) },
          ]}
        />
      }
      calculator={
        <LifePathCalculator
          example={exampleDateFor(Number(content.number), 1993)}
          current={Number(content.number)}
        />
      }
    />
  )
}
