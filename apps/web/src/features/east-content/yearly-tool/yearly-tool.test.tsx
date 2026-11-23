import { annualOutlook, type BirthInput, computeChart } from '@xuanxue/bazi'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Route as SingleSegment } from '../../../routes/$slug.tsx'
import { templateConfig } from '../../../server/template-config.ts'
import { BAZI } from '../../east-en/copy/tools.ts'
import { EastEnText } from '../../east-en/links.tsx'
import { EAST_EN_CONTENT_ROUTES, isEastEnglishOnlyPath } from '../../east-en/paths.ts'
import { SiteContext } from '../../site/context.tsx'
import { routeSite } from '../../site/gate.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { eastContentRouteOf } from '../routes.ts'
import { COPY as EN } from './copy/en.ts'
import { COPY as KO } from './copy/ko.ts'
import type { YearlyToolCopy } from './copy/types.ts'
import { COPY as HANS } from './copy/zh-Hans.ts'
import { COPY as HANT } from './copy/zh-Hant.ts'
import { YearlyResult, YearlyToolPage, type YearlyToolResult } from './page.tsx'
import { YEARLY_TOOL_LOCALES, YEARLY_TOOL_PATHS, type YearlyToolLocale } from './paths.ts'
import { loadYearlyToolCopy, yearlyToolHead } from './route-data.tsx'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hans' }))
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
vi.mock('../../tools/numerology/content.functions.ts', () => ({ getNumerologyPage: vi.fn() }))
// 详批卡与出生档案依赖登录、报价等运行时，这里只验证它们在页面中的位置
vi.mock('../../readings/unlock-card.tsx', () => ({
  ReadingUnlock: ({ kind, request }: { kind: string; request: unknown }) => (
    <div data-testid="unlock" data-kind={kind} data-ready={request ? 'yes' : 'no'} />
  ),
}))
vi.mock('../../profiles/profile-bar.tsx', () => ({ ProfileBar: () => null }))
const birthTool = vi.hoisted(() => ({
  state: { status: 'idle' } as { status: string; result?: unknown },
}))
vi.mock('../../tools/bazi/use-birth-tool.ts', async (original) => {
  const actual = await original<typeof import('../../tools/bazi/use-birth-tool.ts')>()
  const { defaultBirthValues } = await import('../../tools/bazi/birth-form-state.ts')
  return {
    ...actual,
    useBirthTool: ({ locale }: { locale: string }) => {
      const values = {
        ...defaultBirthValues(locale),
        year: '1990',
        month: '5',
        day: '15',
        time: '10:30',
      }
      return {
        values,
        submitted: values,
        formKey: 0,
        state: birthTool.state,
        issues: [],
        fill: () => {},
        onChange: () => {},
        onSubmit: () => {},
      }
    },
  }
})

const COPIES: Record<YearlyToolLocale, YearlyToolCopy> = {
  'zh-Hans': HANS,
  'zh-Hant': HANT,
  ko: KO,
  en: EN,
}

const birth = (time: BirthInput['time']): BirthInput => ({
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time,
  gender: 'male',
  location: { city: 'beijing' },
  trueSolarTime: false,
})

function compute(input: BirthInput): YearlyToolResult {
  const chart = computeChart(input, { referenceYear: 2026 })
  return { chart, outlook: annualOutlook(chart, { startYear: 2027, years: 1 }) }
}

