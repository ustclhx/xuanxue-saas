import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import {
  listPosts,
  listTags,
  localizedEntries,
  publishedPostLocales,
} from '../marketing/content.ts'
import { siteOfLocale } from '../site/site.ts'
import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import { contentParents } from './content-parents.ts'
import type { SeoPage, StaticPath } from './metadata.ts'
import { localizedPath, sameSiteSourceLocale, staticPage, tagPageTitle } from './metadata.ts'
import { projectPageLinking, projectPages } from './pages.project.ts'

/** 内容集合 frontmatter 中的内链字段（content-collections.ts 已按集合补上默认 parent） */
interface Linking {
  parent?: string | undefined
  anchor_short?: string | undefined
  related?: readonly string[] | undefined
}
interface Post extends Linking {
  slug: string
  locale: string
  title: string
  summary: string
  date: string
  tags: string[]
  draft: boolean
  cover?: string | undefined
}
interface Page extends Linking {
  slug: string
  locale: string
  title: string
  description: string
}
interface Guide extends Linking {
  slug: string
  locale: string
  title: string
  answer_summary: string
  draft: boolean
}

interface LegalPage extends Page {
  /** 法律页按站点分开（content/legal/<site>/<locale>/） */
  site?: string
}

/** 内容条目的公共字段：主词默认取标题；条目语言与当前语言不同且同站时为回退页（模板 0.7.3） */
function contentPage(
  entry: Linking & { locale: string; title: string },
  locale: string,
  path: string,
  defaultParent: string,
): Omit<SeoPage, 'description'> {
  return {
    path,
    locale,
    title: entry.title,
    titleMain: entry.title,
    parent: entry.parent ?? defaultParent,
    // 跨站回退（东方站语言显示英文条目）不声明 sourceLocale，见 metadata.ts sameSiteSourceLocale
    ...(sameSiteSourceLocale(locale, entry.locale) !== undefined && { sourceLocale: entry.locale }),
    ...(entry.anchor_short !== undefined && { anchorShort: entry.anchor_short }),
    ...(entry.related?.length ? { related: entry.related } : {}),
  }
}

/** 地图与 OG 共用公开页面清单，始终排除草稿、未来文章和关闭的功能。 */
export function publicPages(
  content: {
    posts: readonly Post[]
    legal: readonly LegalPage[]
    docs: readonly Page[]
    guides?: readonly Guide[]
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
      const paths: StaticPath[] = [
        '/',
        ...(config.billing.enabled ? ['/pricing' as const] : []),
        '/faq',
      ]
      const pages = paths.map((path) => staticPage(path, locale))
      if (config.features.newsletter) pages.push(staticPage('/newsletter', locale))
      if (config.features.waitlist) pages.push(staticPage('/waitlist', locale))
      const published = content.posts.filter((post) => !post.draft)
      // 该语言自己没有已发布文章时，博客列表不进站点地图（specs/marketing-site「博客为空时隐藏入口」）
      if (config.features.blog && publishedPostLocales(published, now).includes(locale)) {
        const blog = staticPage('/blog', locale)
        pages.push(blog)
        const posts = listPosts(published, { locale, defaultLocale, now })
        // 文章层级与主词（模板 0.7.3）：缺少译文、以默认语言原文显示的文章为回退页，不进站点地图
        pages.push(
          ...posts.map((post) => ({
            ...contentPage(
              post,
              locale,
              `/blog/${encodeURIComponent(post.slug)}`,
              contentParents.posts,
            ),
            description: post.summary,
            date: post.date,
            cover: post.cover,
          })),
        )
        // 博客列表的第 2 页起（/blog/page/<n>）是项目自己的分页：noindex, follow，不登记进清单与站点地图
        // （模板 0.7.3 的 hubPages() 分页进站点地图，本项目不采用）；标签页一页列出全部文章
        pages.push(
          ...listTags(posts).map((tag) => ({
            path: `/blog/tags/${encodeURIComponent(tag)}`,
            locale,
            title: tagPageTitle(tag, locale),
            titleMain: tagPageTitle(tag, locale),
            anchorShort: tag,
            parent: '/blog',
            description: `${blog.description} · ${tag}`,
          })),
        )
      }
      pages.push(
        // 只收录语言所属站点有原文的法律页；回退显示其他语言原文的页面 noindex，不进站点地图
        ...content.legal
          .filter(
            (page) =>
              page.locale === locale && (!page.site || page.site === siteOfLocale(locale, config)),
          )
          .map((page) => ({
            ...page,
            locale,
            path: `/${encodeURIComponent(page.slug)}`,
            titleMain: page.title,
            parent: page.parent ?? contentParents.legal,
          })),
      )
      if (config.features.guides) {
        pages.push(staticPage('/guides', locale))
        pages.push(
          ...localizedEntries(
            (content.guides ?? []).filter((guide) => !guide.draft),
            locale,
            defaultLocale,
          ).map((guide) => ({
            ...contentPage(
              guide,
              locale,
              `/guides/${encodeURIComponent(guide.slug)}`,
              contentParents.guides,
            ),
            description: guide.answer_summary,
          })),
        )
      }
      if (config.features.docs) {
        pages.push(staticPage('/docs', locale))
        pages.push(
          ...localizedEntries(content.docs, locale, defaultLocale).map((page) => ({
            ...contentPage(
              page,
              locale,
              `/docs/${encodeURIComponent(page.slug)}`,
              contentParents.docs,
            ),
            description: page.description,
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
      // 项目自有页面（pages.project.ts）与模板清单合并，再补上项目页面的层级与主词
      pages.push(...projectPages({ locale, defaultLocale, now, config }))
      return pages.map((page) => projectPageLinking(page))
    })
  return result
}

export function findPublicPage(pages: readonly SeoPage[], path: string): SeoPage | undefined {
  return pages.find((page) => localizedPath(page.path, page.locale) === path)
}
