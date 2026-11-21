import { SITE_IDS, type SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { eastEnglishStaticPage, isEastEnglishStaticPath } from '../east-en/static-seo.ts'
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
import { localizedPath, staticPage, tagPageTitle } from './metadata.ts'
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
  /** 法律页按站点分开（content/legal/<site>/<locale>/）；取值为站点 id */
  site?: string
}

/** 内容条目的公共字段：主词默认取标题；条目语言与当前语言不同且同站时为回退页（模板 0.7.3、0.7.4） */
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
    // 原语言在另一站点（东方站语言显示英文条目）时 fallbackSourceLocale 按普通页处理（模板 0.7.4 seo.linking.sites）
    sourceLocale: entry.locale,
    ...(entry.anchor_short !== undefined && { anchorShort: entry.anchor_short }),
    ...(entry.related?.length ? { related: entry.related } : {}),
  }
}

/**
 * 地图与 OG 共用公开页面清单，始终排除草稿、未来文章和关闭的功能。缺少译文的内容按 `i18n.untranslated`
 * 处理：`'hide'`（默认）不生成该语言的条目，`'fallback'` 生成回退页（`sourceLocale` 为原语言）。
 */
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
  // 「站点 × 语言」（项目扩展 TR-2，5b 东方站根路径英文）：每种语言先按归属站点生成（顺序与输出不变），
  // 同一语言在其他站点的页面（东方站 en）排在最后并带 `site`
  const owner = (locale: string) => siteOfLocale(locale, config) ?? 'west'
  const pairs: (readonly [SiteId, string])[] = [
    ...locales.map((locale) => [owner(locale), locale] as const),
    ...SITE_IDS.flatMap((id) =>
      config.sites[id].locales
        .filter((locale) => locales.some((l) => l === locale) && owner(locale) !== id)
        .map((locale) => [id, locale] as const),
    ),
  ].filter(
    ([id, locale]) => config.sites[id].locales.some((l) => l === locale) && (!site || site === id),
  )
  const result = pairs.flatMap(([pairSite, locale]) => {
    const secondary = pairSite !== owner(locale)
    const { defaultLocale, untranslated } = config.i18n
    const paths: StaticPath[] = [
      '/',
      ...(config.billing.enabled ? ['/pricing' as const] : []),
      '/faq',
    ]
    // 另一站点的同语言静态页（东方站根路径英文）用本站文案（features/east-en/static-seo.ts）
    const pages = secondary
      ? paths.filter(isEastEnglishStaticPath).map((path) => eastEnglishStaticPage(path))
      : paths.map((path) => staticPage(path, locale))
    if (secondary) {
      // 另一站点的同语言页面（东方站根路径英文）：只有静态页、法律页与注册表 / 内容集合中登记在本站的页面，
      // 没有博客、指南与文档
      pages.push(
        ...content.legal
          .filter((page) => page.locale === locale && page.site === pairSite)
          .map((page) => ({
            ...page,
            locale,
            site: pairSite,
            path: `/${encodeURIComponent(page.slug)}`,
            titleMain: page.title,
            parent: page.parent ?? contentParents.legal,
          })),
      )
      for (const tool of tools) {
        const path = tool.paths[locale]
        const title = tool.titles[locale]
        if (!path || !title || tool.site !== pairSite) continue
        const page: SeoPage = {
          path,
          locale,
          site: pairSite,
          title,
          description: tool.descriptions?.[locale] ?? title,
          alternates: Object.fromEntries(
            Object.entries(tool.paths).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
        }
        const existing = pages.findIndex((entry) => entry.path === path)
        if (existing === -1) pages.push(page)
        else pages[existing] = page
      }
      for (const page of content.toolPages ?? []) {
        if (page.locale !== locale || page.site !== pairSite) continue
        const existing = pages.findIndex((entry) => entry.path === page.path)
        if (existing === -1) pages.push(page)
        else pages[existing] = page
      }
      return pages.map((page) => projectPageLinking(page))
    }
    if (config.features.newsletter) pages.push(staticPage('/newsletter', locale))
    if (config.features.waitlist) pages.push(staticPage('/waitlist', locale))
    const published = content.posts.filter((post) => !post.draft)
    // 该语言自己没有已发布文章时，博客列表不进站点地图（specs/marketing-site「博客为空时隐藏入口」）
    if (config.features.blog && publishedPostLocales(published, now).includes(locale)) {
      const blog = staticPage('/blog', locale)
      pages.push(blog)
      const posts = listPosts(published, { locale, defaultLocale, now, untranslated })
      // 文章层级与主词（模板 0.7.3）：缺少译文的文章按 i18n.untranslated 处理（模板 0.8.0 默认 'hide' 不生成条目；
      // 'fallback' 下以默认语言原文显示的回退页不进站点地图）
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
      ...(content.legal as readonly (LegalPage & { site?: SiteId })[])
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
          untranslated,
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
        ...localizedEntries(content.docs, locale, defaultLocale, untranslated).map((page) => ({
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
      if (!path || !title || tool.site !== pairSite) continue
      const page = {
        path,
        locale,
        title,
        description: tool.descriptions?.[locale] ?? title,
        // SeoPage.alternates（模板 0.8.0 本地化 slug）只收已声明的语言
        alternates: Object.fromEntries(
          Object.entries(tool.paths).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      }
      const existing = pages.findIndex((entry) => entry.path === path)
      if (existing === -1) pages.push(page)
      else pages[existing] = page
    }
    for (const page of content.toolPages ?? []) {
      if (page.locale !== locale || (page.site !== undefined && page.site !== pairSite)) continue
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
