import { zodiacPairTable } from '@xuanxue/bazi/almanac'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { reversedPairPath } from '../../routing/pair-path.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import { markOf, pairFacts, pairMarks, relatedPairs, seriesOf, signYears } from './data.ts'
import type { ZodiacPairHubData } from './page.functions.ts'
import { PairGrid } from './pages.tsx'
import {
  ZODIAC_PAIR_KEYS,
  zodiacPairContentRoutes,
  zodiacPairName,
  zodiacPairPath,
  zodiacPairSlug,
} from './paths.ts'
import { zodiacPairSeoPages } from './seo-pages.ts'

vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'zh-Hans' }
})

describe('配对事实与引擎一致', () => {
  it('78 组按地支顺序，关系与五行逐项等于 zodiacPairTable', () => {
    const table = zodiacPairTable()
    expect(ZODIAC_PAIR_KEYS).toHaveLength(78)
    expect(ZODIAC_PAIR_KEYS).toEqual(table.map((row) => row.branches.join('-')))
    for (const [index, key] of ZODIAC_PAIR_KEYS.entries()) {
      const facts = pairFacts(key)
      expect(facts.relations).toEqual(table[index]?.relations)
      expect(facts.elements).toEqual(table[index]?.elements)
      expect(facts.elementRelation).toEqual(table[index]?.elementRelation)
    }
  })

  it('子午相冲、子丑六合、巳申六合优先于刑与破、同生肖记为同', () => {
    expect(pairFacts('zi-wu').relations).toContain('clash')
    expect(markOf('zi-wu')).toBe('clash')
    expect(markOf('zi-chou')).toBe('sixCombine')
    expect(pairFacts('si-shen').relations).toEqual(['sixCombine', 'punish', 'break'])
    expect(markOf('si-shen')).toBe('sixCombine')
    expect(markOf('zi-chen')).toBe('triad')
    expect(markOf('zi-wei')).toBe('harm')
    expect(markOf('zi-yin')).toBe('none')
    expect(markOf('wu-wu')).toBe('same')
  })

  it('年份、相关配对与上一对/下一对', () => {
    expect(signYears('zi', 2026)).toEqual([1960, 1972, 1984, 1996, 2008, 2020, 2032])
    expect(relatedPairs('zi-chou')).toEqual(['zi-shen', 'zi-chen', 'zi-wu'])
    expect(seriesOf('zi-zi')).toEqual({ previous: null, next: 'zi-chou' })
    expect(seriesOf('hai-hai')).toEqual({ previous: 'xu-hai', next: null })
  })
})

describe('地址、反序与注册表', () => {
  it('zh-hans 登记总表与 78 个配对页，ko、en 未发布不登记', () => {
    expect(eastContentRouteOf('zh-Hans', '/生肖配对')).toMatchObject({ id: 'index' })
    expect(eastContentRouteOf('zh-Hans', '/生肖配对/属鼠和属牛')).toMatchObject({
      collection: 'zodiac-pair',
      id: 'zi-chou',
    })
    expect(eastContentRouteOf('zh-Hans', '/生肖配对/属牛和属鼠')).toBeUndefined()
    expect(eastContentRouteOf('ko', '/띠궁합/쥐띠-소띠')).toBeUndefined()
    const routes = TOOL_ROUTES.filter((route) => route.id.startsWith('zodiac-pair'))
    expect(routes).toHaveLength(79)
    expect(routes.every((route) => Object.keys(route.paths).join() === 'zh-Hans')).toBe(true)
    expect(routes[0]).toMatchObject({ directoryGroup: 'relation', freeLabel: 'free_lookup' })
  })

  it('反序与同生肖地址：反序 301 到规范地址，同生肖不跳转', () => {
    expect(reversedPairPath('east', 'zh-Hans', encodeURI('/生肖配对/属牛和属鼠'))).toBe(
      '/生肖配对/属鼠和属牛',
    )
    expect(reversedPairPath('east', 'zh-Hans', '/生肖配对/属猪和属鼠')).toBe('/生肖配对/属鼠和属猪')
    expect(reversedPairPath('east', 'zh-Hans', '/生肖配对/属鼠和属鼠')).toBeUndefined()
    expect(reversedPairPath('east', 'zh-Hans', '/生肖配对/属鼠和属牛')).toBeUndefined()
    // 每个规范 slug 都能被反序规则识别
    for (const key of ZODIAC_PAIR_KEYS) {
      const [a, b] = zodiacPairSlug('zh-Hans', key).split('和')
      if (a !== b)
        expect(reversedPairPath('east', 'zh-Hans', `/生肖配对/${b}和${a}`)).toBe(
          zodiacPairPath('zh-Hans', key),
        )
    }
  })

  it('hreflang 只含已发布语言：ko 内容存在也不进清单', () => {
    const entries = [
      { locale: 'zh-Hans', key: 'zi-chou', title: 't', description: 'd' },
      { locale: 'ko', key: 'zi-chou', title: 't', description: 'd' },
      { locale: 'zh-Hans', key: 'index', title: 't', description: 'd' },
    ]
    const pages = zodiacPairSeoPages(entries)
    expect(pages.map((page) => page.locale)).toEqual(['zh-Hans', 'zh-Hans'])
    expect(pages[0]).toMatchObject({
      path: '/生肖配对/属鼠和属牛',
      parent: '/生肖配对',
      titleMain: '属鼠和属牛',
      alternates: { 'zh-Hans': '/生肖配对/属鼠和属牛' },
    })
    expect(pages[1]).toMatchObject({ path: '/生肖配对', parent: '/' })
  })
})

