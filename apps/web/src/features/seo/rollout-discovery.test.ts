import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { eastHomeRedirect } from '../i18n/east-home.ts'
import { LOCALE_RELEASE } from '../i18n/rollout.ts'
import { routeSite } from '../site/gate.ts'
import { llmsTxt, robots, sitemap, sitemapIndex, sitemapLocales } from './crawlers.ts'
import { alternateLinks } from './metadata.ts'
import { publicPages } from './pages.ts'

/**
 * 未发布语言不可被发现（openspec add-locales-eu-ja 决策 5，specs/seo「未发布语言不可被发现」）。
 * 用真实配置验证各过滤点：把已上线的 `ko` 临时改为 pending，相当于「ko 尚未发布」，
 * 检查站点地图、hreflang、llms.txt、robots.txt、东方站根路径跳转与站点守卫都不再暴露它。
 */
const EAST = 'https://ganjiday.com'
const east = LOCALE_RELEASE.east as Record<string, string>

describe.runIf(templateConfig.i18n.enabled)('未发布语言不可被发现', () => {
  beforeEach(() => {
    east.ko = 'pending'
  })
  afterEach(() => {
    east.ko = 'released'
  })

  it('站点地图索引与子图不含未发布语言', () => {
    expect(sitemapLocales('east')).toEqual(['zh-Hant', 'zh-Hans', 'en'])
    expect(sitemapIndex('east')).not.toContain('/sitemap/ko.xml')
    const xml = sitemap(
      publicPages({ posts: [], legal: [], docs: [] }, new Date(), templateConfig, 'east'),
      EAST,
      'zh-Hant',
    )
    expect(xml).toContain('<loc>https://ganjiday.com/zh-hant</loc>')
    expect(xml).not.toContain('hreflang="ko"')
  })

  it('hreflang 不含未发布语言，x-default 不变；未发布语言页面自身保留自指', () => {
    const links = alternateLinks(EAST, '/', undefined, undefined, 'zh-Hant').map(
      (link) => link.hrefLang,
    )
    expect(links).toEqual(['zh-Hant', 'zh-Hans', 'en', 'x-default'])
    const own = alternateLinks(EAST, '/', undefined, undefined, 'ko').map((link) => link.hrefLang)
    expect(own).toContain('ko')
  })

  it('llms.txt 与 robots.txt 不列未发布语言', () => {
    const text = llmsTxt('east') ?? ''
    expect(text).toContain('## 繁體中文')
    expect(text).not.toContain('## 한국어')
    expect(text).not.toContain('/ko/')
    expect(robots(EAST)).not.toContain('Disallow: /ko/app')
    expect(robots(EAST)).toContain('Disallow: /zh-hant/app')
  })

  it('东方站根路径不跳到未发布语言；正式域名的前缀返回 404，本地主机放行', () => {
    const response = eastHomeRedirect(
      new Request(`${EAST}/`, { headers: { 'accept-language': 'ko-KR' } }),
      templateConfig,
    )
    expect(response?.headers.get('location')).toBe(`${EAST}/zh-hant`)
    expect(routeSite(new URL(`${EAST}/ko`), templateConfig)).toEqual({ kind: 'not-found' })
    expect(routeSite(new URL('http://east.localhost:3000/ko'), templateConfig)).toEqual({
      kind: 'pass',
      noindex: false,
    })
  })

  it('恢复为 released 后输出与现状相同', () => {
    east.ko = 'released'
    expect(sitemapLocales('east')).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'en'])
    expect(
      alternateLinks(EAST, '/', undefined, undefined, 'zh-Hant').map((link) => link.hrefLang),
    ).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'en', 'x-default'])
    expect(llmsTxt('east')).toContain('## 한국어')
  })
})
