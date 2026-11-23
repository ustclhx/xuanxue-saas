import { readFileSync } from 'node:fs'
import { SITE_IDS } from '@xuanxue/config'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { yearlySeoPages } from '../east-content/yearly/seo-pages.ts'
import { zodiacSeoPages } from '../east-content/zodiac/seo-pages.ts'
import { tarotFeelingsSeoPages } from '../east-en/seo-pages.ts'
import { isLocaleReleased, releasedSiteLocales } from '../i18n/rollout.ts'
import { eastEnglishAlternates } from '../marketing/east-english/head.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { tarotLocalizedSeoPages, tarotMeaningSeoPages } from '../tools/tarot/meaning-routes.ts'
import { sitemap } from './crawlers.ts'
import { absoluteUrl, localizedPath, pageHead, pageSite } from './metadata.ts'
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

// 只检查已发布的「站点 × 语言」（rollout.ts）：未发布的页面不在站点地图中，也不出现在已发布页面的 hreflang 中。
// 工具页清单与 pages.server.ts 的 getPublicPages 相同（含东方站根路径英文的 as feelings 牌页）
const allPages = publicPages(
  {
    posts: generated('allPosts'),
    legal: generated('allLegalPages'),
    docs: generated('allDocs'),
    guides: generated('allGuides'),
    toolPages: [
      ...numerologySeoPages(generated('allNumerologies')),
      ...tarotMeaningSeoPages(generated('allTarots')),
      ...tarotLocalizedSeoPages(),
      ...tarotFeelingsSeoPages(generated('allTarotFeelings')),
      ...zodiacSeoPages(generated('allZodiacs')),
      ...yearlySeoPages(generated('allYearlies')),
    ],
  },
  new Date(),
)
const pages = allPages.filter((page) =>
  isLocaleReleased(page.locale, templateConfig, pageSite(page)),
)

type Alternates = Record<string, string>

/** 同一 <loc> 或页面 head 中重复出现的 hreflang（每种语言与 x-default 都只能出现一次） */
const duplicates: string[] = []

/** 站点地图中每个 <loc> 的 hreflang → href */
function sitemapEntries(): Map<string, Alternates> {
  const entries = new Map<string, Alternates>()
  for (const site of SITE_IDS)
    for (const locale of releasedSiteLocales(site, templateConfig)) {
      const xml = sitemap(pages, '', locale, site)
      for (const [, loc = '', body = ''] of xml.matchAll(/<url><loc>(.*?)<\/loc>(.*?)<\/url>/g)) {
        const links: Alternates = {}
        for (const [, lang = '', href = ''] of body.matchAll(
          /hreflang="([^"]+)" href="([^"]+)"/g,
        )) {
          if (lang in links) duplicates.push(`${loc} ${lang}`)
          links[lang] = href.replaceAll('&amp;', '&')
        }
        entries.set(loc.replaceAll('&amp;', '&'), links)
      }
    }
  return entries
}

