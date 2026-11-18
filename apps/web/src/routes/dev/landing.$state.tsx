import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { siteOfLocale } from '../../features/site/site.ts'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'

// 落地页异常态的演示（openspec separate-landing-homepage design.md D8a），只在本地开发服务器可用，供截图对照：
// - `/dev/landing/no-daily`：每日运势页未登记 → 不渲染今日条；
// - `/dev/landing/no-plan`：当前语言没有可购买的方案 → 一行价格只写免费说明。
// 东方站：`http://east.localhost:<WEB_PORT>/zh-hant/dev/landing/no-daily`；西方站：`/dev/landing/no-daily`。
const STATES = ['no-daily', 'no-plan'] as const
type State = (typeof STATES)[number]

const LandingPage = lazyRouteComponent(
  () => import('../../features/marketing/home-hub/landing-page.tsx'),
  'LandingPage',
)
const EastSampleChart = lazyRouteComponent(
  () => import('../../features/marketing/home-hub/sample-chart-east.tsx'),
  'EastSampleChart',
)
const WestSampleChart = lazyRouteComponent(
  () => import('../../features/marketing/home-hub/sample-chart-west.tsx'),
  'WestSampleChart',
)

export const Route = createFileRoute('/dev/landing/$state')({
  beforeLoad: ({ params }) => {
    if (!import.meta.env.DEV || !(STATES as readonly string[]).includes(params.state))
      throw notFound()
  },
  loader: async () => {
    await Promise.all([
      LandingPage.preload?.(),
      EastSampleChart.preload?.(),
      WestSampleChart.preload?.(),
    ])
    return null
  },
  head: () => ({
    meta: [{ title: 'Landing page states' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: LandingStatePage,
})

function LandingStatePage() {
  const state = Route.useParams().state as State
  const east = siteOfLocale(getLocale(), templateConfig) === 'east'
  return (
    <MarketingShell>
      <Suspense>
        <LandingPage
          sampleChart={east ? <EastSampleChart /> : <WestSampleChart />}
          {...(state === 'no-daily' ? { dailyPages: {} } : {})}
          {...(state === 'no-plan' ? { catalog: { plans: [], prices: [], providers: [] } } : {})}
        />
      </Suspense>
    </MarketingShell>
  )
}
