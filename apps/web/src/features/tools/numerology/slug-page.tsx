import { Suspense } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { Breadcrumb } from '../breadcrumb.tsx'
import { toolHref } from '../tool-href.ts'
import { ChartCalculator } from './chart.tsx'
import { CompatibilityCalculator } from './compatibility.tsx'
import type { NumerologyPage } from './content.functions.ts'
import { NumerologyContentPage } from './content-page.tsx'
import { FullCalculator } from './full-calculator.tsx'
import { LifePathHome } from './home.tsx'
import { numerologyLocale } from './href.ts'
import { LifePathCalculator } from './life-path-calculator.tsx'
import { NameCalculator } from './name-calculator.tsx'
import { NUMEROLOGY_INTRO_MAIN, type NumerologyPageId } from './routes.ts'
import { NumerologyToolPage } from './tool-route-page.tsx'

/**
 * 本地化路径的数字命理单段页面（`/es/numero-de-vida`、`/es/calculadora-numerologia` 等，add-locales-eu-ja 决策 2）
 * 与两种语言的入门页（`/numerology`、`/es/numerologia`，content-growth-phase1 决策 7）
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
    case 'numerology':
      // 入门页（content-growth-phase1 决策 7）：枢纽页版式，首屏内嵌 Life Path 计算器（默认样例日期），
      // 面包屑「首页 › 主词」与 head 的 BreadcrumbList 一致
      return content ? (
        <NumerologyContentPage
          tool="numerology"
          content={content}
          breadcrumb={<IntroBreadcrumb />}
          calculator={<LifePathCalculator example={INTRO_EXAMPLE} />}
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

/**
 * 入门页计算器的样例日期：1997-12-22 → 3 + 22 + 8 = 33（日与总数都是大师数，样例卡带「大师数」标记，同设计稿初始态）。
 * 不用工具页的默认样例（→ 11）：样例卡会链接到对应数字页，`/life-path-number/11` 与 `/es/numero-de-vida/11` 的入链
 * 已到 4 条，再加一条同名锚文本会使 top1 占比超过 70%（audit:seo anchor-top-share）。
 */
const INTRO_EXAMPLE = { year: 1997, month: 12, day: 22 } as const

function IntroBreadcrumb() {
  const locale = numerologyLocale()
  return (
    <Breadcrumb
      items={[
        { name: m.marketing_nav_home(), href: toolHref('/', locale) },
        { name: NUMEROLOGY_INTRO_MAIN[locale] },
      ]}
    />
  )
}
