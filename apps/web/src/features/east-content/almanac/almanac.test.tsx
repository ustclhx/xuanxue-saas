import * as engine from '@xuanxue/bazi/almanac'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as TwoSegment } from '../../../routes/$section/$item.tsx'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { TOOL_ROUTES, toolsForSite } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import {
  type AlmanacMonthPayload,
  type AlmanacToolPayload,
  almanacPayload,
} from './almanac.functions.ts'
import { ALMANAC_QUERY_ROBOTS, almanacHead } from './head.ts'
import { displayYear } from './model.ts'
import { AlmanacMonthPage } from './month-page.tsx'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hans' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
// 数据库不可达：任何创建数据库客户端或探测连接的调用都会失败（spec「不查数据库」）
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
  const source = readFileSync(
    new URL('../../../../.content-collections/generated/allAlmanacs.js', import.meta.url),
    'utf8',
  )
  return {
    allAlmanacs: JSON.parse(
      source
        .replace(/^\s*export default\s*/, '')
        .trim()
        .replace(/;$/, ''),
    ),
  }
})
vi.mock('../../tools/numerology/content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))
vi.mock('../../tools/bazi/bazi-home.tsx', () => ({ BaziHome: () => null }))
vi.mock('../../east-en/feelings.functions.ts', () => ({ getTarotFeelings: vi.fn() }))
vi.mock('../../east-en/tarot-pages.tsx', () => ({ EastEnTarotPage: () => null }))

/** 北京时间的某一刻 */
const beijing = (iso: string) => new Date(`${iso}+08:00`)
const month = async (id: number, now: Date) =>
  (await almanacPayload(String(id), undefined, now, engine)) as AlmanacMonthPayload
const tool = async (date: string | undefined, now = beijing('2026-11-22T10:00:00')) =>
  (await almanacPayload('tool', date, now, engine)) as AlmanacToolPayload

describe('月份页年份滚动（决策 5）', () => {
  it('参考月份 ≤ M 时取当年，否则取次年', () => {
    expect(displayYear(1, { year: 2026, month: 12, day: 10 })).toBe(2027)
    expect(displayYear(12, { year: 2026, month: 12, day: 10 })).toBe(2026)
    expect(displayYear(11, { year: 2026, month: 11, day: 22 })).toBe(2026)
  })

  it('2026-12-10 打开 1 月页显示 2027 年 1 月，Title 含「2027年1月」', async () => {
    const payload = await month(1, beijing('2026-12-10T09:00:00'))
    expect(payload.view).toMatchObject({ year: 2027, month: 1 })
    const head = almanacHead(payload)
    expect(head.meta[0]?.title).toContain('2027年1月')
  })

  it('当月页显示全月（含已过去的日子），北京时间跨月后才滚到次年', async () => {
    const before = await month(11, beijing('2026-11-30T23:59:59'))
    expect(before.view.year).toBe(2026)
    expect(before.view.days).toHaveLength(30)
    expect(before.view.days[0]?.date).toBe('2026-11-01')
    expect(before.view.days.find((day) => day.today)?.date).toBe('2026-11-30')
    const after = await month(11, beijing('2026-12-01T00:00:00'))
    expect(after.view.year).toBe(2027)
    expect(after.view.days.some((day) => day.today)).toBe(false)
    // 同一时刻 UTC 仍是 11 月 30 日：以北京时间为准
    expect(beijing('2026-12-01T00:00:00').getUTCDate()).toBe(30)
    expect((await month(12, beijing('2026-12-01T00:00:00'))).view.year).toBe(2026)
    // 跨年：12 月过完后 12 月页滚到次年，1 月页显示当年
    const newYear = beijing('2027-01-01T00:00:00')
    expect((await month(12, newYear)).view.year).toBe(2027)
    expect((await month(1, newYear)).view.year).toBe(2027)
  })

  it('12 个月份页的 Title、H1 两两不同，Title 不含「吉日」', async () => {
    const now = beijing('2026-11-22T10:00:00')
    const titles = new Set<string>()
    for (let id = 1; id <= 12; id++) {
      const title = almanacHead(await month(id, now)).meta[0]?.title ?? ''
      expect(title).not.toMatch(/吉日|嫁娶|婚/)
      titles.add(title)
    }
    expect(titles.size).toBe(12)
  })
})

describe('月份页内容', () => {
  it('6 月页列出芒种、夏至的交节时刻与月建由巳转午，并标出入梅', async () => {
    const payload = await month(6, beijing('2026-11-22T10:00:00'))
    expect(payload.view.year).toBe(2027)
    expect(payload.view.terms.map((term) => term.name)).toEqual(['芒种', '夏至'])
    expect(payload.view.monthBranch).toMatchObject({ from: '巳', to: '午', term: '芒种' })
    expect(payload.view.seasonal.map((item) => item.names).join('、')).toContain('入梅')
  })

  it('交节日与前一日的建除相同时照实列出并在节气卡说明', async () => {
    const payload = await month(11, beijing('2026-11-22T10:00:00'))
    const [lidong] = payload.view.terms
    expect(lidong).toMatchObject({ name: '立冬', time: '17:52', repeatedDuty: '开' })
    expect(payload.view.days[5]?.duty.name).toBe('开')
    expect(payload.view.days[6]?.duty.name).toBe('开')
  })

  it('逐日表宜先显示 4 项、忌 3 项，其余收进 details；嫁娶按引擎顺序作为普通词条出现', async () => {
    const payload = await month(11, beijing('2026-11-22T10:00:00'))
    const day = payload.view.days[21]
    expect(day?.recommends.slice(0, 4)).toEqual(['纳采', '订盟', '嫁娶', '祭祀'])
    const html = renderToStaticMarkup(<AlmanacMonthPage payload={payload} />)
    expect(html).toContain('另 19 项')
    expect(html).toContain('data-table-section')
    // 各月一致的 H2；页面没有汇总嫁娶日期的段落
    for (const title of ['本月节气与节令', '本月每日黄历', '怎么读本月的宜忌', '常见问题'])
      expect(html).toContain(`>${title}</h2>`)
    expect(html).not.toMatch(/<h[1-3][^>]*>[^<]*(嫁娶|婚)/)
  })
})

describe('工具页', () => {
  it('2026-11-22 默认显示庚子日，白虎（黑道），冲马煞南，当天交小雪', async () => {
    const payload = await tool(undefined)
    expect(payload.query).toBe(false)
    expect(payload.result).toMatchObject({
      date: '2026-11-22',
      pillars: { year: '丙午', month: '己亥', day: '庚子' },
      star: { name: '白虎', ecliptic: '黑道', yellow: false },
      clash: { zodiac: '马', sha: '南' },
      duty: { name: '除' },
      term: { name: '小雪', beginsToday: true },
    })
    expect(payload.result?.termNote).toBe('当天 15:23 交小雪。')
    // 黄历页的建除释义只写字义与次序，不带随日期变化的行动建议（每日页另用自己的释义）
    expect(payload.result?.duty.gloss).toContain('十二值星的第二位')
    expect(payload.result?.duty.gloss).not.toMatch(/适合|不宜|提醒/)
    expect(payload.months).toEqual({ current: 11, next: 12 })
    const head = almanacHead(payload)
    expect(head.meta).not.toContainEqual(expect.objectContaining({ name: 'robots' }))
  })

  it('选择 2027-02-04：结果更新并标明当天交立春，带参数时 noindex, follow，canonical 指向工具页', async () => {
    const payload = await tool('2027-02-04')
    expect(payload.result?.pillars).toEqual({ year: '丁未', month: '壬寅', day: '甲寅' })
    expect(payload.result?.termNote).toBe('当天 09:46 交立春，干支年由丙午转为丁未，月建由丑转寅。')
    expect(payload.result?.avoids).toEqual([])
    const head = almanacHead(payload)
    expect(head.meta).toContainEqual({ name: 'robots', content: ALMANAC_QUERY_ROBOTS })
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: `https://ganjiday.com/zh-hans/${encodeURIComponent('黄历')}`,
    })
  })

  it('日期非法或超出范围时为错误态，仍 noindex', async () => {
    for (const date of ['2026-02-30', 'abc', '1899-12-31', '']) {
      const payload = await tool(date)
      expect(payload.result, date).toBeNull()
      expect(almanacHead(payload).meta).toContainEqual({
        name: 'robots',
        content: ALMANAC_QUERY_ROBOTS,
      })
    }
  })
})

