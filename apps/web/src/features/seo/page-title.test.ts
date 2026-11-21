import { describe, expect, it, vi } from 'vitest'
import { withRelease } from '../i18n/rollout-fixture.ts'
import { authPageHead, pageHead, staticPage, titleWithSite } from './metadata.ts'
import { siteTitle } from './site-title.ts'

// openspec separate-landing-homepage design.md D3a（specs/seo「页面标题带站名」）：
// 内页「<页面标题><分隔符><站名>」，首页站名在前、不再追加，同一标题中站名只出现一次。

const state = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => state.locale }
})

const titleOf = (head: { meta: readonly object[] }) =>
  head.meta.flatMap((item) => ('title' in item ? [item.title as string] : []))[0]
const content = (head: ReturnType<typeof pageHead>, key: string) =>
  head.meta.flatMap((item) =>
    ('property' in item && item.property === key) || ('name' in item && item.name === key)
      ? [item.content]
      : [],
  )[0]

describe('页面标题带站名', () => {
  it.each([
    ['zh-Hant', '價格方案：免費工具與積分包｜干支日'],
    ['zh-Hans', '价格方案：免费工具与积分包｜干支日'],
    ['ko', '요금 안내: 무료 도구와 크레딧 팩 | 간지데이'],
    ['en', 'Pricing: free tools and credit packs | Arcanumber'],
  ])('%s 内页按语言选择分隔符与站名，og / twitter 标题一致', (locale, title) => {
    const head = pageHead(staticPage('/pricing', locale), 'http://localhost')
    expect(titleOf(head)).toBe(title)
    expect(content(head, 'og:title')).toBe(title)
    expect(content(head, 'twitter:title')).toBe(title)
  })

  it.each([
    ['zh-Hant', '干支日｜免費八字排盤、紫微斗數與塔羅', '干支日'],
    ['zh-Hans', '干支日｜免费八字排盘、紫微斗数与塔罗', '干支日'],
    ['ko', '간지데이 | 무료 만세력·사주·타로', '간지데이'],
    // 西方站品类主词在前、站名在后（openspec seo-fix-tdk-links 决策 3）
    ['en', 'Numerology & Tarot Calculators, Free | Arcanumber', 'Arcanumber'],
  ])('%s 首页标题含站名，不再追加站名', (locale, title, brand) => {
    const head = pageHead(staticPage('/', locale), 'http://localhost')
    expect(titleOf(head)).toBe(title)
    expect(title.startsWith(brand) || title.endsWith(brand)).toBe(true)
    expect(title.split(brand)).toHaveLength(2)
    expect(content(head, 'og:title')).toBe(title)
  })

  it('标题已含站名时不重复追加；韩语页面不使用英文站名', () => {
    expect(titleWithSite('About Arcanumber', 'en')).toBe('About Arcanumber')
    expect(titleWithSite('關於干支日', 'zh-Hant')).toBe('關於干支日')
    expect(titleWithSite('사주궁합', 'ko')).toBe('사주궁합 | 간지데이')
    expect(titleWithSite('사주궁합', 'ko')).not.toContain('Ganjiday')
  })

  it('认证页标题带站名', () => {
    expect(titleOf(authPageHead('/login', 'zh-Hant', '登入'))).toBe('登入｜干支日')
    expect(titleOf(authPageHead('/login', 'ko', '로그인'))).toBe('로그인 | 간지데이')
    expect(titleOf(authPageHead('/login', 'en', 'Sign in'))).toBe('Sign in | Arcanumber')
  })

  it('应用区、账户页、后台与分享页用当前站点的站名：语言不属于本站时改用本站第一个语言', () => {
    const matches = (id: 'east' | 'west', known = true) => [
      { routeId: '__root__', loaderData: { site: { id, known } } },
    ]
    state.locale = 'zh-Hant'
    expect(siteTitle('我的報告', matches('east'))).toBe('我的報告｜干支日')
    state.locale = 'ko'
    expect(siteTitle('내 리포트', matches('east'))).toBe('내 리포트 | 간지데이')
    // 东方站应用区残留西方站语言的 Cookie：仍是东方站站名，不出现 Arcanumber
    state.locale = 'es'
    expect(siteTitle('Lecturas', matches('east'))).toBe('Lecturas｜干支日')
    state.locale = 'en'
    withRelease({ east: { en: 'pending' } }, () =>
      expect(siteTitle('Readings', matches('east'))).toBe('Readings｜干支日'),
    )
    // 东方站英文发布后（2026-11-21）en 是东方站语言，用东方站英文站名
    expect(siteTitle('Readings', matches('east'))).toBe('Readings | Ganjiday')
    expect(siteTitle('Readings', matches('west'))).toBe('Readings | Arcanumber')
    // 西方站残留东方站语言
    state.locale = 'ko'
    expect(siteTitle('Readings', matches('west'))).toBe('Readings | Arcanumber')
    // 未登记的 Host（预览环境）按语言取站名
    expect(siteTitle('내 리포트', matches('west', false))).toBe('내 리포트 | 간지데이')
    state.locale = 'en'
  })
})
