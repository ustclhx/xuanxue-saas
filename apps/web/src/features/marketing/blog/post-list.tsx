import { PostCard, PostCover } from '@xuanxue/ui/project'
import { m } from '../../../paraglide/messages.js'
import { getLocale, localizeHref } from '../../../paraglide/runtime.js'
import { BlogEmptyState } from './empty-state.tsx'

export interface PostSummary {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly date: string
  readonly tags: readonly string[]
  readonly draft: boolean
  readonly cover?: string | undefined
  readonly coverAlt?: string | undefined
}

export function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(date),
  )
}

/** 生成封面的字形：标题里的第一个数字（至多三位），否则标题的第一个字 */
export function coverGlyph(title: string): string {
  const number = /\d{1,3}/.exec(title)?.[0]
  if (number) return number
  const first = Array.from(title.trim()).find((char) => /[\p{L}\p{N}]/u.test(char)) ?? ''
  return first.toLocaleUpperCase()
}

/** 博客路径在当前语言下的站内地址（服务端输出的真实链接，中文与空格按 URL 编码） */
function blogHref(path: string): string {
  return localizeHref(path, { locale: getLocale() })
}

/**
 * 分类筛选（列表顶部）：链接到已有的标签页，当前项以 aria-current 标出。
 * 这是列表页自身的导航；文章卡片上的分类只作小字，不再是链接。
 */
export function TopicNav({ tags, active }: { tags: readonly string[]; active?: string }) {
  if (tags.length === 0) return null
  const item =
    'inline-flex min-h-11 flex-none items-center rounded-field bg-surface-2 px-3.5 text-caption text-ink-muted hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:inset-ring aria-[current=page]:inset-ring-mark'
  return (
    <nav aria-label={m.marketing_blog_topics_label()} className="flex gap-2 overflow-x-auto pb-1">
      <a
        href={blogHref('/blog')}
        aria-current={active === undefined ? 'page' : undefined}
        className={item}
      >
        {m.marketing_blog_topic_all()}
      </a>
      {tags.map((tag) => (
        <a
          key={tag}
          href={blogHref(`/blog/tags/${encodeURIComponent(tag)}`)}
          aria-current={tag === active ? 'page' : undefined}
          className={item}
        >
          {tag}
        </a>
      ))}
    </nav>
  )
}

function Card({ post, featured = false }: { post: PostSummary; featured?: boolean }) {
  const locale = getLocale()
  const topic = post.tags[0]
  return (
    <PostCard
      featured={featured}
      href={blogHref(`/blog/${encodeURIComponent(post.slug)}`)}
      title={post.title}
      summary={post.summary}
      meta={
        <>
          {topic && `${topic} · `}
          <time dateTime={post.date}>{formatDate(post.date, locale)}</time>
          {post.draft && ` · ${m.marketing_blog_draft()}`}
        </>
      }
      cover={
        <PostCover
          src={post.cover}
          alt={post.coverAlt}
          glyph={coverGlyph(post.title)}
          // 第一篇在首屏内，直接加载；其余封面懒加载
          loading={featured ? 'eager' : 'lazy'}
        />
      }
    />
  )
}

/** 分页（列表底部）：「第 1 页，共 3 页」+ 更早 / 较新的文章；只有一页时不输出 */
function Pager({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null
  const link = 'inline-flex min-h-11 items-center text-brand-ink'
  return (
    <nav
      aria-label={m.marketing_blog_pages_label()}
      className="flex flex-wrap items-center justify-between gap-4"
    >
      <span className="text-caption text-ink-subtle">
        {m.marketing_blog_page_status({ page: String(page), total: String(pages) })}
      </span>
      <span className="flex flex-wrap gap-x-6">
        {page > 1 && (
          <a
            href={blogHref(page === 2 ? '/blog' : `/blog/page/${page - 1}`)}
            rel="prev"
            className={link}
          >
            ← {m.marketing_blog_newer()}
          </a>
        )}
        {page < pages && (
          <a href={blogHref(`/blog/page/${page + 1}`)} rel="next" className={link}>
            {m.marketing_blog_older()} →
          </a>
        )}
      </span>
    </nav>
  )
}

/**
 * 博客列表（设计稿 warm-refresh/BlogList.dc.html）：分类筛选 → 第一篇横向大卡 → 卡片网格
 * （桌面 3 列、手机 1 列）→ 分页。每张卡只有标题一个链接；没有文章时显示空状态。
 */
export function PostList({
  posts,
  tags = [],
  activeTag,
  page = 1,
  pages = 1,
}: {
  posts: readonly PostSummary[]
  tags?: readonly string[]
  activeTag?: string
  page?: number
  pages?: number
}) {
  if (posts.length === 0) return <BlogEmptyState />
  const [first, ...rest] = posts
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <TopicNav tags={tags} {...(activeTag === undefined ? {} : { active: activeTag })} />
      {first && (
        <ul aria-label={m.marketing_blog_featured_label()} className="m-0 flex flex-col p-0">
          <Card post={first} featured />
        </ul>
      )}
      {rest.length > 0 && (
        <ul className="m-0 grid gap-4 p-0 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <Card key={post.slug} post={post} />
          ))}
        </ul>
      )}
      <Pager page={page} pages={pages} />
    </div>
  )
}
