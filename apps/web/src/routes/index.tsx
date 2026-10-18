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
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

// 东方站语言首页（openspec add-bazi-saju-chart tasks.md 2.2、3.1）：`/zh-hant` 为八字排盤、`/ko` 为만세력；
// 东方站根路径（入口页）与西方站沿用下方营销首页
const EAST_HOME_LOCALES = ['zh-Hant', 'ko'] as const
const isEastHome = (locale: string) => (EAST_HOME_LOCALES as readonly string[]).includes(locale)

// 首页（tasks.md 3.1）：各区块均为静态文案与数据，构建期预渲染，不依赖数据库（features/marketing/prerender.ts）
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!templateConfig.marketing.enabled) throw redirect({ to: '/app' })
  },
  head: ({ matches }) => {
    if (!templateConfig.marketing.enabled) return {}
    const locale = getLocale()
    if (isEastHome(locale))
      return easternToolHead(
        { path: '/', locale, ...easternPageCopy('home') },
        originFromMatches(matches),
      )
    return pageHead(
      locale === 'en' && originFromMatches(matches) === seoSiteOrigin('east')
        ? eastEntryPage()
        : staticPage('/', locale),
      originFromMatches(matches),
      [organizationData(originFromMatches(matches)), websiteData(originFromMatches(matches))],
    )
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
  if (site === 'east' && getLocale() === 'en') return <EastEntry />
  return (
    <MarketingShell>
      <Hero />
      <Features />
      {templateConfig.billing.enabled && <Pricing plans={placeholderPlans} />}
      <Testimonials />
      <Faq />
      <Cta />
      {templateConfig.features.waitlist ? <GrowthForm feature="waitlist" /> : null}
      {templateConfig.features.newsletter ? <GrowthForm feature="newsletter" /> : null}
      <p data-testid="version" className="sr-only">
        v{__APP_VERSION__}
      </p>
    </MarketingShell>
  )
}
