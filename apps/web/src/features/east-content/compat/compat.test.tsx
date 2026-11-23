import { readFileSync } from 'node:fs'
import { computeCompatibility } from '@xuanxue/bazi'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { EAST_EN_CONTENT_ROUTES } from '../../east-en/paths.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { alternateLinks } from '../../seo/metadata.ts'
import { SiteContext } from '../../site/context.tsx'
import { type BirthFormValues, toBirthInput } from '../../tools/bazi/birth-form-state.ts'
import { type CompatItemNotes, GunghapPage, GunghapResult } from '../../tools/bazi/gunghap-page.tsx'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { EAST_CONTENT_ROUTES, eastContentRouteOf } from '../routes.ts'
import {
  COMPAT_LOCALES,
  COMPAT_SCENARIO_KEYS,
  COMPAT_SCENARIO_TITLES,
  COMPAT_TOOL_PATHS,
  compatScenarioPath,
  nextCompatScenario,
} from './paths.ts'
import { compatSeoPages } from './seo-pages.ts'

const runtime = vi.hoisted(() => ({ locale: 'zh-Hans' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => runtime.locale }
})
vi.mock('../../readings/unlock-card.tsx', () => ({
  ReadingUnlock: () => null,
  ReadingComingSoon: () => null,
}))

/** 构建期生成的 compat 集合（pnpm typecheck / build 先运行 build-content） */
const allCompats = JSON.parse(
  readFileSync(
    new URL('../../../../.content-collections/generated/allCompats.js', import.meta.url),
    'utf8',
  )
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
) as {
  locale: string
  page: string
  title: string
  description: string
  short: string
}[]

const render = (node: React.ReactNode) =>
  renderToString(<SiteContext value="east">{node}</SiteContext>)

describe('合盘场景页地址（content-growth-v2-tools 13.1，决策 2）', () => {
  it('五种语言各 5 个场景页；工具页正文只登记 zh-Hans、zh-Hant、ja、en，ko /사주궁합 不进集合', () => {
    const routes = [...EAST_CONTENT_ROUTES, ...EAST_EN_CONTENT_ROUTES].filter((route) =>
      route.collection.startsWith('compat'),
    )
    expect(routes.filter((route) => route.collection === 'compat-scenario')).toHaveLength(25)
    expect(
      routes.filter((route) => route.collection === 'compat').map((route) => route.locale),
    ).toEqual(['zh-Hans', 'zh-Hant', 'ja', 'en'])
    expect(eastContentRouteOf('ko', '/사주궁합')).toBeUndefined()
    expect(eastContentRouteOf('zh-Hans', encodeURI('/八字合盘/合婚'))).toMatchObject({
      collection: 'compat-scenario',
      id: 'marriage',
    })
    expect(compatScenarioPath('en', 'business')).toBe('/bazi-compatibility/business-partners')
    expect(compatScenarioPath('ko', 'parent-child')).toBe('/사주궁합/부모-자녀')
  })

  it('注册表登记场景页（nav: false），hreflang 互指五种语言', () => {
    for (const key of COMPAT_SCENARIO_KEYS) {
      const route = TOOL_ROUTES.find((item) => item.id === `saju-gunghap-${key}`)
      expect(route).toMatchObject({ site: 'east', nav: false, directoryGroup: 'relation' })
      expect(Object.keys(route?.paths ?? {}).sort()).toEqual([...COMPAT_LOCALES].sort())
    }
    const links = alternateLinks('', '/八字合盘/亲子', undefined, undefined, 'zh-Hans', 'east')
    expect(links.map((link) => link.hrefLang)).toContain('ko')
  })

  it('场景页进入预渲染（东方站英文在 /en/ 命名空间）', () => {
    const paths = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    expect(paths).toContain('/zh-hans/八字合盘/合婚')
    expect(paths).toContain('/ko/사주궁합/부모-자녀')
    expect(paths).toContain('/en/bazi-compatibility/business-partners')
  })

  it('场景页之间的正文内链是环形：每页链向下一个场景，每个场景恰好一条入链', () => {
    const targets = COMPAT_SCENARIO_KEYS.map(nextCompatScenario)
    expect(new Set(targets).size).toBe(COMPAT_SCENARIO_KEYS.length)
    expect(targets).not.toContain(undefined)
  })
})

