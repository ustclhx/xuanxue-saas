import { readdirSync, readFileSync } from 'node:fs'
import { assertMoonCoverage, fullMoonNames, generateMoonBuildData } from '@xuanxue/astro/moon'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as TwoSegment } from '../../../routes/$section/$item.tsx'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { westContentRouteOf } from '../routes.ts'
import { FULL_MOON_NAME_KEYS } from './copy.ts'
import {
  clockTime,
  displayYear,
  fullMoons,
  type MoonTable,
  moonDay,
  moonLitPath,
  zonedDateKey,
} from './model.ts'
import { MOON_QUERY_ROBOTS, type MoonData, type MoonEntry, moonPage } from './moon.functions.ts'
import { MoonPage } from './pages.tsx'
import { isMoonQueryRequest, MOON_TOOL_ROUTES, moonMonthPath } from './paths.ts'

const runtime = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
// 数据库不可达：任何创建数据库客户端或探测连接的调用都会失败（spec「预渲染且不查数据库」）
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
vi.mock('content-collections', () => import('../../../../.content-collections/generated/index.js'))
// 页头页脚依赖路由上下文，这里只渲染页面本身
vi.mock('../../marketing/marketing-shell.tsx', () => ({
  MarketingShell: ({ children }: { children: unknown }) => children,
}))

