import { toMajor } from '@xuanxue/billing/currency'
import { brandName } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import type { PricingCatalog } from '../marketing/pricing-data.ts'
import type { SeoPage } from './metadata.ts'
import {
  absoluteUrl,
  fallbackSourceLocale,
  localizedPath,
  ogImagePath,
  pageBrand,
} from './metadata.ts'
import { localeOrigin } from './origins.ts'

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
/** `url` 省略时为站点根地址；语言首页传入该页的 canonical（东方站根路径会跳转，不作为地址） */
export function websiteData(appUrl: string, brand: string, url = appUrl) {
  return {
    '@context': context,
    '@type': 'WebSite',
    name: brand,
    url,
    publisher: { '@id': absoluteUrl(appUrl, '/#organization') },
  }
}
export function articleData(page: SeoPage, appUrl: string) {
  // 地址与 canonical 一致（同站点回退页指向原语言地址，原语言在另一站点时为本页地址）；inLanguage 标注内容的真实语言
  const source = fallbackSourceLocale(page) ?? page.locale
  const url = absoluteUrl(
    source === page.locale ? appUrl : localeOrigin(source),
    localizedPath(page.path, source),
  )
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
    inLanguage: page.sourceLocale ?? page.locale,
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
          // 按币种指数换算主单位（KRW 无小数）
          price: toMajor(price.amount, price.currency),
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

export function faqData(faq: readonly { q: string; a: string }[]) {
  return {
    '@context': context,
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}

// 与 pageHead 的 canonical 同一算法：按语言所属站点的 origin 与带语言前缀的路径生成绝对地址
const canonicalUrl = (path: string, locale: string) =>
  absoluteUrl(localeOrigin(locale), localizedPath(path, locale))

/**
 * 主工具页的 WebApplication（openspec separate-landing-homepage design.md D3，specs/seo「结构化数据」）：
 * 免费工具，`url` 与页面 canonical 相同。
 */
export function webApplicationData(
  page: Pick<SeoPage, 'path' | 'locale' | 'description'>,
  name: string,
) {
  return {
    '@context': context,
    '@type': 'WebApplication',
    name,
    description: page.description,
    url: canonicalUrl(page.path, page.locale),
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    inLanguage: page.locale,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  }
}

/** 面包屑（首页 › 工具 › 子页）：各级为同一语言下的页面路径，地址与对应页面的 canonical 相同 */
export function breadcrumbData(
  items: readonly { readonly name: string; readonly path: string }[],
  locale: string,
) {
  return {
    '@context': context,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path, locale),
    })),
  }
}
