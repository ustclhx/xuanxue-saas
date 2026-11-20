import { describe, expect, it } from 'vitest'
import { languageHref } from './language-links.ts'

const siteLocales = ['zh-Hant', 'zh-Hans', 'ko']

/**
 * 语言控件各项的地址（多语言 SEO 规范 ML-08：普通链接，指向该语言的对应页面）。
 */
describe('languageHref', () => {
  it('本页 hreflang 中有该语言：用声明的地址（工具页各语言路径不同）', () => {
    const alternates = new Map([
      ['zh-Hant', encodeURI('/zh-hant/塔羅')],
      ['zh-Hans', encodeURI('/zh-hans/塔罗')],
      ['ko', encodeURI('/ko/타로')],
    ])
    const page = {
      locale: 'zh-Hant',
      pathname: '/塔羅',
      publicPath: encodeURI('/zh-hant/塔羅'),
      alternates,
      siteLocales,
    }
    expect(languageHref({ ...page, target: 'ko' })).toBe(encodeURI('/ko/타로'))
    expect(languageHref({ ...page, target: 'zh-Hans' })).toBe(encodeURI('/zh-hans/塔罗'))
    expect(languageHref({ ...page, target: 'zh-Hant' })).toBe(encodeURI('/zh-hant/塔羅'))
    // 东方站英文只有首页
    expect(languageHref({ ...page, target: 'en' })).toBe('/')
  })

  it('东方站各语言首页与英文首页 / 互指', () => {
    const alternates = new Map([
      ['zh-Hant', '/zh-hant'],
      ['zh-Hans', '/zh-hans'],
      ['ko', '/ko'],
      ['en', '/'],
    ])
    const home = { locale: 'en', pathname: '/en', publicPath: '/', alternates, siteLocales }
    expect(languageHref({ ...home, target: 'en' })).toBe('/')
    expect(languageHref({ ...home, target: 'zh-Hant' })).toBe('/zh-hant')
  })

  it('本页没有该语言的版本：去该语言首页', () => {
    const alternates = new Map([
      ['zh-Hant', encodeURI('/zh-hant/紫微斗數排盤')],
      ['zh-Hans', encodeURI('/zh-hans/紫微斗数排盘')],
    ])
    const page = {
      locale: 'zh-Hant',
      pathname: '/紫微斗數排盤',
      publicPath: encodeURI('/zh-hant/紫微斗數排盤'),
      alternates,
      siteLocales,
    }
    expect(languageHref({ ...page, target: 'ko' })).toBe('/ko')
    expect(languageHref({ ...page, target: 'en' })).toBe('/')
  })

  it('认证页没有 hreflang：同一页面换语言前缀并保留查询参数；东方站没有英文认证页，English 去首页', () => {
    const login = {
      locale: 'zh-Hant',
      pathname: '/login',
      publicPath: '/zh-hant/login',
      search: '?redirect=%2Fapp',
      alternates: null,
      siteLocales,
    }
    expect(languageHref({ ...login, target: 'ko' })).toBe('/ko/login?redirect=%2Fapp')
    expect(languageHref({ ...login, target: 'zh-Hant' })).toBe('/zh-hant/login?redirect=%2Fapp')
    expect(languageHref({ ...login, target: 'en' })).toBe('/')
  })

  it('应用区与 404 没有语言版本：其他语言去语言首页，当前语言指向当前页（不带查询参数）', () => {
    const app = {
      locale: 'ko',
      pathname: '/app/personal',
      publicPath: '/app/personal',
      search: '?tab=reports',
      alternates: null,
      siteLocales,
    }
    expect(languageHref({ ...app, target: 'zh-Hant' })).toBe('/zh-hant')
    expect(languageHref({ ...app, target: 'ko' })).toBe('/app/personal')
    const missing = {
      locale: 'zh-Hant',
      pathname: '/no-such-page',
      publicPath: '/zh-hant/no-such-page',
      alternates: null,
      siteLocales,
    }
    expect(languageHref({ ...missing, target: 'zh-Hans' })).toBe('/zh-hans')
  })
})
