/**
 * 博客、法律页与文档的查询规则（openspec add-marketing-i18n-seo tasks.md 3.3、3.4）。
 * 只处理 content-collections 生成的数据，不引用生成模块本身，便于单元测试。
 *
 * - 内容按 `<locale>/<slug>` 组织；某语言没有对应版本时回退到默认语言的版本。
 * - 草稿在生产构建中已被跳过（content-collections.ts），这里只按发布时间过滤定时发布的文章。
 */

interface Localized {
  readonly locale: string
  readonly slug: string
}

export interface PostLike extends Localized {
  readonly date: string
  readonly tags: readonly string[]
}

export interface DocLike extends Localized {
  readonly title: string
  readonly description: string
  readonly section: string
  readonly order: number
  readonly searchText: string
}

/** 发布时间已到（定时发布的文章在到期前不出现） */
export function isPublished(post: Pick<PostLike, 'date'>, now: Date): boolean {
  return new Date(post.date).getTime() <= now.getTime()
}

/** 当前语言的条目，缺失的 slug 用默认语言的版本补齐 */
export function localizedEntries<T extends Localized>(
  entries: readonly T[],
  locale: string,
  defaultLocale: string,
): T[] {
  const bySlug = new Map<string, T>()
  for (const entry of entries) if (entry.locale === defaultLocale) bySlug.set(entry.slug, entry)
  for (const entry of entries) if (entry.locale === locale) bySlug.set(entry.slug, entry)
  return [...bySlug.values()]
}

/** 某 slug 真实存在译文的语言（不含回退），供 hreflang 只关联真实译文 */
export function translationLocales(entries: readonly Localized[], slug: string): string[] {
  return [...new Set(entries.filter((entry) => entry.slug === slug).map((entry) => entry.locale))]
}

export function findLocalized<T extends Localized>(
  entries: readonly T[],
  slug: string,
  locale: string,
  defaultLocale: string,
): T | undefined {
  return (
    entries.find((entry) => entry.slug === slug && entry.locale === locale) ??
    entries.find((entry) => entry.slug === slug && entry.locale === defaultLocale)
  )
}

/**
 * 法律页按站点分开（product-improve-ai-content D4）：只在语言所属站点的正文中查找，
 * 该站点缺少这种语言时回退到同站点的默认语言版本（页面标注并 noindex），不借用另一站点的正文。
 */
export function findLegalPage<T extends Localized & { readonly site: string }>(
  pages: readonly T[],
  options: { slug: string; locale: string; site: string; defaultLocale: string },
): T | undefined {
  const own = pages.filter((page) => page.site === options.site)
  return findLocalized(own, options.slug, options.locale, options.defaultLocale)
}

