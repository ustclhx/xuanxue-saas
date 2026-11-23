import { tojeongGwae } from '@xuanxue/bazi/tojeong'
import { describe, expect, it, vi } from 'vitest'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import { loadGwae } from './gwae.ts'
import { hasTojeongShareQuery, isGwaeNumber, TOJEONG_QUERY_ROBOTS } from './paths.ts'
import { computeTojeong, sharedOutcome } from './tool-page.tsx'

const runtime = vi.hoisted(() => ({ locale: 'ko' }))
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
        handler: (handler: (input: unknown) => unknown) => handler,
      }
      return builder
    },
  }
})
vi.mock('content-collections', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(
    new URL('../../../../.content-collections/generated/allTojeongs.js', import.meta.url),
    'utf8',
  )
  return {
    allTojeongs: JSON.parse(
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

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

const ALL_GWAE = Array.from({ length: 8 }, (_, sang) =>
  Array.from({ length: 6 }, (_, jung) =>
    Array.from({ length: 3 }, (_, ha) => (sang + 1) * 100 + (jung + 1) * 10 + ha + 1),
  ),
).flat(2)

describe('表单计算（阴阳历、闰月）', () => {
  it('阳历 1990-05-15 先换算为阴历 4 月 21 日，2027 年为 463괘（与引擎一致）', async () => {
    const computed = await computeTojeong(
      form({ calendar: 'solar', year: '1990', month: '5', day: '15', target: '2027' }),
    )
    expect(computed).toMatchObject({ ok: true })
    if (!computed.ok || computed.outcome.kind !== 'computed') throw new Error('expected result')
    const { result } = computed.outcome
    expect(result.birthLunar).toEqual({ year: 1990, month: 4, day: 21, isLeapMonth: false })
    expect(result).toMatchObject({ gwae: 463, countingAge: 38, taeseNumber: 14 })
    expect(result).toEqual(
      tojeongGwae({ birth: { year: 1990, month: 5, day: 15 }, calendar: 'solar' }, 2027),
    )
  })

  it('阴历输入不换算；闰月按平月计算，目标年份可选', async () => {
    const lunar = await computeTojeong(
      form({ calendar: 'lunar', year: '1985', month: '3', day: '30', target: '2027' }),
    )
    if (!lunar.ok || lunar.outcome.kind !== 'computed') throw new Error('expected result')
    // 2027 年阴历 3 月是小月：生日 30 日按 29 日计算
    expect(lunar.outcome.result).toMatchObject({ gwae: 113, targetLunar: { day: 29 } })

    const leap = await computeTojeong(
      form({ calendar: 'lunar', year: '2020', month: '4', day: '10', leap: 'on', target: '2027' }),
    )
    if (!leap.ok || leap.outcome.kind !== 'computed') throw new Error('expected result')
    expect(leap.outcome.result.birthLunar.isLeapMonth).toBe(true)
    expect(leap.outcome.result.gwae).toBe(
      tojeongGwae({ birth: { year: 2020, month: 4, day: 10 }, calendar: 'lunar' }, 2027).gwae,
    )

    const next = await computeTojeong(
      form({ calendar: 'solar', year: '1990', month: '5', day: '15', target: '2028' }),
    )
    if (!next.ok || next.outcome.kind !== 'computed') throw new Error('expected result')
    expect(next.outcome.result.countingAge).toBe(39)
  })

  it('不存在的闰月、非法日期与早于出生年的目标年份给出对应错误', async () => {
    expect(
      await computeTojeong(
        form({ calendar: 'lunar', year: '2020', month: '5', day: '1', leap: 'on' }),
      ),
    ).toEqual({ ok: false, error: 'leap' })
    // 阳历表单中的闰月勾选不生效
    expect(
      await computeTojeong(
        form({ calendar: 'solar', year: '2020', month: '5', day: '1', leap: 'on' }),
      ),
    ).toMatchObject({ ok: true })
    for (const values of [
      { year: '1990', month: '2', day: '30' },
      { year: '1899', month: '5', day: '1' },
      { year: '', month: '5', day: '1' },
      { year: '1990', month: '13', day: '1' },
    ])
      expect(await computeTojeong(form({ calendar: 'solar', ...values }))).toEqual({
        ok: false,
        error: 'date',
      })
    expect(
      await computeTojeong(
        form({ calendar: 'solar', year: '2027', month: '12', day: '31', target: '2026' }),
      ),
    ).toEqual({ ok: false, error: 'target' })
  })
})

describe('分享参数与索引', () => {
  it('分享参数只认合法괘 번호与可选年份', () => {
    expect(sharedOutcome('?gwae=463&year=2027')).toEqual({ kind: 'shared', gwae: 463, year: 2027 })
    expect(sharedOutcome('?gwae=463')).toEqual({ kind: 'shared', gwae: 463, year: 2027 })
    for (const search of ['', '?gwae=470', '?gwae=964', '?gwae=463&year=1999', '?gwae=abc'])
      expect(sharedOutcome(search)).toBeNull()
    expect(hasTojeongShareQuery(new URLSearchParams('gwae=463'))).toBe(true)
    expect(hasTojeongShareQuery({ date: undefined })).toBe(false)
  })

  it('带分享参数的工具页为 noindex, follow，canonical 指向工具页；数据库不可达照常返回', async () => {
    runtime.locale = 'ko'
    const loader = SingleSegment.options.loader
    if (typeof loader !== 'function') throw new Error('缺少待测的路由处理函数')
    const load = (deps: Record<string, unknown>) =>
      loader({ params: { slug: '토정비결' }, deps } as unknown as Parameters<typeof loader>[0])

    const plain = await load({ date: undefined })
    expect(plain.eastContent?.route).toMatchObject({ collection: 'tojeong', id: 'tool' })
    type Head = {
      meta: { name?: string; content?: string }[]
      links: { rel: string; href: string }[]
    }
    const headOf = (data: typeof plain) => data.eastContent?.head as Head | undefined
    const robots = (data: typeof plain) => headOf(data)?.meta.find((meta) => meta.name === 'robots')
    expect(robots(plain)).toBeUndefined()

    const shared = await load({ date: undefined, gwae: 463, year: 2027 })
    expect(robots(shared)).toEqual({ name: 'robots', content: TOJEONG_QUERY_ROBOTS })
    const canonical = headOf(shared)?.links.find((link) => link.rel === 'canonical')
    expect(decodeURI(canonical?.href ?? '')).toMatch(/\/ko\/토정비결$/)
    expect(database.calls).toBe(0)
  })

  it('只有 ko 一个地址；注册表为年度组、2027 小标，站点地图只含不带参数的地址', () => {
    expect(eastContentRouteOf('ko', '/토정비결')).toMatchObject({ collection: 'tojeong' })
    expect(eastContentRouteOf('zh-Hans', '/토정비결')).toBeUndefined()
    const route = TOOL_ROUTES.find((item) => item.id === 'tojeong')
    expect(route).toMatchObject({
      site: 'east',
      directoryGroup: 'yearly',
      paths: { ko: '/토정비결' },
      badge: { kind: 'year', until: '2027-02-28' },
    })
    expect(Object.values(route?.paths ?? {}).some((path) => path?.includes('?'))).toBe(false)
  })
})

describe('144괘解读', () => {
  it('111–863 共 144 个괘 번호都能按需加载到解读', async () => {
    expect(ALL_GWAE).toHaveLength(144)
    expect(ALL_GWAE.every(isGwaeNumber)).toBe(true)
    for (const gwae of ALL_GWAE) {
      const entry = await loadGwae(gwae)
      expect(entry?.summary, String(gwae)).toBeTruthy()
    }
    expect(await loadGwae(470)).toBeNull()
  })
})
