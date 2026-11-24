import { readdirSync, readFileSync } from 'node:fs'
import * as chartEngine from '@xuanxue/astro/chart'
import { localToUtc, utcOffsetSeconds } from '@xuanxue/astro/places'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { templateConfig } from '../../../server/template-config.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { NATAL_READING_LOCALES } from '../../readings/release.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { westContentRouteOf } from '../routes.ts'
import {
  type BirthPlace,
  computeNatal,
  formatDegree,
  formatOffset,
  type NatalInput,
  parseNatalForm,
} from './model.ts'
import { getNatalPage } from './natal.functions.ts'
import { NatalPage } from './pages.tsx'
import { NATAL_PATHS, NATAL_TOOL_ROUTES } from './paths.ts'

const runtime = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
// 数据库不可达：任何创建数据库客户端或探测连接的调用都会失败（公开页不查数据库）
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
        validator: () => builder,
        handler: (handler: (input: unknown) => unknown) => handler,
      }
      return builder
    },
  }
})
vi.mock('content-collections', () => import('../../../../.content-collections/generated/index.js'))
// 解锁卡依赖会话与计费 server functions，这里只核对占位是否出现
vi.mock('../../readings/unlock-card.tsx', () => ({
  ReadingUnlock: () => null,
  ReadingComingSoon: () => 'reading-coming-soon',
}))
vi.mock('../../marketing/marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: unknown }) => children,
}))

const timeEngine = { localToUtc, utcOffsetSeconds }
const LISBON: BirthPlace = {
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'PT',
  latitude: 38.7167,
  longitude: -9.1333,
  timeZone: 'Europe/Lisbon',
}
const TROMSO: BirthPlace = {
  name: 'Tromsø',
  admin1: 'Troms',
  country: 'NO',
  latitude: 69.6496,
  longitude: 18.957,
  timeZone: 'Europe/Oslo',
}
const input = (overrides: Partial<NatalInput> = {}): NatalInput => ({
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  place: LISBON,
  houseSystem: 'placidus',
  ...overrides,
})

describe('表单校验', () => {
  const form = {
    date: '1990-05-15',
    time: '10:30',
    unknownTime: false,
    place: LISBON,
    houseSystem: 'placidus',
  }
  it('合法输入得到出生资料，未知时间时不要求时刻', () => {
    expect(parseNatalForm(form, '2026-11-24')).toMatchObject({
      ok: true,
      input: { year: 1990, month: 5, day: 15, time: { hour: 10, minute: 30 } },
    })
    expect(parseNatalForm({ ...form, time: '', unknownTime: true }, '2026-11-24')).toMatchObject({
      ok: true,
      input: { time: null },
    })
  })

  it('错误输入分别标出日期、时间与地名', () => {
    expect(parseNatalForm({ ...form, date: '1990-02-30' }, '2026-11-24')).toEqual({
      ok: false,
      errors: { date: 'date' },
    })
    expect(parseNatalForm({ ...form, date: '1790-05-15' }, '2026-11-24')).toEqual({
      ok: false,
      errors: { date: 'dateRange' },
    })
    expect(parseNatalForm({ ...form, date: '2026-11-25' }, '2026-11-24')).toEqual({
      ok: false,
      errors: { date: 'dateRange' },
    })
    expect(parseNatalForm({ ...form, time: '24:10' }, '2026-11-24')).toEqual({
      ok: false,
      errors: { time: 'time' },
    })
    expect(parseNatalForm({ ...form, time: '', place: null }, '2026-11-24')).toEqual({
      ok: false,
      errors: { time: 'time', place: 'place' },
    })
  })
})

