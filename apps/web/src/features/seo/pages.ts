import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { listPosts, listTags, localizedEntries } from '../marketing/content.ts'
import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import type { SeoPage } from './metadata.ts'
import { localizedPath, staticPage, tagPageTitle } from './metadata.ts'

interface Post {
  slug: string
  locale: string
  title: string
  summary: string
  date: string
  tags: string[]
  draft: boolean
  cover?: string | undefined
}
interface Page {
  slug: string
  locale: string
  title: string
  description: string
}

/** 地图与 OG 共用公开页面清单，始终排除草稿、未来文章和关闭的功能。 */
export function publicPages(
  content: {
    posts: readonly Post[]
    legal: readonly Page[]
    docs: readonly Page[]
    /** 工具自带 SEO 文案的页面（如 numerology 的工具内页与内容页），按自身 locale 收录并按路径去重 */
    toolPages?: readonly SeoPage[]
  },
  now = new Date(),
  config = templateConfig,
  site?: SiteId,
  tools: readonly ToolRoute[] = TOOL_ROUTES,
): SeoPage[] {
  if (!config.marketing.enabled) return []
  const locales = config.i18n.enabled ? config.i18n.locales : [config.i18n.defaultLocale]
  const result = locales
    .filter((locale) => !site || config.sites[site].locales.some((l) => l === locale))
    .flatMap((locale) => {
      const { defaultLocale } = config.i18n
      const pages = ['/', ...(config.billing.enabled ? ['/pricing'] : [])].map((path) =>
        staticPage(path, locale),
      )
      if (config.features.newsletter) pages.push(staticPage('/newsletter', locale))
      if (config.features.waitlist) pages.push(staticPage('/waitlist', locale))
      if (config.features.blog) {
        pages.push(staticPage('/blog', locale))
        const posts = listPosts(
          content.posts.filter((post) => !post.draft),
          { locale, defaultLocale, now },
        )
        pages.push(
          ...posts.map((post) => ({
            path: `/blog/${encodeURIComponent(post.slug)}`,
            locale,
            title: post.title,
            description: post.summary,
            date: post.date,
            cover: post.cover,
          })),
        )
        pages.push(
          ...listTags(posts).map((tag) => ({
            path: `/blog/tags/${encodeURIComponent(tag)}`,
            locale,
            title: tagPageTitle(tag, locale),
            description: `${staticPage('/blog', locale).description} · ${tag}`,
          })),
        )
      }
      pages.push(
        // 法律页只有英文原文；其他语言的同一路径显示英文并 noindex，不进站点地图
        ...content.legal
          .filter((page) => page.locale === locale)
          .map((page) => ({ ...page, locale, path: `/${encodeURIComponent(page.slug)}` })),
      )
      if (config.features.docs) {
        pages.push(staticPage('/docs', locale))
        pages.push(
          ...localizedEntries(content.docs, locale, defaultLocale).map((page) => ({
            ...page,
            locale,
            path: `/docs/${encodeURIComponent(page.slug)}`,
          })),
        )
      }
      for (const tool of tools) {
        const path = tool.paths[locale]
        const title = tool.titles[locale]
        if (!path || !title || !config.sites[tool.site].locales.some((l) => l === locale)) continue
        const page = {
          path,
          locale,
          title,
          description: tool.descriptions?.[locale] ?? title,
          alternates: tool.paths,
        }
        const existing = pages.findIndex((entry) => entry.path === path)
        if (existing === -1) pages.push(page)
        else pages[existing] = page
      }
      for (const page of content.toolPages ?? []) {
        if (page.locale !== locale) continue
        const existing = pages.findIndex((entry) => entry.path === page.path)
        if (existing === -1) pages.push(page)
        else pages[existing] = page
      }
      return pages
    })
  return result
}

export function findPublicPage(pages: readonly SeoPage[], path: string): SeoPage | undefined {
  return pages.find((page) => localizedPath(page.path, page.locale) === path)
}
