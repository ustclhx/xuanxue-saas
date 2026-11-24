import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// 检查脚本用独立规则复算约简与模式（scripts/check-content-angel-numbers.mjs）
import {
  factIssues,
  recomputeFacts,
} from '../../../../../../scripts/check-content-angel-numbers.mjs'
import { alternateLinks } from '../../seo/metadata.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { WEST_CONTENT_ROUTES, westContentRouteOf } from '../routes.ts'
import { digitsSummary, numberRelated, sumText } from './copy.ts'
import { nearbyNumbers, publishedNumbers } from './listing.ts'
import { angelFacts, angelGroup } from './numbers.ts'
import { ANGEL_HUB_PATHS, ANGEL_NUMBERS, angelNumberPath } from './paths.ts'
import { type AngelSeoEntry, angelSeoPages } from './seo-pages.ts'

function generated() {
  return JSON.parse(
    readFileSync(
      new URL('../../../../.content-collections/generated/allAngelNumbers.js', import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as (AngelSeoEntry & { theme?: string })[]
}

const entry = (locale: string, key: string): AngelSeoEntry & { theme: string } => ({
  locale,
  key,
  title: `${locale} ${key}`,
  description: `${locale} ${key}`,
  theme: `theme ${key}`,
})

describe('数字事实', () => {
  it('与独立写出的约简与模式规则一致', () => {
    expect(recomputeFacts()).toEqual([])
  })

  it('按生命灵数规则约简：逐位相加，11、22、33 保留', () => {
    expect(angelFacts('1111')).toMatchObject({ sum: 4, root: 4, pattern: 'repeat' })
    expect(angelFacts('444')).toMatchObject({ sum: 12, root: 3, steps: [{ result: 3 }] })
    expect(angelFacts('911')).toMatchObject({ sum: 11, root: 11, master: true, steps: [] })
    expect(angelFacts('000')).toMatchObject({ sum: 0, root: 0, pattern: 'repeat' })
    expect(angelFacts('4444')).toMatchObject({ sum: 16, root: 7 })
    expect(angelFacts('1221').pattern).toBe('mirror')
    expect(angelFacts('1212').pattern).toBe('alternate')
    expect(angelFacts('1144').pattern).toBe('pairs')
    expect(angelFacts('1234').pattern).toBe('ascending')
    expect(angelFacts('711').pattern).toBe('lead')
    expect(sumText(angelFacts('999'))).toBe('9 + 9 + 9 = 27 → 2 + 7 = 9')
    expect(digitsSummary('en', angelFacts('1111'))).toBe('1, four times')
    expect(digitsSummary('es', angelFacts('1212'))).toBe('1 y 2, alternados')
  })

  it('正文复算：写错的算式与根数被找出', () => {
    expect(factIssues('1111 reduces to 4. 1 + 1 + 1 + 1 = 4.', '1111').issues).toEqual([])
    expect(factIssues('It reduces to 2.', '1111').issues).toHaveLength(1)
    expect(factIssues('4 + 4 + 4 = 13.', '444').issues).toHaveLength(1)
    expect(factIssues('El 911 se reduce a 2.', '1111').issues).toHaveLength(1)
    expect(factIssues('Look at the clock at 25:10.', '1111').issues).toHaveLength(1)
  })

  it('相关卡片只链接存在的生命灵数页（0 没有页面）', () => {
    const paths = numberRelated('en', angelFacts('1010'), '1010').map((card) => card.path)
    expect(paths.slice(0, 2)).toEqual(['/life-path-number/1', '/life-path-number/2'])
    expect(paths).toHaveLength(4)
    expect(numberRelated('en', angelFacts('000'), '000').map((card) => card.path)).not.toContain(
      '/life-path-number/0',
    )
    expect(numberRelated('es', angelFacts('911'), '911')[2]?.path).toBe('/numero-de-vida/11')
  })
})

describe('地址与注册表', () => {
  const routes = WEST_CONTENT_ROUTES.filter((route) => route.collection === 'angel-numbers')

  it('en、es 各有枢纽与本语言的数字页，地址互不相同', () => {
    expect(routes).toHaveLength(2 + ANGEL_NUMBERS.en.length + ANGEL_NUMBERS.es.length)
    expect(new Set(routes.map((route) => `${route.locale}${route.path}`)).size).toBe(routes.length)
    expect(westContentRouteOf('en', '/angel-numbers')?.id).toBe('index')
    expect(westContentRouteOf('es', '/numeros-angelicales')?.id).toBe('index')
    expect(westContentRouteOf('en', '/angel-numbers/1111')?.id).toBe('1111')
    expect(westContentRouteOf('es', '/numeros-angelicales/1717')?.id).toBe('1717')
    // 只在另一种语言发布的数字没有地址
    expect(westContentRouteOf('en', '/angel-numbers/1717')).toBeUndefined()
    expect(westContentRouteOf('es', '/numeros-angelicales/911')).toBeUndefined()
  })

  it('注册表：枢纽进 numerology 分组，数字页 nav: false，paths 只含已发布的语言', () => {
    const angel = TOOL_ROUTES.filter((route) => route.id.startsWith('angel-number'))
    const hub = angel.find((route) => route.id === 'angel-numbers')
    expect(hub).toMatchObject({
      paths: { en: '/angel-numbers', es: '/numeros-angelicales' },
      directoryGroup: 'numerology',
    })
    expect(hub?.nav).not.toBe(false)
    const byId = new Map(angel.map((route) => [route.id, route]))
    expect(byId.get('angel-number-111')?.paths).toEqual({
      en: '/angel-numbers/111',
      es: '/numeros-angelicales/111',
    })
    expect(byId.get('angel-number-911')?.paths).toEqual({ en: '/angel-numbers/911' })
    expect(byId.get('angel-number-1717')?.paths).toEqual({ es: '/numeros-angelicales/1717' })
    for (const route of angel.filter((r) => r !== hub)) expect(route.nav).toBe(false)
  })

  it('枢纽分组：三位重复、四位、其他序列', () => {
    expect(angelGroup('777')).toBe('triple')
    expect(angelGroup('1234')).toBe('four')
    expect(angelGroup('123')).toBe('more')
    expect(angelGroup('911')).toBe('more')
  })
})

describe('只列已发布数字（specs/angel-number-pages）', () => {
  it('枢纽只列本语言有内容文件的数字，按登记顺序', () => {
    const entries = [
      entry('es', '222'),
      entry('es', 'index'),
      entry('es', '111'),
      entry('en', '911'),
    ]
    expect(publishedNumbers(entries, 'es').map((item) => item.number)).toEqual(['111', '222'])
    expect(publishedNumbers(entries, 'en').map((item) => item.number)).toEqual(['911'])
  })

  it('相邻数字含当前数字、两端向另一侧补足', () => {
    const items = ['000', '111', '222', '333', '444', '555', '666', '777'].map((number) => ({
      number,
      theme: '',
    }))
    expect(nearbyNumbers(items, '000').map((item) => item.number)).toEqual([
      '000',
      '111',
      '222',
      '333',
      '444',
      '555',
    ])
    expect(nearbyNumbers(items, '777').map((item) => item.number)).toEqual([
      '222',
      '333',
      '444',
      '555',
      '666',
      '777',
    ])
    expect(nearbyNumbers(items, '999')).toEqual([])
  })

  it('es 未发布某数字时，该数字 en 页的 hreflang 不含 es', () => {
    const pages = angelSeoPages([
      entry('en', 'index'),
      entry('es', 'index'),
      entry('en', '111'),
      entry('es', '111'),
      entry('en', '911'),
    ])
    const byKey = new Map(pages.map((page) => [`${page.locale}${page.path}`, page]))
    expect(byKey.get('en/angel-numbers/911')?.alternates).toEqual({ en: '/angel-numbers/911' })
    expect(byKey.get('en/angel-numbers/111')?.alternates).toEqual({
      en: '/angel-numbers/111',
      es: '/numeros-angelicales/111',
    })
    expect(byKey.get('es/numeros-angelicales')?.alternates).toEqual({
      en: '/angel-numbers',
      es: '/numeros-angelicales',
    })
    const links = (path: string) =>
      alternateLinks('', path, ['en', 'es'], byKey.get(`en${path}`)?.alternates, 'en', 'west')
        .map((link) => link.hrefLang)
        .filter((lang) => lang !== 'x-default')
    expect(links('/angel-numbers/911')).toEqual(['en'])
    expect(links('/angel-numbers/111').sort()).toEqual(['en', 'es'])
  })
})

describe('内容集合与公开页面清单', () => {
  const entries = generated()

  it('内容文件与登记的数字一一对应（文件存在即已发布）', () => {
    for (const locale of ['en', 'es'] as const) {
      const keys = entries
        .filter((item) => item.locale === locale && item.key !== 'index')
        .map((item) => item.key)
      expect(keys.sort()).toEqual([...ANGEL_NUMBERS[locale]].sort())
      expect(entries.some((item) => item.locale === locale && item.key === 'index')).toBe(true)
    }
  })

  it('每页进入清单：数字页上级与同组为本语言枢纽，hreflang 只连两种语言都有的数字', () => {
    const pages = angelSeoPages(entries)
    expect(pages).toHaveLength(entries.length)
    for (const page of pages) {
      expect(page.site).toBe('west')
      if (page.path === ANGEL_HUB_PATHS[page.locale as 'en' | 'es']) continue
      expect(page).toMatchObject({
        parent: ANGEL_HUB_PATHS[page.locale as 'en' | 'es'],
        group: ANGEL_HUB_PATHS[page.locale as 'en' | 'es'],
      })
      const number = page.path.split('/').at(-1) ?? ''
      const both =
        ANGEL_NUMBERS.en.includes(number as never) && ANGEL_NUMBERS.es.includes(number as never)
      expect(Object.keys(page.alternates ?? {}).sort()).toEqual(both ? ['en', 'es'] : [page.locale])
    }
    expect(
      pages.find((page) => page.locale === 'es' && page.path.endsWith('/1111'))?.alternates,
    ).toEqual({
      en: angelNumberPath('en', '1111'),
      es: angelNumberPath('es', '1111'),
    })
  })
})
