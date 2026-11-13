import { lifePath } from '@xuanxue/numerology'
import { LifePathChart } from '../../tools/charts/life-path-chart.tsx'
import { SAMPLE_BIRTH_DATE } from '../../tools/charts/samples.ts'

/** 西方站首页样例推导图（tasks 9.3）：虚构生日 1990-05-15 → Life Path 3，静态预渲染 */
export function WestSampleChart() {
  return <LifePathChart result={lifePath(SAMPLE_BIRTH_DATE)} date={SAMPLE_BIRTH_DATE} />
}