describe('路由与站点地图', () => {
  const loadTwo = TwoSegment.options.loader
  const loadSingle = SingleSegment.options.loader
  if (typeof loadTwo !== 'function' || typeof loadSingle !== 'function')
    throw new Error('缺少待测的路由处理函数')

  it('没有逐日页面：逐日地址返回 404', async () => {
    runtime.locale = 'zh-Hans'
    for (const item of ['2026-12-01', '12月1日', '13月']) {
      expect(eastContentRouteOf('zh-Hans', `/黄历/${item}`)).toBeUndefined()
      await expect(
        loadTwo({ params: { section: '黄历', item } } as Parameters<typeof loadTwo>[0]),
      ).rejects.toMatchObject({ isNotFound: true })
    }
    // 其他语言没有黄历
    expect(eastContentRouteOf('zh-Hant', '/黄历')).toBeUndefined()
    expect(eastContentRouteOf('ko', '/黄历/1月')).toBeUndefined()
  })

  it('数据库不可达时月份页与带日期的工具页照常返回数据', async () => {
    runtime.locale = 'zh-Hans'
    const monthData = await loadTwo({
      params: { section: '黄历', item: encodeURIComponent('1月') },
    } as Parameters<typeof loadTwo>[0])
    expect(monthData.eastContent?.route).toMatchObject({ collection: 'almanac', id: '1' })
    const toolData = await loadSingle({
      params: { slug: '黄历' },
      deps: { date: '2027-02-04' },
    } as Parameters<typeof loadSingle>[0])
    expect(toolData.eastContent?.head.meta).toContainEqual({
      name: 'robots',
      content: ALMANAC_QUERY_ROBOTS,
    })
    expect(database.calls).toBe(0)
  })

  it('注册表登记 13 个不带参数的地址，均不预渲染；工具页进页头「历法与生肖」分组，月份页不进导航', () => {
    const routes = TOOL_ROUTES.filter((route) => route.id.startsWith('almanac'))
    expect(routes.map((route) => route.paths['zh-Hans'])).toEqual([
      '/黄历',
      ...Array.from({ length: 12 }, (_, i) => `/黄历/${i + 1}月`),
    ])
    for (const route of routes) {
      expect(route).toMatchObject(
        route.id === 'almanac'
          ? { site: 'east', prerender: false, navGroup: 'calendar' }
          : { site: 'east', prerender: false, nav: false },
      )
      // content-growth-v2-tools 第 18 组：zh-Hant 農民曆并入同一条目，互为 hreflang
      expect(Object.keys(route.paths)).toEqual(['zh-Hans', 'zh-Hant'])
    }
    expect(
      toolsForSite('east', 'zh-Hans')
        .filter((tool) => tool.navGroup === 'calendar')
        .map((tool) => tool.title),
    ).toEqual(['黄历', '十二生肖'])
  })
})
