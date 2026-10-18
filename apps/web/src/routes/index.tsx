import { createFileRoute, redirect } from '@tanstack/react-router'
import { GrowthForm } from '../features/growth/forms.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'
import { placeholderPlans } from '../features/marketing/pricing-placeholder.ts'
import { Cta } from '../features/marketing/sections/cta.tsx'
import { Faq } from '../features/marketing/sections/faq.tsx'
import { Features } from '../features/marketing/sections/features.tsx'
import { Hero } from '../features/marketing/sections/hero.tsx'
import { Pricing } from '../features/marketing/sections/pricing.tsx'
import { Testimonials } from '../features/marketing/sections/testimonials.tsx'
import { eastEntryPage, originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { seoSiteOrigin } from '../features/seo/origins.ts'
import { organizationData, websiteData } from '../features/seo/structured-data.ts'
import { useSiteId } from '../features/site/context.tsx'
import { EastEntry } from '../features/site/east-entry.tsx'
import { BaziHome } from '../features/tools/bazi/bazi-home.tsx'
import { easternPageCopy, easternToolHead } from '../features/tools/bazi/head.ts'
import { ManseryeokHome } from '../features/tools/bazi/manseryeok-home.tsx'
import { getNumerologyPage } from '../features/tools/numerology/content.functions.ts'
import { LifePathHome } from '../features/tools/numerology/home.tsx'
import { NUMEROLOGY_LOCALE } from '../features/tools/numerology/routes.ts'
import { faqItems, faqPageData } from '../features/tools/numerology/seo.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 东方站语言首页（openspec add-bazi-saju-chart tasks.md 2.2、3.1）：`/zh-hant` 为八字排盤、`/ko` 为만세력；
// 西方站英语首页为 Life Path Number 计算器（openspec add-numerology-tools tasks.md 2.1、design.md 决策 3），
// 原营销首页的功能等板块迁往 /pricing 与页脚；东方站根路径为语言入口页。
// 各首页均为静态文案与内容，构建期预渲染，不依赖数据库（features/marketing/prerender.ts）
const EAST_HOME_LOCALES = ['zh-Hant', 'ko'] as const
const isEastHome = (locale: string) => (EAST_HOME_LOCALES as readonly string[]).includes(locale)

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!templateConfig.marketing.enabled) throw redirect({ to: '/app' })
  },
  loader: () =>
    getLocale() === NUMEROLOGY_LOCALE
      ? getNumerologyPage({ data: { slug: 'life-path-number' } })
      : null,
  head: ({ matches, loaderData }) => {
    if (!templateConfig.marketing.enabled) return {}
    const locale = getLocale()
    const origin = originFromMatches(matches)
    if (isEastHome(locale))
      return easternToolHead({ path: '/', locale, ...easternPageCopy('home') }, origin)
    const data = [organizationData(origin), websiteData(origin)]
    if (locale === 'en' && origin === seoSiteOrigin('east'))
      return pageHead(eastEntryPage(), origin, data)
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
  if (locale === 'zh-Hant')
    return (
      <MarketingShell>
        <BaziHome />
      </MarketingShell>
    )
  if (locale === 'ko')
    return (
      <MarketingShell>
        <ManseryeokHome />
      </MarketingShell>
    )
  return <HomePage />
}

function HomePage() {
  const site = useSiteId()
  const content = Route.useLoaderData()
  if (site === 'east' && getLocale() === 'en') return <EastEntry />
  return (
    <MarketingShell>
      {content ? (
        <LifePathHome content={content} />
      ) : (
        <>
          <Hero />
          <Features />
          {templateConfig.billing.enabled && <Pricing plans={placeholderPlans} />}
          <Testimonials />
          <Faq />
          <Cta />
          {templateConfig.features.waitlist ? <GrowthForm feature="waitlist" /> : null}
          {templateConfig.features.newsletter ? <GrowthForm feature="newsletter" /> : null}
        </>
      )}
      <p data-testid="version" className="sr-only">
        v{__APP_VERSION__}
      </p>
    </MarketingShell>
  )
}
