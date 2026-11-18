import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseLocale, locales, overwriteGetLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('@tanstack/react-router', () => ({ useLocation: () => route }))
vi.mock('./preference.functions.ts', () => ({ saveLanguagePreference: vi.fn() }))

import { LanguageSuggestion } from './language-controls.tsx'
import { siteSuggestableLocales } from './site-suggestion.ts'
import { localePrefix } from './url-prefix.ts'

const preview = { id: 'west', known: false } as const
const candidates = locales.filter((locale) => locale !== baseLocale)
const banners = (html: string) =>
  html.match(/<aside\b[^>]*data-locale-suggestion-for="[^"]+"[^>]*>/g) ?? []

afterEach(() => {
  route.pathname = '/'
  overwriteGetLocale(() => baseLocale)
})

describe('语言建议浮层（首帧即在最终位置）', () => {
  it.skipIf(candidates.length === 0)(
    '默认语言营销页服务端输出每个候选语言的隐藏浮层与显示规则，由首帧前脚本选择显示哪一条',
    () => {
      for (const pathname of ['/', '/pricing']) {
        route.pathname = pathname
        const html = renderToString(<LanguageSuggestion site={preview} />)
        expect(banners(html)).toHaveLength(candidates.length)
        for (const banner of banners(html)) {
          expect(banner).toMatch(/class="hidden /)
          // 水合标记只在客户端 effect 中加上，服务端输出不带
          expect(banner).not.toContain('data-hydrated')
        }
        expect(html).toContain(`[data-locale-suggestion-for="${candidates[0]}"]{display:flex}`)
        // 「切换」是指向目标语言地址的真实链接（水合前、无 JS 也可用），两个按钮带委托监听识别的属性
        const target = `${localePrefix(candidates[0] ?? '')}${pathname === '/' ? '' : pathname}`
        expect(html).toMatch(
          new RegExp(`<a[^>]*href="${target}"[^>]*data-locale-suggestion-action="switch"`),
        )
        expect(html).toMatch(/<button[^>]*data-locale-suggestion-action="dismiss"/)
        // 横幅文案不进入搜索摘要
        expect(html.match(/<div data-nosnippet=""/g)).toHaveLength(candidates.length)
      }
    },
  )

  it('已登记站点只输出本站语言的浮层（两站分开经营），与首帧脚本取同一个可建议语言', () => {
    route.pathname = '/pricing'
    for (const id of ['west', 'east'] as const) {
      const own = templateConfig.sites[id].locales.filter((locale) => locale !== baseLocale)
      const html = renderToString(<LanguageSuggestion site={{ id, known: true }} />)
      expect(banners(html)).toHaveLength(own.length)
      expect(siteSuggestableLocales({ id, known: true }, '/pricing')).toEqual(
        templateConfig.sites[id].locales,
      )
    }
    // 未登记 Host 沿用模板默认（全部非默认语言），带语言前缀的页面不建议
    expect(siteSuggestableLocales(preview, '/pricing')).toBeUndefined()
    expect(siteSuggestableLocales(preview, localePrefix(baseLocale))).toEqual([])
  })

  it('非营销页、带语言前缀的页面与非默认语言页不输出浮层', () => {
    route.pathname = '/login'
    expect(banners(renderToString(<LanguageSuggestion site={preview} />))).toHaveLength(0)
    // 东方站英文入口页 `/en`：语言是默认语言但带前缀
    route.pathname = localePrefix(baseLocale)
    expect(
      banners(renderToString(<LanguageSuggestion site={{ id: 'east', known: true }} />)),
    ).toHaveLength(0)
    const other = candidates[0]
    if (other) {
      overwriteGetLocale(() => other)
      route.pathname = localePrefix(other)
      expect(banners(renderToString(<LanguageSuggestion site={preview} />))).toHaveLength(0)
    }
  })
})
