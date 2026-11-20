import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allDocs, allGuides, allLegalPages, allPosts } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../server/template-config.ts'
import { contentParents } from '../seo/content-parents.ts'
import { getPageLinks } from '../seo/pages.server.ts'
import { siteOfLocale } from '../site/site.ts'
import {
  findLegalPage,
  findLocalized,
  findPost,
  isPublished,
  listPosts,
  listTags,
  loadDocsPage,
  localizedEntries,
  paginate,
  publishedPostLocales,
  translationLocales,
} from './content.ts'

/**
 * 博客、法律页与文档的数据（tasks.md 3.3、3.4）。内容在构建期生成，不访问数据库；
 * 页面经预渲染输出静态 HTML，客户端路由跳转时才调用这些 server function。
 *
 * 语言由调用方传入：server function 的请求地址不带语言前缀，服务端无法从 URL 得到页面语言。
 * 详情数据附带 `translations`（真实存在译文的语言），条目自身的 `locale` 是内容的真实语言，
 * 页面据此输出回退页的 canonical 与 hreflang（openspec seo-internal-linking 2.2）。
 * 缺少译文的条目按 `i18n.untranslated` 处理：默认 `'hide'` 时详情 404、列表不列出（multilingual-seo 3.1）。
 * hub（列表、标签与分页）的 `translations` 取公开页面清单中存在该地址的语言，hreflang 只列真实版本。
 * `links` 是面包屑与内链区块（seo-internal-linking 3.1–3.3），由公开页面清单在服务端计算。
 */

const { locales, defaultLocale, untranslated } = templateConfig.i18n
const locale = z
  .string()
  .transform((value) => ((locales as readonly string[]).includes(value) ? value : defaultLocale))
const slug = z.string().min(1).max(200)

function requireBlog() {
  if (!templateConfig.features.blog) throw notFound()
}

/**
 * 博客列表与标签页：列表页每页 POSTS_PER_PAGE 篇（项目自有分页，/blog/page/<n> 为 noindex, follow），
 * 标签页不分页；`page` 超出范围时 404。模板 0.7.3 的 hubPageSize 分页不采用。
 */
export const getBlogIndex = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      locale,
      tag: z.string().max(64).optional(),
      page: z.number().int().min(1).max(10_000).optional(),
    }),
  )
  .handler(({ data }) => {
    requireBlog()
    const now = new Date()
    const options = { locale: data.locale, defaultLocale, now, untranslated }
    const all = listPosts(allPosts, { ...options, tag: data.tag }).map(
      ({ html, ...summary }) => summary,
    )
    if (data.tag !== undefined && all.length === 0) throw notFound()
    // 标签页不分页（一页列出该标签的全部文章）；列表页每页 1 + 6 篇
    const paged =
      data.tag === undefined ? paginate(all, data.page ?? 1) : { items: all, page: 1, pages: 1 }
    if (!paged) throw notFound()
    return {
      posts: paged.items,
      page: paged.page,
      pages: paged.pages,
      tags: listTags(listPosts(allPosts, options)),
    }
  })

/** 页头与页脚的博客入口按语言显示（根布局 loader 读取一次）；内容在构建期生成，不访问数据库 */
export const getBlogLocales = createServerFn({ method: 'GET' }).handler(() =>
  templateConfig.features.blog ? publishedPostLocales(allPosts, new Date()) : [],
)

export const getBlogPost = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale, slug }))
  .handler(({ data }) => {
    requireBlog()
    const now = new Date()
    const post = findPost(allPosts, { ...data, defaultLocale, now, untranslated })
    if (!post) throw notFound()
    const published = allPosts.filter((entry) => isPublished(entry, now))
    return {
      ...post,
      translations: translationLocales(published, post.slug),
      links: getPageLinks(
        `/blog/${encodeURIComponent(post.slug)}`,
        data.locale,
        post.parent ?? contentParents.posts,
      ),
    }
  })

export const getLegalPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale, slug }))
  .handler(({ data }) => {
    // 站点由语言决定（两站语言不重叠）；正文只取该站点的版本
    const site = siteOfLocale(data.locale, templateConfig) ?? 'west'
    const page = findLegalPage(allLegalPages, { ...data, site, defaultLocale, untranslated })
    if (!page) throw notFound()
    // 法律页在根路径（/privacy 等），由 legal-route.ts 输出 head；缺少本站该语言原文时回退页 noindex，
    // 不采用模板 0.7.3 /legal/<slug> 的回退 canonical 与内链区块
    return page
  })

export const getDocsPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale, slug: slug.optional() }))
  .handler(({ data }) => {
    const result = loadDocsPage(allDocs, {
      enabled: templateConfig.features.docs,
      slug: data.slug,
      locale: data.locale,
      defaultLocale,
      untranslated,
    })
    if (!result) throw notFound()
    // 文档站本项目未开启（features.docs=false）：沿用项目版式，不接模板 0.7.3 的面包屑与内链区块
    return result
  })

function requireGuides() {
  if (!templateConfig.features.guides) throw notFound()
}

export const getGuideIndex = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale }))
  .handler(({ data }) => {
    requireGuides()
    return localizedEntries(allGuides, data.locale, defaultLocale, untranslated).map(
      ({ html, faq, ...summary }) => summary,
    )
  })

export const getGuide = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale, slug }))
  .handler(({ data }) => {
    requireGuides()
    const guide = findLocalized(allGuides, data.slug, data.locale, defaultLocale, untranslated)
    if (!guide) throw notFound()
    // 答案页本项目未开启（features.guides=false）：沿用项目版式，不接模板 0.7.3 的面包屑与内链区块
    return guide
  })
