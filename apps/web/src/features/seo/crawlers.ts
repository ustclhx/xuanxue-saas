import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { EAST_ENGLISH_COPY } from '../marketing/east-english/content.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_PATH } from '../site/site.ts'
import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import type { SeoPage } from './metadata.ts'
import { absoluteUrl, alternateLinks, localizedPath, staticPage } from './metadata.ts'
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
/**
 * 显式允许的 AI 爬虫（product-improve-ai-content D10）。爬虫命中自己名字的分组后会忽略 `*` 分组，
 * 所以每组都重复私有路径的 Disallow；`Allow: /` 比 Disallow 短，按最长匹配仍禁止私有路径。
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'PerplexityBot',
] as const

export function robots(appUrl: string, known = true): string {
  if (!known) return 'User-agent: *\nDisallow: /\n'

  const prefixes = [
    '',
    ...(templateConfig.i18n.enabled ? templateConfig.i18n.locales.map(localePrefix) : []),
  ]
  const disallow = [
    ...prefixes.flatMap((prefix) =>
      ['/app', '/account', '/admin', '/api'].map((path) => `Disallow: ${prefix}${path}`),
    ),
    'Disallow: /*?r=',
    'Disallow: /*&r=',
    'Disallow: /_site/',
  ]
  return [
    'User-agent: *',
    ...disallow,
    ...AI_CRAWLERS.flatMap((bot) => ['', `User-agent: ${bot}`, 'Allow: /', ...disallow]),
    '',
    `Sitemap: ${absoluteUrl(appUrl, '/sitemap.xml')}`,
    '',
  ].join('\n')
}

const LOCALE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
  ko: '한국어',
}

// llms.txt 的站点简介：面向 AI 检索的英文概述，与各站点实际提供的体系一致
const LLMS_INTRO: Record<SiteId, string> = {
  east: 'Free BaZi (八字, Four Pillars of Destiny) charts, Zi Wei Dou Shu (紫微斗數) charts, Korean Manseryeok (만세력) and Saju compatibility, and tarot spreads in Traditional Chinese, Simplified Chinese and Korean. Free tools calculate by traditional rules in the visitor’s browser; results are for entertainment and self-reflection, not predictions. Optional credit packs unlock full AI-written readings based on the visitor’s own chart.',
  west: 'Free numerology and tarot tools in English: Life Path number, numerology calculator, Life Path compatibility and tarot spreads. Free tools calculate by traditional rules in the visitor’s browser; results are for entertainment and self-reflection, not predictions. Optional credit packs unlock full AI-written readings based on the visitor’s own numbers and cards.',
}

// 牌义页、命理概念页与单个数字页属于参考内容，不列为核心工具
const REFERENCE_PAGE = /^(?:tarot-card-|bazi-concept-|life-path-\d)/

/**
 * `/llms.txt`（llmstxt.org 格式）：站点简介与本站各语言核心工具、定价、常见问题的规范地址。
 * 未知 Host 与 robots 一致不对外提供，返回 null。
 */
export function llmsTxt(
  site: SiteId,
  known = true,
  config = templateConfig,
  tools: readonly ToolRoute[] = TOOL_ROUTES,
): string | null {
  if (!known || !config.marketing.enabled) return null
  const origin = seoSiteOrigin(site)
  const url = (path: string, locale: string) => absoluteUrl(origin, localizedPath(path, locale))
  const sections = config.sites[site].locales
    .filter((locale) => config.i18n.enabled || locale === config.i18n.defaultLocale)
    .map((locale) => {
      const seen = new Set<string>()
      const lines = tools.flatMap((tool) => {
        const path = tool.paths[locale]
        const title = tool.titles[locale]
        if (tool.site !== site || !path || !title || REFERENCE_PAGE.test(tool.id)) return []
        if (seen.has(path)) return []
        seen.add(path)
        const description = tool.descriptions?.[locale]
        return [`- [${title}](${url(path, locale)})${description ? `: ${description}` : ''}`]
      })
      for (const path of [
        ...(config.billing.enabled ? ['/pricing' as const] : []),
        '/faq' as const,
      ]) {
        const page = staticPage(path, locale)
        lines.push(`- [${page.title}](${url(path, locale)}): ${page.description}`)
      }
      return [`## ${LOCALE_NAMES[locale] ?? locale}`, '', ...lines].join('\n')
    })
  // 东方站英文入口页（D5）：en 归西方站，东方站只有这一页英文
  if (
    site === 'east' &&
    config.i18n.enabled &&
    config.i18n.locales.some((l) => l === EAST_ENGLISH_LOCALE)
  )
    sections.push(
      [
        `## ${LOCALE_NAMES[EAST_ENGLISH_LOCALE] ?? EAST_ENGLISH_LOCALE}`,
        '',
        `- [${EAST_ENGLISH_COPY.title}](${absoluteUrl(origin, EAST_ENGLISH_PATH)}): ${EAST_ENGLISH_COPY.description}`,
      ].join('\n'),
    )
  const brand = config.sites[site].brand
  const names = [...new Set([brand.name, ...Object.values(brand.names)])].join(' / ')
  return [
    `# ${names}`,
    '',
    `> ${LLMS_INTRO[site]}`,
    '',
    ...sections.flatMap((s) => [s, '']),
    `Sitemap: ${absoluteUrl(origin, '/sitemap.xml')}`,
    '',
  ].join('\n')
}