/** 博客列表：已发布、可按标签筛选，按发布时间倒序 */
export function listPosts<T extends PostLike>(
  posts: readonly T[],
  options: { locale: string; defaultLocale: string; now: Date; tag?: string | undefined },
): T[] {
  return localizedEntries(posts, options.locale, options.defaultLocale)
    .filter((post) => isPublished(post, options.now))
    .filter((post) => options.tag === undefined || post.tags.includes(options.tag))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** 博客列表每页的篇数：第一篇为横向大卡，其余 6 篇排成卡片网格（设计稿 warm-refresh/BlogList.dc.html） */
export const POSTS_PER_PAGE = 7

/** 列表分页：`page` 从 1 开始；超出范围（含非整数）时返回 undefined，由路由回 404 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  perPage: number = POSTS_PER_PAGE,
): { items: T[]; page: number; pages: number } | undefined {
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  if (!Number.isInteger(page) || page < 1 || page > pages) return undefined
  return { items: items.slice((page - 1) * perPage, page * perPage), page, pages }
}

/**
 * 文章的大致阅读时间（分钟，至少 1）：中日韩文字按每分钟 400 字、其余按每分钟 220 个词估算。
 * 只用于文章页的元信息行，是给读者的参考，不进结构化数据。
 */
export function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  const cjk = text.match(/[㐀-鿿가-힯぀-ヿ]/g)?.length ?? 0
  const words = text
    .replace(/[㐀-鿿가-힯぀-ヿ]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length
  return Math.max(1, Math.round(cjk / 400 + words / 220))
}

/**
 * 自己有已发布文章的语言（specs/marketing-site「博客为空时隐藏入口」）：只计该语言本身的文章，
 * 不计默认语言的回退文章——两站分开经营，东方站不因西方站的英文文章显示博客入口。
 */
export function publishedPostLocales(posts: readonly PostLike[], now: Date): string[] {
  return [...new Set(posts.filter((post) => isPublished(post, now)).map((post) => post.locale))]
}

/** hub 列表的页数：至少 1 页（没有下级时仍有空列表页） */
export function hubPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** hub 列表第 `page` 页的条目；页码超出范围时返回 null（路由返回 404） */
export function hubSlice<T>(items: readonly T[], page: number, pageSize: number): T[] | null {
  if (!Number.isInteger(page) || page < 1 || page > hubPageCount(items.length, pageSize))
    return null
  return items.slice((page - 1) * pageSize, page * pageSize)
}

/** 已发布文章中出现过的标签，按名称排序 */
export function listTags(posts: readonly PostLike[]): string[] {
  return [...new Set(posts.flatMap((post) => post.tags))].sort()
}

export function findPost<T extends PostLike>(
  posts: readonly T[],
  options: { slug: string; locale: string; defaultLocale: string; now: Date },
): T | undefined {
  const post = findLocalized(posts, options.slug, options.locale, options.defaultLocale)
  return post && isPublished(post, options.now) ? post : undefined
}

export interface DocsNavSection {
  readonly title: string
  readonly items: readonly { slug: string; title: string }[]
}

/** 文档侧边导航：文档按 order（全站顺序）、标题排序，分组按其第一篇出现的位置排列 */
export function docsNav(docs: readonly DocLike[]): DocsNavSection[] {
  const sorted = [...docs].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  const sections = new Map<string, { slug: string; title: string }[]>()
  for (const doc of sorted) {
    const items = sections.get(doc.section) ?? []
    items.push({ slug: doc.slug, title: doc.title })
    sections.set(doc.section, items)
  }
  return [...sections].map(([title, items]) => ({ title, items }))
}

export interface DocsSearchEntry {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly text: string
}

/** 构建期生成的搜索索引（随文档页的数据下发，客户端搜索） */
export function docsSearchIndex(docs: readonly DocLike[]): DocsSearchEntry[] {
  return docs.map(({ slug, title, description, searchText }) => ({
    slug,
    title,
    description,
    text: searchText,
  }))
}

/** 所有词都出现在标题、描述或正文中即命中；标题命中的排在前面 */
export function searchDocs(index: readonly DocsSearchEntry[], query: string): DocsSearchEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  const haystack = (entry: DocsSearchEntry) =>
    `${entry.title} ${entry.description} ${entry.text}`.toLowerCase()
  const titleHits = (entry: DocsSearchEntry) =>
    terms.filter((term) => entry.title.toLowerCase().includes(term)).length
  return index
    .filter((entry) => terms.every((term) => haystack(entry).includes(term)))
    .sort((a, b) => titleHits(b) - titleHits(a))
}

/**
 * 文档页数据（tasks.md 3.4）：`features.docs` 关闭时返回 null（路由返回 404），
 * 未指定 slug 时取侧边导航的第一篇。
 */
export function loadDocsPage<T extends DocLike>(
  docs: readonly T[],
  options: { enabled: boolean; slug?: string | undefined; locale: string; defaultLocale: string },
): { page: T; nav: DocsNavSection[]; searchIndex: DocsSearchEntry[] } | null {
  if (!options.enabled) return null
  const entries = localizedEntries(docs, options.locale, options.defaultLocale)
  const nav = docsNav(entries)
  const slug = options.slug ?? nav[0]?.items[0]?.slug
  const page = slug === undefined ? undefined : entries.find((doc) => doc.slug === slug)
  if (!page) return null
  return { page, nav, searchIndex: docsSearchIndex(entries) }
}