function generated<T>(name: string): T {
  const source = readFileSync(
    new URL(`../../../../.content-collections/generated/${name}.js`, import.meta.url),
    'utf8',
  )
  return JSON.parse(
    source
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as T
}

const entries = generated<MoonEntry[]>('allMoons')
// 固定构建日，结果不随运行日期变化
const DATA: MoonData = (() => {
  const table = generateMoonBuildData('2026-11-23')
  return { ...table, buildDate: '2026-11-23', years: [2026, 2027] }
})()
const TABLE: MoonTable = DATA
const links = () => ({ breadcrumb: [], titleOf: (path: string) => path })
const page = (id: Parameters<typeof moonPage>[0], now: string, year?: string) => {
  const result = moonPage(id, year, new Date(now), DATA, entries, links)
  if (!result) throw new Error(`no page ${id}`)
  return result
}

describe('月相模型', () => {
  it('同一满月时刻在东京与洛杉矶按各自时区显示，对应同一个 UTC 时刻', () => {
    const [full] = fullMoons(TABLE, 'UTC').filter((row) => row.year === 2027)
    expect(full).toBeDefined()
    const utcMs = full?.utcMs ?? 0
    const tokyo = zonedDateKey(utcMs, 'Asia/Tokyo')
    const la = zonedDateKey(utcMs, 'America/Los_Angeles')
    // 东京比洛杉矶快 17 小时：日期相同或晚一天，时刻换算回 UTC 相同
    expect(new Date(`${tokyo}T00:00:00Z`).getTime()).toBeGreaterThanOrEqual(
      new Date(`${la}T00:00:00Z`).getTime(),
    )
    expect(clockTime(utcMs, 'Asia/Tokyo')).not.toBe(clockTime(utcMs, 'America/Los_Angeles'))
    // 主要月相按当地日期标注：两地各自那一天都显示满月
    expect(moonDay(TABLE, tokyo, 'Asia/Tokyo')?.quarter?.utcMs).toBe(utcMs)
    expect(moonDay(TABLE, la, 'America/Los_Angeles')?.quarter?.utcMs).toBe(utcMs)
  })

  it('月份页取该月最近一次尚未结束的那个月', () => {
    expect(displayYear(1, { year: 2026, month: 12 })).toBe(2027)
    expect(displayYear(12, { year: 2026, month: 12 })).toBe(2026)
    expect(displayYear(11, { year: 2026, month: 12 })).toBe(2027)
    // 2026-12-10 打开 1 月月历：显示 2027 年 1 月，Title 含 2027
    const january = page('january', '2026-12-10T08:00:00Z')
    expect(january.payload).toMatchObject({ kind: 'month', view: { year: 2027, month: 1 } })
    expect(january.seo.title).toContain('2027')
    expect(january.seo.title.startsWith('January 2027 Moon Calendar')).toBe(true)
    const december = page('december', '2026-12-10T08:00:00Z')
    expect(december.payload).toMatchObject({ view: { year: 2026, month: 12 } })
  })

  it('构建期表覆盖构建日前 1 个月至后 14 个月，剩余不足 13 个月时报错', () => {
    expect(DATA.startDate).toBe('2026-10-23')
    expect(DATA.endDate).toBe('2028-01-23')
    expect(() => assertMoonCoverage(DATA.endDate, '2026-11-23')).not.toThrow()
    expect(() => assertMoonCoverage(DATA.endDate, '2027-01-24')).toThrow(RangeError)
    // 内容集合生成的表同样满足（构建当天生成）
    const [built] = generated<MoonData[]>('allMoonData')
    expect(built).toBeDefined()
    if (built) expect(() => assertMoonCoverage(built.endDate, built.buildDate)).not.toThrow()
  })

  it('页面的传统月名与引擎一致', () => {
    const names = fullMoonNames()
    expect(FULL_MOON_NAME_KEYS).toEqual(Array.from({ length: 12 }, (_, i) => names[(i + 1) as 1]))
  })

  it('月相图路径与设计稿一致', () => {
    expect(moonLitPath(0, true)).toBeNull()
    expect(moonLitPath(1, true)).toBe('full')
    expect(moonLitPath(0.25, true)).toBe('M70 10 A60 60 0 0 1 70 130 A30 60 0 0 0 70 10 Z')
    expect(moonLitPath(0.98, true)).toBe('M70 10 A60 60 0 0 1 70 130 A57.6 60 0 0 1 70 10 Z')
    expect(moonLitPath(0.5, true)).toBe('M70 10 A60 60 0 0 1 70 130 A0 60 0 0 1 70 10 Z')
    // 亏月亮在左
    expect(moonLitPath(0.25, false)).toBe('M70 10 A60 60 0 0 0 70 130 A30 60 0 0 1 70 10 Z')
  })
})

describe('月相页', () => {
  it('月份页的 ?year= 输出 noindex, follow，表能覆盖时显示所请求的年份', () => {
    const plain = page('november', '2026-11-23T08:00:00Z')
    expect(plain.payload).toMatchObject({ query: false, view: { year: 2026 }, otherYear: 2027 })
    const query = page('november', '2026-11-23T08:00:00Z', '2027')
    expect(query.payload).toMatchObject({ query: true, view: { year: 2027 } })
    expect(query.seo.title).toContain('2027')
    // 超出覆盖期：仍为查询结果（noindex），显示默认年份
    const outside = page('november', '2026-11-23T08:00:00Z', '2031')
    expect(outside.payload).toMatchObject({ query: true, view: { year: 2026 } })
    expect(isMoonQueryRequest('/moon-calendar/november', new URLSearchParams('year=2027'))).toBe(
      true,
    )
    expect(isMoonQueryRequest('/moon-calendar/november', new URLSearchParams('utm=x'))).toBe(false)
    expect(isMoonQueryRequest('/moon-phase-today', new URLSearchParams('year=2027'))).toBe(false)
  })

  it('数据库不可达时各页照常返回数据，查询参数结果为 noindex', async () => {
    runtime.locale = 'en'
    const site = Promise.resolve({ loaderData: { site: { id: 'west' } } })
    const loadSingle = SingleSegment.options.loader as unknown as (input: unknown) => Promise<{
      westContent?: { route: unknown; head: { meta: unknown[] } }
    }>
    const loadTwo = TwoSegment.options.loader as unknown as (input: unknown) => Promise<{
      westContent?: { route: unknown; head: { meta: unknown[] } }
    }>
    for (const slug of ['moon-phase-today', 'full-moon', 'full-moon-calendar', 'moon-calendar']) {
      const data = await loadSingle({ params: { slug }, deps: {}, parentMatchPromise: site })
      expect(data.westContent?.route).toMatchObject({ collection: 'moon' })
    }
    const month = await loadTwo({
      params: { section: 'moon-calendar', item: 'january' },
      deps: {},
      location: { hash: '', searchStr: '' },
      parentMatchPromise: site,
    })
    expect(month.westContent?.route).toMatchObject({ collection: 'moon', id: 'january' })
    expect(month.westContent?.head.meta).not.toContainEqual({
      name: 'robots',
      content: MOON_QUERY_ROBOTS,
    })
    const query = await loadTwo({
      params: { section: 'moon-calendar', item: 'january' },
      deps: { year: 2028 },
      location: { hash: '', searchStr: '?year=2028' },
      parentMatchPromise: site,
    })
    expect(query.westContent?.head.meta).toContainEqual({
      name: 'robots',
      content: MOON_QUERY_ROBOTS,
    })
    expect(database.calls).toBe(0)
  })

  it('东方站与其他语言没有月相地址', () => {
    expect(westContentRouteOf('en', '/moon-phase-today')).toMatchObject({ id: 'today' })
    expect(westContentRouteOf('es', '/moon-phase-today')).toBeUndefined()
    expect(westContentRouteOf('en', '/moon-calendar/smarch')).toBeUndefined()
  })

  it('注册表登记 16 个西方站地址：预渲染、目录分组 moon，只有今日月相进页头', () => {
    const routes = TOOL_ROUTES.filter((route) => MOON_TOOL_ROUTES.includes(route))
    expect(routes).toHaveLength(16)
    for (const route of routes) {
      expect(route).toMatchObject({
        site: 'west',
        directoryGroup: 'moon',
        freeLabel: 'free_lookup',
      })
      expect(route.prerender).toBeUndefined()
      expect(route.nav).toBe(route.id === 'moon-phase-today' ? undefined : false)
    }
    expect(routes.map((route) => route.paths.en)).toContain(moonMonthPath(12))
  })

  it('服务端 HTML 为构建日的 UTC 视图，正文含月历、满月表与合规说明', () => {
    for (const id of [
      'today',
      'full-moon',
      'full-moon-calendar',
      'moon-calendar',
      'march',
    ] as const) {
      const html = renderToStaticMarkup(
        <MoonPage payload={page(id, '2026-11-23T08:00:00Z').payload} />,
      )
      expect(html).toContain('do not predict the future')
      expect(html).not.toMatch(/\bAI\b/)
    }
    const today = renderToStaticMarkup(
      <MoonPage payload={page('today', '2026-11-23T08:00:00Z').payload} />,
    )
    expect(today).toContain('As of Monday, November 23, 2026')
    expect(today).toContain('href="/moon-calendar/november"')
  })

  it('月相页的客户端模块不引入 astronomy-engine（只允许类型导入）', () => {
    const dir = new URL('./', import.meta.url)
    const files = readdirSync(dir).filter(
      (file) => /\.tsx?$/.test(file) && !file.endsWith('.test.tsx'),
    )
    expect(files).toContain('pages.tsx')
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), 'utf8')
      expect(source, file).not.toMatch(/from 'astronomy-engine'/)
      for (const match of source.matchAll(/^import (type )?[^;]*from '@xuanxue\/astro[^']*'/gm))
        expect(match[1], file).toBe('type ')
    }
  })
})