describe('总表网格', () => {
  it('12×12 网格链接到全部 78 个规范配对页，对称格指向同一页', () => {
    const page = { locale: 'zh-Hans', marks: pairMarks() } as unknown as ZodiacPairHubData
    const html = renderToStaticMarkup(createElement(PairGrid, { page }))
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => decodeURI(match[1] ?? ''))
    expect(hrefs).toHaveLength(144)
    const unique = new Set(hrefs)
    expect(unique.size).toBe(78)
    for (const key of ZODIAC_PAIR_KEYS)
      expect(unique.has(`/zh-hans${zodiacPairPath('zh-Hans', key)}`)).toBe(true)
    expect(html).toContain('aria-label="属鼠 × 属马：六冲"')
  })
})

describe('ko 띠궁합与 en Chinese zodiac compatibility（第 17 组）', () => {
  it('登记后各有总表与 78 个配对页：ko 按地支顺序「쥐띠-소띠」，en 走根路径「rat-and-ox」', () => {
    const { east, eastEn } = zodiacPairContentRoutes(['ko', 'en'])
    expect(east).toHaveLength(79)
    expect(eastEn).toHaveLength(79)
    expect(east.every((route) => route.locale === 'ko')).toBe(true)
    expect(east[0]).toMatchObject({ path: '/띠궁합', id: 'index' })
    expect(east.find((route) => route.id === 'zi-chou')?.path).toBe('/띠궁합/쥐띠-소띠')
    expect(eastEn.find((route) => route.id === 'zi-chou')?.path).toBe(
      '/chinese-zodiac-compatibility/rat-and-ox',
    )
    expect(eastEn.find((route) => route.id === 'xu-hai')?.path).toBe(
      '/chinese-zodiac-compatibility/dog-and-pig',
    )
    expect(new Set(east.map((route) => route.path)).size).toBe(79)
    expect(new Set(eastEn.map((route) => route.path)).size).toBe(79)
    expect(zodiacPairName('ko', 'zi-chou')).toBe('쥐띠와 소띠')
    expect(zodiacPairName('en', 'zi-chou')).toBe('Rat and Ox')
    expect(zodiacPairName('zh-Hans', 'zi-chou')).toBe('属鼠和属牛')
  })

  it('反序地址 301 到规范地址，同生肖不跳转', () => {
    expect(reversedPairPath('east', 'ko', encodeURI('/띠궁합/소띠-쥐띠'))).toBe('/띠궁합/쥐띠-소띠')
    expect(reversedPairPath('east', 'en', '/chinese-zodiac-compatibility/ox-and-rat')).toBe(
      '/chinese-zodiac-compatibility/rat-and-ox',
    )
    expect(reversedPairPath('east', 'ko', '/띠궁합/쥐띠-쥐띠')).toBeUndefined()
    expect(reversedPairPath('east', 'en', '/chinese-zodiac-compatibility/rat-and-rat')).toBe(
      undefined,
    )
    // 西方站不认东方站的地址
    expect(reversedPairPath('west', 'en', '/chinese-zodiac-compatibility/ox-and-rat')).toBe(
      undefined,
    )
    for (const locale of ['ko', 'en'] as const)
      for (const key of ZODIAC_PAIR_KEYS) {
        const separator = locale === 'ko' ? '-' : '-and-'
        const [a, b] = zodiacPairSlug(locale, key).split(separator)
        const hub = locale === 'ko' ? '/띠궁합' : '/chinese-zodiac-compatibility'
        if (a !== b)
          expect(reversedPairPath('east', locale, `${hub}/${b}${separator}${a}`)).toBe(
            zodiacPairPath(locale, key),
          )
      }
  })

  it('hreflang：三种语言都发布时同一组配对互列，未发布的语言不出现', () => {
    const entries = ['zh-Hans', 'ko', 'en'].flatMap((locale) =>
      ['zi-chou', 'index'].map((key) => ({ locale, key, title: 't', description: 'd' })),
    )
    const all = zodiacPairSeoPages(entries, ['zh-Hans', 'ko', 'en'])
    expect(all).toHaveLength(6)
    const ko = all.find((page) => page.locale === 'ko' && page.path !== '/띠궁합')
    expect(ko).toMatchObject({
      path: '/띠궁합/쥐띠-소띠',
      parent: '/띠궁합',
      titleMain: '쥐띠와 소띠',
      alternates: {
        'zh-Hans': '/生肖配对/属鼠和属牛',
        ko: '/띠궁합/쥐띠-소띠',
        en: '/chinese-zodiac-compatibility/rat-and-ox',
      },
    })
    expect(all.find((page) => page.path === '/chinese-zodiac-compatibility')).toMatchObject({
      titleMain: 'Chinese Zodiac Compatibility',
      alternates: { 'zh-Hans': '/生肖配对', ko: '/띠궁합', en: '/chinese-zodiac-compatibility' },
    })
    const onlyKo = zodiacPairSeoPages(entries, ['zh-Hans', 'ko'])
    expect(onlyKo.some((page) => page.locale === 'en')).toBe(false)
    expect(onlyKo.every((page) => !Object.hasOwn(page.alternates ?? {}, 'en'))).toBe(true)
  })

  it('总表网格按语言链接 78 个规范配对页（ko 带 /ko 前缀，en 为根路径）', () => {
    for (const [locale, prefix] of [
      ['ko', '/ko'],
      ['en', ''],
    ] as const) {
      const page = { locale, marks: pairMarks() } as unknown as ZodiacPairHubData
      const html = renderToStaticMarkup(createElement(PairGrid, { page }))
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => decodeURI(match[1] ?? ''))
      expect(hrefs).toHaveLength(144)
      const unique = new Set(hrefs)
      expect(unique.size).toBe(78)
      for (const key of ZODIAC_PAIR_KEYS)
        expect(unique.has(`${prefix}${zodiacPairPath(locale, key)}`)).toBe(true)
    }
  })
})