function render(node: ReactNode) {
  return renderToStaticMarkup(<SiteContext value="east">{node}</SiteContext>)
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('个人 2027 流年工具：地址与注册表', () => {
  it('四种语言登记地址，注册表归入 yearly 分组并带至 2027-02-28 的「2027」小标', () => {
    const route = TOOL_ROUTES.find((item) => item.id === 'yearly-tool')
    expect(route).toMatchObject({
      site: 'east',
      nav: false,
      directoryGroup: 'yearly',
      freeLabel: 'free_lookup',
      badge: { kind: 'year', label: '2027', until: '2027-02-28' },
      paths: {
        'zh-Hans': '/2027流年',
        'zh-Hant': '/2027流年',
        ko: '/2027-신년-사주',
        en: '/bazi-2027',
      },
    })
    for (const locale of ['zh-Hans', 'zh-Hant', 'ko'] as const)
      expect(eastContentRouteOf(locale, encodeURI(YEARLY_TOOL_PATHS[locale]))).toMatchObject({
        collection: 'yearly-tool',
      })
    expect(EAST_EN_CONTENT_ROUTES).toContainEqual(
      expect.objectContaining({ path: '/bazi-2027', collection: 'yearly-tool' }),
    )
    // 东方站英文独有地址：西方站同路径 404，两站不互链
    expect(isEastEnglishOnlyPath('/bazi-2027')).toBe(true)
    expect(routeSite(new URL('/bazi-2027', 'https://arcanumber.com'), templateConfig)).toEqual({
      kind: 'not-found',
    })
    expect(eastContentRouteOf('ja', '/2027流年')).toBeUndefined()
  })

  it('数据库不可达时四种语言的页面照常返回数据，head 自指 canonical 并互指 hreflang', async () => {
    const loader = SingleSegment.options.loader
    if (typeof loader !== 'function') throw new Error('缺少 $slug loader')
    for (const locale of YEARLY_TOOL_LOCALES) {
      runtime.locale = locale
      const data = await loader({
        params: { slug: YEARLY_TOOL_PATHS[locale].slice(1) },
        deps: { date: undefined },
        parentMatchPromise: Promise.resolve({ loaderData: { site: { id: 'east' } } }),
      } as unknown as Parameters<typeof loader>[0])
      expect(data.eastContent?.route).toMatchObject({ collection: 'yearly-tool', locale })
      const head = data.eastContent?.head as
        | { meta: { title?: string }[]; links: { rel: string; href: string; hrefLang?: string }[] }
        | undefined
      expect(head?.meta[0]?.title).toContain(COPIES[locale].seo.title)
      const canonical = head?.links.find((item) => item.rel === 'canonical')?.href ?? ''
      expect(decodeURI(canonical)).toContain(YEARLY_TOOL_PATHS[locale])
      const langs = head?.links
        .filter((item) => item.rel === 'alternate')
        .map((item) => item.hrefLang ?? '')
      expect(langs).toEqual(expect.arrayContaining(['zh-Hans', 'zh-Hant', 'ko', 'en']))
      expect(langs).not.toContain('ja')
    }
    expect(database.calls).toBe(0)
  })

  it('Title、H1 写明年份与干支；ko 不以신년운세、띠별 운세为目标', async () => {
    for (const locale of YEARLY_TOOL_LOCALES) {
      const copy = await loadYearlyToolCopy(locale)
      expect(copy).toBe(COPIES[locale])
      expect(copy.seo.title.startsWith('2027') || copy.seo.title.startsWith('BaZi 2027')).toBe(true)
      expect(copy.h1).toContain('2027')
    }
    expect(HANS.h1).toContain('丁未')
    expect(HANT.h1).toContain('丁未')
    expect(KO.h1).toContain('정미')
    expect(EN.h1).toContain('Fire Goat')
    for (const field of [KO.seo.title, KO.h1, KO.crumb]) {
      expect(field).toContain('2027 신년 사주')
      expect(field).not.toMatch(/신년운세|띠별 운세/)
    }
    expect(JSON.stringify(KO)).not.toContain('띠별 운세')
    const head = yearlyToolHead({ locale: 'ko', copy: KO })
    expect(head.meta[0]?.title).not.toContain('신년운세')
  })
})

describe('个人 2027 流年工具：结果', () => {
  it('结果与引擎一致：流年干支、十神、合冲、大运、太岁与喜忌', () => {
    runtime.locale = 'zh-Hans'
    const result = compute(birth({ hour: 10, minute: 30 }))
    const year = result.outlook.years[0]
    if (!year) throw new Error('缺少 2027 流年')
    // 2027 立春后为丁未年
    expect([year.stem, year.branch]).toEqual(['ding', 'wei'])
    const html = render(<YearlyResult result={result} locale="zh-Hans" copy={HANS} share={{}} />)
    const plain = text(html)
    // 1990-05-15 10:30 北京：庚午 辛巳 庚辰 辛巳；丁为正官、未本气己土为正印；午未六合
    expect(year.stemTenGod).toBe('zhengGuan')
    expect(plain).toContain('天干 丁 十神 正官 五行 火 喜忌 喜用')
    expect(plain).toContain('地支 未 十神 正印 五行 土 喜忌 忌')
    expect(plain).toContain('藏干另有丁（正官）、乙（正财）')
    expect(year.relations).toEqual([{ with: 'year', type: 'sixCombine' }])
    expect(plain).toContain('年柱 庚午 六合')
    expect(plain).toContain('日柱 庚辰 无合冲')
    // 大运乙酉在 2027 年交运
    expect(year.decade).toEqual({ stem: 'yi', branch: 'you' })
    expect(plain).toContain('大运 乙酉 无合冲；2027 年换入此运')
    expect(plain).toContain('本命年支午与流年未既不同支也不相冲')
    expect(plain).toContain('流年天干丁火为喜用，地支未土为忌')
    expect(html).not.toContain('data-testid="yearly-approximate"')
  })

  it('属牛者冲太岁、属羊者值太岁（与引擎的太岁判定一致）', () => {
    runtime.locale = 'zh-Hant'
    const ox = compute({ ...birth({ hour: 8, minute: 0 }), year: 1985, month: 6, day: 1 })
    expect(ox.outlook.years[0]?.taiSui).toBe('chong')
    expect(
      text(render(<YearlyResult result={ox} locale="zh-Hant" copy={HANT} share={{}} />)),
    ).toContain('年支丑與流年未相沖')
    const goat = compute({ ...birth({ hour: 8, minute: 0 }), year: 1991, month: 6, day: 1 })
    expect(goat.outlook.years[0]?.taiSui).toBe('zhi')
    expect(
      text(render(<YearlyResult result={goat} locale="zh-Hant" copy={HANT} share={{}} />)),
    ).toContain('年支與流年同為未')
  })

  it('不知道时辰：标注近似，只比对年、月、日三柱', () => {
    runtime.locale = 'ko'
    const result = compute(birth(null))
    expect(result.outlook.approximate).toBe(true)
    const html = render(<YearlyResult result={result} locale="ko" copy={KO} share={{}} />)
    expect(html).toContain('data-testid="yearly-approximate"')
    expect(text(html)).toContain(KO.result.approximate)
    const relations = text(html.slice(html.indexOf('id="relations"'), html.indexOf('id="tai-sui"')))
    expect(relations).not.toContain('시주')
    expect(relations).toContain('연주 庚(경)午(오) 육합')
    expect(relations).toContain('일주 庚(경)辰(진) 합충 없음')
  })

  it('详批入口在免费结果之后、说明长文之前；ko 接사주详批，其余接八字详批', () => {
    for (const locale of YEARLY_TOOL_LOCALES) {
      runtime.locale = locale
      birthTool.state = { status: 'idle' }
      const idle = render(<YearlyToolPage locale={locale} copy={COPIES[locale]} />)
      expect(idle).not.toContain('yearly-unlock-lead')
      expect(idle).toContain('data-ready="no"')
      expect(idle).toContain(`<h1`)
      expect(text(idle)).toContain(COPIES[locale].article.title)

      birthTool.state = { status: 'done', result: compute(birth({ hour: 10, minute: 30 })) }
      const html = render(<YearlyToolPage locale={locale} copy={COPIES[locale]} />)
      const result = html.indexOf('id="result"')
      const tenGods = html.indexOf('id="ten-gods"')
      const lead = html.indexOf('data-testid="yearly-unlock-lead"')
      const unlock = html.indexOf('data-testid="unlock"')
      const article = html.indexOf(COPIES[locale].article.title)
      expect(result).toBeGreaterThan(-1)
      expect(tenGods).toBeGreaterThan(result)
      expect(lead).toBeGreaterThan(tenGods)
      expect(unlock).toBeGreaterThan(lead)
      expect(article).toBeGreaterThan(unlock)
      expect(html).toContain(`data-kind="${locale === 'ko' ? 'saju-full' : 'bazi-full'}"`)
      expect(html).toContain('data-ready="yes"')
    }
    birthTool.state = { status: 'idle' }
  })

  it('正文内链 2–5 条，均为东方站同语言页面', () => {
    for (const locale of YEARLY_TOOL_LOCALES) {
      runtime.locale = locale
      const html = render(<YearlyToolPage locale={locale} copy={COPIES[locale]} />)
      const nav = html.slice(html.lastIndexOf('<nav'))
      const hrefs = [...nav.matchAll(/<a href="([^"]+)"/g)].map((match) => match[1] ?? '')
      expect(hrefs.length).toBeGreaterThanOrEqual(2)
      expect(hrefs.length).toBeLessThanOrEqual(5)
      for (const href of hrefs) {
        expect(href.startsWith('/')).toBe(true)
        if (locale !== 'en') expect(href.startsWith(`/${locale.toLowerCase()}`)).toBe(true)
      }
    }
  })

  it('东方站英文正文的 `[BaZi 2027](bazi-2027)` 输出真实 <a>（链接键含数字）', () => {
    runtime.locale = 'en'
    const paragraph = BAZI.sections
      .flatMap((section) => section.paragraphs)
      .find((text) => text.includes('(bazi-2027)'))
    if (!paragraph) throw new Error('八字计算器正文缺少 2027 入链')
    const html = render(<EastEnText text={paragraph} />)
    expect(html).toContain('href="/bazi-2027"')
    expect(html).not.toContain('](bazi-2027)')
  })
})
