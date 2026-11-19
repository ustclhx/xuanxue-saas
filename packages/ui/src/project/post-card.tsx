import type { ReactNode } from 'react'
import { cn } from '../lib/utils.ts'

// 博客列表的文章卡片（设计稿 warm-refresh/BlogList.dc.html，Proposals79 B「PostCard / PostCover」）：
// 封面 16:9、「分类 · 日期」小字、标题、摘要。标题是卡片里唯一的 <a>，点击区域用伪元素铺满整张卡，
// 不出现「阅读更多」。无客户端状态，服务端直接输出。

export interface PostCoverProps {
  /** 自托管图片的站内路径；省略时输出生成封面 */
  src?: string | undefined
  /** 图片的替代文字（有 `src` 时必填，由内容集合的 schema 保证） */
  alt?: string | undefined
  /** 生成封面中央的字形（数字、单字或罗马数字） */
  glyph?: string | undefined
  /** 首屏内的封面传 eager，其余默认懒加载 */
  loading?: 'eager' | 'lazy'
  className?: string
}

/**
 * 封面：固定 16:9，图片载入前后高度不变（不引起位移）。没有图片时是生成封面：
 * surface-2 底、illus 圆环、accent 字形，纯装饰，对读屏隐藏。
 */
export function PostCover({ src, alt, glyph, loading = 'lazy', className }: PostCoverProps) {
  const frame = cn('aspect-video w-full overflow-hidden rounded-field bg-surface-2', className)
  if (src)
    return (
      <div className={frame}>
        <img
          src={src}
          alt={alt ?? ''}
          width={1280}
          height={720}
          loading={loading}
          decoding="async"
          className="block size-full object-cover"
        />
      </div>
    )
  return (
    <div aria-hidden="true" data-slot="post-cover-fallback" className={frame}>
      <svg viewBox="0 0 320 180" aria-hidden="true" focusable="false" className="block size-full">
        <g fill="none" stroke="currentColor" strokeWidth="1.25" className="text-illus">
          <circle cx="160" cy="90" r="68" />
          <circle cx="160" cy="90" r="50" opacity="0.55" />
        </g>
        {glyph && (
          <text
            x="160"
            y="93"
            fontSize="56"
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            className="font-heading text-mark"
          >
            {glyph}
          </text>
        )}
      </svg>
    </div>
  )
}

export interface PostCardProps {
  /** 文章地址：服务端输出的真实链接 */
  href: string
  /** 文章标题，同时是链接的锚文本 */
  title: string
  summary: ReactNode
  /** 标题上方的小字：「分类 · 日期」（分类只作说明，不是链接） */
  meta: ReactNode
  cover: ReactNode
  /** 横向大卡（列表第一篇）：桌面封面在左、文字在右，标题用 title 字号 */
  featured?: boolean
  className?: string
}

export function PostCard({
  href,
  title,
  summary,
  meta,
  cover,
  featured = false,
  className,
}: PostCardProps) {
  return (
    <li
      data-slot="post-card"
      className={cn(
        'relative flex list-none flex-col gap-4 rounded-object bg-surface p-3 pb-6',
        featured && 'md:grid md:grid-cols-12 md:items-center md:gap-8 md:pb-3',
        className,
      )}
    >
      <div className={cn(featured && 'md:col-span-7')}>{cover}</div>
      <div
        className={cn(
          'flex flex-col gap-2 px-3',
          featured && 'md:col-span-5 md:gap-3 md:pr-5 md:pl-0',
        )}
      >
        <p className="m-0 text-caption text-ink-subtle">{meta}</p>
        <h2
          className={cn(
            'm-0 text-balance font-heading text-ink',
            featured ? 'text-title' : 'text-subtitle',
          )}
        >
          {/* 伪元素铺满卡片：整张卡可点，焦点环画在卡片外沿 */}
          <a
            href={href}
            className="underline underline-offset-4 after:absolute after:inset-0 after:rounded-object hover:decoration-2 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:outline-offset-3"
          >
            {title}
          </a>
        </h2>
        <p className="m-0 text-body text-ink-muted">{summary}</p>
      </div>
    </li>
  )
}
