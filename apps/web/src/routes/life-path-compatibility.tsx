import { createFileRoute } from '@tanstack/react-router'
import { CompatibilityCalculator } from '../features/tools/numerology/compatibility.tsx'
import { toolFaq } from '../features/tools/numerology/copy.ts'
import { NUMEROLOGY_TOOLS } from '../features/tools/numerology/routes.ts'
import { numerologyHead, requireNumerologyLocale } from '../features/tools/numerology/seo.ts'
import { NumerologyToolPage } from '../features/tools/numerology/tool-route-page.tsx'
import { m } from '../paraglide/messages.js'

// 生命灵数相性（openspec add-numerology-tools tasks.md 2.2），只在西方站英语下提供
export const Route = createFileRoute('/life-path-compatibility')({
  beforeLoad: requireNumerologyLocale,
  head: ({ matches }) =>
    numerologyHead(
      NUMEROLOGY_TOOLS['life-path-compatibility'],
      matches,
      toolFaq('life-path-compatibility'),
    ),
  component: () => (
    <NumerologyToolPage
      id="life-path-compatibility"
      title={m.numerology_compat_title()}
      intro={m.numerology_compat_intro()}
    >
      <CompatibilityCalculator />
    </NumerologyToolPage>
  ),
})
