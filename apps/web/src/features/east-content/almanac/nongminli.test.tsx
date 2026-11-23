import * as engine from '@xuanxue/bazi/almanac'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as TwoSegment } from '../../../routes/$section/$item.tsx'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { cachedPageOf } from '../../daily/page-cache.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import { taiSuiRows } from '../tai-sui-year/page.functions.ts'
import {
  type AlmanacMonthPayload,
  type AlmanacToolPayload,
  almanacPayload,
} from './almanac.functions.ts'
import { ALMANAC_QUERY_ROBOTS, almanacHead } from './head.ts'
import { fetusText } from './model.ts'
import { AlmanacMonthPage } from './month-page.tsx'
import { AlmanacToolPage } from './tool-page.tsx'

/**
 * zh-Hant 農民曆与 2027 太歲（openspec content-growth-v2-tools 第 18 组）。
 * 胎神、所沖干支与煞方的期望值取自 lunar-javascript（getDayPositionTai、getDayChongDesc、getDaySha）。
 */
const runtime = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
const database = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@xuanxue/db', async (original) => {
  const actual = await original<typeof import('@xuanxue/db')>()
  const unreachable = () => {
    database.calls += 1
    throw new Error('数据库不可达')
  }
  return { ...actual, createDb: unreachable, pingDatabase: unreachable }
})
vi.mock('@tanstack/react-start', async (original) => {
  const actual = await original<typeof import('@tanstack/react-start')>()
  return {
    ...actual,
    createServerFn: () => {
      const builder = {
        inputValidator: () => builder,
        handler: (handler: (input: unknown) => unknown) => handler,
      }
      return builder
    },
  }
})
vi.mock('content-collections', async () => {
  const { readFileSync } = await import('node:fs')
  const read = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL(`../../../../.content-collections/generated/${name}.js`, import.meta.url),
        'utf8',
      )
        .replace(/^\s*export default\s*/, '')
        .trim()
        .replace(/;$/, ''),
    )
  return { allAlmanacs: read('allAlmanacs'), allTaiSuiYears: read('allTaiSuiYears') }
})
vi.mock('../../tools/numerology/content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))
vi.mock('../../tools/bazi/bazi-home.tsx', () => ({ BaziHome: () => null }))
vi.mock('../../east-en/feelings.functions.ts', () => ({ getTarotFeelings: vi.fn() }))
vi.mock('../../east-en/tarot-pages.tsx', () => ({ EastEnTarotPage: () => null }))
vi.mock('@tanstack/react-router', async (original) => {
  const actual = await original<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => () => Promise.resolve() }
})

const taipei = (iso: string) => new Date(`${iso}+08:00`)
const tool = async (date: string | undefined, now = taipei('2026-11-22T10:00:00')) =>
  (await almanacPayload('tool', date, now, engine, 'zh-Hant')) as AlmanacToolPayload
const month = async (id: number, now = taipei('2026-11-22T10:00:00')) =>
  (await almanacPayload(String(id), undefined, now, engine, 'zh-Hant')) as AlmanacMonthPayload

describe('農民曆工具页', () => {
  it('胎神、所沖干支与煞方与 lunar-javascript 一致', async () => {
    const cases = [
      ['2027-01-01', '碓磨栖 外正西', '甲戌', '狗', '南'],
      ['2027-02-04', '占門爐 外東北', '戊申', '猴', '北'],
      ['2026-11-22', '占碓磨 房內南', '甲午', '馬', '南'],
    ] as const
    for (const [date, fetus, pillar, zodiac, sha] of cases) {
      const { result } = await tool(date)
      expect(result, date).toMatchObject({ fetus, clash: { pillar, zodiac, sha } })
    }
    // 简中黄历同一天的胎神组字一致（只是字形不同）
    expect(fetusText(engine.almanacDay({ year: 2027, month: 2, day: 4 }).fetus)).toBe(
      '占门炉 外东北',
    )
  })

  it('结果区显示胎神占方与台湾写法的沖煞，宜忌按引擎顺序、空栏显示说明文字', async () => {
    const payload = await tool('2027-02-04')
    expect(payload.result?.termNote).toBe('本日 09:46 交立春；年柱由丙午換成丁未，月令由丑換到寅。')
    expect(payload.result?.avoids).toEqual([])
    const html = renderToStaticMarkup(<AlmanacToolPage payload={payload} />)
    expect(html).toContain('胎神占方')
    expect(html).toContain('沖猴(戊申) 煞北')
    expect(html).toContain('這一欄今日沒有列出項目。')
    expect(html).not.toMatch(/吉日|擇日|<select/)
  })

  it('带日期参数时 noindex, follow，canonical 指向工具页；hreflang 与简中黄历互指', async () => {
    const head = almanacHead(await tool('2027-02-04'))
    expect(head.meta).toContainEqual({ name: 'robots', content: ALMANAC_QUERY_ROBOTS })
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: `https://ganjiday.com/zh-hant/${encodeURIComponent('農民曆')}`,
    })
    const alternates = head.links.filter((link) => 'hrefLang' in link || 'hreflang' in link)
    const hrefs = alternates.map((link) => (link as { href: string }).href).join(' ')
    expect(hrefs).toContain(`/zh-hans/${encodeURIComponent('黄历')}`)
    expect(almanacHead(await tool(undefined)).meta).not.toContainEqual(
      expect.objectContaining({ name: 'robots' }),
    )
  })
})

