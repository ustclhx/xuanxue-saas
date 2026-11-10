import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { eastEnglishAlternates } from '../marketing/east-english/head.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { tarotMeaningSeoPages } from '../tools/tarot/meaning-routes.ts'
import { sitemap } from './crawlers.ts'
import { absoluteUrl, localizedPath, pageHead } from './metadata.ts'
import { localeOrigin } from './origins.ts'
import { publicPages } from './pages.ts'

// openspec fix-seo-canonical-indexing（specs/seo「多语言关联」）：用构建实际生成的内容集合
// （typecheck / build 前生成）检查全部公开页的 hreflang：页面 head 与站点地图一致、包含自身、
// 互指，目标都在站点地图中（可索引的规范地址），x-default 不再指向会跳转的东方站根路径。
function generated<T>(name: string): T[] {
  return JSON.parse(
    readFileSync(
      new URL(`../../../.content-collections/generated/${name}.js`, import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as T[]
}

const pages = publicPages(
  {
    posts: generated('allPosts'),
    legal: generated('allLegalPages'),
    docs: generated('allDocs'),
    guides: generated('allGuides'),
    toolPages: [
      ...numerologySeoPages(generated('allNumerologies')),
      ...tarotMeaningSeoPages(generated('allTarots')),
    ],
  },
  new Date(),
)

type Alternates = Record<string, string>

/** 站点地图中每个 <loc> 的 hreflang → href */
function sitemapEntries(): Map<string, Alternates> {
  const entries = new Map<string, Alternates>()
  const siteLocales = templateConfig.i18n.locales
  for (const locale of siteLocales) {
    const xml = sitemap(pages, '', locale)
    for (const [, loc = '', body = ''] of xml.matchAll(/<url><loc>(.*?)<\/loc>(.*?)<\/url>/g)) {
      const links: Alternates = {}
      for (const [, lang = '', href = ''] of body.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g))
        links[lang] = href.replaceAll('&amp;', '&')
      entries.set(loc.replaceAll('&amp;', '&'), links)
    }
  }
  return entries
}

function headAlternates(page: (typeof pages)[number]) {
  const head = pageHead(page, '')
  const canonical = head.links.find((link) => link.rel === 'canonical')?.href ?? ''
  const alternates: Alternates = Object.fromEntries(
    head.links.flatMap((link) => ('hrefLang' in link ? [[link.hrefLang, link.href]] : [])),
  )
  return { canonical, alternates }
}

const EAST_ROOT = 'https://ganjiday.com/'

describe('全部公开页的 hreflang 与站点地图（fix-seo-canonical-indexing 2.1）', () => {
  const entries = sitemapEntries()

  it('站点地图条目与页面 head 的语言关联逐一相同，且包含页面自身', () => {
    expect(entries.size).toBeGreaterThan(100)
    for (const page of pages) {
      const { canonical, alternates } = headAlternates(page)
      const entry = entries.get(canonical)
      expect(entry, canonical).toBeDefined()
      // 东方站首页额外与 /en 入口页互指；/en 有自己的 en 子图
      expect(alternates, canonical).toEqual(entry)
      expect(alternates[page.locale], canonical).toBe(canonical)
    }
  })

  it('x-default 指向同一页面的站点默认语言版本，不指向东方站根路径', () => {
    for (const [loc, alternates] of entries) {
      expect(alternates['x-default'], loc).toBeDefined()
      expect(alternates['x-default'], loc).not.toBe(EAST_ROOT)
      // x-default 必须是该组语言版本之一（同一页面），不是站点入口
      expect(
        Object.entries(alternates).some(
          ([lang, href]) => lang !== 'x-default' && href === alternates['x-default'],
        ),
        loc,
      ).toBe(true)
      if (loc.startsWith('https://ganjiday.com/') && alternates['zh-Hant'])
        expect(alternates['x-default'], loc).toBe(alternates['zh-Hant'])
      if (loc.startsWith('https://arcanumber.com/')) expect(alternates['x-default'], loc).toBe(loc)
    }
  })

  it('每个 hreflang 目标都在站点地图中（可索引的规范地址）并互指同一组语言', () => {
    for (const [loc, alternates] of entries) {
      for (const [lang, href] of Object.entries(alternates)) {
        if (lang === 'x-default') continue
        // 东方站首页的 en 指向 /en 入口页，它在 en 子图中另行生成
        if (href === 'https://ganjiday.com/en') continue
        const target = entries.get(href)
        expect(target, `${loc} → ${lang} ${href}`).toBeDefined()
        expect(target?.[lang], href).toBe(href)
        // 互指：目标页声明回到本页
        const own = Object.entries(alternates).find(([, value]) => value === loc)?.[0]
        if (own) expect(target?.[own], `${href} ↛ ${loc}`).toBe(loc)
      }
    }
  })

  it('东方站内页与首页示例：/ko/pricing 与 /ko 的 x-default 为繁中同页', () => {
    expect(entries.get('https://ganjiday.com/ko/pricing')).toEqual({
      'zh-Hant': 'https://ganjiday.com/zh-hant/pricing',
      'zh-Hans': 'https://ganjiday.com/zh-hans/pricing',
      ko: 'https://ganjiday.com/ko/pricing',
      'x-default': 'https://ganjiday.com/zh-hant/pricing',
    })
    expect(entries.get('https://ganjiday.com/ko')?.['x-default']).toBe(
      'https://ganjiday.com/zh-hant',
    )
    expect(eastEnglishAlternates().find((link) => link.hrefLang === 'x-default')?.href).toBe(
      'https://ganjiday.com/zh-hant',
    )
    // 规范地址都不带结尾斜杠（根路径除外），与站点跳转的规范形式一致
    for (const loc of entries.keys())
      if (new URL(loc).pathname !== '/') expect(loc.endsWith('/'), loc).toBe(false)
  })

  it('规范地址按语言所属站点生成', () => {
    for (const page of pages)
      expect(headAlternates(page).canonical).toBe(
        absoluteUrl(localeOrigin(page.locale), localizedPath(page.path, page.locale)),
      )
  })
})
