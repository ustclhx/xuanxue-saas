import { createFileRoute } from '@tanstack/react-router'
import { toolFaq } from '../features/tools/numerology/copy.ts'
import { FullCalculator } from '../features/tools/numerology/full-calculator.tsx'
import { NUMEROLOGY_TOOLS } from '../features/tools/numerology/routes.ts'
import { numerologyHead, requireNumerologyLocale } from '../features/tools/numerology/seo.ts'
import { NumerologyToolPage } from '../features/tools/numerology/tool-route-page.tsx'
import { m } from '../paraglide/messages.js'

// 完整计算器（openspec add-numerology-tools tasks.md 2.2），只在西方站英语下提供
export const Route = createFileRoute('/numerology-calculator')({
  beforeLoad: requireNumerologyLocale,
  head: ({ matches }) =>
    numerologyHead(
      NUMEROLOGY_TOOLS['numerology-calculator'],
      matches,
      toolFaq('numerology-calculator'),
    ),
  component: () => (
    <NumerologyToolPage
      id="numerology-calculator"
      title={m.numerology_calc_title()}
      intro={m.numerology_calc_intro()}
    >
      <FullCalculator />
    </NumerologyToolPage>
  ),
})
