import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import type { PricingCatalog } from '../../features/marketing/pricing-data.ts'
import { siteOfLocale } from '../../features/site/site.ts'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'

// 落地页异常态的演示（openspec separate-landing-homepage design.md D8a），只在本地开发服务器可用，供截图对照：
// - `/dev/landing/no-daily`：每日运势页未登记 → 不渲染今日条；
// - `/dev/landing/no-plan`：当前语言没有可购买的方案 → 一行价格只写免费说明。
// - `/dev/landing/priced`：有可购买方案的正常态（开发服务器的价格快照是不可购买的仓库示例，首页因此显示免费说明）。
// 东方站：`http://east.localhost:<WEB_PORT>/zh-hant/dev/landing/no-daily`；西方站：`/dev/landing/no-daily`。
const STATES = ['no-daily', 'no-plan', 'priced'] as const
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
// 首屏线描插画（refresh-visual-system-warm D8）：每站一个母题，同样按站点加载
const StemWheel = lazyRouteComponent(
  () => import('../../features/illustrations/east/stem-wheel.tsx'),
  'StemWheel',
)
const NumberWheel = lazyRouteComponent(
  () => import('../../features/illustrations/west/number-wheel.tsx'),
  'NumberWheel',
)

/** 演示用目录：一个可购买的积分包，只为让一行价格显示积分数；金额不在首页显示 */
const PRICED: PricingCatalog = {
  plans: [
    {
      id: 'demo',
      key: 'reading_single',
      name: 'Single',
      type: 'credit_pack',
      credits: 100,
      creditExpiryDays: 365,
      features: {},
    },
  ],
  prices: (['USD', 'TWD', 'KRW'] as const).map((currency) => ({
    id: `demo-${currency}`,
    planId: 'demo',
    provider: 'stripe',
    interval: null,
    amount: 199,
    currency,
    active: true,
    available: true,
  })),
  providers: [{ id: 'stripe', available: true }],
} as unknown as PricingCatalog

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
  const state = Route.useParams().state as State
  const east = siteOfLocale(getLocale(), templateConfig) === 'east'
  return (
    <MarketingShell>
      <Suspense>
        <LandingPage
          art={east ? <StemWheel className="size-full" /> : <NumberWheel className="size-full" />}
          sampleChart={east ? <EastSampleChart /> : <WestSampleChart />}
          {...(state === 'no-daily' ? { dailyPages: {} } : {})}
          {...(state === 'no-plan' ? { catalog: { plans: [], prices: [], providers: [] } } : {})}
          {...(state === 'priced' ? { catalog: PRICED } : {})}
        />
      </Suspense>
    </MarketingShell>
  )
}
