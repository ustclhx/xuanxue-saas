import { createFileRoute, notFound as featureNotFound } from '@tanstack/react-router'
import { getMarketingPricing } from '../features/marketing/pricing.functions.ts'
import type { PricingCatalog } from '../features/marketing/pricing-data.ts'
import { PricingPage } from '../features/marketing/pricing-page.tsx'
import { getReadingPricing } from '../features/readings/readings.functions.ts'
import { originFromMatches, pageHead, staticPage } from '../features/seo/metadata.ts'
import { pricingData } from '../features/seo/structured-data.ts'
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
  loader: async () => {
    const [catalog, pricing] = await Promise.all([
      getMarketingPricing(),
      getReadingPricing({ data: { locale: getLocale() } }),
    ])
    return { catalog, readings: pricing.readings }
  },
  component: () => {
    const { catalog, readings } = Route.useLoaderData()
    return <PricingPage catalog={catalog} readings={readings} />
  },
  head: ({ matches, loaderData }) =>
    pageHead(
      staticPage('/pricing', getLocale()),
      originFromMatches(matches),
      loaderData
        ? pricingData(
            sellableCatalog(loaderData.catalog, loaderData.readings),
            originFromMatches(matches),
            getLocale(),
          )
        : [],
    ),
})
