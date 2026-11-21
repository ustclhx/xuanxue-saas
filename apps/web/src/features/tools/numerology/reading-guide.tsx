import { m } from '../../../paraglide/messages.js'
import { ReadingGuide } from '../reading-guide.tsx'
import { numerologyHref } from './href.ts'

/** 姓名类与配对结果没有对应详批：引导到可以解锁数字命理详批的完整计算器 */
export function NumerologyReadingGuide() {
  return (
    <ReadingGuide
      kind="numerology-full"
      body={m.funnel_guide_numerology()}
      to={{
        href: numerologyHref('numerology-calculator'),
        label: m.funnel_guide_numerology_cta(),
        target: 'numerology-calculator',
      }}
    />
  )
}
