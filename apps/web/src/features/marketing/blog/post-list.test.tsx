import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { postSchema } from '../../../../content-collections.ts'
import { inlineLinks, linkPhrases, plainInline } from '../content-page.tsx'
import { coverGlyph, PostList, type PostSummary } from './post-list.tsx'

// 博客列表（openspec refresh-visual-system-warm 9.1，设计稿 warm-refresh/BlogList.dc.html）：
// 卡片里标题是唯一的链接、封面固定宽高比、没有封面图时输出装饰性的生成封面。

const post = (slug: string, extra: Partial<PostSummary> = {}): PostSummary => ({
  slug,
  title: `Title of ${slug}`,
  summary: `Summary of ${slug}`,
  date: '2026-11-12',
  tags: ['numerology', 'guide'],
  draft: false,
  ...extra,
})

const anchors = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
    href: match[1],
    text: (match[2] ?? '').replace(/<[^>]+>/g, '').trim(),
  }))

describe('博客列表', () => {
  const posts = [
    post('first', { cover: '/images/blog/first.webp', coverAlt: 'A column of numbers' }),
    post('second', { title: 'Master Numbers 11, 22 and 33 Explained' }),
    post('third', { cover: '/images/blog/third.webp', coverAlt: 'A reversed card' }),
  ]
  const html = renderToStaticMarkup(
    <PostList posts={posts} tags={['guide', 'numerology']} page={1} pages={3} />,
  )

  it('每张卡只有标题一个链接，锚文本是文章标题，没有「阅读更多」', () => {
    const cards = html.split('data-slot="post-card"').slice(1)
    expect(cards).toHaveLength(3)
    for (const [index, card] of cards.entries()) {
      const links = anchors(card.split('</li>')[0] ?? '')
      expect(links).toEqual([{ href: `/blog/${posts[index]?.slug}`, text: posts[index]?.title }])
    }
    expect(html).not.toMatch(/read more/i)
    // 分类只作小字，不是链接
    expect(html).toContain('numerology · <time dateTime="2026-11-12">')
    expect(html).not.toContain('href="/blog/tags/numerology">numerology</a> ·')
  })

  it('第一篇是横向大卡并直接加载封面，其余封面懒加载', () => {
    expect(html).toMatch(/aria-label="Featured post"/)
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
    expect(images).toHaveLength(2)
    expect(images[0]).toContain('alt="A column of numbers"')
    expect(images[0]).toContain('loading="eager"')
    expect(images[1]).toContain('alt="A reversed card"')
    expect(images[1]).toContain('loading="lazy"')
    // 固定宽高比：图片载入前后不位移
    for (const image of images) expect(image).toMatch(/width="1280" height="720"/)
    expect(html.match(/aspect-video/g)).toHaveLength(3)
  })

  it('没有封面图时输出装饰性的生成封面：对读屏隐藏，字形取自标题', () => {
    const fallback = /<div aria-hidden="true" data-slot="post-cover-fallback"[\s\S]*?<\/div>/.exec(
      html,
    )?.[0]
    expect(fallback).toContain('text-illus')
    expect(fallback).toContain('text-mark')
    expect(fallback).toContain('>11</text>')
    expect(coverGlyph('什么是日主？')).toBe('什')
    expect(coverGlyph('  “how to ask”')).toBe('H')
  })

  it('分类筛选链接到标签页，分页给出页码与更早的文章', () => {
    expect(html).toContain('aria-label="Topics"')
    expect(anchors(html)).toEqual(
      expect.arrayContaining([
        { href: '/blog', text: 'All' },
        { href: '/blog/tags/guide', text: 'guide' },
        { href: '/blog/page/2', text: 'Older posts →' },
      ]),
    )
    expect(html).toContain('Page 1 of 3')
    expect(html).toMatch(/<a href="\/blog" aria-current="page"/)
    const second = renderToStaticMarkup(<PostList posts={posts} page={2} pages={3} />)
    expect(anchors(second)).toEqual(
      expect.arrayContaining([
        { href: '/blog', text: '← Newer posts' },
        { href: '/blog/page/3', text: 'Older posts →' },
      ]),
    )
    // 只有一页时不输出分页
    expect(renderToStaticMarkup(<PostList posts={posts} />)).not.toContain('Older posts')
  })

  it('空列表：说明里链接本站主工具与三张牌塔罗，共 2 条', () => {
    const empty = renderToStaticMarkup(<PostList posts={[]} />)
    expect(empty).toContain('No posts yet.')
    expect(anchors(empty)).toEqual([
      { href: '/life-path-number', text: 'life path number' },
      { href: '/tarot', text: 'three-card tarot' },
    ])
    expect(empty).not.toMatch(/\[|\]\(/)
  })
})

describe('文章 frontmatter：cover 与 coverAlt', () => {
  const base = { title: 'T', summary: 'S', date: '2026-11-12', content: 'body' }

  it('cover 为站内路径，写了 cover 就必须写 coverAlt', () => {
    expect(postSchema.safeParse(base).success).toBe(true)
    expect(
      postSchema.safeParse({ ...base, cover: '/images/blog/a.webp', coverAlt: 'Alt' }).success,
    ).toBe(true)
    const missing = postSchema.safeParse({ ...base, cover: '/images/blog/a.webp' })
    expect(missing.success).toBe(false)
    expect(missing.error?.issues[0]?.path).toEqual(['coverAlt'])
    // 图片自托管：不接受外部地址
    for (const cover of ['https://cdn.example/a.webp', '//cdn.example/a.webp', 'a.webp'])
      expect(postSchema.safeParse({ ...base, cover, coverAlt: 'Alt' }).success).toBe(false)
  })
})

describe('文案里的链接标记', () => {
  it('inlineLinks 把 [锚文本](key) 换成真实链接，未知 key 只留文字', () => {
    const html = renderToStaticMarkup(
      inlineLinks('Try the [life path number](main) tool or [tarot](missing).', {
        main: { href: '/life-path-number' },
      }),
    )
    expect(html).toBe(
      'Try the <a href="/life-path-number" class="text-brand-ink">life path number</a> tool or tarot.',
    )
    expect(plainInline('See the [Privacy Policy](privacy).')).toBe('See the Privacy Policy.')
  })

  it('linkPhrases 只给已有的名称加链接，不改写句子', () => {
    const text = 'Unused credits can be refunded. See the Refund Policy for details.'
    expect(
      renderToStaticMarkup(
        linkPhrases(text, [
          { phrase: 'Refund Policy', href: '/refund' },
          { phrase: 'Privacy Policy', href: '/privacy' },
        ]),
      ),
    ).toBe(
      'Unused credits can be refunded. See the <a href="/refund" class="text-brand-ink">Refund Policy</a> for details.',
    )
    expect(linkPhrases(text, [{ phrase: 'Privacy Policy', href: '/privacy' }])).toBe(text)
  })
})
