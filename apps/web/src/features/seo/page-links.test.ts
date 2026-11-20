import { describe, expect, it } from 'vitest'
import { hubSlice } from '../marketing/content.ts'
import type { SeoPage } from './metadata.ts'
import { breadcrumbTrail, hubPagePath, pageLinks, parseHubPage } from './page-links.ts'

// 内链区块数据（openspec seo-internal-linking 3.1–3.3）：锚文本只取 titleMain / anchorShort，未声明的区块为空
const page = (path: string, extra: Partial<SeoPage> = {}): SeoPage => ({
  path,
  locale: 'en',
  title: `SEO title of ${path}`,
  description: `About ${path}`,
  titleMain: `Main ${path}`,
  ...(path !== '/' && { parent: '/' }),
  ...extra,
})

const lessons = Array.from({ length: 9 }, (_, index) =>
  page(`/course/lesson-${index + 1}`, {
    parent: '/course',
    group: '/course',
    date: `2026-01-${String(9 - index).padStart(2, '0')}`,
  }),
)
const pages: SeoPage[] = [
  page('/', { titleMain: 'Acme', anchorShort: 'Home' }),
  page('/blog', { titleMain: 'Blog' }),
  page('/course', { parent: '/blog', anchorShort: 'Course' }),
  ...lessons,
  page('/blog/a', { parent: '/blog', related: ['/blog/b', '/blog/hidden', '/blog/missing'] }),
  page('/blog/b', { parent: '/blog', anchorShort: 'B short' }),
  page('/blog/hidden', { parent: '/blog', indexable: false }),
  page('/blog/a', { locale: 'zh', parent: '/blog', titleMain: '甲' }),
]
const linking = { series: [], groupLinksMax: 5 }

describe('面包屑', () => {
  it('沿 parent 链从首页列出全部上级，上级优先用 anchorShort', () => {
    const { breadcrumb } = pageLinks(pages, '/course/lesson-5', 'en', linking)
    expect(breadcrumb).toEqual([
      { href: '/', label: 'Home' },
      { href: '/blog', label: 'Blog' },
      { href: '/course', label: 'Course' },
    ])
    expect(pageLinks(pages, '/', 'en', linking).breadcrumb).toEqual([])
  })

  it('不在清单中的页面按 fallbackParent 生成；缺失或成环的上级处停止', () => {
    expect(pageLinks(pages, '/blog/draft', 'en', linking, '/blog').breadcrumb).toEqual([
      { href: '/', label: 'Home' },
      { href: '/blog', label: 'Blog' },
    ])
    const loop = [page('/x', { parent: '/y' }), page('/y', { parent: '/x' })]
    const find = (path: string) => loop.find((entry) => entry.path === path)
    expect(breadcrumbTrail('/x', find)).toEqual([{ href: '/y', label: 'Main /y' }])
    expect(breadcrumbTrail('/z', find, '/missing')).toEqual([])
  })
})

describe('相关与同组区块', () => {
  it('相关区块只列存在且可索引的目标，锚文本为目标主词', () => {
    const { related, group, series } = pageLinks(pages, '/blog/a', 'en', linking)
    expect(related).toEqual([
      { href: '/blog/b', label: 'Main /blog/b', description: 'About /blog/b' },
    ])
    // 未声明 group 时没有同组与系列区块
    expect(group).toBeNull()
    expect(series).toBeNull()
  })

  it('未声明 related 时相关区块为空；按语言取同语言页面', () => {
    expect(pageLinks(pages, '/blog/b', 'en', linking).related).toEqual([])
    expect(pageLinks(pages, '/blog/a', 'zh', linking).related).toEqual([])
    expect(pageLinks(pages, '/blog/a', 'fr', linking).breadcrumb).toEqual([])
  })

  it('同组区块最多 groupLinksMax 个，从本页之后轮转取，按组内顺序输出并链接组页', () => {
    const { group } = pageLinks(pages, '/course/lesson-8', 'en', { ...linking, groupLinksMax: 3 })
    expect(group?.key).toBe('/course')
    expect(group?.hub).toEqual({ href: '/course', label: 'Main /course' })
    expect(group?.items.map((item) => item.href)).toEqual([
      '/course/lesson-1',
      '/course/lesson-2',
      '/course/lesson-9',
    ])
    expect(group?.items[0]?.label).toBe('Main /course/lesson-1')
    // 每页都被同组的其他页链接到
    const linked = new Set(
      lessons.flatMap(
        (lesson) =>
          pageLinks(pages, lesson.path, 'en', { ...linking, groupLinksMax: 3 }).group?.items.map(
            (item) => item.href,
          ) ?? [],
      ),
    )
    expect(linked.size).toBe(lessons.length)
  })
})

describe('系列上一篇／下一篇', () => {
  it('declared 按清单顺序：中间一页链接前后两页，且它们不在同组区块重复', () => {
    const series = { ...linking, series: [{ group: '/course', orderBy: 'declared' as const }] }
    const links = pageLinks(pages, '/course/lesson-5', 'en', series)
    expect(links.series).toEqual({
      previous: { href: '/course/lesson-4', label: 'Main /course/lesson-4' },
      next: { href: '/course/lesson-6', label: 'Main /course/lesson-6' },
    })
    expect(links.group?.items.map((item) => item.href)).toEqual([
      '/course/lesson-1',
      '/course/lesson-2',
      '/course/lesson-7',
      '/course/lesson-8',
      '/course/lesson-9',
    ])
    expect(pageLinks(pages, '/course/lesson-1', 'en', series).series?.previous).toBeNull()
    expect(pageLinks(pages, '/course/lesson-9', 'en', series).series?.next).toBeNull()
  })

  it('date 按发布时间升序排列', () => {
    const series = { ...linking, series: [{ group: '/course', orderBy: 'date' as const }] }
    // 日期与声明顺序相反：lesson-9 最早
    expect(pageLinks(pages, '/course/lesson-9', 'en', series).series).toEqual({
      previous: null,
      next: { href: '/course/lesson-8', label: 'Main /course/lesson-8' },
    })
  })
})

describe('hub 分页', () => {
  it('第 1 页即 hub，其余为 /page/<n>；页码只接受不带前导零的整数', () => {
    expect(hubPagePath('/blog', 1)).toBe('/blog')
    expect(hubPagePath('/blog', 2)).toBe('/blog/page/2')
    expect(hubPagePath('/', 3)).toBe('/page/3')
    expect(parseHubPage('2')).toBe(2)
    for (const bad of ['0', '02', '1.5', 'x', '-1', '']) expect(parseHubPage(bad)).toBeNull()
  })

  it('下级超过上限时分页：150 个、上限 100 时第二页列出剩余 50 个', () => {
    const items = Array.from({ length: 150 }, (_, index) => index)
    expect(hubSlice(items, 1, 100)).toHaveLength(100)
    expect(hubSlice(items, 2, 100)).toEqual(items.slice(100))
    expect(hubSlice(items, 3, 100)).toBeNull()
    expect(hubSlice([], 1, 100)).toEqual([])
  })
})
