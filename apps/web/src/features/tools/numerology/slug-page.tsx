import { Suspense } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { ChartCalculator } from './chart.tsx'
import { CompatibilityCalculator } from './compatibility.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { NumerologyContentPage } from './content-page.tsx'
import { FullCalculator } from './full-calculator.tsx'
import { LifePathHome } from './home.tsx'
import { NameCalculator } from './name-calculator.tsx'
import type { NumerologyPageId } from './routes.ts'
import { NumerologyToolPage } from './tool-route-page.tsx'

/**
 * 本地化路径的数字命理单段页面（`/es/numero-de-vida`、`/es/calculadora-numerologia` 等，add-locales-eu-ja 决策 2）
 * 由 routes/$slug.tsx 统一承接，避免每种语言每个页面一个路由文件进入首页脚本（首页包预算，决策 11）。
 * 组件与英文路由文件相同；本模块只经 $slug 的懒加载组件引用，不进首页闭包。
 */
export function NumerologySlugPage({
  id,
  content,
}: {
  id: NumerologyPageId
  content: NumerologyPage | null
}) {
  switch (id) {
    case 'life-path':
      return content ? (
        <MarketingShell>
          <Suspense>
            <LifePathHome content={content} />
          </Suspense>
        </MarketingShell>
      ) : null
    case 'destiny-number':
      return content ? (
        <NumerologyContentPage
          tool="destiny-number"
          content={content}
          calculator={<NameCalculator focus="expression" example="Ximena Ibáñez Robles" />}
        />
      ) : null
    case 'soul-urge-number':
      return content ? (
        <NumerologyContentPage
          tool="soul-urge-number"
          content={content}
          calculator={<NameCalculator focus="soulUrge" example="Mariana Cuéllar Ortiz" />}
        />
      ) : null
    case 'numerology-calculator':
      return (
        <NumerologyToolPage
          id={id}
          title={m.numerology_calc_title()}
          intro={m.numerology_calc_intro()}
        >
          <FullCalculator />
        </NumerologyToolPage>
      )
    case 'name-numerology':
      return (
        <NumerologyToolPage
          id={id}
          title={m.numerology_name_title()}
          intro={m.numerology_name_intro()}
        >
          <NameCalculator />
        </NumerologyToolPage>
      )
    case 'life-path-compatibility':
      return (
        <NumerologyToolPage
          id={id}
          title={m.numerology_compat_title()}
          intro={m.numerology_compat_intro()}
        >
          <CompatibilityCalculator />
        </NumerologyToolPage>
      )
    case 'numerology-chart':
      return (
        <NumerologyToolPage
          id={id}
          title={m.numerology_chart_title()}
          intro={m.numerology_chart_intro()}
        >
          <ChartCalculator />
        </NumerologyToolPage>
      )
  }
}
