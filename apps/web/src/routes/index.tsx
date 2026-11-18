import { createFileRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import {
  absoluteUrl,
  localizedPath,
  originFromMatches,
  pageBrand,
  pageHead,
  staticPage,
} from '../features/seo/metadata.ts'
import { localeOrigin } from '../features/seo/origins.ts'
import { organizationData, websiteData } from '../features/seo/structured-data.ts'
import { legacyHashRedirectScript } from '../features/site/gate.ts'
import { siteOfLocale } from '../features/site/site.ts'
import { mainToolHref } from '../features/tools/tool-href.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 两站语言首页：品牌落地页（openspec separate-landing-homepage design.md D2，specs/home-hub「品牌落地页结构」）。
// 东方站 `/zh-hant`、`/zh-hans`、`/ko` 与西方站 `/` 同一组件，按站点换样例与插画；东方站根路径由
// features/i18n/east-home.ts 跳到语言首页。工具（八字排盤 / 만세력 / Life Path Number）在各自的关键词 URL
// （routes/$slug.tsx、routes/life-path-number/index.tsx），首页不含工具表单，也不加载工具代码与内容集合。
// 首页为静态文案，构建期预渲染，不依赖数据库（features/marketing/prerender.ts）。

// 落地页与两站样例按需加载：loader 先预载当前站点的组件，SSR 与客户端导航都不会挂起；
// 水合时由 Suspense 保留服务端 HTML，组件就绪后再水合。东方站不下载西方站的样例，反之亦然。
const LandingPage = lazyRouteComponent(
  () => import('../features/marketing/home-hub/landing-page.tsx'),
  'LandingPage',
)
const EastSampleChart = lazyRouteComponent(
  () => import('../features/marketing/home-hub/sample-chart-east.tsx'),
  'EastSampleChart',
)
const WestSampleChart = lazyRouteComponent(
  () => import('../features/marketing/home-hub/sample-chart-west.tsx'),
  'WestSampleChart',
)

const isEastLocale = (locale: string) => siteOfLocale(locale, templateConfig) === 'east'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!templateConfig.marketing.enabled) throw redirect({ to: '/app' })
  },
  loader: async () => {
    await Promise.all([
      LandingPage.preload?.(),
      isEastLocale(getLocale()) ? EastSampleChart.preload?.() : WestSampleChart.preload?.(),
    ])
    return null
  },
  head: ({ matches }) => {
    if (!templateConfig.marketing.enabled) return {}
    const locale = getLocale()
    const origin = originFromMatches(matches)
    // 两站首页同为品牌 head（openspec separate-landing-homepage design.md D3）：品牌标题、Organization 与 WebSite；
    // 工具的 Title、FAQPage 等随工具迁到主工具页（routes/$slug.tsx、routes/life-path-number/index.tsx）
    const brand = pageBrand({ locale })
    // 结构化数据用语言所属站点的 origin（与 pageHead 的 canonical 相同）；WebSite 的地址为本页 canonical
    const siteOrigin = localeOrigin(locale)
    const head = pageHead(staticPage('/', locale), origin, [
      organizationData(siteOrigin, brand),
      websiteData(siteOrigin, brand, absoluteUrl(siteOrigin, localizedPath('/', locale))),
    ])
    return {
      ...head,
      scripts: [
        // 旧分享链接 `<语言首页>#r=…`（design.md D4）：首帧前替换到本语言主工具页并保留片段。
        // 工具页地址在构建期写入脚本，不依赖水合；只在落地页输出
        { children: legacyHashRedirectScript(mainToolHref(locale)) },
        ...head.scripts,
      ],
    }
  },
  component: IndexPage,
})

function IndexPage() {
  const east = isEastLocale(getLocale())
  return (
    <MarketingShell>
      <Suspense>
        {/* 首屏插画（refresh-visual-system-warm 第 5 组的 features/illustrations/）合并后经 art 传入；
            在此之前 LandingHero 保留同样大小的空位，换入插画不引起布局位移 */}
        <LandingPage sampleChart={east ? <EastSampleChart /> : <WestSampleChart />} />
      </Suspense>
      {/* 页面版本标记：对读屏以外不可见，核对部署版本时使用（tasks.md 4.1 要求保留） */}
      <p data-testid="version" className="sr-only">
        v{__APP_VERSION__}
      </p>
    </MarketingShell>
  )
}