describe('计算', () => {
  it('有出生时间：按里斯本当时的夏令时（UTC+1）换算，结果与引擎一致', () => {
    const result = computeNatal(input(), chartEngine, timeEngine)
    expect(result.kind).toBe('timed')
    if (result.kind !== 'timed') return
    expect(result.moment).toMatchObject({ offsetSeconds: 3600, status: 'ok', daylightSaving: true })
    expect(result.moment.utcMs).toBe(Date.UTC(1990, 4, 15, 9, 30))
    const direct = chartEngine.natalChart({
      utcMs: Date.UTC(1990, 4, 15, 9, 30),
      latitude: LISBON.latitude,
      longitude: LISBON.longitude,
    })
    expect(result.chart).toEqual(direct)
    expect(result.chart.points.sun.sign).toBe('taurus')
    expect(result.chart.ascendant.sign).toBe('cancer')
    expect(result.chart.houses.system).toBe('placidus')
  })

  it('不知道出生时间：只按当地正午给星座，当天月亮跨座时列出两个可能与换座时刻', () => {
    const result = computeNatal(input({ time: null }), chartEngine, timeEngine)
    expect(result.kind).toBe('untimed')
    if (result.kind !== 'untimed') return
    expect(result.moment.utcMs).toBe(Date.UTC(1990, 4, 15, 11, 0))
    const moon = result.changes.moon
    expect(moon?.signs).toEqual(['capricorn', 'aquarius'])
    // 换座时刻在当地当天之内，且前后星座与引擎一致
    const start = Date.UTC(1990, 4, 14, 23, 0)
    const end = Date.UTC(1990, 4, 15, 23, 0)
    expect(moon?.atMs).toBeGreaterThan(start)
    expect(moon?.atMs).toBeLessThan(end)
    expect(chartEngine.chartPositions((moon?.atMs ?? 0) - 60_000).moon.sign).toBe('capricorn')
    expect(chartEngine.chartPositions(moon?.atMs ?? 0).moon.sign).toBe('aquarius')
    // 太阳当天未换座；相位不含月亮
    expect(result.changes.sun).toBeUndefined()
    expect(result.aspects.every((aspect) => aspect.a !== 'moon' && aspect.b !== 'moon')).toBe(true)
  })

  it('不知道出生时间且月亮当天未换座：不列跨座', () => {
    // 1990-05-12 月亮整天在双鱼？以引擎为准：起止星座相同则无跨座
    const result = computeNatal(input({ time: null, day: 12 }), chartEngine, timeEngine)
    if (result.kind !== 'untimed') throw new Error('expected untimed')
    const start = localToUtc({ year: 1990, month: 5, day: 12, hour: 0, minute: 0 }, 'Europe/Lisbon')
    const end = localToUtc({ year: 1990, month: 5, day: 13, hour: 0, minute: 0 }, 'Europe/Lisbon')
    const signs = chartEngine.moonSignsBetween(start.utcMs, end.utcMs - 1)
    expect(Boolean(result.changes.moon)).toBe(signs.length > 1)
  })

  it('太阳换座当天无出生时间：两个星座都列出', () => {
    // 2000-03-20 太阳在当天 07:35 UTC 进入白羊（春分）
    const result = computeNatal(
      input({ year: 2000, month: 3, day: 20, time: null, place: { ...LISBON, timeZone: 'UTC' } }),
      chartEngine,
      timeEngine,
    )
    if (result.kind !== 'untimed') throw new Error('expected untimed')
    expect(result.changes.sun?.signs).toEqual(['pisces', 'aries'])
  })

  it('纬度超过 66°：Placidus 改整宫制并标注', () => {
    const result = computeNatal(input({ place: TROMSO }), chartEngine, timeEngine)
    if (result.kind !== 'timed') throw new Error('expected timed')
    expect(result.chart.houses).toMatchObject({
      system: 'whole-sign',
      requested: 'placidus',
      highLatitudeFallback: true,
    })
  })

  it('格式化：度分向下取整，UTC 偏移含地方平时的秒', () => {
    expect(formatDegree(29.9999)).toBe('29°59′')
    expect(formatDegree(4.1)).toBe('4°06′')
    expect(formatOffset(3600)).toBe('UTC+1')
    expect(formatOffset(-14400)).toBe('UTC−4')
    expect(formatOffset(19800)).toBe('UTC+5:30')
    expect(formatOffset(-2205)).toBe('UTC−0:36:45')
  })
})

