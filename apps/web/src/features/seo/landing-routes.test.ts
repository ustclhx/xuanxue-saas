import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { switchLocalePath } from '../i18n/switch-path.ts'
import { optinToolPath } from '../readings/optin-email.ts'
import { mainToolPath, toolsForSite } from '../tools/registry.ts'
import { sitemap } from './crawlers.ts'
import { alternateLinks, pageHead, staticPage } from './metadata.ts'
import { publicPages } from './pages.ts'
import { breadcrumbData, organizationData, websiteData } from './structured-data.ts'

// openspec separate-landing-homepage tasks 2.3、2.5：工具迁到关键词 URL 后，注册表驱动的站点地图、hreflang、
// 语言切换、页头导航与邮件链接随之迁移，语言首页仍在站点地图中。

const EAST = 'https://ganjiday.com'
const BAZI = {
  'zh-Hant': `${EAST}${encodeURI('/zh-hant/八字排盤')}`,
  'zh-Hans': `${EAST}${encodeURI('/zh-hans/八字排盘')}`,
  ko: `${EAST}${encodeURI('/ko/만세력')}`,
  ja: `${EAST}${encodeURI('/ja/四柱推命')}`,
  en: `${EAST}/bazi-calculator`,
}
const locales = templateConfig.i18n.locales
const pages = (site: 'east' | 'west') =>
  publicPages({ posts: [], legal: [], docs: [] }, new Date('2026-11-17'), templateConfig, site)