describe('農民曆月份页', () => {
  it('逐日表多一列胎神，标题用「每日宜忌」，没有按事项筛选日子的控件', async () => {
    const payload = await month(2)
    expect(payload.view.year).toBe(2027)
    const html = renderToStaticMarkup(<AlmanacMonthPage payload={payload} />)
    expect(html).toContain('>胎神</th>')
    expect(html).toContain('2月農民曆：2027年2月每日宜忌')
    expect(html).not.toMatch(/吉日|擇日|<select|<form/)
    const title = almanacHead(payload).meta[0]?.title ?? ''
    expect(title).toContain('2月農民曆')
    expect(title).not.toMatch(/吉日|嫁娶|婚/)
  })

  it('12 个月份页 Title 两两不同', async () => {
    const titles = new Set<string>()
    for (let id = 1; id <= 12; id++) titles.add(almanacHead(await month(id)).meta[0]?.title ?? '')
    expect(titles.size).toBe(12)
  })
})

describe('路由、注册表与边缘缓存', () => {
  const loadTwo = TwoSegment.options.loader
  const loadSingle = SingleSegment.options.loader
  if (typeof loadTwo !== 'function' || typeof loadSingle !== 'function')
    throw new Error('缺少待测的路由处理函数')

  it('登记工具页、12 个月份页与 2027 太歲；简中地址在繁中下 404', () => {
    expect(eastContentRouteOf('zh-Hant', '/農民曆')).toMatchObject({ id: 'tool' })
    expect(eastContentRouteOf('zh-Hant', '/農民曆/12月')).toMatchObject({ id: '12' })
    expect(eastContentRouteOf('zh-Hant', '/2027太歲')).toMatchObject({
      collection: 'tai-sui-year',
      id: '2027',
    })
    expect(eastContentRouteOf('zh-Hant', '/農民曆/2027-01-01')).toBeUndefined()
    expect(eastContentRouteOf('zh-Hans', '/農民曆')).toBeUndefined()
    const taiSui = TOOL_ROUTES.find((route) => route.id === 'tai-sui-2027')
    expect(taiSui).toMatchObject({ paths: { 'zh-Hant': '/2027太歲' }, nav: false })
    expect(taiSui?.prerender).toBeUndefined()
  })

  it('数据库不可达时月份页、带日期的工具页与 2027 太歲照常返回数据', async () => {
    runtime.locale = 'zh-Hant'
    const monthData = await loadTwo({
      params: { section: '農民曆', item: encodeURIComponent('1月') },
    } as Parameters<typeof loadTwo>[0])
    expect(monthData.eastContent?.route).toMatchObject({ collection: 'almanac', id: '1' })
    const toolData = await loadSingle({
      params: { slug: '農民曆' },
      deps: { date: '2027-02-04' },
    } as Parameters<typeof loadSingle>[0])
    expect(toolData.eastContent?.head.meta).toContainEqual({
      name: 'robots',
      content: ALMANAC_QUERY_ROBOTS,
    })
    const taiSui = await loadSingle({
      params: { slug: '2027太歲' },
      deps: {},
    } as Parameters<typeof loadSingle>[0])
    expect(taiSui.eastContent?.route).toMatchObject({ collection: 'tai-sui-year' })
    expect(database.calls).toBe(0)
  })

  it('農民曆页面走边缘缓存，日期参数进键', () => {
    const url = (path: string) => new URL(encodeURI(path), 'https://ganjiday.com')
    const locales = ['zh-Hant', 'zh-Hans', 'ko', 'ja', 'en']
    expect(cachedPageOf(url('/zh-hant/農民曆'), locales)).toEqual({ locale: 'zh-Hant' })
    expect(cachedPageOf(url('/zh-hant/農民曆/3月'), locales)).toEqual({ locale: 'zh-Hant' })
    expect(cachedPageOf(url('/zh-hant/農民曆?date=2027-02-04'), locales)).toEqual({
      locale: 'zh-Hant',
      variant: 'date=2027-02-04',
    })
    expect(cachedPageOf(url('/zh-hant/2027太歲'), locales)).toBeNull()
    expect(cachedPageOf(url('/zh-hans/農民曆'), locales)).toBeNull()
  })
})

describe('2027 太歲表', () => {
  it('值羊、沖刑牛、刑破狗、害鼠；六合马、三合兔猪；出生年份 1930 起至 2027', () => {
    const rows = Object.fromEntries(taiSuiRows(engine, 2027).map((row) => [row.branch, row]))
    expect(rows.wei?.relations).toEqual(['zhi'])
    expect(rows.chou?.relations).toEqual(['chong', 'xing'])
    expect(rows.xu?.relations).toEqual(['xing', 'po'])
    expect(rows.zi?.relations).toEqual(['hai'])
    expect(rows.wu?.relations).toEqual(['sixCombine'])
    expect(rows.mao?.relations).toEqual(['triad'])
    expect(rows.hai?.relations).toEqual(['triad'])
    expect(rows.yin?.relations).toEqual([])
    expect(rows.wei?.years).toEqual([1931, 1943, 1955, 1967, 1979, 1991, 2003, 2015, 2027])
  })
})
