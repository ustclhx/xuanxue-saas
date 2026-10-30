import { templateConfig } from '../../../server/template-config.ts'
import { escapeXml } from '../../seo/crawlers.ts'
import { absoluteUrl, localizedPath } from '../../seo/metadata.ts'
import { seoSiteOrigin } from '../../seo/origins.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH } from '../../site/site.ts'
import { EAST_ENGLISH_COPY as copy } from './content.ts'

/**
 * 东方站英文入口页的 head 与站点地图（specs/seo「多语言关联」场景「东方站英文入口页」）：
 * en 归西方站，通用的 pageHead 会把 canonical 指向西方站，因此这里按东方站 origin 单独输出。
 * hreflang 与东方站三种语言首页互指，x-default 为东方站根路径，不出现西方站地址。
 */

export const EAST_ENGLISH_OG_IMAGE = '/og/east/en.png'

export function eastEnglishUrl(): string {
  return absoluteUrl(seoSiteOrigin('east'), EAST_ENGLISH_PATH)
}

export function eastEnglishAlternates() {
  const origin = seoSiteOrigin('east')
  return [
    { rel: 'alternate', hrefLang: EAST_ENGLISH_LOCALE, href: eastEnglishUrl() },
    ...templateConfig.sites.east.locales.map((locale) => ({
      rel: 'alternate',
      hrefLang: locale as string,
      href: absoluteUrl(origin, localizedPath('/', locale)),
    })),
    { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl(origin, '/') },
  ]
}

export function eastEnglishHead() {
  const url = eastEnglishUrl()
  const brand = templateConfig.sites.east.brand.name
  const title = `${copy.title} | ${brand}`
  const image = absoluteUrl(seoSiteOrigin('east'), EAST_ENGLISH_OG_IMAGE)
  return {
    meta: [
      { title },
      { name: 'description', content: copy.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: copy.description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: brand },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: EAST_ENGLISH_LOCALE },
      { property: 'og:image', content: image },
      { property: 'og:image:alt', content: title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: copy.description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: title },
    ],
    links: [{ rel: 'canonical', href: url }, ...eastEnglishAlternates()],
  }
}

/** 东方站 `en` 子站点地图：只收录英文入口页 */
export function eastEnglishSitemap(): string {
  const links = eastEnglishAlternates()
    .map(
      (link) =>
        `<xhtml:link rel="alternate" hreflang="${escapeXml(link.hrefLang)}" href="${escapeXml(link.href)}"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${escapeXml(eastEnglishUrl())}</loc>${links}</url></urlset>`
}
