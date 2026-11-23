import type { SiteId } from '@xuanxue/config'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { Route as TwoSegment } from '../../routes/$section/$item.tsx'
import { Route as SingleSegment } from '../../routes/$slug.tsx'
import { Route as LifePathNumber } from '../../routes/life-path-number/$number.tsx'
import { Route as NumeroDeVida } from '../../routes/numero-de-vida/$number.tsx'
import { templateConfig } from '../../server/template-config.ts'
import { EAST_EN_CONTENT_ROUTES } from '../east-en/paths.ts'
import { routeSite } from '../site/gate.ts'
import { easternPageOf } from '../tools/bazi/eastern-routes.ts'
import { getNumerologyPage } from '../tools/numerology/content.functions.ts'
import { WEST_CONTENT_ROUTES, type WestContentRoute } from '../west-content/routes.ts'
import { EAST_CONTENT_ROUTES, type EastContentRoute } from './routes.ts'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hans' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})

// 这里验证路由数据与 head。各内容组发布后的正文由实际构建验收。
vi.mock('../tools/numerology/content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))
vi.mock('../tools/bazi/bazi-home.tsx', () => ({ BaziHome: () => null }))
vi.mock('../tools/bazi/gunghap-page.tsx', () => ({ GunghapPage: () => null }))
vi.mock('../east-en/feelings.functions.ts', () => ({ getTarotFeelings: vi.fn() }))
vi.mock('../east-en/tarot-pages.tsx', () => ({ EastEnTarotPage: () => null }))
vi.mock('./route-data.ts', () => ({
  EastContentPage: () => null,
  loadEastContent: (route: EastContentRoute, date: unknown) => ({
    route,
    content: date,
    head: { meta: [{ title: route.id }] },
  }),
}))
vi.mock('../west-content/route-data.ts', () => ({
  WestContentPage: () => null,
  loadWestContent: (route: WestContentRoute, search: unknown) => ({
    route,
    content: search,
    head: { meta: [{ title: route.id }] },
  }),
}))

const loadSingle = SingleSegment.options.loader
const loadTwo = TwoSegment.options.loader
const singleHead = SingleSegment.options.head
if (typeof loadSingle !== 'function' || typeof loadTwo !== 'function' || !singleHead)
  throw new Error('缺少待测的路由处理函数')

const eastFixtures: EastContentRoute[] = [
  { locale: 'ja', path: '/四柱推命相性/友人', collection: 'compat-scenario', id: 'friends' },
]
const eastEnglishFixtures = [
  { locale: 'en', path: '/chinese-zodiac', collection: 'zodiac', id: 'index' },
  {
    locale: 'en',
    path: '/bazi-compatibility/friends',
    collection: 'compat-scenario',
    id: 'friends',
  },
] satisfies (EastContentRoute & { locale: 'en' })[]
const westFixtures: WestContentRoute[] = [
  { locale: 'en', path: '/moon-phase-today', collection: 'moon', id: 'today' },
  { locale: 'en', path: '/moon-calendar/january', collection: 'moon', id: 'january' },
  { locale: 'es', path: '/fase-lunar-hoy', collection: 'moon', id: 'today' },
]

const pairs = [
  {
    site: 'east',
    locale: 'zh-Hans',
    section: '生肖配对',
    reverse: '属牛和属鼠',
    canonical: '属鼠和属牛',
    same: '属鼠和属鼠',
    prefix: '/zh-hans',
  },
  {
    site: 'east',
    locale: 'ko',
    section: '띠궁합',
    reverse: '소띠-쥐띠',
    canonical: '쥐띠-소띠',
    same: '쥐띠-쥐띠',
    prefix: '/ko',
  },
  {
    site: 'east',
    locale: 'en',
    section: 'chinese-zodiac-compatibility',
    reverse: 'ox-and-rat',
    canonical: 'rat-and-ox',
    same: 'rat-and-rat',
    prefix: '',
  },
  {
    site: 'west',
    locale: 'en',
    section: 'zodiac-compatibility',
    reverse: 'leo-and-aries',
    canonical: 'aries-and-leo',
    same: 'aries-and-aries',
    prefix: '',
  },
] as const

// 模拟后续内容组只登记规范页，测试结束后复原清单。
const eastRoutes = EAST_CONTENT_ROUTES as EastContentRoute[]
const eastEnglishRoutes = EAST_EN_CONTENT_ROUTES as (EastContentRoute & { locale: 'en' })[]
const westRoutes = WEST_CONTENT_ROUTES as WestContentRoute[]
const routeCounts = [eastRoutes.length, eastEnglishRoutes.length, westRoutes.length] as const
beforeAll(() => {
  eastRoutes.push(...eastFixtures)
  eastEnglishRoutes.push(...eastEnglishFixtures)
  westRoutes.push(...westFixtures)
  for (const { site, locale, section, canonical, same } of pairs) {
    for (const id of [canonical, same]) {
      const path = `/${section}/${id}` as const
      if (site === 'west') westRoutes.push({ locale, path, collection: 'zodiac', id })
      else if (locale === 'en')
        eastEnglishRoutes.push({ locale, path, collection: 'zodiac-pair', id })
      else eastRoutes.push({ locale, path, collection: 'zodiac-pair', id })
    }
  }
})
afterAll(() => {
  eastRoutes.splice(routeCounts[0])
  eastEnglishRoutes.splice(routeCounts[1])
  westRoutes.splice(routeCounts[2])
})

const single = async (site: SiteId, locale: string, slug: string) => {
  runtime.locale = locale
  return loadSingle({
    params: { slug },
    deps: { date: undefined },
    parentMatchPromise: Promise.resolve({ loaderData: { site: { id: site } } }),
  } as Parameters<typeof loadSingle>[0])
}

const two = async (
  site: SiteId,
  locale: string,
  section: string,
  item: string,
  deps = {},
  location = { searchStr: '', hash: '' },
) => {
  runtime.locale = locale
  return loadTwo({
    params: { section, item },
    deps,
    location,
    parentMatchPromise: Promise.resolve({ loaderData: { site: { id: site } } }),
  } as Parameters<typeof loadTwo>[0])
}

const notFound = { isNotFound: true }

it('东方站简中与根路径英文未登记地址返回 404', async () => {
  await expect(single('east', 'zh-Hans', '未登记内容')).rejects.toMatchObject(notFound)
  await expect(two('east', 'ko', '띠', '미등록')).rejects.toMatchObject(notFound)
  await expect(single('east', 'en', 'chinese-zodiac-2027')).rejects.toMatchObject(notFound)
  await expect(two('east', 'en', 'bazi-compatibility', 'unknown')).rejects.toMatchObject(notFound)
})

it('西方站未登记的单段与两段地址返回 404', async () => {
  await expect(single('west', 'es', 'sin-registrar')).rejects.toMatchObject(notFound)
  await expect(two('west', 'en', 'moon-calendar', 'missing')).rejects.toMatchObject(notFound)
})

it('已登记的东方站内容只在本站分发，西方站拒绝东方站语言前缀', async () => {
  await expect(single('east', 'en', 'chinese-zodiac')).resolves.toMatchObject({
    eastContent: { route: { collection: 'zodiac' } },
  })
  await expect(two('east', 'en', 'bazi-compatibility', 'friends')).resolves.toMatchObject({
    eastContent: { route: { collection: 'compat-scenario' } },
  })
  await expect(single('west', 'en', 'chinese-zodiac')).rejects.toMatchObject(notFound)
  await expect(two('west', 'en', 'bazi-compatibility', 'friends')).rejects.toMatchObject(notFound)
  for (const path of ['/zh-hans/黄历', '/zh-hans/黄历/1月', '/ko/띠/쥐띠', '/chinese-zodiac']) {
    expect(routeSite(new URL(path, 'https://arcanumber.com'), templateConfig)).toEqual({
      kind: 'not-found',
    })
  }
})

it('已登记的西方站内容透过单段与两段路由分发，东方站同地址返回 404', async () => {
  await expect(single('west', 'es', 'fase-lunar-hoy')).resolves.toMatchObject({
    westContent: { route: { collection: 'moon', locale: 'es' } },
  })
  await expect(
    two('west', 'en', 'moon-calendar', 'january', { year: 2027 }),
  ).resolves.toMatchObject({
    westContent: { route: { collection: 'moon', id: 'january' }, content: { year: 2027 } },
  })
  for (const path of ['/moon-phase-today', '/moon-calendar/january', '/es/fase-lunar-hoy']) {
    expect(routeSite(new URL(path, 'https://ganjiday.com'), templateConfig)).toEqual({
      kind: 'not-found',
    })
  }
  await expect(two('east', 'en', 'moon-calendar', 'january')).rejects.toMatchObject(notFound)
})

it('东方站繁中和日文的两段地址交给东方内容集合', async () => {
  await expect(two('east', 'zh-Hant', '農民曆', '1月')).resolves.toMatchObject({
    // 農民曆由第 18 组登记，复用黄历集合
    eastContent: { route: { collection: 'almanac', locale: 'zh-Hant', id: '1' } },
  })
  await expect(two('east', 'ja', '四柱推命相性', '友人')).resolves.toMatchObject({
    eastContent: { route: { collection: 'compat-scenario', locale: 'ja' } },
  })
})

it.each(pairs)(
  '$site/$locale 按地支或黄道顺序规范化配对地址',
  async ({ site, locale, section, reverse, canonical, same, prefix }) => {
    await expect(
      two(
        site,
        locale,
        section,
        encodeURIComponent(reverse),
        {},
        { searchStr: '?ref=test', hash: 'faq' },
      ),
    ).rejects.toMatchObject({
      status: 301,
      options: { href: `${prefix}${encodeURI(`/${section}/${canonical}`)}?ref=test#faq` },
    })
    for (const item of [canonical, same]) {
      const result = await two(site, locale, section, item)
      // zh-Hans 配对页已由第 16 组登记（id 为地支 key），按地址核对规范页
      expect(result.eastContent?.route ?? result.westContent?.route).toMatchObject({
        path: `/${section}/${item}`,
      })
    }
  },
)

it('未发布的反序地址在东方站保留英文分发并返回 404', async () => {
  const path = '/chinese-zodiac-compatibility/goat-and-snake'
  expect(routeSite(new URL(path, 'https://ganjiday.com'), templateConfig)).toEqual({
    kind: 'pass',
    noindex: false,
  })
  await expect(
    two('east', 'en', 'chinese-zodiac-compatibility', 'goat-and-snake'),
  ).rejects.toMatchObject(notFound)
})

it('现有生肖、黄历及东方英文塔罗仍使用各自集合', async () => {
  await expect(two('east', 'ko', '띠', '쥐띠')).resolves.toMatchObject({
    eastContent: { route: { collection: 'zodiac', id: 'zi' } },
  })
  await expect(two('east', 'zh-Hans', '黄历', '1月')).resolves.toMatchObject({
    eastContent: { route: { collection: 'almanac', id: '1' } },
  })
  await expect(single('east', 'en', 'tarot-feelings')).resolves.toMatchObject({
    tarot: { kind: 'index' },
  })
  await expect(two('east', 'en', 'tarot-spreads', 'one-card')).resolves.toMatchObject({
    tarot: {
      kind: 'spread',
      spread: 'daily',
      head: {
        links: expect.arrayContaining([
          { rel: 'canonical', href: 'https://ganjiday.com/tarot-spreads/one-card' },
        ]),
      },
    },
  })
})

it('合盘五种语言已在注册表发布（content-growth-v2-tools 12.3）；中日英工具页由 compat 集合分发（第 13 组）', async () => {
  for (const [locale, slug] of [
    ['zh-Hans', '八字合盘'],
    ['zh-Hant', '八字合盤'],
    ['ja', '四柱推命相性'],
    ['en', 'bazi-compatibility'],
  ] as const) {
    expect(easternPageOf(locale, slug)).toBe('gunghap')
    await expect(single('east', locale, slug)).resolves.toMatchObject({
      eastContent: { route: { locale, collection: 'compat', id: 'tool' } },
    })
  }
  // ko `/사주궁합` 正文不改：仍由排盘页分发
  expect(easternPageOf('ko', '사주궁합')).toBe('gunghap')
  await expect(single('east', 'ko', '사주궁합')).resolves.toEqual({ easternTool: 'gunghap' })
  // 西方站同路径仍为 404
  await expect(single('west', 'en', 'bazi-compatibility')).rejects.toMatchObject(notFound)

  const params = { slug: '八字排盘' }
  const loaderData = await single('east', 'zh-Hans', params.slug)
  expect(loaderData).toEqual({ easternTool: 'bazi' })
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

it('西方英文与西语的生命灵数 7 仍使用既有数字子页', async () => {
  const en = LifePathNumber.options
  const es = NumeroDeVida.options
  if (
    !en.beforeLoad ||
    !es.beforeLoad ||
    typeof en.loader !== 'function' ||
    typeof es.loader !== 'function'
  )
    throw new Error('缺少数字子页的路由处理函数')

  const input = { params: { number: '7' } }
  runtime.locale = 'en'
  await en.beforeLoad(input as Parameters<typeof en.beforeLoad>[0])
  await en.loader(input as Parameters<typeof en.loader>[0])
  expect(getNumerologyPage).toHaveBeenLastCalledWith({ data: { slug: 'life-path-7' } })

  runtime.locale = 'es'
  await es.beforeLoad(input as Parameters<typeof es.beforeLoad>[0])
  await es.loader(input as Parameters<typeof es.loader>[0])
  expect(getNumerologyPage).toHaveBeenLastCalledWith({
    data: { locale: 'es', slug: 'life-path-7' },
  })
})
