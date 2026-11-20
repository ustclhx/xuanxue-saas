import { createFileRoute } from '@tanstack/react-router'
import { CompatibilityCalculator } from '../features/tools/numerology/compatibility.tsx'
import { toolFaq } from '../features/tools/numerology/copy.ts'
import { getNumerologyToolGuide } from '../features/tools/numerology/guide.functions.ts'
import { NUMEROLOGY_TOOLS } from '../features/tools/numerology/routes.ts'
import { numerologyHead, requireNumerologyLocale } from '../features/tools/numerology/seo.ts'
import { NumerologyToolPage } from '../features/tools/numerology/tool-route-page.tsx'
import { m } from '../paraglide/messages.js'

// 生命灵数相性（openspec add-numerology-tools tasks.md 2.2），只在西方站英语下提供
export const Route = createFileRoute('/life-path-compatibility')({
  beforeLoad: requireNumerologyLocale,
  loader: () => getNumerologyToolGuide({ data: { id: 'life-path-compatibility' } }),
  head: ({ loaderData, matches }) =>
    numerologyHead(NUMEROLOGY_TOOLS['life-path-compatibility'], matches, [
      ...toolFaq('life-path-compatibility'),
      ...(loaderData?.faq ?? []),
    ]),
  component: () => (
    <NumerologyToolPage
      id="life-path-compatibility"
      title={m.numerology_compat_title()}
      intro={m.numerology_compat_intro()}
      guide={Route.useLoaderData()}
    >
      <CompatibilityCalculator />
    </NumerologyToolPage>
  ),
})