describe('主工具页的注册表驱动功能', () => {
  it('各语言的主工具页路径', () => {
    expect(mainToolPath('zh-Hant')).toBe('/八字排盤')
    expect(mainToolPath('zh-Hans')).toBe('/八字排盘')
    expect(mainToolPath('ko')).toBe('/만세력')
    expect(mainToolPath('en')).toBe('/life-path-number')
    expect(mainToolPath('fr')).toBeUndefined()
  })

  it('站点地图列出新工具页与语言首页，hreflang 与页面声明一致', () => {
    const east = pages('east')
    const ko = sitemap(east, EAST, 'ko')
    expect(ko).toContain('<loc>https://ganjiday.com/ko/%EB%A7%8C%EC%84%B8%EB%A0%A5</loc>')
    expect(ko).toContain('<loc>https://ganjiday.com/ko</loc>')
    const hant = sitemap(east, EAST, 'zh-Hant')
    expect(hant).toContain(`<loc>${BAZI['zh-Hant']}</loc>`)
    expect(hant).toContain('<loc>https://ganjiday.com/zh-hant</loc>')
    for (const [language, href] of Object.entries(BAZI))
      expect(hant).toContain(`hreflang="${language}" href="${href}"`)
    // 有东方站英文版本（2026-11-21 发布）：x-default 指向英文版本
    expect(hant).toContain(`hreflang="x-default" href="${BAZI.en}"`)
    // 页面 head 的声明与站点地图相同
    const page = east.find((item) => item.locale === 'zh-Hans' && item.path === '/八字排盘')
    if (!page) throw new Error('Missing zh-Hans bazi page')
    const links = pageHead(page, EAST).links.filter((link) => link.rel === 'alternate')
    expect(links).toEqual([
      { rel: 'alternate', hrefLang: 'zh-Hant', href: BAZI['zh-Hant'] },
      { rel: 'alternate', hrefLang: 'zh-Hans', href: BAZI['zh-Hans'] },
      { rel: 'alternate', hrefLang: 'ko', href: BAZI.ko },
      { rel: 'alternate', hrefLang: 'ja', href: BAZI.ja },
      { rel: 'alternate', hrefLang: 'en', href: BAZI.en },
      { rel: 'alternate', hrefLang: 'x-default', href: BAZI.en },
    ])
    const west = sitemap(pages('west'), 'https://arcanumber.com')
    expect(west).toContain('<loc>https://arcanumber.com/life-path-number</loc>')
    expect(west).toContain('<loc>https://arcanumber.com/</loc>')
  })

  // 使用者 2026-11-20：东方站 `/` 是英文首页，en 与 x-default 都指向它
  it('首页 hreflang 簇：东方站各语言首页加英文首页 /，x-default 为 /', () => {
    expect(
      alternateLinks(EAST, '/', locales, undefined, 'ko').map((link) => [link.hrefLang, link.href]),
    ).toEqual([
      ['en', `${EAST}/`],
      ['zh-Hant', `${EAST}/zh-hant`],
      ['zh-Hans', `${EAST}/zh-hans`],
      ['ko', `${EAST}/ko`],
      ['ja', `${EAST}/ja`],
      ['x-default', `${EAST}/`],
    ])
    expect(
      alternateLinks(EAST, '/', locales, undefined, 'en').map((link) => [link.hrefLang, link.href]),
    ).toEqual([
      ['en', 'https://arcanumber.com/'],
      ['es', 'https://arcanumber.com/es'],
      ['x-default', 'https://arcanumber.com/'],
    ])
  })

  it('语言切换：八字排盤 ↔ 八字排盘 ↔ 만세력；Life Path 只在西方站；首页留在首页', () => {
    expect(switchLocalePath(encodeURI('/zh-hant/八字排盤'), 'zh-Hans', locales)).toBe('/八字排盘')
    expect(switchLocalePath(encodeURI('/zh-hans/八字排盘'), 'ko', locales)).toBe('/만세력')
    expect(switchLocalePath(encodeURI('/ko/만세력'), 'zh-Hant', locales)).toBe('/八字排盤')
    expect(switchLocalePath('/life-path-number', 'zh-Hant', locales)).toBe('/')
    expect(switchLocalePath('/zh-hant', 'ko', locales)).toBe('/')
    expect(switchLocalePath('/', 'en', locales)).toBe('/')
  })

  it('页头导航指向关键词 URL，不再以语言首页作为工具入口', () => {
    const paths = (site: 'east' | 'west', locale: string) =>
      Object.fromEntries(toolsForSite(site, locale).map((tool) => [tool.id, tool.path]))
    expect(paths('east', 'zh-Hant').bazi).toBe('/八字排盤')
    expect(paths('east', 'zh-Hans').bazi).toBe('/八字排盘')
    expect(paths('east', 'ko').bazi).toBe('/만세력')
    expect(paths('west', 'en')['life-path']).toBe('/life-path-number')
    for (const [site, locale] of [
      ['east', 'zh-Hant'],
      ['east', 'ko'],
      ['west', 'en'],
    ] as const)
      expect(Object.values(paths(site, locale))).not.toContain('/')
  })

  it('optin 邮件的结果链接指向主工具页', () => {
    const input = (locale: 'zh-Hant' | 'ko' | 'en') =>
      ({
        site: locale === 'en' ? 'west' : 'east',
        locale,
        sourceTool: locale === 'en' ? 'life-path' : locale === 'ko' ? 'manseryeok' : 'bazi',
        result:
          locale === 'en'
            ? { kind: 'numerology', lifePath: 7 }
            : { kind: 'bazi', dayMaster: 'geng' },
      }) as Parameters<typeof optinToolPath>[0]
    expect(optinToolPath(input('zh-Hant'), templateConfig)).toBe(encodeURI('/zh-hant/八字排盤'))
    expect(optinToolPath(input('ko'), templateConfig)).toBe(encodeURI('/ko/만세력'))
    expect(optinToolPath(input('en'), templateConfig)).toBe('/life-path-number')
  })
})

describe('首页与数字页的结构化数据', () => {
  it('首页输出 Organization 与 WebSite，WebSite 的地址为本页 canonical，韩语站名为간지데이', () => {
    const canonical = pageHead(staticPage('/', 'ko'), EAST).links.find(
      (link) => link.rel === 'canonical',
    )?.href
    expect(canonical).toBe(`${EAST}/ko`)
    expect(websiteData(EAST, '간지데이', canonical)).toMatchObject({
      '@type': 'WebSite',
      name: '간지데이',
      url: canonical,
    })
    expect(organizationData(EAST, '간지데이')).toMatchObject({ name: '간지데이', url: EAST })
  })

  it('数字页面包屑：Home › Life Path Number › n，各级地址为对应页面的 canonical', () => {
    const data = breadcrumbData(
      [
        { name: 'Home', path: '/' },
        { name: 'Life Path Number', path: '/life-path-number' },
        { name: '7', path: '/life-path-number/7' },
      ],
      'en',
    )
    expect(data['@type']).toBe('BreadcrumbList')
    expect(data.itemListElement.map((item) => [item.position, item.name, item.item])).toEqual([
      [1, 'Home', 'https://arcanumber.com/'],
      [2, 'Life Path Number', 'https://arcanumber.com/life-path-number'],
      [3, '7', 'https://arcanumber.com/life-path-number/7'],
    ])
  })
})
