import { describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
vi.mock('../content.functions.ts', () => ({ getBlogIndex: vi.fn() }))

import { Route } from '../../../routes/blog/index.tsx'

const matches = [{ routeId: '__root__', loaderData: { appUrl: 'https://seo.example' } }]
const post = {
  slug: 'hello',
  locale: 'en',
  title: 'Hello',
  summary: 'Hello summary',
  date: '2026-01-01',
  tags: [],
}

async function robotsFor(locale: string, posts: unknown[]) {
  runtime.locale = locale
  const head = Route.options.head
  if (!head) throw new Error('Blog index head is missing')
  const result = await head({
    matches,
    loaderData: { posts, page: 1, pages: 1, tags: [] },
  } as unknown as Parameters<typeof head>[0])
  const robots = result?.meta?.find((meta) => meta && 'name' in meta && meta.name === 'robots')
  const canonical = result?.links?.find((link) => link?.rel === 'canonical')
  return { robots: robots && 'content' in robots ? robots.content : undefined, canonical }
}

describe('博客列表 head（content-growth-phase1 4.1，marketing-site「空博客列表不进索引」）', () => {
  it.each(['en', 'es', 'zh-Hans', 'zh-Hant', 'ko', 'ja'])(
    '%s 没有已发布文章时输出 noindex, follow，canonical 照常',
    async (locale) => {
      const { robots, canonical } = await robotsFor(locale, [])
      expect(robots).toBe('noindex, follow')
      expect(canonical).toBeDefined()
    },
  )

  it('有已发布文章时不输出 robots，列表页恢复可索引', async () => {
    expect((await robotsFor('en', [post])).robots).toBeUndefined()
    expect((await robotsFor('zh-Hant', [{ ...post, locale: 'zh-Hant' }])).robots).toBeUndefined()
  })
})
