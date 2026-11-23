import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { siteOfLocale } from '../../features/site/site.ts'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'

// 每日运势页未登记时的落地页演示，只在本地开发服务器可用，供截图对照。
// 东方站：`http://east.localhost:<WEB_PORT>/zh-hant/dev/landing/no-daily`；西方站：`/dev/landing/no-daily`。

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
// 首屏线描插画（refresh-visual-system-warm D8）：每站一个母题，同样按站点加载
const StemWheel = lazyRouteComponent(
  () => import('../../features/illustrations/east/stem-wheel.tsx'),
  'StemWheel',
)
const NumberWheel = lazyRouteComponent(
  () => import('../../features/illustrations/west/number-wheel.tsx'),
  'NumberWheel',
)

export const Route = createFileRoute('/dev/landing/$state')({
  beforeLoad: ({ params }) => {
    if (!import.meta.env.DEV || params.state !== 'no-daily') throw notFound()
  },
  loader: async () => {
    await Promise.all([
      LandingPage.preload?.(),
      EastSampleChart.preload?.(),
      WestSampleChart.preload?.(),
      StemWheel.preload?.(),
      NumberWheel.preload?.(),
    ])
    return null
  },
  head: () => ({
    meta: [{ title: 'Landing page states' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: LandingStatePage,
})

function LandingStatePage() {
  const east = siteOfLocale(getLocale(), templateConfig) === 'east'
  return (
    <MarketingShell freeTools>
      <Suspense>
        <LandingPage
          art={east ? <StemWheel className="size-full" /> : <NumberWheel className="size-full" />}
          sampleChart={east ? <EastSampleChart /> : <WestSampleChart />}
          dailyPages={{}}
        />
      </Suspense>
    </MarketingShell>
  )
}
