import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { originFromMatches, pageBrand, pageHead, staticPage } from '../features/seo/metadata.ts'
import { organizationData, websiteData } from '../features/seo/structured-data.ts'
import { easternPageCopy, easternToolHead } from '../features/tools/bazi/head.ts'
import { getNumerologyPage } from '../features/tools/numerology/content.functions.ts'
import { NUMEROLOGY_LOCALE } from '../features/tools/numerology/routes.ts'
import { faqItems, faqPageData } from '../features/tools/numerology/seo.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 东方站语言首页（openspec add-bazi-saju-chart tasks.md 2.2、3.1）：`/zh-hant` 为八字排盤、`/ko` 为만세력；
// 西方站英语首页为 Life Path Number 计算器（openspec add-numerology-tools tasks.md 2.1、design.md 决策 3），
// 原营销首页的功能等板块迁往 /pricing 与页脚；东方站根路径由 features/i18n/east-home.ts 跳到语言首页。
// 各首页均为静态文案与内容，构建期预渲染，不依赖数据库（features/marketing/prerender.ts）
const EAST_HOME_LOCALES = ['zh-Hant', 'zh-Hans', 'ko'] as const
const isEastHome = (locale: string) => (EAST_HOME_LOCALES as readonly string[]).includes(locale)

// 各语言首页工具按需加载（docs/runbooks/evidence/perf-audit）：西方站首页不下载八字 / 만세력，
// 东方站首页不下载生命灵数。loader 先预载当前语言的组件，SSR 与客户端导航都不会挂起；
// 水合时由 Suspense 保留服务端 HTML，组件就绪后再水合。
const BaziHome = lazyRouteComponent(
  () => import('../features/tools/bazi/bazi-home.tsx'),
  'BaziHome',
)
const ManseryeokHome = lazyRouteComponent(
  () => import('../features/tools/bazi/manseryeok-home.tsx'),
  'ManseryeokHome',
)
const LifePathHome = lazyRouteComponent(
  () => import('../features/tools/numerology/home.tsx'),
  'LifePathHome',
)
// 首页枢纽区块与两站样例图形（redesign-home-chart-visuals tasks 9）：同样按需加载、loader 预载，
// 静态预渲染进 HTML；东方站不下载西方站的推导图，反之亦然
const HomeHub = lazyRouteComponent(
  () => import('../features/marketing/home-hub/home-hub.tsx'),
  'HomeHub',
)
const EastSampleChart = lazyRouteComponent(
  () => import('../features/marketing/home-hub/sample-chart-east.tsx'),
  'EastSampleChart',
)
const WestSampleChart = lazyRouteComponent(
  () => import('../features/marketing/home-hub/sample-chart-west.tsx'),
  'WestSampleChart',
)
const TemplateHome = lazyRouteComponent(
  () => import('../features/marketing/template-home.tsx'),
  'TemplateHome',
)

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!templateConfig.marketing.enabled) throw redirect({ to: '/app' })
  },
  loader: async () => {
    const locale = getLocale()
    if (isEastHome(locale)) {
      await Promise.all([
        locale === 'ko' ? ManseryeokHome.preload?.() : BaziHome.preload?.(),
        HomeHub.preload?.(),
        EastSampleChart.preload?.(),
      ])
    }
    if (locale !== NUMEROLOGY_LOCALE) return null
    const [page] = await Promise.all([
      getNumerologyPage({ data: { slug: 'life-path-number' } }),
      LifePathHome.preload?.(),
      HomeHub.preload?.(),
      WestSampleChart.preload?.(),
    ])
    if (!page) await TemplateHome.preload?.()
    return page
  },
  head: ({ matches, loaderData }) => {
    if (!templateConfig.marketing.enabled) return {}
    const locale = getLocale()
    const origin = originFromMatches(matches)
    if (isEastHome(locale))
      return easternToolHead({ path: '/', locale, ...easternPageCopy('home') }, origin)
    const brand = pageBrand({ locale })
    const data = [organizationData(origin, brand), websiteData(origin, brand)]
    if (!loaderData) return pageHead(staticPage('/', locale), origin, data)
    // Title / description 与站点地图（numerologySeoPages）同用首页长文的 frontmatter
    const { title, description, faq } = loaderData
    return pageHead({ path: '/', title, description, locale: loaderData.locale }, origin, [
      ...data,
      faqPageData(faqItems(faq)),
    ])
  },
  component: IndexPage,
})

function IndexPage() {
  const locale = getLocale()
  if (locale === 'zh-Hant' || locale === 'zh-Hans')
    return (
      <MarketingShell>
        <Suspense>
          <BaziHome hub={<HomeHub sampleChart={<EastSampleChart />} />} />
        </Suspense>
      </MarketingShell>
    )
  if (locale === 'ko')
    return (
      <MarketingShell>
        <Suspense>
          <ManseryeokHome hub={<HomeHub sampleChart={<EastSampleChart />} />} />
        </Suspense>
      </MarketingShell>
    )
  return <HomePage />
}

function HomePage() {
  const content = Route.useLoaderData()
  return (
    <MarketingShell>
      <Suspense>
        {content ? (
          <LifePathHome content={content} hub={<HomeHub sampleChart={<WestSampleChart />} />} />
        ) : (
          <TemplateHome />
        )}
      </Suspense>
      <p data-testid="version" className="sr-only">
        v{__APP_VERSION__}
      </p>
    </MarketingShell>
  )
}