function headAlternates(page: (typeof pages)[number]) {
  const head = pageHead(page, '')
  const canonical = head.links.find((link) => link.rel === 'canonical')?.href ?? ''
  const langs = head.links.flatMap((link) => ('hrefLang' in link ? [link.hrefLang] : []))
  for (const lang of langs.filter((item, index) => langs.indexOf(item) !== index))
    duplicates.push(`${canonical} ${lang}`)
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
      if (!isLocaleReleased(page.locale, templateConfig)) continue
      const { canonical, alternates } = headAlternates(page)
      const entry = entries.get(canonical)
      expect(entry, canonical).toBeDefined()
      // 东方站首页额外与 /en 入口页互指；/en 有自己的 en 子图
      expect(alternates, canonical).toEqual(entry)
      expect(alternates[page.locale], canonical).toBe(canonical)
    }
    expect(duplicates).toEqual([])
  })

  // 使用者 2026-11-20：两站默认语言都是英语，东方站 `/` 是英文首页（不跳转）；
  // 东方站有英文版本的页面（2026-11-21 发布根路径英文后）x-default 指向英文版本，其余仍指向繁中同页；
  // 西方站 x-default 为英文版本
  it('x-default 指向同一页面的站点默认语言版本：英文版本优先，其余为繁中同页', () => {
    for (const [loc, alternates] of entries) {
      expect(alternates['x-default'], loc).toBeDefined()
      if (alternates.en === EAST_ROOT) expect(alternates['x-default'], loc).toBe(EAST_ROOT)
      else expect(alternates['x-default'], loc).not.toBe(EAST_ROOT)
      // x-default 必须是该组语言版本之一（同一页面），不是站点入口
      expect(
        Object.entries(alternates).some(
          ([lang, href]) => lang !== 'x-default' && href === alternates['x-default'],
        ),
        loc,
      ).toBe(true)
      if (loc.startsWith('https://ganjiday.com/') && alternates['zh-Hant'] && !alternates.en)
        expect(alternates['x-default'], loc).toBe(alternates['zh-Hant'])
      if (loc.startsWith('https://ganjiday.com/') && alternates.en)
        expect(alternates['x-default'], loc).toBe(alternates.en)
      if (loc.startsWith('https://arcanumber.com/'))
        expect(alternates['x-default'], loc).toBe(alternates.en ?? loc)
      // 不跨站：同一组语言版本与 x-default 都在本页所在的站点
      const host = new URL(loc).host
      for (const href of Object.values(alternates)) expect(new URL(href).host, loc).toBe(host)
    }
  })

  it('每个 hreflang 目标都在站点地图中（可索引的规范地址）并互指同一组语言', () => {
    for (const [loc, alternates] of entries) {
      for (const [lang, href] of Object.entries(alternates)) {
        if (lang === 'x-default') continue
        // 东方站首页的 en 指向英文首页 `/`，它在东方站 en 子图中另行生成
        if (href === EAST_ROOT) continue
        const target = entries.get(href)
        expect(target, `${loc} → ${lang} ${href}`).toBeDefined()
        expect(target?.[lang], href).toBe(href)
        // 互指：目标页声明回到本页
        const own = Object.entries(alternates).find(([, value]) => value === loc)?.[0]
        if (own) expect(target?.[own], `${href} ↛ ${loc}`).toBe(loc)
      }
    }
  })

  it('东方站内页与首页示例：/ko/pricing 的 x-default 为英文定价页，/ko 的 x-default 为英文首页 /', () => {
    // 定价页有东方站英文版本（/pricing，2026-11-21 发布）：x-default 指向英文版本
    expect(entries.get('https://ganjiday.com/ko/pricing')).toEqual({
      'zh-Hant': 'https://ganjiday.com/zh-hant/pricing',
      'zh-Hans': 'https://ganjiday.com/zh-hans/pricing',
      ko: 'https://ganjiday.com/ko/pricing',
      ja: 'https://ganjiday.com/ja/pricing',
      en: 'https://ganjiday.com/pricing',
      'x-default': 'https://ganjiday.com/pricing',
    })
    // 没有英文版本的东方站页面：x-default 为繁中同页
    expect(entries.get('https://ganjiday.com/ko/newsletter')?.['x-default']).toBe(
      'https://ganjiday.com/zh-hant/newsletter',
    )
    // 西方站西语页：x-default 为英文版本
    expect(entries.get('https://arcanumber.com/es/pricing')).toEqual({
      en: 'https://arcanumber.com/pricing',
      es: 'https://arcanumber.com/es/pricing',
      'x-default': 'https://arcanumber.com/pricing',
    })
    expect(entries.get('https://ganjiday.com/ko')?.['x-default']).toBe(EAST_ROOT)
    expect(entries.get('https://ganjiday.com/ko')?.en).toBe(EAST_ROOT)
    expect(eastEnglishAlternates().find((link) => link.hrefLang === 'x-default')?.href).toBe(
      EAST_ROOT,
    )
    // 规范地址都不带结尾斜杠（根路径除外），与站点跳转的规范形式一致
    for (const loc of entries.keys())
      if (new URL(loc).pathname !== '/') expect(loc.endsWith('/'), loc).toBe(false)
  })

  it('规范地址按语言所属站点生成', () => {
    for (const page of pages)
      expect(headAlternates(page).canonical).toBe(
        absoluteUrl(localeOrigin(page.locale, page.site), localizedPath(page.path, page.locale)),
      )
  })
})
