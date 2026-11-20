import { createFileRoute } from '@tanstack/react-router'
import { toolFaq } from '../features/tools/numerology/copy.ts'
import { NameCalculator } from '../features/tools/numerology/name-calculator.tsx'
import { NUMEROLOGY_TOOLS } from '../features/tools/numerology/routes.ts'
import { numerologyHead, requireNumerologyLocale } from '../features/tools/numerology/seo.ts'
import { NumerologyToolPage } from '../features/tools/numerology/tool-route-page.tsx'
import { m } from '../paraglide/messages.js'

// 姓名数字（openspec add-numerology-tools tasks.md 2.2），只在西方站英语下提供
export const Route = createFileRoute('/name-numerology')({
  beforeLoad: requireNumerologyLocale,
  head: ({ matches }) =>
    numerologyHead(NUMEROLOGY_TOOLS['name-numerology'], matches, toolFaq('name-numerology')),
  component: () => (
    <NumerologyToolPage
      id="name-numerology"
      title={m.numerology_name_title()}
      intro={m.numerology_name_intro()}
    >
      <NameCalculator />
    </NumerologyToolPage>
  ),
})
