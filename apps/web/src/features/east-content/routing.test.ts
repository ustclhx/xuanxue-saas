import { expect, it, vi } from 'vitest'
import { Route as TwoSegment } from '../../routes/$section/$item.tsx'
import { Route as SingleSegment } from '../../routes/$slug.tsx'
import { templateConfig } from '../../server/template-config.ts'
import { routeSite } from '../site/gate.ts'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hans' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})

// 单测校验路由数据与 head；正文和生成的内容集合由构建后验收覆盖。
vi.mock('../tools/numerology/content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))
vi.mock('../tools/bazi/bazi-home.tsx', () => ({ BaziHome: () => null }))
vi.mock('../east-en/feelings.functions.ts', () => ({ getTarotFeelings: vi.fn() }))
vi.mock('../east-en/tarot-pages.tsx', () => ({ EastEnTarotPage: () => null }))

const loadSingle = SingleSegment.options.loader
const beforeSingle = SingleSegment.options.beforeLoad
const loadTwo = TwoSegment.options.loader
const singleHead = SingleSegment.options.head
const notFound = { isNotFound: true }
if (
  typeof loadSingle !== 'function' ||
  typeof loadTwo !== 'function' ||
  !beforeSingle ||
  !singleHead
)
  throw new Error('缺少待测的路由处理函数')

it('东方站未登记的单段与两段地址返回 404', async () => {
  runtime.locale = 'zh-Hans'
  expect(() =>
    beforeSingle({ params: { slug: '未登记内容' } } as Parameters<typeof beforeSingle>[0]),
  ).toThrow(expect.objectContaining(notFound))
  runtime.locale = 'ko'
  await expect(
    loadTwo({ params: { section: '띠', item: '미등록' } } as Parameters<typeof loadTwo>[0]),
  ).rejects.toMatchObject(notFound)
})

it('西方站拒绝东方站语言的单段与两段地址', () => {
  for (const path of ['/zh-hans/黄历', '/zh-hans/黄历/1月', '/ko/띠/쥐띠']) {
    expect(routeSite(new URL(path, 'https://arcanumber.com'), templateConfig)).toEqual({
      kind: 'not-found',
    })
  }
})

it('东方站英文两段塔罗地址仍返回牌阵数据与 head', async () => {
  runtime.locale = 'en'
  const result = await loadTwo({
    params: { section: 'tarot-spreads', item: 'one-card' },
  } as Parameters<typeof loadTwo>[0])
  expect(result.tarot).toMatchObject({
    kind: 'spread',
    spread: 'daily',
    head: {
      links: expect.arrayContaining([
        { rel: 'canonical', href: 'https://ganjiday.com/tarot-spreads/one-card' },
      ]),
    },
  })
})

it('东方站简中排盘继续使用原单段路由的 head', async () => {
  runtime.locale = 'zh-Hans'
  const params = { slug: '八字排盘' }
  const loaderData = await loadSingle({ params, deps: { date: undefined } } as Parameters<
    typeof loadSingle
  >[0])
  expect(loaderData).toEqual({ west: null })
  const matches = [{ routeId: '__root__', loaderData: { appUrl: 'https://ganjiday.com' } }]
  expect(
    (
      await singleHead({ params, matches, loaderData } as unknown as Parameters<
        typeof singleHead
      >[0])
    )?.links,
  ).toContainEqual({
    rel: 'canonical',
    href: `https://ganjiday.com/zh-hans/${encodeURIComponent(params.slug)}`,
  })
})
