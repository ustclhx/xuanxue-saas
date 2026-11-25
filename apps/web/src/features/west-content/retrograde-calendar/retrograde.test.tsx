import { readdirSync, readFileSync } from 'node:fs'
import {
  assertRetrogradeCoverage,
  generateRetrogradeBuildData,
  retrogradeSigns,
} from '@xuanxue/astro/retrograde'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { templateConfig } from '../../../server/template-config.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { directoryGroups } from '../../tools/directory.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { westContentRouteOf } from '../routes.ts'
import { mercuryNowAnswer } from './copy.ts'
import {
  activePeriods,
  dateWithYear,
  nextAfterYear,
  type RetroData,
  yearPeriods,
  yearSpan,
} from './model.ts'
import { RetrogradePage } from './pages.tsx'
import { RETROGRADE_PATH, RETROGRADE_TOOL_ROUTES } from './paths.ts'
import { type RetroEntry, retrogradeHead, retrogradePage } from './retrograde.functions.ts'

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

/** 与 content-collections.ts 的 retrogradeData 同一换算，固定构建日，结果不随运行日期变化 */
function dataFor(buildDate: string): RetroData {
  const table = generateRetrogradeBuildData(buildDate)
  return {
    ...table,
    periods: table.periods.map(({ planet, startMs, endMs, startLongitude, endLongitude }) => ({
      planet,
      startMs,
      endMs,
      signs: retrogradeSigns(startLongitude, endLongitude),
    })),
  }
}

const DATA = dataFor('2026-11-25')
const entries = generated<RetroEntry[]>('allRetrogradeCalendars')
const links = () => ({ breadcrumb: [], titleOf: (path: string) => path })
const page = (now: string, data = DATA) => {
  const result = retrogradePage(new Date(now), data, entries, links)
  if (!result) throw new Error('no retrograde page')
  return result
}

describe('逆行日历模型', () => {
  it('跨年的逆行期在两个年份都列出，时间条截到年界', () => {
    const jupiter2026 = yearPeriods(DATA, 'jupiter', 2026, 'UTC')
    const jupiter2027 = yearPeriods(DATA, 'jupiter', 2027, 'UTC')
    expect(jupiter2026.map((p) => dateWithYear(p.startMs, 'UTC'))).toEqual([
      'Nov 11, 2025',
      'Dec 13, 2026',
    ])
    expect(jupiter2027.map((p) => dateWithYear(p.endMs, 'UTC'))).toEqual(['Apr 13, 2027'])
    const [first] = jupiter2026
    expect(first && yearSpan(first, 2026, 'UTC')).toMatchObject({ start: 0 })
    const last = jupiter2026.at(-1)
    expect(last && yearSpan(last, 2026, 'UTC').end).toBe(1)
  })

  it('当地日期按访客时区：同一停滞时刻在东京与洛杉矶可落在不同日期', () => {
    // 金星 2026-11-14 约 00:20 UTC 恢复顺行：洛杉矶仍是 11 月 13 日
    const venus = yearPeriods(DATA, 'venus', 2026, 'UTC')[0]
    expect(venus).toBeDefined()
    if (!venus) return
    expect(dateWithYear(venus.endMs, 'Asia/Tokyo')).toBe('Nov 14, 2026')
    expect(dateWithYear(venus.endMs, 'America/Los_Angeles')).toBe('Nov 13, 2026')
  })

  it('没有逆行的年份给出下一次开始的日期', () => {
    expect(yearPeriods(DATA, 'mars', 2026, 'UTC')).toEqual([])
    const next = nextAfterYear(DATA, 'mars', 2026, 'UTC')
    expect(next && dateWithYear(next.startMs, 'UTC')).toBe('Jan 10, 2027')
    expect(yearPeriods(DATA, 'venus', 2027, 'UTC')).toEqual([])
  })

  it('此刻逆行的行星与水星现状', () => {
    const now = Date.parse('2026-11-25T12:00:00Z')
    expect(activePeriods(DATA, now).map((p) => p.planet)).toEqual(['saturn', 'uranus', 'neptune'])
    expect(mercuryNowAnswer(DATA, now, 'UTC')).toBe(
      'No. Mercury turned direct on November 13, 2026. The next Mercury retrograde begins on February 9, 2027.',
    )
    expect(mercuryNowAnswer(DATA, Date.parse('2027-02-20T00:00:00Z'), 'UTC')).toBe(
      'Yes. Mercury turned retrograde on February 9, 2027 and turns direct on March 3, 2027.',
    )
  })
})

