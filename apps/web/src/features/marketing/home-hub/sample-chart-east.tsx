import { getLocale } from '../../../paraglide/runtime.js'
import { PillarsChart } from '../../tools/charts/pillars-chart.tsx'
import { SAMPLE_BAZI_PILLARS } from '../../tools/charts/samples.ts'

/** 东方站首页样例命盘（tasks 9.3）：固化的虚构命盘，静态预渲染，不加载排盘引擎 */
export function EastSampleChart() {
  const locale = getLocale()
  return (
    <PillarsChart
      pillars={SAMPLE_BAZI_PILLARS}
      locale={locale === 'ko' ? 'ko' : locale === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant'}
    />
  )
}
