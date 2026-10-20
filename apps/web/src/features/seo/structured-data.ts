import { brandName } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import type { PricingCatalog } from '../marketing/pricing-data.ts'
import type { SeoPage } from './metadata.ts'
import { absoluteUrl, localizedPath, ogImagePath, pageBrand } from './metadata.ts'

const context = 'https://schema.org'
/** 两站各自的 Organization / WebSite（launch-v1-production design：两站品牌分开） */
export function organizationData(appUrl: string, brand: string) {
  return {
    '@context': context,
    '@type': 'Organization',
    '@id': absoluteUrl(appUrl, '/#organization'),
    name: brand,
    url: appUrl,
  }
}
export function websiteData(appUrl: string, brand: string) {
  return {
    '@context': context,
    '@type': 'WebSite',
    name: brand,
    url: appUrl,
    publisher: { '@id': absoluteUrl(appUrl, '/#organization') },
  }
}
export function articleData(page: SeoPage, appUrl: string) {
  const url = absoluteUrl(appUrl, localizedPath(page.path, page.locale))
  const image = page.cover
    ? absoluteUrl(appUrl, page.cover)
    : absoluteUrl(appUrl, ogImagePath(page))
  return {
    '@context': context,
    '@type': 'BlogPosting',
    headline: page.title,
    description: page.description,
    datePublished: page.date,
    dateModified: page.date,
    author: { '@type': 'Organization', name: pageBrand(page), url: appUrl },
    publisher: organizationData(appUrl, pageBrand(page)),
    mainEntityOfPage: url,
    url,
    image,
    inLanguage: page.locale,
  }
}

/** 金额转换与定价页一致：套餐目录中的整数以最小货币单位保存。 */
export function pricingData(catalog: PricingCatalog, appUrl: string, locale: string) {
  return catalog.plans.flatMap((plan) => {
    const prices = catalog.prices.filter((price) => price.planId === plan.id)
    if (prices.length === 0) return []
    return [
      {
        '@context': context,
        '@type': 'Product',
        name: plan.name,
        description: `${plan.credits} credits`,
        productID: plan.key,
        brand: { '@type': 'Brand', name: brandName(templateConfig, locale) },
        image: absoluteUrl(appUrl, ogImagePath({ path: '/pricing', locale })),
        offers: prices.map((price) => ({
          '@type': 'Offer',
          price: (price.amount / 100).toFixed(2),
          priceCurrency: price.currency.toUpperCase(),
          url: absoluteUrl(appUrl, localizedPath('/pricing', locale)),
          availability: price.available
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        })),
      },
    ]
  })
}
