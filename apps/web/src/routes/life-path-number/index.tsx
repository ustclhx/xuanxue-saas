import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MarketingShell } from '../../features/marketing/marketing-shell.tsx'
import { breadcrumbData, webApplicationData } from '../../features/seo/structured-data.ts'
import { getNumerologyPage } from '../../features/tools/numerology/content.functions.ts'
import { LIFE_PATH_TOOL_PATH, NUMEROLOGY_LOCALE } from '../../features/tools/numerology/routes.ts'
import {
  faqItems,
  numerologyHead,
  requireNumerologyLocale,
} from '../../features/tools/numerology/seo.ts'
import { m } from '../../paraglide/messages.js'

// Life Path Number 计算器（openspec separate-landing-homepage design.md D1、D3）：迁移前在西方站首页，
// Title / description / H1、说明长文与 FAQ 原样迁到这里（长文与 FAQ 在结果之后）；首页改为品牌落地页。
// 正文见 content/numerology/en/life-path-number.mdx，缺失时返回 404。
// 组件按需加载：与 routes/index.tsx 共用同一个分包，loader 先预载，SSR 与客户端导航都不会挂起。
const LifePathHome = lazyRouteComponent(
  () => import('../../features/tools/numerology/home.tsx'),
  'LifePathHome',
)

export const Route = createFileRoute('/life-path-number/')({
  beforeLoad: requireNumerologyLocale,
  loader: async () => {
    const [page] = await Promise.all([
      getNumerologyPage({ data: { slug: 'life-path-number' } }),
      LifePathHome.preload?.(),
    ])
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, matches }) => {
    if (!loaderData) return {}
    const page = {
      path: LIFE_PATH_TOOL_PATH,
      locale: NUMEROLOGY_LOCALE,
      title: loaderData.title,
      description: loaderData.description,
    }
    // FAQPage 的问答与页面上可见的 FAQ 同为长文 frontmatter
    return numerologyHead(page, matches, faqItems(loaderData.faq), [
      webApplicationData(page, m.numerology_home_title()),
      breadcrumbData(
        [
          { name: m.marketing_nav_home(), path: '/' },
          { name: m.numerology_number_life_path(), path: LIFE_PATH_TOOL_PATH },
        ],
        NUMEROLOGY_LOCALE,
      ),
    ])
  },
  component: LifePathToolPage,
})

function LifePathToolPage() {
  const content = Route.useLoaderData()
  return (
    <MarketingShell>
      <Suspense>
        <LifePathHome content={content} />
      </Suspense>
    </MarketingShell>
  )
}
