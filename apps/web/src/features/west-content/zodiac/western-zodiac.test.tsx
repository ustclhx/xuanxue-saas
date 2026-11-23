import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
// 检查脚本用独立规则复算事实表（scripts/check-content-western-zodiac.mjs）
import { recomputeFacts } from '../../../../../../scripts/check-content-western-zodiac.mjs'
import { reversedPairPath } from '../../routing/pair-path.ts'
import { TOOL_ROUTES } from '../../tools/registry.ts'
import { WEST_CONTENT_ROUTES, westContentRouteOf } from '../routes.ts'
import { traditionNote } from './copy.ts'
import { PAIRS, pairFacts, SIGN_KEYS, signOf } from './facts.ts'
import { PairGrid } from './pages.tsx'
import { pairPath, signPath, ZODIAC_COMPAT_PATH, ZODIAC_SIGNS_PATH } from './paths.ts'
import { westernZodiacSeoPages } from './seo-pages.ts'

function generated() {
  return JSON.parse(
    readFileSync(
      new URL('../../../../.content-collections/generated/allWesternZodiacs.js', import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as { locale: string; key: string; kind: string; title: string; description: string }[]
}

describe('事实表', () => {
  it('与独立写出的三方四正、守护星与角距规则一致', () => {
    expect(recomputeFacts()).toEqual([])
  })

  it('78 组配对按黄道序，角距取较短一侧', () => {
    expect(PAIRS).toHaveLength(78)
    expect(pairFacts('aries', 'leo')).toMatchObject({ aspect: 'trine', angle: 120, distance: 4 })
    expect(pairFacts('aries', 'pisces')).toMatchObject({ aspect: 'semisextile', angle: 30 })
    expect(pairFacts('leo', 'aquarius')).toMatchObject({ aspect: 'opposition', angle: 180 })
    expect(pairFacts('capricorn', 'gemini')).toMatchObject({
      first: 'gemini',
      second: 'capricorn',
      aspect: 'quincunx',
      elementRelation: 'other',
    })
    expect(signOf('scorpio')).toMatchObject({ ruler: 'mars', modernRuler: 'pluto' })
  })

  it('配对表的传统说明按关系取句，不含判定', () => {
    expect(traditionNote.modality('cardinal', 'fixed')).toBe(
      'Cardinal signs start things, fixed signs sustain them.',
    )
    expect(traditionNote.ruler('venus', 'venus')).toContain('Both are ruled by Venus')
  })
})

describe('地址与注册表', () => {
  const routes = WEST_CONTENT_ROUTES.filter((route) => route.collection === 'zodiac')

  it('枢纽、12 档案、总表与 78 配对各有一个 en 规范地址', () => {
    expect(routes).toHaveLength(92)
    expect(new Set(routes.map((route) => route.path)).size).toBe(92)
    expect(westContentRouteOf('en', ZODIAC_SIGNS_PATH)?.id).toBe('index')
    expect(westContentRouteOf('en', ZODIAC_COMPAT_PATH)?.id).toBe('chart')
    expect(westContentRouteOf('en', '/zodiac-signs/aries')?.id).toBe('aries')
    expect(westContentRouteOf('es', '/zodiac-signs/aries')).toBeUndefined()
  })

  it('66 组反序地址都 301 到已登记的规范地址，同星座与规范地址不跳转', () => {
    let reversed = 0
    for (const [a, b] of PAIRS) {
      const canonical = pairPath(a, b)
      expect(westContentRouteOf('en', canonical)?.collection).toBe('zodiac')
      expect(reversedPairPath('west', 'en', canonical)).toBeUndefined()
      if (a === b) continue
      const reverse = `${ZODIAC_COMPAT_PATH}/${b}-and-${a}`
      expect(reversedPairPath('west', 'en', reverse)).toBe(canonical)
      expect(westContentRouteOf('en', reverse)).toBeUndefined()
      reversed += 1
    }
    expect(reversed).toBe(66)
    // 东方站不承接西方配对地址
    expect(reversedPairPath('east', 'en', '/zodiac-compatibility/leo-and-aries')).toBeUndefined()
  })

  it('注册表登记 92 页：枢纽与总表进导航，其余 nav: false，分组为 astrology / compatibility', () => {
    const west = TOOL_ROUTES.filter(
      (route) => route.id.startsWith('western-zodiac-') && route.site === 'west',
    )
    expect(west).toHaveLength(92)
    expect(west.filter((route) => route.nav !== false).map((route) => route.id)).toEqual([
      'western-zodiac-signs',
      'western-zodiac-compatibility',
    ])
    for (const route of west) {
      const path = route.paths.en ?? ''
      expect(route.directoryGroup).toBe(
        path.startsWith(ZODIAC_SIGNS_PATH) ? 'astrology' : 'compatibility',
      )
    }
  })
})

describe('总表', () => {
  it('桌面网格链接到全部 78 个规范配对页', () => {
    const html = renderToStaticMarkup(<PairGrid />)
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    expect(hrefs).toHaveLength(144)
    const unique = new Set(hrefs)
    expect(unique.size).toBe(78)
    expect([...unique].sort()).toEqual(PAIRS.map(([a, b]) => pairPath(a, b)).sort())
    expect(html).toContain('aria-label="Aries and Leo: trine"')
    expect(html).toContain('aria-label="Aries and Pisces: semi-sextile, no major aspect"')
  })
})

describe('内容集合与公开页面清单', () => {
  const entries = generated()
  it('92 篇内容齐全，每页进入清单且层级正确', () => {
    expect(entries).toHaveLength(92)
    const pages = westernZodiacSeoPages(entries)
    expect(pages).toHaveLength(92)
    const byPath = new Map(pages.map((page) => [page.path, page]))
    for (const key of SIGN_KEYS)
      expect(byPath.get(signPath(key))).toMatchObject({
        parent: ZODIAC_SIGNS_PATH,
        group: ZODIAC_SIGNS_PATH,
        site: 'west',
      })
    for (const [a, b] of PAIRS)
      expect(byPath.get(pairPath(a, b))).toMatchObject({ parent: ZODIAC_COMPAT_PATH })
    expect(byPath.get(ZODIAC_COMPAT_PATH)).toMatchObject({ parent: '/' })
    expect(new Set(pages.map((page) => page.title)).size).toBe(92)
  })
})