describe('compat 内容集合', () => {
  it('各语言页面齐全，场景页导航名与注册表一致', () => {
    for (const locale of COMPAT_LOCALES) {
      const pages = allCompats.filter((entry) => entry.locale === locale)
      expect(pages.map((entry) => entry.page).sort()).toEqual(
        [...(locale === 'ko' ? [] : ['index']), ...COMPAT_SCENARIO_KEYS].sort(),
      )
      for (const key of COMPAT_SCENARIO_KEYS)
        expect(pages.find((entry) => entry.page === key)?.short).toBe(
          COMPAT_SCENARIO_TITLES[locale][key],
        )
    }
  })

  it('SEO 清单：场景页上级为本语言工具页，同组，hreflang 为五种语言的同一场景', () => {
    const pages = compatSeoPages(allCompats)
    const page = pages.find((item) => item.path === '/四柱推命相性/親子')
    expect(page).toMatchObject({
      locale: 'ja',
      parent: COMPAT_TOOL_PATHS.ja,
      group: '/四柱推命相性',
    })
    expect(page?.alternates).toMatchObject({
      ko: '/사주궁합/부모-자녀',
      en: '/bazi-compatibility/parent-child',
    })
    expect(pages.find((item) => item.path === '/bazi-compatibility')).toMatchObject({
      site: 'east',
    })
    expect(pages.some((item) => item.locale === 'ko' && item.path === '/사주궁합')).toBe(false)
  })
})

describe('场景页的逐项解释（13.1）', () => {
  const notes = Object.fromEntries(
    [
      'stemCombine',
      'branchSixCombine',
      'branchTriad',
      'branchClash',
      'branchPunish',
      'elementComplementAB',
      'elementComplementBA',
    ].map((key) => [key, `note-${key}`]),
  ) as unknown as CompatItemNotes

  it('工具页在长文前输出七项解释；场景页只在结果中出现；不传时（ko 工具页）不输出', () => {
    runtime.locale = 'zh-Hans'
    const tool = render(<GunghapPage locale="zh-Hans" items={notes} itemsInBody />)
    for (const key of Object.keys(notes)) expect(tool).toContain(`data-item-note="${key}"`)
    const scenario = render(<GunghapPage locale="zh-Hans" scenario="friends" items={notes} />)
    expect(scenario).not.toContain('data-item-note')
    runtime.locale = 'ko'
    expect(render(<GunghapPage />)).not.toContain('data-item-note')
  })

  it('韩语工具页从同组导航链接到五个场景', () => {
    runtime.locale = 'ko'
    const html = render(<GunghapPage />)
    for (const key of COMPAT_SCENARIO_KEYS)
      expect(html).toContain(`href="/ko${encodeURI(compatScenarioPath('ko', key))}"`)
  })

  it('结果只列出加减分不为 0 的项目及其场景解释', () => {
    runtime.locale = 'zh-Hans'
    // 1990-05-15 与 1991-11-11：日柱庚辰、乙酉（乙庚合、辰酉六合）
    const birth = (year: string, month: string, day: string, time: string): BirthFormValues => ({
      calendar: 'solar',
      leap: false,
      gender: 'female',
      year,
      month,
      day,
      time,
      unknownTime: false,
      place: 'seoul',
      utcOffset: '540',
      longitude: '',
      trueSolar: false,
    })
    const a = toBirthInput(birth('1990', '5', '15', '10:30'))
    const b = toBirthInput(birth('1991', '11', '11', '14:00'))
    if (!a.ok || !b.ok) throw new Error('sample input invalid')
    const result = computeCompatibility(a.input, b.input, { referenceYear: 2026 })
    expect(result.items.some((item) => item.key === 'stemCombine')).toBe(true)
    const html = render(<GunghapResult result={result} share={{}} locale="zh-Hans" notes={notes} />)
    for (const item of result.items)
      expect(html.includes(`data-reading="${item.key}"`)).toBe(item.delta !== 0)
    expect(html).toContain('note-stemCombine')
  })
})