describe('地址、注册表与页面', () => {
  it('两页只在西方站 en 登记，预渲染、目录分组 astrology', () => {
    expect(westContentRouteOf('en', '/rising-sign-calculator')).toMatchObject({
      collection: 'natal-chart',
      id: 'rising-sign-calculator',
    })
    expect(westContentRouteOf('en', '/birth-chart')).toMatchObject({ id: 'birth-chart' })
    expect(westContentRouteOf('es', '/birth-chart')).toBeUndefined()
    const routes = TOOL_ROUTES.filter((route) => NATAL_TOOL_ROUTES.includes(route))
    expect(routes).toHaveLength(2)
    for (const route of routes) {
      expect(route).toMatchObject({ site: 'west', directoryGroup: 'astrology' })
      expect(route.prerender).toBeUndefined()
    }
    const entries = prerenderEntryPages(templateConfig, routes).map((entry) => entry.path)
    expect(entries).toEqual(expect.arrayContaining(Object.values(NATAL_PATHS)))
  })

  it('数据库不可达时两页照常返回数据（head 含 Title、FAQ 结构化数据）', async () => {
    runtime.locale = 'en'
    const site = Promise.resolve({ loaderData: { site: { id: 'west' } } })
    const load = SingleSegment.options.loader as unknown as (input: unknown) => Promise<{
      westContent?: { route: unknown; head: { meta: { title?: string }[] } }
    }>
    for (const slug of ['rising-sign-calculator', 'birth-chart']) {
      const data = await load({ params: { slug }, deps: {}, parentMatchPromise: site })
      expect(data.westContent?.route).toMatchObject({ collection: 'natal-chart', id: slug })
      const title = data.westContent?.head.meta.find((item) => item.title)?.title ?? ''
      expect(title.length).toBeLessThanOrEqual(60)
    }
    expect(database.calls).toBe(0)
  })

  it('服务端 HTML：H1、表单、正文与地名署名；不提 AI；星盘页未出结果时不显示解锁', async () => {
    const rising = await getNatalPage({ data: { id: 'rising-sign-calculator' } })
    const chart = await getNatalPage({ data: { id: 'birth-chart' } })
    const risingHtml = renderToStaticMarkup(<NatalPage payload={rising.content} />)
    const chartHtml = renderToStaticMarkup(<NatalPage payload={chart.content} />)
    expect(risingHtml).toContain('<h1')
    expect(risingHtml).toContain('Rising Sign Calculator')
    expect(risingHtml).toContain('href="/birth-chart"')
    expect(chartHtml).toContain('Birth Chart Calculator')
    expect(chartHtml).toContain('href="/rising-sign-calculator"')
    for (const html of [risingHtml, chartHtml]) {
      expect(html).toContain('GeoNames')
      expect(html).toContain('CC BY 4.0')
      expect(html).toContain('method="post"')
      expect(html).not.toMatch(/\bAI\b/)
    }
    expect(chartHtml).toContain('Placidus')
    expect(chartHtml).not.toContain('reading-coming-soon')
    // B5：评测通过并经使用者审阅样例前不开放购买
    expect(NATAL_READING_LOCALES).not.toContain('en')
  })

  it('页面模块不静态引入星历引擎（astronomy-engine 只在提交后动态加载）', () => {
    const dir = new URL('./', import.meta.url)
    const files = readdirSync(dir).filter(
      (file) => /\.tsx?$/.test(file) && !file.endsWith('.test.tsx'),
    )
    expect(files).toContain('pages.tsx')
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), 'utf8')
      expect(source, file).not.toMatch(/from 'astronomy-engine'/)
      for (const match of source.matchAll(/^import (type )?[^;]*from '@xuanxue\/astro\/chart'/gm))
        expect(match[1], file).toBe('type ')
    }
  })
})
