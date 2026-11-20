import { createFileRoute } from '@tanstack/react-router'
import { ChartCalculator } from '../features/tools/numerology/chart.tsx'
import { toolFaq } from '../features/tools/numerology/copy.ts'
import { NUMEROLOGY_TOOLS } from '../features/tools/numerology/routes.ts'
import { numerologyHead, requireNumerologyLocale } from '../features/tools/numerology/seo.ts'
import { NumerologyToolPage } from '../features/tools/numerology/tool-route-page.tsx'
import { m } from '../paraglide/messages.js'

// 数字分布图（openspec add-numerology-tools tasks.md 2.2），只在西方站英语下提供
export const Route = createFileRoute('/numerology-chart')({
  beforeLoad: requireNumerologyLocale,
  head: ({ matches }) =>
    numerologyHead(NUMEROLOGY_TOOLS['numerology-chart'], matches, toolFaq('numerology-chart')),
  component: () => (
    <NumerologyToolPage
      id="numerology-chart"
      title={m.numerology_chart_title()}
      intro={m.numerology_chart_intro()}
    >
      <ChartCalculator />
    </NumerologyToolPage>
  ),
})
