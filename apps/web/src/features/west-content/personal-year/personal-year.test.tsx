import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { WEST_CONTENT_ROUTES, westContentRouteOf } from '../routes.ts'
import { exampleFor, personalYearOf } from './calc.ts'
import { type PersonalYearEntry, personalYearPage } from './page.functions.ts'
import { FactPanel, NumberGrid } from './pages.tsx'
import { PERSONAL_YEAR_NUMBERS, PERSONAL_YEAR_TOOL_ROUTES } from './paths.ts'

function generated(): PersonalYearEntry[] {
  return JSON.parse(
    readFileSync(
      new URL('../../../../.content-collections/generated/allPersonalYears.js', import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  )
}

vi.mock('content-collections', () => import('../../../../.content-collections/generated/index.js'))

const links = () => ({ breadcrumb: [], titleOf: (path: string) => path })

describe('地址与注册表', () => {
  const routes = WEST_CONTENT_ROUTES.filter((route) => route.collection === 'personal-year')

  it('en、es 各有计算器页与 1–9 年份数页', () => {
    expect(routes).toHaveLength(20)
    expect(westContentRouteOf('en', '/personal-year-number')?.id).toBe('index')
    expect(westContentRouteOf('en', '/personal-year-number/5')?.id).toBe('5')
    expect(westContentRouteOf('es', '/ano-personal/9')?.id).toBe('9')
    // 只有 1–9：主数与 0 不登记，语言不串
    expect(westContentRouteOf('en', '/personal-year-number/11')).toBeUndefined()
    expect(westContentRouteOf('en', '/personal-year-number/0')).toBeUndefined()
    expect(westContentRouteOf('es', '/personal-year-number/5')).toBeUndefined()
  })

  it('20 页都构建期预渲染（不查数据库），es 带 /es 前缀', () => {
    const paths = prerenderEntryPages(templateConfig, PERSONAL_YEAR_TOOL_ROUTES).map(
      (page) => page.path,
    )
    for (const value of PERSONAL_YEAR_NUMBERS) {
      expect(paths).toContain(`/personal-year-number/${value}`)
      expect(paths).toContain(`/es/ano-personal/${value}`)
    }
    expect(paths).toContain('/personal-year-number')
    expect(paths).toContain('/es/ano-personal')
  })

  it('注册表：计算器进全部工具 numerology 组，年份数页 nav: false，两种语言互为对应页', () => {
    const entries = TOOL_ROUTES.filter((route) => route.id.startsWith('personal-year'))
    expect(entries).toHaveLength(10)
    expect(entries.filter((route) => route.nav !== false).map((route) => route.id)).toEqual([
      'personal-year',
    ])
    for (const route of entries) {
      expect(route.site).toBe('west')
      expect(route.directoryGroup).toBe('numerology')
      expect(Object.keys(route.paths).sort()).toEqual(['en', 'es'])
    }
  })
})

describe('页面数据', () => {
  const entries = generated()

  it('内容集合齐全：两种语言各 10 篇，年份数页各有 3 个问题', () => {
    expect(entries).toHaveLength(20)
    for (const entry of entries)
      expect(entry.questions?.length ?? 0).toBe(entry.key === 'index' ? 0 : 3)
  })

  it('hreflang 只列有内容条目的语言', () => {
    const both = personalYearPage('en', '5', entries, links)
    expect(both?.seo.alternates).toEqual({
      en: '/personal-year-number/5',
      es: '/ano-personal/5',
    })
    const enOnly = personalYearPage(
      'en',
      '5',
      entries.filter((entry) => entry.locale === 'en'),
      links,
    )
    expect(enOnly?.seo.alternates).toEqual({ en: '/personal-year-number/5' })
    expect(personalYearPage('es', '5', [], links)).toBeNull()
  })

  it('年份数页的相关区块先列计算器与同数字的 Life Path 页', () => {
    const page = personalYearPage('es', '7', entries, links)
    expect(page?.payload.related.slice(0, 2).map((item) => item.href)).toEqual([
      '/ano-personal',
      '/numero-de-vida/7',
    ])
    expect(page?.payload).toMatchObject({ kind: 'number', number: 7, path: '/ano-personal/7' })
  })
})

describe('组件', () => {
  it('数字面板的示例由引擎当场计算，结果等于本页数字', () => {
    for (const value of PERSONAL_YEAR_NUMBERS) {
      const html = renderToStaticMarkup(<FactPanel locale="en" value={value} />)
      const year = new Date().getUTCFullYear()
      const example = exampleFor(value, year)
      expect(personalYearOf(example)?.value).toBe(value)
      expect(html).toContain(`Personal Year ${value}`)
    }
  })

  it('1–9 网格链接到 9 个年份数页，当前数字带 aria-current', () => {
    const html = renderToStaticMarkup(
      <NumberGrid locale="es" title="Años" current={4} sub={(value) => String(value)} />,
    )
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    expect(hrefs).toEqual(PERSONAL_YEAR_NUMBERS.map((value) => `/es/ano-personal/${value}`))
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toContain('data-link-zone="siblings"')
  })
})
