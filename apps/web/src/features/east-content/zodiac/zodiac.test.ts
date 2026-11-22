import { readFileSync } from 'node:fs'
import { zodiacBoundaries, zodiacYears } from '@xuanxue/bazi/almanac'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { pageHead } from '../../seo/metadata.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import { annualOf, childFacts, exampleOf, hubFacts, relationsOf, yearRows } from './data.ts'
import { annualChips } from './labels.ts'
import { lookupZodiac } from './lookup.ts'
import { AnnualCard } from './pages.tsx'
import { ZODIAC_KEYS } from './paths.ts'
import { zodiacSeoPages } from './seo-pages.ts'

vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'zh-Hans' }
})

/** 2026-11-22 12:00 北京时间（丙午年，立春 2026-02-04 04:02 之后） */
const NOW = Date.UTC(2026, 10, 22, 4)

function generatedZodiacs() {
  return JSON.parse(
    readFileSync(
      new URL('../../../../.content-collections/generated/allZodiacs.js', import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as { locale: string; key: string; title: string; description: string; annual: object }[]
}

describe('年份表与引擎一致', () => {
  it('每个生肖页的行与 zodiacYears 逐项相同，本年按立春取 2026', () => {
    for (const key of ZODIAC_KEYS) {
      const facts = childFacts(key, NOW)
      const engine = zodiacYears(key)
      expect(facts.currentYear).toBe(2026)
      expect(facts.years.map((row) => [row.year, row.stem, row.branch, row.nayinIndex])).toEqual(
        engine.map((row) => [row.year, row.stem, row.branch, row.nayinIndex]),
      )
      expect(facts.years.map((row) => row.lichun)).toEqual(
        engine.map(({ lichun: { month, day, hour, minute } }) => ({ month, day, hour, minute })),
      )
    }
  })

  it('属马：2026 丙午立春 2 月 4 日 04:02、春节 2 月 17 日；本年值太岁自刑、次年午未六合', () => {
    const facts = childFacts('wu', NOW)
    const row = facts.years.find((entry) => entry.year === 2026)
    expect(row).toMatchObject({
      stem: 'bing',
      branch: 'wu',
      lichun: { month: 2, day: 4, hour: 4, minute: 2 },
      newYear: { month: 2, day: 17 },
    })
    expect(facts.annual.map((entry) => entry.year)).toEqual([2026, 2027])
    expect(annualChips(facts.annual[0] as NonNullable<(typeof facts.annual)[0]>, 'wu')).toEqual([
      '值太岁',
      '午午自刑',
    ])
    expect(annualChips(facts.annual[1] as NonNullable<(typeof facts.annual)[1]>, 'wu')).toEqual([
      '午未六合',
    ])
  })

  it('核对示例：立春与春节同日（2038 戊午）单独说明，2025 乙巳为春节先到', () => {
    expect(exampleOf(yearRows('wu'), 2038)).toMatchObject({ year: 2038, order: 'same' })
    expect(exampleOf(yearRows('si'), 2026)).toMatchObject({ year: 2025, order: 'before' })
    expect(exampleOf(yearRows('wu'), 2026)).toMatchObject({ year: 2026, order: 'after' })
  })

  it('关系表：午与未六合、寅午戌三合、子午冲、午自刑、丑午害', () => {
    expect(relationsOf('wu')).toEqual([
      { type: 'sixCombine', branches: ['wei'] },
      { type: 'triad', branches: ['yin', 'wu', 'xu'] },
      { type: 'clash', branches: ['zi'] },
      { type: 'punish', branches: ['wu'] },
      { type: 'harm', branches: ['chou'] },
    ])
    expect(relationsOf('chou').find((entry) => entry.type === 'punish')?.branches).toEqual([
      'xu',
      'wei',
    ])
  })

  it('枢纽总表：本年属马，羊的最近年份为 2015、2027', () => {
    const facts = hubFacts(NOW)
    expect(facts.currentBranch).toBe('wu')
    expect(facts.rows.find((row) => row.key === 'wei')?.recent).toEqual([2015, 2027])
    expect(facts.rows.find((row) => row.key === 'wu')?.recent).toEqual([2026, 2038])
    expect(facts.boundaries).toHaveLength(zodiacBoundaries().length)
  })
})

describe('属相查询（立春与春节两种口径）', () => {
  const boundaries = hubFacts(NOW).boundaries

  it('2025-02-01 出生：春节（1 月 29 日）已过属蛇，立春（2 月 3 日 22:10）前仍属龙', () => {
    const result = lookupZodiac('2025-02-01', boundaries)
    expect(result).toMatchObject({
      kind: 'ok',
      lichun: { state: 'before', month: 2, day: 3, time: '22:10', before: { branch: 'chen' } },
      newYear: { state: 'after', result: { branch: 'si', stem: 'yi' } },
    })
  })

  it('立春当天给出两种可能，日期不存在或超出 1924–2043 时报错', () => {
    expect(lookupZodiac('2026-02-04', boundaries)).toMatchObject({
      kind: 'ok',
      lichun: { state: 'same', time: '04:02', after: { branch: 'wu' }, before: { branch: 'si' } },
    })
    expect(lookupZodiac('2025-02-30', boundaries)).toEqual({ kind: 'invalid' })
    expect(lookupZodiac('1900-05-01', boundaries)).toEqual({ kind: 'range' })
    expect(lookupZodiac('1924-01-15', boundaries)).toEqual({ kind: 'range' })
    expect(lookupZodiac('', boundaries)).toEqual({ kind: 'required' })
  })
})

describe('流年缺少撰写文字时只列关系名', () => {
  it('有文字时显示段落，缺失时只输出关系标签', () => {
    const annual = annualOf(2027, 'wu')
    if (!annual) throw new Error('missing 2027')
    const withText = renderToStaticMarkup(
      createElement(AnnualCard, { annual, natal: 'wu', text: '逐页撰写的流年说明' }),
    )
    const without = renderToStaticMarkup(
      createElement(AnnualCard, { annual, natal: 'wu', text: undefined }),
    )
    expect(withText).toContain('逐页撰写的流年说明')
    expect(without).toContain('午未六合')
    expect(without).toContain('2027 丁未年')
    expect(without).not.toContain('<p class="m-0 text-body')
  })
})

describe('地址与 hreflang', () => {
  it('简中地址登记在东方内容映射与注册表，未撰写的繁中、韩语地址不登记', () => {
    expect(eastContentRouteOf('zh-Hans', '/生肖')).toMatchObject({
      collection: 'zodiac',
      id: 'index',
    })
    expect(eastContentRouteOf('zh-Hans', encodeURI('/生肖/属马'))).toMatchObject({ id: 'wu' })
    expect(eastContentRouteOf('zh-Hant', '/生肖/屬鼠')).toBeUndefined()
    expect(eastContentRouteOf('ko', '/띠/쥐띠')).toBeUndefined()
    const hub = TOOL_ROUTES.find((route) => route.id === 'zodiac')
    expect(hub).toMatchObject({ navGroup: 'calendar', paths: { 'zh-Hans': '/生肖' } })
    expect(TOOL_ROUTES.filter((route) => route.id.startsWith('zodiac-'))).toHaveLength(12)
  })

  it('hreflang 只含已发布的语言版本，canonical 指向自身', () => {
    const pages = zodiacSeoPages(generatedZodiacs())
    expect(pages).toHaveLength(13)
    const horse = pages.find((page) => page.path === '/生肖/属马')
    expect(horse).toMatchObject({ parent: '/生肖', group: '/生肖', titleMain: '属马' })
    expect(Object.keys(horse?.alternates ?? {})).toEqual(['zh-Hans'])
    const links = pageHead(horse as NonNullable<typeof horse>, '').links
    expect(links).toContainEqual({
      rel: 'canonical',
      href: `https://ganjiday.com/zh-hans/${encodeURI('生肖/属马')}`,
    })
    const hreflangs = links.flatMap((link) => ('hrefLang' in link ? [link.hrefLang] : []))
    expect(hreflangs).toContain('zh-Hans')
    expect(hreflangs).not.toContain('ko')
    expect(hreflangs).not.toContain('zh-Hant')
  })

  it('zh-hans 内容有 12 个生肖与枢纽，每页都写了丙午、丁未两年', () => {
    const entries = generatedZodiacs().filter((entry) => entry.locale === 'zh-Hans')
    expect(entries.map((entry) => entry.key).sort()).toEqual([...ZODIAC_KEYS, 'index'].sort())
    for (const entry of entries.filter((item) => item.key !== 'index'))
      expect(Object.keys(entry.annual).sort()).toEqual(['丁未', '丙午'])
  })
})
