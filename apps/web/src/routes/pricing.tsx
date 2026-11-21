import { createFileRoute, notFound as featureNotFound } from '@tanstack/react-router'
import { getMarketingPricing } from '../features/marketing/pricing.functions.ts'
import type { PricingCatalog } from '../features/marketing/pricing-data.ts'
import { PricingPage } from '../features/marketing/pricing-page.tsx'
import { getReadingPricing } from '../features/readings/readings.functions.ts'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { pricingData } from '../features/seo/structured-data.ts'
import { eastEnglishRouteData } from '../features/site/site.functions.ts'
import { getLocale } from '../paraglide/runtime.js'
import { templateConfig } from '../server/template-config.ts'

/** 详批未开放时积分包不出售，结构化数据与页面一致标为缺货 */
function sellableCatalog(catalog: PricingCatalog, readings: readonly unknown[]): PricingCatalog {
  if (readings.length > 0) return catalog
  return { ...catalog, prices: catalog.prices.map((price) => ({ ...price, available: false })) }
}

export const Route = createFileRoute('/pricing')({
  beforeLoad: () => {
    if (!templateConfig.billing.enabled) throw featureNotFound()
  },
  loader: async ({ parentMatchPromise }) => {
    const [catalog, pricing, eastEn] = await Promise.all([
      getMarketingPricing(),
      getReadingPricing({ data: { locale: getLocale() } }),
      // 东方站根路径英文（5b）的标题与描述按需加载
      eastEnglishRouteData(parentMatchPromise).then((data) => data?.eastEnPricingPage() ?? null),
    ])
    return { catalog, readings: pricing.readings, eastEn }
  },
  component: () => {
    const { catalog, readings } = Route.useLoaderData()
    return <PricingPage catalog={catalog} readings={readings} />
  },
  head: ({ matches, loaderData }) => {
    // 东方站根路径英文（5b）：同一地址按站点取标题、描述与品牌（按需加载，见 eastEnglishPricing）
    const eastEn = loaderData?.eastEn ? ('east' as const) : undefined
    return pageHead(
      loaderData?.eastEn ?? staticPage('/pricing', getLocale()),
      originFromMatches(matches),
      loaderData
        ? pricingData(
            sellableCatalog(loaderData.catalog, loaderData.readings),
            originFromMatches(matches),
            getLocale(),
            eastEn,
          )
        : [],
    )
  },
})
