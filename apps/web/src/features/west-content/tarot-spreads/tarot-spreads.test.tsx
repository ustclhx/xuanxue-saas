import { readFileSync } from 'node:fs'
import { generateMoonBuildData } from '@xuanxue/astro/moon'
import { TOPIC_SPREAD_SIZES } from '@xuanxue/tarot'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as TarotSpreadRoute } from '../../../routes/tarot/$spread.tsx'
import { SpreadTable } from '../../tools/tarot/table.tsx'
import type { MoonData } from '../moon/moon.functions.ts'
import { westContentRouteOf } from '../routes.ts'
import { type TarotSpreadEntry, tarotSpreadPage } from './page.functions.ts'
import { TarotTopicSpreadPage } from './page.tsx'
import { TAROT_SPREAD_TOOL_ROUTES, TAROT_TOPIC_SPREADS } from './paths.ts'

const runtime = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
// 数据库不可达：公开牌阵页不得创建数据库客户端
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
        middleware: () => builder,
        handler: (handler: (input: unknown) => unknown) => handler,
      }
      return builder
    },
  }
})
vi.mock('content-collections', () => import('../../../../.content-collections/generated/index.js'))
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

const entries = generated<TarotSpreadEntry[]>('allTarotSpreads')
// 固定构建日，结果不随运行日期变化
const MOON: MoonData = {
  ...generateMoonBuildData('2026-11-23'),
  buildDate: '2026-11-23',
  years: [2026, 2027],
}
const links = () => ({ breadcrumb: [], titleOf: (path: string) => path })

describe('主题牌阵页', () => {
  it('三个牌阵各有逐页文案，牌位数与牌库的牌数一致，Title 与 H1 不以 free tarot reading 开头', () => {
    expect(entries.map((entry) => entry.key).sort()).toEqual([...TAROT_TOPIC_SPREADS].sort())
    for (const entry of entries) {
      expect(entry.positions).toHaveLength(
        TOPIC_SPREAD_SIZES[entry.key as keyof typeof TOPIC_SPREAD_SIZES],
      )
      expect(entry.title).not.toMatch(/^free tarot reading/i)
      expect(entry.heading).not.toMatch(/^free tarot reading/i)
    }
  })

  it('注册为西方站 en 页面，不进页头下拉，进塔罗分组并带 New 小标', () => {
    expect(TAROT_SPREAD_TOOL_ROUTES.map((route) => route.paths.en)).toEqual([
      '/tarot/love',
      '/tarot/career',
      '/tarot/full-moon',
    ])
    for (const route of TAROT_SPREAD_TOOL_ROUTES)
      expect(route).toMatchObject({ site: 'west', nav: false, directoryGroup: 'tarot' })
    expect(westContentRouteOf('en', '/tarot/love')).toMatchObject({ collection: 'tarot-spreads' })
    expect(westContentRouteOf('es', '/tarot/love')).toBeUndefined()
  })

  it('满月牌阵附带参考日前后的月相表，其他牌阵不带；More spreads 列出另外两个牌阵与三张牌', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    const moon = tarotSpreadPage('full-moon', now, entries, MOON, links)
    expect(moon?.payload.moon?.asOf).toBe('2026-11-24')
    const events = moon?.payload.moon?.table.events.filter((event) => event.phase === 'full-moon')
    // 2026-11-24 满月与下一次满月（2026-12-24）都在截取范围内
    expect(
      events?.slice(0, 2).map((event) => new Date(event.utcMs).toISOString().slice(0, 10)),
    ).toEqual(['2026-11-24', '2026-12-24'])
    expect(tarotSpreadPage('love', now, entries, MOON, links)?.payload.moon).toBeNull()
    expect(
      tarotSpreadPage('career', now, entries, MOON, links)?.payload.related.map((r) => r.href),
    ).toEqual(['/tarot/love', '/tarot/full-moon', '/tarot'])
    // 参考日超出预计算表时不给月相框数据
    expect(
      tarotSpreadPage('full-moon', new Date('2030-01-01T00:00:00Z'), entries, MOON, links)?.payload
        .moon,
    ).toBeNull()
  })

  it('渲染牌位说明、正文与相关区块；满月牌阵有月相框和两个月相页链接；无付费解锁卡', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    for (const id of TAROT_TOPIC_SPREADS) {
      const page = tarotSpreadPage(id, now, entries, MOON, links)
      if (!page) throw new Error(id)
      const html = renderToStaticMarkup(<TarotTopicSpreadPage payload={page.payload} />)
      expect(html).toContain(page.payload.heading)
      for (const position of page.payload.positions) expect(html).toContain(position.name)
      expect(html).toContain('data-link-zone="related"')
      expect(html).not.toMatch(/credits|\bAI\b/)
      if (id === 'full-moon') {
        expect(html).toContain('Full moon today · Beaver Moon')
        expect(html).toContain('href="/moon-phase-today"')
        expect(html).toContain('href="/full-moon-calendar"')
      } else expect(html).not.toContain('href="/moon-phase-today"')
    }
  })

  it('4 张牌手机 2×2、桌面一行；5 张牌手机 3 + 2、桌面一行', () => {
    const positions = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, meaning: '' }))
    const four = renderToStaticMarkup(
      <SpreadTable
        spread="career"
        cards={[]}
        positions={positions(4)}
        revealed={[]}
        locale="en"
        onReveal={() => {}}
      />,
    )
    expect(four).toContain('grid-cols-2')
    expect(four).toContain('sm:grid-cols-4')
    const five = renderToStaticMarkup(
      <SpreadTable
        spread="love"
        cards={[]}
        positions={positions(5)}
        revealed={[]}
        locale="en"
        onReveal={() => {}}
      />,
    )
    expect(five).toContain('grid-cols-6')
    expect(five).toContain('sm:grid-cols-5')
    expect(five.match(/col-start-2 sm:col-start-auto/g)).toHaveLength(1)
  })

  it('/tarot/love 经塔罗文件路由转交西方内容分发，数据库不可达时仍可加载；东方站与未知子路径不转交', async () => {
    const load = TarotSpreadRoute.options.loader as unknown as (input: unknown) => Promise<{
      westContent?: { route: { id: string }; content: unknown }
      spread?: string
    }>
    const parent = (site: string) => Promise.resolve({ loaderData: { site: { id: site } } })
    database.calls = 0
    const data = await load({ params: { spread: 'love' }, parentMatchPromise: parent('west') })
    expect(data.westContent?.route.id).toBe('love')
    expect(database.calls).toBe(0)
    const daily = await load({ params: { spread: 'daily' }, parentMatchPromise: parent('west') })
    expect(daily.spread).toBe('daily')
    await expect(
      load({ params: { spread: 'love' }, parentMatchPromise: parent('east') }),
    ).rejects.toBeDefined()
  })
})
