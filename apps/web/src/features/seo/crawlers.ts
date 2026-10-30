import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { EAST_ENGLISH_LOCALE } from '../site/site.ts'
import type { SeoPage } from './metadata.ts'
import { absoluteUrl, alternateLinks, localizedPath } from './metadata.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'

export function escapeXml(text: string): string {
  return text.replace(
    /[<>&"']/g,
    (char) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char,
  )
}

export function sitemap(pages: readonly SeoPage[], appUrl: string, locale?: string): string {
  const urls = pages
    .filter((page) => !locale || page.locale === locale)
    .map((page) => {
      const languages = pages
        .filter((other) => other.path === page.path)
        .map((other) => other.locale)
      const links = alternateLinks(appUrl, page.path, languages, page.alternates, page.locale)
        .map(
          (link) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(link.hrefLang)}" href="${escapeXml(link.href)}"/>`,
        )
        .join('')
      return `<url><loc>${escapeXml(absoluteUrl(localeOrigin(page.locale), localizedPath(page.path, page.locale)))}</loc>${links}</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`
}

export function sitemapIndex(site: SiteId): string {
  const urls = sitemapLocales(site)
    .map(
      (locale) =>
        `<sitemap><loc>${escapeXml(absoluteUrl(seoSiteOrigin(site), `/sitemap/${locale.toLowerCase()}.xml`))}</loc></sitemap>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</sitemapindex>`
}

/** 站点地图索引中的子图语言；东方站另有只含英文入口页的 en 子图（D5） */
export function sitemapLocales(site: SiteId): string[] {
  const { enabled, defaultLocale, locales } = templateConfig.i18n
  const own: string[] = templateConfig.sites[site].locales.filter(
    (locale) => enabled || locale === defaultLocale,
  )
  if (site === 'east' && enabled && locales.some((locale) => locale === EAST_ENGLISH_LOCALE))
    own.push(EAST_ENGLISH_LOCALE)
  return own
}

export function robots(appUrl: string, known = true): string {
  if (!known) return 'User-agent: *\nDisallow: /\n'

  const prefixes = [
    '',
    ...(templateConfig.i18n.enabled ? templateConfig.i18n.locales.map(localePrefix) : []),
  ]
  return [
    'User-agent: *',
    ...prefixes.flatMap((prefix) =>
      ['/app', '/account', '/admin', '/api'].map((path) => `Disallow: ${prefix}${path}`),
    ),
    'Disallow: /*?r=',
    'Disallow: /*&r=',
    'Disallow: /_site/',
    `Sitemap: ${absoluteUrl(appUrl, '/sitemap.xml')}`,
    '',
  ].join('\n')
}