describe('年份滚动与覆盖期', () => {
  it('H1 与 Title 列出构建年与次年，跨年构建后滚动', () => {
    const now = page('2026-11-25T08:00:00Z')
    expect(now.payload.heading).toBe('Retrograde Calendar: 2026 and 2027')
    expect(now.seo.title).toContain('2026–2027')
    const later = page('2027-01-05T08:00:00Z', dataFor('2027-01-05'))
    expect(later.payload.heading).toBe('Retrograde Calendar: 2027 and 2028')
    expect(later.seo.description).toContain('2027 and 2028')
  })

  it('内容集合生成的表在构建日满足覆盖期，次年之后未重新构建即报错', () => {
    const [built] = generated<RetroData[]>('allRetrogradeData')
    expect(built).toBeDefined()
    if (!built) return
    const tuple = built.years as [number, number]
    expect(() =>
      assertRetrogradeCoverage({ ...built, years: tuple }, built.buildDate),
    ).not.toThrow()
    expect(() =>
      assertRetrogradeCoverage({ ...built, years: tuple }, `${tuple[1] + 1}-01-01`),
    ).toThrow(RangeError)
  })
})

describe('逆行日历页', () => {
  it('数据库不可达时页面照常返回数据', async () => {
    runtime.locale = 'en'
    const site = Promise.resolve({ loaderData: { site: { id: 'west' } } })
    const loadSingle = SingleSegment.options.loader as unknown as (input: unknown) => Promise<{
      westContent?: { route: unknown; head: { meta: unknown[] } }
    }>
    const data = await loadSingle({
      params: { slug: 'retrograde-calendar' },
      deps: {},
      parentMatchPromise: site,
    })
    expect(data.westContent?.route).toMatchObject({ collection: 'retrograde-calendar' })
    expect(database.calls).toBe(0)
  })

  it('只有西方站 en 有地址', () => {
    expect(westContentRouteOf('en', RETROGRADE_PATH)).toMatchObject({ id: 'index' })
    expect(westContentRouteOf('es', RETROGRADE_PATH)).toBeUndefined()
  })

  it('注册表：预渲染、占星分组与 New 小标，进全部工具页且排在星座枢纽之后', () => {
    const routes = TOOL_ROUTES.filter((route) => RETROGRADE_TOOL_ROUTES.includes(route))
    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({
      site: 'west',
      directoryGroup: 'astrology',
      freeLabel: 'free_lookup',
      badge: { kind: 'new' },
    })
    expect(prerenderEntryPages(templateConfig, routes).map((entry) => entry.path)).toContain(
      RETROGRADE_PATH,
    )
    const astrology = directoryGroups('west', 'en', TOOL_ROUTES, '2026-12-01').find(
      (group) => group.group === 'astrology',
    )
    const ids = astrology?.tools.map((tool) => tool.id) ?? []
    expect(ids.indexOf('retrograde-calendar')).toBeGreaterThan(ids.indexOf('western-zodiac-signs'))
    expect(
      directoryGroups('west', 'es').flatMap((group) => group.tools.map((t) => t.id)),
    ).not.toContain('retrograde-calendar')
  })

  it('服务端 HTML 为构建时刻的 UTC 视图：表格、无逆行说明、FAQ 已填、合规说明与正文内链', () => {
    const result = page('2026-11-25T08:00:00Z')
    const html = renderToStaticMarkup(<RetrogradePage payload={result.payload} />)
    expect(html).toContain('Retrograde Calendar: 2026 and 2027')
    expect(html).toContain('As of Wednesday, November 25, 2026')
    expect(html).toContain('Mercury retrograde 2026')
    expect(html).toContain('Feb 26, 2026')
    expect(html).toContain('No retrograde in 2026. The next begins Jan 10, 2027.')
    expect(html).toContain('No retrograde in 2027.')
    expect(html).toContain('Saturn · until Dec 10')
    expect(html).toContain('Dates are in UTC.')
    expect(html).toContain('do not predict the future')
    expect(html).toContain('href="/birth-chart"')
    expect(html).not.toContain('{mercury-now}')
    expect(html).not.toMatch(/\bAI\b/)
    // 结构化数据中的 FAQ 答案同样已按参考时刻填好
    const head = JSON.stringify(retrogradeHead(result))
    expect(head).toContain('The next Mercury retrograde begins on February 9, 2027.')
    expect(head).not.toContain('{mercury-now}')
  })

  it('逆行日历的客户端模块不引入 astronomy-engine（只允许类型导入）', () => {
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
