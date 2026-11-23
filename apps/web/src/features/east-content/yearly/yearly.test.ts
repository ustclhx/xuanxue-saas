import { readFileSync } from 'node:fs'
import { zodiacBoundaries, zodiacYearFacts, zodiacYears } from '@xuanxue/bazi/almanac'
import { describe, expect, it, vi } from 'vitest'
import { eastEnContentRouteOf } from '../../east-en/paths.ts'
import { pageHead } from '../../seo/metadata.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import type { EastContentRoute } from '../routes.ts'
import { eastContentRouteOf } from '../routes.ts'
import { childFacts, hubFacts, yearFacts } from './data.ts'
import { YEARLY_KEYS } from './paths.ts'
import { yearlySeoPages } from './seo-pages.ts'
import { unlinkUnpublished, yearlyToolPath } from './tool-link.ts'

vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'zh-Hans' }
})

function generatedYearlies() {
  return JSON.parse(
    readFileSync(
      new URL('../../../../.content-collections/generated/allYearlies.js', import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as { locale: string; year: number; key: string; title: string; description: string }[]
}

describe('关系表与引擎一致', () => {
  it('12 生肖的关系与太岁逐项等于 zodiacYearFacts(2027)', () => {
    const engine = zodiacYearFacts(2027)
    const hub = hubFacts(2027)
    expect(hub.rows).toEqual(
      engine.rows.map(({ branch, relations, taiSui }) => ({ branch, relations, taiSui })),
    )
    for (const key of YEARLY_KEYS)
      expect(childFacts(2027, key).row).toEqual(hub.rows.find((row) => row.branch === key))
  })

  it('2027 丁未：纳音天河水；值太岁属羊、冲太岁属牛（兼刑）、刑破属狗、害属鼠；午未六合', () => {
    const year = yearFacts(2027)
    expect(year).toMatchObject({
      stem: 'ding',
      branch: 'wei',
      nayinIndex: 21,
      stemElement: 'fire',
      branchElement: 'earth',
      lichun: { year: 2027, month: 2, day: 4, hour: 9, minute: 46 },
      nextLichun: { year: 2028, month: 2, day: 4 },
      newYear: { month: 2, day: 6 },
      nextNewYear: { year: 2028, month: 1, day: 26 },
    })
    const taiSui = Object.fromEntries(hubFacts(2027).rows.map((row) => [row.branch, row.taiSui]))
    expect(taiSui).toMatchObject({
      wei: ['zhi'],
      chou: ['chong', 'xing'],
      xu: ['xing', 'po'],
      zi: ['hai'],
      wu: [],
    })
    expect(childFacts(2027, 'wu').row.relations).toEqual(['sixCombine'])
  })

  it('属马：五行与三合局，出生年份 1954–2026 与 zodiacYears 一致，虚岁按 2027 计', () => {
    const facts = childFacts(2027, 'wu')
    expect(facts).toMatchObject({
      element: 'fire',
      branchElementRelation: 'aGeneratesB',
      stemElementRelation: 'same',
      triad: ['yin', 'wu', 'xu'],
      triadElement: 'fire',
      triadHasYear: false,
    })
    const engine = zodiacYears('wu').filter((row) => row.year >= 1948 && row.year < 2027)
    expect(facts.births.map((row) => [row.year, row.stem, row.nayinIndex])).toEqual(
      engine.map((row) => [row.year, row.stem, row.nayinIndex]),
    )
    expect(facts.births.at(-1)).toMatchObject({ year: 2026, age: 2 })
    expect(childFacts(2027, 'mao')).toMatchObject({ triadHasYear: true, triadElement: 'wood' })
  })

  it('ko 显示偏移：설날按 UTC+9（2027 年 2 月 7 日）', () => {
    expect(yearFacts(2027, 540).newYear).toMatchObject({ month: 2, day: 7 })
    const boundary = zodiacBoundaries().find((entry) => entry.year === 2028)
    expect(yearFacts(2027).endsAt).toBe(boundary?.lichunEpochMs)
  })
})

describe('地址、注册表与 hreflang', () => {
  it('zh-Hans、zh-Hant 枢纽与 12 页登记在东方内容映射与注册表，未撰写的语言不登记', () => {
    expect(eastContentRouteOf('zh-Hans', encodeURI('/2027生肖运势'))).toMatchObject({
      collection: 'yearly',
      id: '2027/index',
    })
    expect(eastContentRouteOf('zh-Hans', encodeURI('/2027生肖运势/属马'))).toMatchObject({
      collection: 'yearly',
      id: '2027/wu',
    })
    expect(eastContentRouteOf('zh-Hant', encodeURI('/2027生肖運勢/屬馬'))).toMatchObject({
      collection: 'yearly',
      id: '2027/wu',
    })
    const hub = TOOL_ROUTES.find((route) => route.id === 'yearly-2027')
    expect(hub).toMatchObject({
      nav: false,
      directoryGroup: 'yearly',
      badge: { kind: 'year', until: '2027-02-28' },
      paths: { 'zh-Hans': '/2027生肖运势', 'zh-Hant': '/2027生肖運勢' },
      titles: { 'zh-Hans': '2027生肖运势', 'zh-Hant': '2027生肖運勢' },
    })
    expect(TOOL_ROUTES.find((route) => route.id === 'yearly-2027-wu')).toMatchObject({
      nav: false,
      paths: { 'zh-Hans': '/2027生肖运势/属马', 'zh-Hant': '/2027生肖運勢/屬馬' },
      titles: { 'zh-Hans': '2027属马', 'zh-Hant': '2027屬馬' },
    })
    expect(TOOL_ROUTES.filter((route) => route.id.startsWith('yearly-2027-'))).toHaveLength(12)
  })

  it('ko（第 10 组）枢纽与 12 页登记在东方内容映射与注册表，主词为「2027년 띠」「말띠 2027」', () => {
    expect(eastContentRouteOf('ko', encodeURI('/2027년-띠'))).toMatchObject({
      collection: 'yearly',
      id: '2027/index',
    })
    expect(eastContentRouteOf('ko', encodeURI('/2027년-띠/말띠'))).toMatchObject({
      collection: 'yearly',
      id: '2027/wu',
    })
    expect(TOOL_ROUTES.find((route) => route.id === 'yearly-2027')).toMatchObject({
      paths: { ko: '/2027년-띠' },
      titles: { ko: '2027년 띠' },
    })
    expect(TOOL_ROUTES.find((route) => route.id === 'yearly-2027-wu')).toMatchObject({
      paths: { ko: '/2027년-띠/말띠' },
      titles: { ko: '말띠 2027' },
    })
    for (const route of TOOL_ROUTES.filter((item) => item.id.startsWith('yearly-2027')))
      expect(route.titles?.ko ?? '').not.toMatch(/운세/)
  })

  it('hreflang 只含已发布的语言版本，canonical 指向自身', () => {
    const entries = generatedYearlies()
    const pages = yearlySeoPages(entries)
    const horse = pages.find((page) => page.path === '/2027生肖运势/属马')
    expect(horse).toMatchObject({
      parent: '/2027生肖运势',
      group: '/2027生肖运势',
      titleMain: '2027属马',
      // zh-Hans、zh-Hant、en、ko 互为 hreflang（9.2、第 10、11 组）
      alternates: {
        'zh-Hans': '/2027生肖运势/属马',
        'zh-Hant': '/2027生肖運勢/屬馬',
        en: '/chinese-zodiac-2027/horse',
        ko: '/2027년-띠/말띠',
      },
    })
    expect(pages.find((page) => page.path === '/2027生肖運勢/屬馬')).toMatchObject({
      locale: 'zh-Hant',
      parent: '/2027生肖運勢',
      titleMain: '2027屬馬',
      alternates: {
        'zh-Hans': '/2027生肖运势/属马',
        'zh-Hant': '/2027生肖運勢/屬馬',
        en: '/chinese-zodiac-2027/horse',
        ko: '/2027년-띠/말띠',
      },
    })
    const links = pageHead(horse as NonNullable<typeof horse>, '').links
    expect(links).toContainEqual({
      rel: 'canonical',
      href: `https://ganjiday.com/zh-hans/${encodeURI('2027生肖运势/属马')}`,
    })
    const hreflangs = links.flatMap((link) => ('hrefLang' in link ? [link.hrefLang] : []))
    expect(hreflangs).toContain('zh-Hant')
    expect(hreflangs).toContain('ko')
    expect(links).toContainEqual({
      rel: 'alternate',
      hrefLang: 'en',
      href: 'https://ganjiday.com/chinese-zodiac-2027/horse',
    })
    const english = pages.find((page) => page.path === '/chinese-zodiac-2027/horse')
    expect(english).toMatchObject({
      locale: 'en',
      site: 'east',
      parent: '/chinese-zodiac-2027',
      titleMain: 'Horse in 2027',
      alternates: {
        'zh-Hans': '/2027生肖运势/属马',
        'zh-Hant': '/2027生肖運勢/屬馬',
        en: '/chinese-zodiac-2027/horse',
        ko: '/2027년-띠/말띠',
      },
    })
    expect(pageHead(english as NonNullable<typeof english>, '').links).toContainEqual({
      rel: 'canonical',
      href: 'https://ganjiday.com/chinese-zodiac-2027/horse',
    })
    // ko 页反向指向其他语言，且 canonical 指向自身
    const koHorse = pages.find((page) => page.locale === 'ko' && page.path === '/2027년-띠/말띠')
    expect(koHorse).toMatchObject({
      parent: '/2027년-띠',
      titleMain: '말띠 2027',
      alternates: {
        'zh-Hans': '/2027生肖运势/属马',
        'zh-Hant': '/2027生肖運勢/屬馬',
        en: '/chinese-zodiac-2027/horse',
        ko: '/2027년-띠/말띠',
      },
    })
    expect(pageHead(koHorse as NonNullable<typeof koHorse>, '').links).toContainEqual({
      rel: 'canonical',
      href: `https://ganjiday.com/ko/${encodeURI('2027년-띠/말띠')}`,
    })

    // 地址未登记的语言不进入 hreflang
    const withJa = yearlySeoPages([
      ...entries,
      { locale: 'ja', year: 2027, key: 'wu', title: 't', description: 'd' },
    ])
    expect(
      Object.keys(withJa.find((page) => page.path === '/2027生肖运势/属马')?.alternates ?? {}),
    ).not.toContain('ja')
  })

  it.each(['zh-Hans', 'zh-Hant', 'en'])('%s 内容为枢纽加 12 生肖', (locale) => {
    const keys = generatedYearlies()
      .filter((entry) => entry.locale === locale && entry.year === 2027)
      .map((entry) => entry.key)
      .sort()
    expect(keys).toEqual([...YEARLY_KEYS, 'index'].sort())
  })

  it('en 地址由东方站英文分发，不进中日韩映射；注册表带 en 路径', () => {
    expect(eastContentRouteOf('en', '/chinese-zodiac-2027')).toBeUndefined()
    expect(eastEnContentRouteOf('/chinese-zodiac-2027')).toMatchObject({
      collection: 'yearly',
      id: '2027/index',
    })
    expect(eastEnContentRouteOf('/chinese-zodiac-2027/goat')).toMatchObject({
      collection: 'yearly',
      id: '2027/wei',
    })
    expect(TOOL_ROUTES.find((route) => route.id === 'yearly-2027-wei')).toMatchObject({
      paths: { en: '/chinese-zodiac-2027/goat' },
      titles: { en: 'Goat in 2027' },
    })
    // 个人年度工具（第 7 组）的 en 地址登记在东方站英文映射里，正文链接保留
    expect(yearlyToolPath('en')).toBe('/bazi-2027')
  })

  it('ko 内容为枢纽加 12 띠', () => {
    const keys = generatedYearlies()
      .filter((entry) => entry.locale === 'ko' && entry.year === 2027)
      .map((entry) => entry.key)
      .sort()
    expect(keys).toEqual([...YEARLY_KEYS, 'index'].sort())
  })
})

describe('个人年度工具未上线时不留死链', () => {
  const tool = `/zh-hans/${encodeURI('2027流年')}`
  const html = `<p>可以用<a href="${tool}">2027流年</a>查看。</p>`

  it('未登记时还原为文字，登记后保留链接', () => {
    expect(unlinkUnpublished(html, [tool])).toBe('<p>可以用2027流年查看。</p>')
    expect(unlinkUnpublished(html, [])).toBe(html)
    expect(yearlyToolPath('zh-Hans', [])).toBeUndefined()
    const routes: EastContentRoute[] = [
      { locale: 'zh-Hans', path: '/2027流年', collection: 'yearly-tool', id: 'tool' },
    ]
    expect(yearlyToolPath('zh-Hans', routes)).toBe('/2027流年')
  })
})
